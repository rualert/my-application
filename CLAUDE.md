# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

The solution `src/MyApplication/MyApplication.sln` has two projects: `MyApplication.Api` (Presentation) and `MyApplication.Application` (Application layer). There is no test project, and no Domain/Infrastructure projects yet — see the architecture rules below for how the solution should be structured as those are added.

## Structure

- `README.md` — run instructions (local + Docker + Docker Compose/ELK).
- `Dockerfile` / `.dockerignore` — multi-stage build (SDK → aspnet runtime) for `MyApplication.Api`, listens on port 8080 in the container. Build context is the repo root.
- The app and its logging environment deploy as two **independent** Compose stacks, joined only by a shared external Docker network `elastic` (declared with `external: true` in the app stack) — never merge them back into one file:
  - `docker-compose.elk.yml` — single-node Elasticsearch + Kibana (security disabled, dev-only). Owns/creates the `elastic` network.
  - `docker-compose.app.yml` — `myapplication-api` only. Requires the `elastic` network to already exist (i.e. the ELK stack started at least once).
- `src/MyApplication/MyApplication.sln` — the solution file.
- `src/MyApplication/MyApplication.Api/` — ASP.NET Core Web API project (Presentation layer). Entry point: `Program.cs`, which wires up DI (registering `Application` layer services) and Serilog. Uses attribute-routed controllers (`AddControllers()` / `MapControllers()`), not minimal-API endpoints — all external call handlers live in `Controllers/`, calling into `MyApplication.Application` services/interfaces rather than containing business logic themselves. Depends on `MyApplication.Application`.
  - Logging is configured in `Program.cs` via `Serilog` (`Serilog.AspNetCore`) + `Elastic.Serilog.Sinks`: writes to console and ships ECS-formatted logs directly to the Elasticsearch data stream `logs-myapplication-api-{environment}`. Elasticsearch endpoint comes from `Elasticsearch:Uri` (`appsettings.json`) / `Elasticsearch__Uri` env var.
- `src/MyApplication/MyApplication.Application/` — Application layer class library. Zero dependency on `MyApplication.Api` or any framework/web package. Organized in feature folders (e.g. `WeatherForecasts/`), each holding its entities/DTOs (e.g. `WeatherForecast.cs`), a port interface (e.g. `IWeatherForecastService.cs`), and the use-case implementation (e.g. `WeatherForecastService.cs`). Register new services in `MyApplication.Api/Program.cs`'s DI container.

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
