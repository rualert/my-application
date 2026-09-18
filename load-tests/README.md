# Нагрузочное тестирование

Сценарии на [k6](https://k6.io/), независимые от `MyApplication.Tests` (тот — .NET/xUnit,
это — отдельный JS-тулинг, аналогично `docs/`). Цель — найти максимальный RPS,
который сервис держит в каждом сценарии, без изменения кода приложения.

## Сценарии

- `scenarios/notes-list.js` — `GET /Notes` (список заметок).
- `scenarios/notes-get-by-id.js` — `GET /Notes/{id}` (заметка по идентификатору).
- `scenarios/notes-create.js` — `POST /Notes` (создание заметки). В отличие от
  двух других, здесь сама нагрузка и есть запись в базу — `SEED_COUNT` лишь
  создаёт исходный объём данных перед стартом (запись может замедляться с
  ростом таблицы/индексов), а не является предметом теста.

Все три перед стартом нагрузки сами создают `SEED_COUNT` заметок через
`POST /Notes` (`setup()`), чтобы тестировать не пустую базу, а реалистичный
объём данных. Запросы отправляются пачками через `http.batch()` (`lib/seed.js`),
а не по одному — иначе при большом `SEED_COUNT` (тысячи заметок) `setup()` не
укладывается в таймаут k6 (`setupTimeout`, поднят до 5 минут в `options`
каждого сценария) и весь прогон падает с `setup() execution timed out`, так
и не начав генерировать нагрузку — снаружи это выглядит так, будто
`SEED_COUNT` «не применился».

## Авторизация

`/Notes` защищён JWT-авторизацией и приватен по пользователю (см.
`NotesController`/`NoteService` в основном `CLAUDE.md`) — каждый сценарий
логинится один раз в `setup()` (`lib/auth.js`, `loginLoadTestUser()`) через
настоящий `POST /Auth/google` и дальше прикладывает `Authorization: Bearer`
ко всем запросам (сидированию и самой нагрузке) от имени одного и того же
пользователя. Настоящий Google недоступен/не нужен для измерения RPS, поэтому
изолированный стенд (`ci/docker-compose.load-tests-db.yml`) запускает API с
`ASPNETCORE_ENVIRONMENT=LoadTest`, при котором `Program.cs` подменяет
`IGoogleIdTokenValidator` двойником (`LoadTestGoogleIdTokenValidator`),
выводящим профиль прямо из переданного `idToken` — тот же приём, что и в
смок-тестах для `FakeGoogleIdTokenValidator`. Access token живёт на весь
прогон без обновления, поэтому у изолированного стенда `Jwt:AccessTokenLifetimeMinutes`
поднят до 60 минут — если когда-нибудь понадобится гонять ступени дольше
этого времени суммарно, либо увеличьте это значение, либо добавьте в
сценарии повторный логин/`POST /Auth/refresh`.

**Этот механизм — только для изолированного нагрузочного стенда.** Если
запускать сценарии вручную против обычного dev-стека (`ci/docker-compose.app.yml`,
вариант B ниже), там `ASPNETCORE_ENVIRONMENT=Production` и настоящий
`GoogleIdTokenValidator` — фиктивный `idToken` из `lib/auth.js` там получит
401, и сценарий упадёт в `setup()`.

## Как это ищет максимальный RPS

Executor — [`ramping-arrival-rate`](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-arrival-rate/):
k6 ступенчато поднимает **целевой RPS** (не число VU — VU подстраиваются сами,
чтобы удержать заданный RPS даже при росте латентности). Ступени задаются в
`config.js` (`RAMP_STAGES`), по умолчанию 50 → 100 → 200 → 400 → 800 → 1200 RPS,
по 30 секунд на ступень.

В каждом сценарии заданы `thresholds`:

```js
thresholds: {
  http_req_failed: ['rate<0.01'],  // не больше 1% ошибок
  http_req_duration: ['p(99)<500'], // p99 не больше 500 мс
}
```

**Максимальный RPS — это последняя ступень, на которой оба порога ещё
выполняются.** k6 не остановит тест сам при нарушении порога (если явно не
включить `abortOnFail` у порога) — тест доходит до конца.

