# MyApplication

ASP.NET Core Web API (.NET 10). Logs are written via [Serilog](https://serilog.net/) directly to Elasticsearch (ECS format) and can be explored in Kibana.

The application and the logging environment (Elasticsearch + Kibana) are deployed as **separate, independent Docker Compose stacks**, each with its own image(s):

- `docker-compose.elk.yml` — the **environment**: Elasticsearch + Kibana.
- `docker-compose.app.yml` — the **application**: `myapplication-api` only.

They communicate over a shared external Docker network (`elastic`). Either stack can be built, deployed, restarted, or torn down without touching the other, as long as the network exists.

## Requirements

- [.NET 10 SDK](https://dotnet.microsoft.com/download) — for running the API locally
- [Docker](https://www.docker.com/) + Docker Compose — for running in containers

## 1. Start the environment (Elasticsearch + Kibana)

From the repository root:

```bash
docker compose -f docker-compose.elk.yml up -d
```

This creates the external `elastic` network (if it doesn't exist yet) and starts:

- **Elasticsearch** — `http://localhost:9200`
- **Kibana** — `http://localhost:5601`

This stack has no dependency on the application and can be deployed/updated on its own.

```bash
docker compose -f docker-compose.elk.yml ps
docker compose -f docker-compose.elk.yml down      # stop, keep data
docker compose -f docker-compose.elk.yml down -v   # stop and wipe Elasticsearch data
```

## 2. Run the API

### Option A — locally with `dotnet run`

Requires the environment stack (step 1) to be up, since the app ships logs to Elasticsearch at `http://localhost:9200` by default (see `Elasticsearch:Uri` in `appsettings.json`).

From `src/MyApplication/`:

```bash
dotnet restore
dotnet run --project MyApplication.Api
```

The API will be available at `http://localhost:5184` (see `MyApplication.Api/Properties/launchSettings.json` for the full list of profiles/ports). Logs go to the console and to the `logs-myapplication-api-development` data stream in Elasticsearch.

### Option B — as its own Docker Compose stack (independent of the environment)

Requires the `elastic` network to already exist, i.e. the environment stack (step 1) must be started at least once first.

From the repository root:

```bash
docker compose -f docker-compose.app.yml up -d --build
```

The API will be available at `http://localhost:8080`, joins the `elastic` network, and ships logs to `elasticsearch:9200` (`logs-myapplication-api-production`).

```bash
docker compose -f docker-compose.app.yml logs -f myapplication-api
docker compose -f docker-compose.app.yml down     # stop/remove the app only, environment keeps running
docker compose -f docker-compose.app.yml up -d --build   # rebuild/redeploy the app only
```

### Option C — single container via plain `docker` (no Compose, no logging stack)

```bash
docker build -t myapplication-api .
docker run -d --name myapplication-api -p 8080:8080 myapplication-api
```

Without an `Elasticsearch__Uri` pointing at a reachable cluster, log shipping to Elasticsearch will simply fail to connect (the app itself keeps running); logs are still visible via `docker logs -f myapplication-api`.

## Viewing logs in Kibana

Logs are written to the Elasticsearch data stream `logs-myapplication-api-<environment>` (e.g. `logs-myapplication-api-development` for local `dotnet run`, `logs-myapplication-api-production` when run via `docker-compose.app.yml`), in [Elastic Common Schema](https://www.elastic.co/guide/en/ecs/current/index.html) format.

1. Open Kibana at `http://localhost:5601`.
2. Go to **Stack Management → Data Views** (or **Discover**, which offers to create one for you) and create a data view/index pattern matching `logs-*` with `@timestamp` as the time field.
3. Open **Discover** and select that data view to search and filter logs. Useful fields: `log.level`, `message`, `service.name`, `event.action`, `http.request.id`.

## Logging configuration

Logging is configured in `MyApplication.Api/Program.cs` via `Serilog` + `Elastic.Serilog.Sinks`:

- Writes structured logs to the console (visible via `docker logs` / the local terminal).
- Ships the same logs to Elasticsearch as ECS documents, into a data stream named `logs-myapplication-api-{environment}`.
- The Elasticsearch endpoint is configurable via `Elasticsearch:Uri` in `appsettings.json` (defaults to `http://localhost:9200`, used for local runs), or overridden via the `Elasticsearch__Uri` environment variable (set to `http://elasticsearch:9200` in `docker-compose.app.yml`).
