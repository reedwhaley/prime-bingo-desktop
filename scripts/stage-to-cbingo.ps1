Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$destinationRoot = "C:\Bingo\desktop_client"

if (-not (Test-Path -LiteralPath "C:\Bingo")) {
    New-Item -ItemType Directory -Path "C:\Bingo" | Out-Null
}

if (-not (Test-Path -LiteralPath $destinationRoot)) {
    New-Item -ItemType Directory -Path $destinationRoot | Out-Null
}

$source = (Resolve-Path -LiteralPath $projectRoot).Path
$destination = (Resolve-Path -LiteralPath $destinationRoot).Path

$null = robocopy $source $destination /MIR /XD node_modules dist src-tauri\target /XF *.log
$exitCode = $LASTEXITCODE

if ($exitCode -gt 7) {
    throw "robocopy failed with exit code $exitCode"
}

Write-Host "Staged desktop client to $destination"
