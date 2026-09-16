# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

The solution `src/MyApplication/MyApplication.sln` has three projects: `MyApplication.Api` (Presentation), `MyApplication.Application` (Application layer), and `MyApplication.Infrastructure` (Infrastructure layer — currently empty, no external integrations exist yet). There is no test project, and no Domain project yet — see the architecture rules below for how the solution should be structured as those are added.

## Structure

- `README.md` — run instructions (local + Docker + Docker Compose/ELK + tracing + docs site).
- `docs/` — a separate [Docusaurus](https://docusaurus.io/) site documenting the application's **business logic** (use cases/business rules/API contracts), independent of this repo's technical README/CLAUDE.md. Content lives under `docs/docs/`, one folder per use case (currently just `weather-forecast/`, a placeholder), with `_category_.json` files controlling the sidebar tree — `sidebars.js` auto-generates the sidebar from that folder structure, so **adding a new use case is just adding a new folder** there. Has its own `package.json`/`node_modules`/`.npmrc` (Node/npm project, unrelated to the .NET solution) — `npm install --global=false && npm start` from `docs/`. `docs/.npmrc` forces local (non-global) installs — needed in some environments where a user-level npm config defaults `npm install` to global/misresolved locations; keep it even if your own environment doesn't need it. When real business logic is added to `MyApplication.Application`, add/update the corresponding page(s) under `docs/docs/` in the same change. **This also runs in reverse: treat `docs/docs/` as the spec.** If a change to `docs/docs/` describes new or different application behavior than what `MyApplication.Application` currently implements (not just wording/formatting edits), don't just accept the doc edit — point out the mismatch and propose the corresponding code change, and only implement it once the user confirms.
- `Dockerfile` / `.dockerignore` — multi-stage build (SDK → aspnet runtime) for `MyApplication.Api`, listens on port 8080 in the container. Build context is the repo root.
- The app and its logging/tracing environment deploy as two **independent** Compose stacks, joined only by a shared external Docker network `elastic` (declared with `external: true` in the app stack) — never merge them back into one file:
  - `docker-compose.elk.yml` — single-node Elasticsearch + Kibana + APM Server (security disabled, dev-only). Owns/creates the `elastic` network. APM Server receives OTLP traces on `:8200` (gRPC and HTTP multiplexed on the same port) and writes them to Elasticsearch `traces-apm-*`, visible in Kibana under Observability → APM.
  - `docker-compose.app.yml` — `myapplication-api` only. Requires the `elastic` network to already exist (i.e. the ELK stack started at least once).
- `src/MyApplication/MyApplication.sln` — the solution file.
- `src/MyApplication/MyApplication.Api/` — ASP.NET Core Web API project (Presentation layer). Entry point: `Program.cs`, which wires up DI (registering `Application` layer services and their `Infrastructure` implementations — this is the only place allowed to reference `MyApplication.Infrastructure` directly), Serilog, and OpenTelemetry tracing. Uses attribute-routed controllers (`AddControllers()` / `MapControllers()`), not minimal-API endpoints — all external call handlers live in `Controllers/`, calling into `MyApplication.Application` services/interfaces rather than containing business logic themselves. Depends on `MyApplication.Application` and `MyApplication.Infrastructure`.
  - Logging is configured in `Program.cs` via `Serilog` (`Serilog.AspNetCore`) + `Elastic.Serilog.Sinks`: writes to console and ships ECS-formatted logs directly to the Elasticsearch data stream `logs-myapplication-api-{environment}`. Elasticsearch endpoint comes from `Elasticsearch:Uri` (`appsettings.json`) / `Elasticsearch__Uri` env var.
  - Distributed tracing is configured in `Program.cs` via `OpenTelemetry.Extensions.Hosting` (`AddOpenTelemetry().WithTracing(...)`), with `AddAspNetCoreInstrumentation()` + `AddHttpClientInstrumentation()` and an OTLP exporter. This propagates W3C `traceparent` across every incoming request and every outgoing `HttpClient` call, and the trace/span IDs are auto-stamped onto Serilog/ECS log lines, so logs and traces correlate by `trace.id`. OTLP endpoint comes from `OpenTelemetry:OtlpEndpoint` (`appsettings.json`) / `OpenTelemetry__OtlpEndpoint` env var; if unset/unreachable, tracing is silently skipped.
  - **Rule: whenever a new outbound integration is added (a database client, a message queue producer/consumer, a call to another HTTP/gRPC service, etc.), add the matching OpenTelemetry instrumentation package for it in the same change** (e.g. Npgsql's native `Npgsql.OpenTelemetry`/`AddNpgsql()` or `OpenTelemetry.Instrumentation.EntityFrameworkCore` for Postgres/EF Core; the relevant instrumentation package for whatever message queue client is chosen), and register it in the `WithTracing(...)` call in `Program.cs`. Don't ship a new integration without tracing wired up — otherwise that hop becomes invisible in the trace.
- `src/MyApplication/MyApplication.Application/` — Application layer class library. Zero dependency on `MyApplication.Api`, `MyApplication.Infrastructure`, or any framework/web package. Organized in feature folders (e.g. `WeatherForecasts/`), each holding its entities/DTOs (e.g. `WeatherForecast.cs`), a port interface (e.g. `IWeatherForecastService.cs`), and the use-case implementation (e.g. `WeatherForecastService.cs`). Register new services in `MyApplication.Api/Program.cs`'s DI container.
- `src/MyApplication/MyApplication.Infrastructure/` — Infrastructure layer class library. Currently **empty** — no database, message queue, or external service integrations exist yet. Depends only on `MyApplication.Application` (implements its port interfaces) plus whatever external/framework packages a given integration needs; never depends on `MyApplication.Api`. When the first integration is added (e.g. Postgres/EF Core, a message queue client, an external HTTP API client), organize it in a feature folder mirroring the `Application` port it implements (e.g. a `Persistence/` or `Messaging/` folder), and remember the tracing rule above — add matching OpenTelemetry instrumentation in the same change.

## Working with this repo

From `src/MyApplication/`:
- `dotnet build` — build the solution
- `dotnet run --project MyApplication.Api` — run the API
- `dotnet test` — run tests (once a test project exists)

Update this file as the project grows — in particular, add new projects to the Structure section as they're created.

## Architecture role and rules

Role: You are an expert software architect specializing in Clean Architecture and Domain-Driven Design (DDD).

Strict Rules for Code Generation:
1. Architectural Layers: Always separate the codebase into distinct layers:
   - Domain (Enterprise business rules: Entities, Value Objects, Use Case Interfaces). Must have zero dependencies on other layers or external libraries.
   - Application (Application business rules: Use Case implementations, CQRS handlers, DTOs, Port interfaces for infrastructure).
   - Infrastructure (Frameworks, Database/ORM implementations, External APIs, Adapters).
   - Presentation (UI, Controllers, Presenters, API Endpoints).

2. Dependency Rule: Source code dependencies must only point inwards. Outer layers (Infrastructure/Presentation) can depend on inner layers (Application/Domain), but inner layers must NEVER depend on outer layers. Use Dependency Inversion (Interfaces) to achieve this.

3. Code Standards:
   - Write clean, maintainable, and heavily decoupled code.
   - Follow SOLID principles strictly.
   - Use meaningful names for classes and variables according to the domain.
   - Avoid mixing business logic with framework-specific code (e.g., no ORM annotations or HTTP status codes in the Domain layer).

Output Format:
- When asked to create a feature, explicitly structure your response by layers (Domain, Application, Infrastructure, Presentation).
- Provide the file paths and the exact code for each file.
- Explain briefly how the data flows between layers for the generated feature.
