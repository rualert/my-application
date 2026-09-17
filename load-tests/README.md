# Нагрузочное тестирование

Сценарии на [k6](https://k6.io/), независимые от `MyApplication.Tests` (тот — .NET/xUnit,
это — отдельный JS-тулинг, аналогично `docs/`). Цель — найти максимальный RPS,
который сервис держит в каждом сценарии, без изменения кода приложения.

## Сценарии

- `scenarios/notes-list.js` — `GET /Notes` (список заметок).
- `scenarios/notes-get-by-id.js` — `GET /Notes/{id}` (заметка по идентификатору).

Оба перед стартом нагрузки сами создают `SEED_COUNT` заметок через `POST /Notes`
(`setup()`), чтобы тестировать не пустую базу, а реалистичный объём данных.

## Как это ищет максимальный RPS

Executor — [`ramping-arrival-rate`](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-arrival-rate/):
k6 ступенчато поднимает **целевой RPS** (не число VU — VU подстраиваются сами,
чтобы удержать заданный RPS даже при росте латентности). Ступени задаются в
`config.js` (`RAMP_STAGES`), по умолчанию 50 → 100 → 200 → 400 → 800 → 1200 RPS,
по 30 секунд на ступень.

В каждом сценарии заданы `thresholds`:

```js
thresholds: {
  http_req_failed: ['rate<0.01'],   // не больше 1% ошибок
  http_req_duration: ['p(95)<500'], // p95 не больше 500 мс
}
```

**Максимальный RPS — это последняя ступень, на которой оба порога ещё
выполняются.** k6 не остановит тест сам при нарушении порога (если явно не
включить `abortOnFail` у порога) — тест доходит до конца, а по summary/логам
видно, на какой именно ступени (по времени от начала прогона) пороги
перестали выполняться. Смотрите вывод `THRESHOLDS`, а для точной привязки
нарушения к ступени — метрики с разбивкой по времени (`--out` в файл/InfluxDB/
Grafana Cloud, если нужна такая детализация).

## Запуск

Нужны поднятые окружение и приложение (см. корневой `README.md`, разделы
1–3): `docker-compose.elk.yml` → `docker-compose.db.yml` → `docker-compose.app.yml`.

Через Docker-образ k6 (ничего дополнительно ставить не нужно):

```bash
docker run --rm -i \
  -e BASE_URL=http://host.docker.internal:8080 \
  -v "$(pwd)/load-tests:/load-tests" \
  -w /load-tests \
  grafana/k6 run scenarios/notes-list.js

docker run --rm -i \
  -e BASE_URL=http://host.docker.internal:8080 \
  -v "$(pwd)/load-tests:/load-tests" \
  -w /load-tests \
  grafana/k6 run scenarios/notes-get-by-id.js
```

`host.docker.internal` — адрес хоста из контейнера k6 (работает в Docker
Desktop на Windows/Mac; на Linux вместо этого добавьте `--add-host=host.docker.internal:host-gateway`
или подключите контейнер к сети `elastic` и используйте `http://myapplication-api:8080`).

Если k6 установлен локально — то же самое, без Docker:

```bash
BASE_URL=http://localhost:8080 k6 run load-tests/scenarios/notes-list.js
```

### Быстрый прогон для проверки (не для поиска реального потолка)

```bash
docker run --rm -i \
  -e BASE_URL=http://host.docker.internal:8080 \
  -e SEED_COUNT=5 \
  -e STAGE_DURATION=5s \
  -e STAGE_TARGETS=10,20 \
  -v "$(pwd)/load-tests:/load-tests" \
  -w /load-tests \
  grafana/k6 run scenarios/notes-list.js
```

## Настройка через переменные окружения

| Переменная | По умолчанию | Что делает |
|---|---|---|
| `BASE_URL` | `http://localhost:8080` | Адрес API |
| `SEED_COUNT` | `50` | Сколько заметок создать перед стартом нагрузки |
| `STAGE_DURATION` | `30s` | Длительность каждой ступени роста RPS |
| `STAGE_TARGETS` | `50,100,200,400,800,1200` | Целевые RPS по ступеням, через запятую |
| `MAX_VUS` | `2000` | Потолок VU, которые k6 может выделить под целевой RPS |