Чтобы узнать именно эту ступень, а не только факт «где-то что-то нарушилось»,
каждый запрос тегируется текущей целевой ступенью (`stage_rps`,
`lib/stageThresholds.js`), а `thresholds` объявляются не только для всего
прогона целиком, но и отдельно для каждой ступени (сабметрики вида
`http_req_duration{stage_rps:400}`). В конце прогона `handleSummary()`
(`lib/maxRpsSummary.js`) проходит по этим сабметрикам и **печатает в консоль
строку вида `Maximum RPS satisfying thresholds: 400`** — искать ступень
глазами по обычной сводке не нужно. Подробная картина по времени (когда
именно латентность/ошибки поползли вверх) всё равно удобнее смотрится на
дашборде — см. ниже.

Тот же результат дописывается строкой в markdown-таблицу `results/<сценарий>.md`
(дата, максимальный RPS, использованные `thresholds`, `SEED_COUNT`) — история
прогонов по каждому сценарию в git, а не только в терминале/Grafana (у
InfluxDB нет retention-политики "хранить вечно"). Thresholds и seed count
записываются вместе с RPS специально: одна и та же цифра RPS означает разное
в зависимости от того, при каких порогах и объёме данных она получена, а
они могут меняться между прогонами — см. `results/notes-list.md`,
`results/notes-get-by-id.md`, `results/notes-create.md`.

## Изолированная БД для прогона

`SEED_COUNT` создаёт тысячи тестовых заметок — если гонять нагрузку на
обычный dev-стек (`ci/docker-compose.db.yml` + `ci/docker-compose.app.yml`), эти
заметки останутся там навсегда и засорят базу, которой пользуются
разработка/`SmokeTests`/что угодно ещё. Поэтому для load-тестов поднимается
**отдельный, полностью изолированный стек** — своя БД и свой инстанс
приложения (`ci/docker-compose.load-tests-db.yml`, порты 5433/8081, чтобы не
конфликтовать с dev-стеком на 5432/8080) — который живёт ровно на время
одного прогона.

**PowerShell-скрипты (`load-tests/scripts/`) делают это автоматически**:
поднимают стек, ждут готовности приложения, гоняют сценарий, затем удаляют
стек вместе с томом данных (`docker compose ... down -v`) — даже если сам
прогон упал с ошибкой. Поэтому для них `ci/docker-compose.db.yml` /
`ci/docker-compose.app.yml` (обычный dev-стек) **не требуются вообще** — нужен
только `ci/docker-compose.load-tests.yml` (шаг 1 ниже). Посмотреть, что осталось
в изолированной базе после прогона (не удаляя её сразу) — флаг `-KeepDb`,
удалить вручную потом:
`docker compose -p myapplication-load-tests -f ci/docker-compose.load-tests-db.yml down -v`.

## Запуск

### 1. Поднять InfluxDB + Grafana для результатов

```bash
docker compose -f ci/docker-compose.load-tests.yml up -d
```

Создаёт отдельный стек (не зависит от окружения приложения):

- **InfluxDB** — `http://localhost:8086`, база `k6`, сюда k6 пишет метрики прогона.
- **Grafana** — `http://localhost:3000` (анонимный доступ, без логина — это чисто
  локальный просмотрщик результатов), datasource и дашборд **«k6 Load Testing
  Results»** подключаются автоматически при первом старте (provisioning из
  `load-tests/grafana/`) — ничего настраивать вручную не нужно.

### 2. Прогнать сценарий с отправкой метрик в InfluxDB

#### Вариант A — PowerShell-скрипты (Windows)

```powershell
cd load-tests/scripts
./Invoke-NotesListScenario.ps1
./Invoke-NotesGetByIdScenario.ps1
./Invoke-NotesCreateScenario.ps1
```

Тонкие обёртки над `Invoke-K6Scenario.ps1`, который сам поднимает изолированный
стек БД/приложения (см. выше), ждёт его готовности, делает `docker run` ниже
(со всеми теми же параметрами — `-BaseUrl`, `-Network`, `-SeedCount`,
`-StageDuration`, `-StageTargets`, `-KeepDb`, ...) и удаляет стек после.
Справка: `Get-Help ./Invoke-NotesListScenario.ps1 -Full`.

#### Вариант B — напрямую через Docker-образ k6

