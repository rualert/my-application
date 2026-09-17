# MyApplication

ASP.NET Core Web API (.NET 10). Логи пишутся через [Serilog](https://serilog.net/) напрямую в Elasticsearch (формат ECS), а каждый запрос трассируется через [OpenTelemetry](https://opentelemetry.io/) — и то, и другое можно смотреть в Kibana. Данные (сейчас — заметки) хранятся в PostgreSQL.

Приложение и его окружение (логи/трейсинг, база данных) разворачиваются как **отдельные, независимые Docker Compose стеки**, каждый со своим образом(-ами):

- `docker-compose.elk.yml` — **логи и трейсинг**: Elasticsearch + Kibana + APM Server.
- `docker-compose.db.yml` — **база данных**: PostgreSQL.
- `docker-compose.app.yml` — **приложение**: только `myapplication-api`.

Они взаимодействуют через общую внешнюю Docker-сеть (`elastic`) — сеть создаётся первым из стеков, `docker-compose.elk.yml`. Любой из стеков можно собрать, развернуть, перезапустить или остановить, не трогая другие — при условии, что сеть уже существует. Есть одно исключение: в отличие от логов/трейсов (которые просто отключаются, если недоступны), при старте приложение применяет миграции EF Core к базе, поэтому PostgreSQL должен быть поднят и доступен **до** запуска приложения — иначе оно не стартует.

## Требования

- [.NET 10 SDK](https://dotnet.microsoft.com/download) — для локального запуска API
- [Docker](https://www.docker.com/) + Docker Compose — для запуска в контейнерах

## 1. Запуск логов и трейсинга (Elasticsearch + Kibana + APM Server)

Из корня репозитория:

```bash
docker compose -f docker-compose.elk.yml up -d
```

Эта команда создаёт внешнюю сеть `elastic` (если её ещё нет) и запускает:

- **Elasticsearch** — `http://localhost:9200`
- **Kibana** — `http://localhost:5601`
- **APM Server** — `http://localhost:8200` (принимает трейсы по OTLP и пишет их в Elasticsearch)

Этот стек никак не зависит от приложения и может разворачиваться/обновляться сам по себе.

```bash
docker compose -f docker-compose.elk.yml ps
docker compose -f docker-compose.elk.yml down      # остановить, данные сохраняются
docker compose -f docker-compose.elk.yml down -v   # остановить и стереть данные Elasticsearch
```

## 2. Запуск базы данных (PostgreSQL)

Требует, чтобы сеть `elastic` уже существовала (создаётся шагом 1).

```bash
docker compose -f docker-compose.db.yml up -d
```

Поднимает PostgreSQL на `localhost:5432` (база `myapplication`, пользователь/пароль `myapplication`/`myapplication` — см. `docker-compose.db.yml`). Схему создавать не нужно — приложение само применяет миграции EF Core при старте.

```bash
docker compose -f docker-compose.db.yml ps
docker compose -f docker-compose.db.yml down      # остановить, данные сохраняются
docker compose -f docker-compose.db.yml down -v   # остановить и стереть данные Postgres
```

## 3. Запуск API

### Вариант A — локально через `dotnet run`

Требует, чтобы окружение (шаги 1–2) было поднято: приложение по умолчанию отправляет логи в Elasticsearch на `http://localhost:9200`, трейсы в APM Server на `http://localhost:8200`, и **обязательно** подключается к PostgreSQL на `localhost:5432` (без него не стартует — см. `Elasticsearch:Uri` / `OpenTelemetry:OtlpEndpoint` / `ConnectionStrings:Notes` в `appsettings.json`).

Из `src/MyApplication/`:

```bash
dotnet restore
dotnet run --project MyApplication.Api
```

API будет доступен по адресу `http://localhost:5184` (полный список профилей/портов — в `MyApplication.Api/Properties/launchSettings.json`). Логи идут в консоль и в data stream `logs-myapplication-api-development` в Elasticsearch.

Интерактивная документация API ([Scalar](https://scalar.com/)) — `http://localhost:5184/scalar`, поверх OpenAPI-документа `http://localhost:5184/openapi/v1.json`. Доступна **только в среде Development** (т.е. только при локальном `dotnet run` — в Docker-образе `ASPNETCORE_ENVIRONMENT=Production`, там эти два адреса не смаплены).

### Вариант B — отдельным Docker Compose стеком (независимо от окружения)

Требует, чтобы сеть `elastic` уже существовала и сервис `postgres` (шаг 2) был поднят и доступен.

Из корня репозитория:

```bash
docker compose -f docker-compose.app.yml up -d --build
```

API будет доступен по адресу `http://localhost:8080`, подключается к сети `elastic`, отправляет логи на `elasticsearch:9200` (`logs-myapplication-api-production`), трейсы на `apm-server:8200` и подключается к БД на `postgres:5432`.

```bash
docker compose -f docker-compose.app.yml logs -f myapplication-api
docker compose -f docker-compose.app.yml down     # остановить/удалить только приложение, окружение продолжает работать
docker compose -f docker-compose.app.yml up -d --build   # пересобрать/передеплоить только приложение
```

### Вариант C — один контейнер через обычный `docker` (без Compose, без стека логирования)

```bash
docker build -t myapplication-api .
docker run -d --name myapplication-api -p 8080:8080 \
  -e ConnectionStrings__Notes="Host=host.docker.internal;Port=5432;Database=myapplication;Username=myapplication;Password=myapplication" \
  myapplication-api
```

Без `Elasticsearch__Uri`, указывающего на доступный кластер, отправка логов в Elasticsearch просто не будет подключаться (само приложение при этом продолжает работать); логи всё равно видны через `docker logs -f myapplication-api`. А вот `ConnectionStrings__Notes` обязателен и должен указывать на реально доступный из контейнера PostgreSQL — без него приложение упадёт при старте на этапе применения миграций.

## Просмотр логов в Kibana

Логи пишутся в data stream Elasticsearch `logs-myapplication-api-<environment>` (например, `logs-myapplication-api-development` при локальном `dotnet run`, `logs-myapplication-api-production` при запуске через `docker-compose.app.yml`), в формате [Elastic Common Schema](https://www.elastic.co/guide/en/ecs/current/index.html).

1. Откройте Kibana по адресу `http://localhost:5601`.
2. Перейдите в **Stack Management → Data Views** (или в **Discover**, который сам предложит создать data view) и создайте data view/index pattern по маске `logs-*` с полем времени `@timestamp`.
3. Откройте **Discover** и выберите этот data view для поиска и фильтрации логов. Полезные поля: `log.level`, `message`, `service.name`, `event.action`, `http.request.id`.

## Просмотр трейсов в Kibana

Каждый входящий HTTP-запрос получает трейс в формате [W3C Trace Context](https://www.w3.org/TR/trace-context/), а каждый исходящий вызов через `HttpClient` (к Elasticsearch, к другому сервису и т. д.) становится дочерним спаном этого же трейса — заголовок `traceparent` прокидывается автоматически. Таким образом по одному trace ID можно проследить, как один логический запрос перемещался между системами и сколько времени занял каждый переход.

1. Откройте Kibana по адресу `http://localhost:5601`.
2. Перейдите в **Observability → APM**, чтобы увидеть сервисы, транзакции (например, `GET Notes`), throughput и latency.
3. Откройте транзакцию, чтобы увидеть полный waterfall — включая все исходящие HTTP-вызовы, сделанные при её обработке, с их собственной длительностью.

Строки логов помечены тем же `trace.id`/`span.id`, что и трейс (автообогащение ECS), поэтому из строки лога в **Discover** можно перейти сразу к её трейсу в **APM**, и наоборот.

## Настройка логирования и трассировки

Обе настроены в `MyApplication.Api/Program.cs`:

- **Логирование** — `Serilog` + `Elastic.Serilog.Sinks`: пишет структурированные логи в консоль (видны через `docker logs` / локальный терминал) и отправляет те же логи в Elasticsearch как ECS-документы, в data stream с именем `logs-myapplication-api-{environment}`. Адрес задаётся через `Elasticsearch:Uri` в `appsettings.json` (по умолчанию `http://localhost:9200`) или переменную окружения `Elasticsearch__Uri` (в `docker-compose.app.yml` указана как `http://elasticsearch:9200`).
- **Трассировка** — `OpenTelemetry` с инструментацией ASP.NET Core и `HttpClient`, экспорт по OTLP в APM Server. Адрес задаётся через `OpenTelemetry:OtlpEndpoint` в `appsettings.json` (по умолчанию `http://localhost:8200`) или переменную окружения `OpenTelemetry__OtlpEndpoint` (в `docker-compose.app.yml` указана как `http://apm-server:8200`). Если адрес не задан/недоступен, трассировка просто отключается — приложение не падает.

**При добавлении новой исходящей интеграции (клиент БД, продюсер/консьюмер очереди сообщений, вызов другого HTTP-сервиса) нужно в том же изменении подключить соответствующую OpenTelemetry-инструментацию** (например, `OpenTelemetry.Instrumentation.EntityFrameworkCore`/`Npgsql.OpenTelemetry` для Postgres или подходящий пакет инструментации для клиента очереди), чтобы новый переход между системами не стал слепой зоной в трейсе.

## База данных (PostgreSQL / EF Core)

Приложение хранит данные (сейчас — заметки, `src/MyApplication/MyApplication.Infrastructure/Notes/`) в PostgreSQL через EF Core (`Npgsql.EntityFrameworkCore.PostgreSQL`). Строка подключения задаётся через `ConnectionStrings:Notes` в `appsettings.json` (по умолчанию `localhost:5432`) или переменную окружения `ConnectionStrings__Notes` (в `docker-compose.app.yml` указана как `postgres:5432`).

При старте приложение само применяет непримененные миграции (`Database.MigrateAsync()` в `Program.cs`) — отдельно накатывать схему вручную не нужно, но PostgreSQL должен быть доступен на момент старта.

Добавление новой миграции после изменения сущностей в `MyApplication.Domain`/маппинга в `MyApplication.Infrastructure`:

```bash
cd src/MyApplication
dotnet ef migrations add <Название> \
  --project MyApplication.Infrastructure \
  --startup-project MyApplication.Api \
  --output-dir Notes/Migrations
```

Требует установленного `dotnet-ef` (`dotnet tool install --global dotnet-ef`), версия которого должна соответствовать версии EF Core в проекте.

## Документация по бизнес-логике

Папка `docs/` — это отдельный сайт на [Docusaurus](https://docusaurus.io/), документирующий **бизнес-логику** приложения (сценарии использования, бизнес-правила, контракты API) в виде дерева статей — отдельно от этого README, который описывает сборку/запуск/деплой.

```bash
cd docs
npm install --global=false   # см. docs/.npmrc: в некоторых окружениях npm install по умолчанию ставит пакеты глобально/не туда
npm start                    # дев-сервер с live reload, http://localhost:3000
npm run build                # статическая сборка сайта в docs/build/
```

Также сайт автоматически публикуется по адресу **https://rualert.github.io/my-application/** — workflow `.github/workflows/deploy-docs.yml` собирает и деплоит `docs/` в GitHub Pages при каждом пуше в `master`, затрагивающем `docs/**` (либо запускается вручную во вкладке Actions). Требует, чтобы в репозитории был включён GitHub Pages с **Settings → Pages → Source: GitHub Actions** (разовая настройка, сам workflow этого сделать не может).

## Тесты

Тесты лежат в отдельном проекте `MyApplication.Tests` (xUnit), не публикуемом и не попадающем в Docker-образ. Разные виды тестов разложены по отдельным директориям верхнего уровня внутри проекта:

- `ArchitectureTests/` — архитектурные тесты на структурные правила решения (например: все исключения в решении должны быть унаследованы от `DomainException`).
- `UseCasesTests/` — тесты пользовательских сценариев: одна папка на крупную фичу (например, `Notes/`), один файл на сценарий внутри неё (`CreateNoteTests.cs`, `GetNoteByIdTests.cs` и т. д.). Тестируют сервисы Application-слоя как чёрный ящик — только через публичный интерфейс, без опоры на детали реализации. Репозиторий (порт Application-слоя, например `INoteRepository`) не мокается и не подменяется фейком — используется настоящая реализация из Infrastructure (`NoteRepository`), чтобы её собственная логика тоже проверялась тестами. Подменяется только сама база данных — вместо PostgreSQL используется провайдер EF Core InMemory.
- `SmokeTests/` — по одному файлу на крупную фичу (например, `NotesSmokeTests.cs`), только blue sky сценарии — по одному на операцию. Тестируют весь сервис целиком как чёрный ящик: реальные HTTP-запросы к приложению, поднятому через `WebApplicationFactory<Program>`, без подмены компонентов — кроме самой базы данных. База — настоящий PostgreSQL в контейнере через Testcontainers, один контейнер на всю сессию тестов; между сценариями данные чистит [Respawn](https://github.com/jbogard/Respawn) (сам определяет таблицы по схеме — ничего вручную поддерживать не нужно).

Стилистические соглашения (для `UseCasesTests`/`SmokeTests`): вспомогательные классы (фикстуры, базовые классы — всё без `[Fact]`/`[Theory]`) лежат в подпапке `Harness/`; переменная/свойство с тестируемой системой всегда называется `Sut`; тело каждого теста размечено комментариями `// Arrange`, `// Act`, `// Assert`.

Из `src/MyApplication/`:

```bash
dotnet test
```

Для `ArchitectureTests`/`UseCasesTests` нужен только .NET SDK. Для `SmokeTests` дополнительно нужен запущенный Docker (поднимает временный PostgreSQL через Testcontainers).

## Нагрузочное тестирование

Сценарии на [k6](https://k6.io/) в `load-tests/` (отдельный от `MyApplication.Tests` JS-тулинг, по аналогии с `docs/`) — ищут максимальный RPS, который держит сервис, по одному сценарию на операцию (`GET /Notes`, `GET /Notes/{id}`, `POST /Notes`). Результаты смотрятся в Grafana (дашборд поднимается вместе с `docker-compose.load-tests.yml`, InfluxDB — хранилище метрик k6). Подробности и команды запуска — в [`load-tests/README.md`](load-tests/README.md).
