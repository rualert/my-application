<#
.SYNOPSIS
    Запускает сценарий «создать заметку» (POST /Notes).

.DESCRIPTION
    Тонкая обёртка над Invoke-K6Scenario.ps1 — параметры те же самые, см. его
    справку: Get-Help ./Invoke-K6Scenario.ps1 -Full.

.EXAMPLE
    ./Invoke-NotesCreateScenario.ps1

.EXAMPLE
    # Быстрый прогон для проверки, не для поиска реального потолка.
    ./Invoke-NotesCreateScenario.ps1 -SeedCount 5 -StageDuration 5s -StageTargets 10,20
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

& (Join-Path $PSScriptRoot 'Invoke-K6Scenario.ps1') @PSBoundParameters -ScenarioFile 'notes-create.js'
