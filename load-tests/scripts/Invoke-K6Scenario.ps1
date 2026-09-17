<#
.SYNOPSIS
    Запускает сценарий k6 из load-tests/scenarios/ в Docker-контейнере,
    с отправкой метрик в InfluxDB для просмотра в Grafana.

.DESCRIPTION
    Общая логика для всех Invoke-*Scenario.ps1 — конкретные скрипты сценариев
    просто вызывают его с именем нужного файла. Предполагает, что уже поднят
    ci/docker-compose.load-tests.yml (InfluxDB + Grafana, см. корневой README.md
    и load-tests/README.md) — сам этот скрипт поднимает/удаляет отдельный
    изолированный стек "БД + приложение" (ci/docker-compose.load-tests-db.yml)
    вокруг прогона k6, чтобы SEED_COUNT (тысячи тестовых заметок) не засорял
    основную dev-базу (ci/docker-compose.db.yml). См. -KeepDb, если вместо
    этого нужно посмотреть в базу после прогона.

.PARAMETER ScenarioFile
    Имя файла сценария внутри load-tests/scenarios/ (например, notes-list.js).

.PARAMETER AppPort
    Хостовый порт изолированного инстанса приложения (ci/docker-compose.load-tests-db.yml),
    поднимаемого для этого прогона. По умолчанию — 8081, чтобы не конфликтовать
    с обычным dev-инстансом на 8080 (ci/docker-compose.app.yml).

.PARAMETER BaseUrl
    Адрес API, доступный из контейнера k6. По умолчанию — изолированный
    инстанс приложения (см. -AppPort) через адрес хоста из контейнера в
    Docker Desktop (Windows/Mac). Если переопределить (например, на обычный
    dev-инстанс) — изолированная БД/приложение всё равно поднимутся и
    удалятся вокруг прогона, просто останутся неиспользованными.

.PARAMETER Network
    Docker-сеть, к которой подключается контейнер k6 — нужна, чтобы достучаться
    до InfluxDB по имени контейнера. Сеть создаётся ci/docker-compose.load-tests.yml.

.PARAMETER InfluxUrl
    Адрес InfluxDB для записи метрик (виден из сети $Network).

.PARAMETER SeedCount
    Сколько заметок создать перед стартом нагрузки. Если не задано —
    используется значение по умолчанию из load-tests/config.js.

.PARAMETER StageDuration
    Длительность каждой ступени роста RPS (например, "30s"). Если не задано —
    используется значение по умолчанию из load-tests/config.js.

.PARAMETER StageTargets
    Целевые RPS по ступеням (например, -StageTargets 50,100,200 — PowerShell
    сам соберёт их в массив). Если не задано — используется значение по
    умолчанию из load-tests/config.js.

.PARAMETER KeepDb
    Не удалять изолированный стек БД/приложения после прогона (по умолчанию
    удаляется всегда, вместе с томом данных) — полезно, чтобы после прогона
    вручную посмотреть, что осталось в базе. Удалить вручную потом:
    docker compose -p myapplication-loadtest -f ci/docker-compose.load-tests-db.yml down -v

.EXAMPLE
    ./Invoke-K6Scenario.ps1 -ScenarioFile notes-list.js

.EXAMPLE
    # Быстрый прогон для проверки, не для поиска реального потолка.
    ./Invoke-K6Scenario.ps1 -ScenarioFile notes-list.js -SeedCount 5 -StageDuration 5s -StageTargets 10,20
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ScenarioFile,

    [int]$AppPort = 8081,
    [string]$BaseUrl = "http://host.docker.internal:$AppPort",
    [string]$Network = 'myapplication_default',
    [string]$InfluxUrl = 'http://influxdb:8086/k6',
    [int]$SeedCount,
    [string]$StageDuration,
    [string[]]$StageTargets,
    [switch]$KeepDb
)

$ErrorActionPreference = 'Stop'

# Вывод k6 внутри контейнера в UTF-8 (кириллица в текстах check()) — без этого
# в консоли с не-UTF8 кодовой страницей текст превращается в нечитаемые символы.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$loadTestsPath = Resolve-Path (Join-Path $PSScriptRoot '..')
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '../..')
$loadTestDbCompose = Join-Path $repoRoot 'ci/docker-compose.load-tests-db.yml'
# Отдельное имя проекта (-p) — чтобы этот стек жил в своей сети/неймспейсе
# контейнеров, а не в общем myapplication_default вместе с dev-стеками.
$composeArgs = @('-p', 'myapplication-loadtest', '-f', $loadTestDbCompose)

Write-Host "Starting isolated DB + app stack for this run (ci/docker-compose.load-tests-db.yml)..."
docker compose @composeArgs up -d --build
if ($LASTEXITCODE -ne 0) {
    throw "docker compose up failed for ci/docker-compose.load-tests-db.yml (exit code $LASTEXITCODE)"
}

try {
    # У приложения нет health-эндпоинта и в образе нет curl/wget для
    # Docker-level healthcheck — опрашиваем с хоста напрямую, пока
    # GET /Notes не ответит (это заодно означает, что миграции применились).
    $readyUrl = "http://localhost:$AppPort/Notes"
    $deadline = (Get-Date).AddSeconds(60)
    $ready = $false
    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-WebRequest -Uri $readyUrl -UseBasicParsing -TimeoutSec 3 | Out-Null
            $ready = $true
            break
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $ready) {
        throw "App at $readyUrl did not become ready within 60s"
    }

    $envArgs = @('-e', "BASE_URL=$BaseUrl")
    if ($PSBoundParameters.ContainsKey('SeedCount')) {
        $envArgs += @('-e', "SEED_COUNT=$SeedCount")
    }
    if ($PSBoundParameters.ContainsKey('StageDuration')) {
        $envArgs += @('-e', "STAGE_DURATION=$StageDuration")
    }
    if ($PSBoundParameters.ContainsKey('StageTargets')) {
        $envArgs += @('-e', "STAGE_TARGETS=$($StageTargets -join ',')")
    }

    docker run --rm -i `
        --network $Network `
        @envArgs `
        -v "${loadTestsPath}:/load-tests" `
        -w /load-tests `
        grafana/k6 run --out "influxdb=$InfluxUrl" "scenarios/$ScenarioFile"
    $k6ExitCode = $LASTEXITCODE
} finally {
    if ($KeepDb) {
        Write-Host "-KeepDb passed - leaving ci/docker-compose.load-tests-db.yml up. Remove manually with:"
        Write-Host "  docker compose -p myapplication-loadtest -f `"$loadTestDbCompose`" down -v"
    } else {
        Write-Host "Tearing down the isolated DB + app stack (with its data volume)..."
        docker compose @composeArgs down -v
    }
}

# exit code 99 = k6 threshold breach — the expected/interesting outcome of this
# load test (finding the RPS stage where a threshold first fails), not a script
# error, so it must not throw. Any other non-zero code is a real failure
# (setup() crash, k6 couldn't start, etc).
if ($k6ExitCode -eq 99) {
    Write-Warning "k6 threshold(s) breached during the run (scenario $ScenarioFile) - this is expected when the ramp reaches the RPS ceiling. Check the Grafana dashboard for details."
} elseif ($k6ExitCode -ne 0) {
    throw "k6 exited with code $k6ExitCode (scenario $ScenarioFile)"
}