**В отличие от варианта A, изолированный стек здесь сам себя не поднимает и
не удаляет** — либо поднимите его вручную (`docker compose -p myapplication-load-tests
-f ci/docker-compose.load-tests-db.yml up -d --build`, порт приложения — 8081,
не забудьте потом `down -v`), либо явно нацельтесь на обычный dev-стек,
понимая, что `SEED_COUNT` останется там навсегда.

Подключенный к сети стека из шага 1 (`myapplication-load-tests-infra_default` —
имя сети по умолчанию для `ci/docker-compose.load-tests.yml` в этом репозитории
(имя проекта `myapplication-load-tests-infra`); проверить точное имя:
`docker network ls`):

```bash
docker run --rm -i \
  --network myapplication-load-tests-infra_default \
  -e BASE_URL=http://host.docker.internal:8081 \
  -v "$(pwd)/load-tests:/load-tests" \
  -w /load-tests \
  grafana/k6 run --out influxdb=http://influxdb:8086/k6 scenarios/notes-list.js

docker run --rm -i \
  --network myapplication-load-tests-infra_default \
  -e BASE_URL=http://host.docker.internal:8081 \
  -v "$(pwd)/load-tests:/load-tests" \
  -w /load-tests \
  grafana/k6 run --out influxdb=http://influxdb:8086/k6 scenarios/notes-get-by-id.js

docker run --rm -i \
  --network myapplication-load-tests-infra_default \
  -e BASE_URL=http://host.docker.internal:8081 \
  -v "$(pwd)/load-tests:/load-tests" \
  -w /load-tests \
  grafana/k6 run --out influxdb=http://influxdb:8086/k6 scenarios/notes-create.js
```

`host.docker.internal` — адрес хоста из контейнера k6 (работает в Docker
Desktop на Windows/Mac; на Linux вместо этого добавьте `--add-host=host.docker.internal:host-gateway`).

Если k6 установлен локально — то же самое, без Docker (InfluxDB тогда доступен
на `localhost:8086`, как опубликовано в `ci/docker-compose.load-tests.yml`):

```bash
BASE_URL=http://localhost:8081 k6 run --out influxdb=http://localhost:8086/k6 load-tests/scenarios/notes-list.js
```

### 3. Посмотреть результаты

Откройте `http://localhost:3000` → **Dashboards** → **k6 Load Testing Results**
(Grafana не хранит свои данные в томе — только InfluxDB, см. `ci/docker-compose.load-tests.yml`
— поэтому конкретный URL дашборда `/d/<uid>/...` каждый раз после пересоздания
контейнера меняется; открывайте через список дашбордов, а не по старой ссылке).
Графики RPS, латентности и виртуальных пользователей по времени прогона.
Разброс задержки в момент, когда p95 начинает уходить вверх, и совпадает по
времени со ступенью в `STAGE_TARGETS`/`STAGE_DURATION`, — это и есть искомый
максимальный RPS.

### Быстрый прогон для проверки (не для поиска реального потолка)

PowerShell:

```powershell
./Invoke-NotesListScenario.ps1 -SeedCount 5 -StageDuration 5s -StageTargets 10,20
```

Docker напрямую (изолированный стек уже должен быть поднят вручную — см. вариант B выше):

```bash
docker run --rm -i \
  --network myapplication-load-tests-infra_default \
  -e BASE_URL=http://host.docker.internal:8081 \
  -e SEED_COUNT=5 \
  -e STAGE_DURATION=5s \
  -e STAGE_TARGETS=10,20 \
  -v "$(pwd)/load-tests:/load-tests" \
  -w /load-tests \
  grafana/k6 run --out influxdb=http://influxdb:8086/k6 scenarios/notes-list.js
```

## Настройка через переменные окружения

| Переменная | По умолчанию | Что делает |
|---|---|---|
| `BASE_URL` | `http://localhost:8081` (изолированный инстанс, см. выше) | Адрес API |
| `SEED_COUNT` | `50` | Сколько заметок создать перед стартом нагрузки |
| `STAGE_DURATION` | `30s` | Длительность каждой ступени роста RPS |
| `STAGE_TARGETS` | `50,100,200,400,800,1200` | Целевые RPS по ступеням, через запятую |
| `MAX_VUS` | `2000` | Потолок VU, которые k6 может выделить под целевой RPS |
