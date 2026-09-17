<#
.SYNOPSIS
    Запускает сценарий «получить список заметок» (GET /Notes).

.DESCRIPTION
    Тонкая обёртка над Invoke-K6Scenario.ps1 — параметры те же самые, см. его
    справку: Get-Help ./Invoke-K6Scenario.ps1 -Full.

.EXAMPLE
    ./Invoke-NotesListScenario.ps1

.EXAMPLE
    # Быстрый прогон для проверки, не для поиска реального потолка.
    ./Invoke-NotesListScenario.ps1 -SeedCount 5 -StageDuration 5s -StageTargets 10,20
#>
[CmdletBinding()]
param(
    [int]$AppPort = 8081,
    [string]$BaseUrl = "http://host.docker.internal:$AppPort",
    [string]$Network = 'myapplication_default',
    [string]$InfluxUrl = 'http://influxdb:8086/k6',
    [int]$SeedCount,
    [string]$StageDuration,
    [string[]]$StageTargets,
    [switch]$KeepDb
)

& (Join-Path $PSScriptRoot 'Invoke-K6Scenario.ps1') @PSBoundParameters -ScenarioFile 'notes-list.js'
