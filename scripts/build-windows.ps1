Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Find-FirstExistingPath {
    param(
        [string[]]$Candidates
    )

    if (-not $Candidates) {
        return $null
    }

    foreach ($candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }

        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    return $null
}

function Find-NewestDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ParentPath
    )

    if (-not (Test-Path -LiteralPath $ParentPath)) {
        return $null
    }

    return Get-ChildItem -LiteralPath $ParentPath -Directory |
        Sort-Object Name -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

if ($projectRoot.StartsWith("\\")) {
    throw "Builds should run from a local path. Stage this folder into C:\Bingo\desktop_client first."
}

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path -LiteralPath $cargoBin) {
    $env:PATH = "$cargoBin;$env:PATH"
}

$cargo = Get-Command cargo -ErrorAction SilentlyContinue
$rustc = Get-Command rustc -ErrorAction SilentlyContinue

if (-not $cargo -or -not $rustc) {
    throw "Cargo/Rust are not available on PATH. Install Rust or reopen the shell after installation."
}

$rustLibBin = Join-Path $env:USERPROFILE ".rustup\toolchains\stable-x86_64-pc-windows-msvc\lib\rustlib\x86_64-pc-windows-msvc\bin"
$rustLld = Join-Path $rustLibBin "rust-lld.exe"

if (-not (Test-Path -LiteralPath $rustLld)) {
    throw "rust-lld.exe was not found at '$rustLld'. The stable MSVC Rust toolchain does not look complete."
}

$vsWhere = Find-FirstExistingPath @(
    "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe",
    "C:\Program Files\Microsoft Visual Studio\Installer\vswhere.exe"
)

$msvcLib = $null
if ($vsWhere) {
    $installPath = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
    if ($installPath) {
        $toolsDir = Find-NewestDirectory (Join-Path $installPath "VC\Tools\MSVC")
        if ($toolsDir) {
            $msvcLib = Join-Path $toolsDir "lib\x64"
        }
    }
}

if (-not $msvcLib) {
    $msvcCandidates = @()
    if ($env:VCToolsInstallDir) {
        $msvcCandidates += (Join-Path $env:VCToolsInstallDir "lib\x64")
    }
    $msvcCandidates += @(
        (Find-NewestDirectory "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC"),
        (Find-NewestDirectory "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC"),
        (Find-NewestDirectory "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC")
    )

    $msvcLib = Find-FirstExistingPath $msvcCandidates

    if ($msvcLib -and -not $msvcLib.EndsWith("lib\x64")) {
        $msvcLib = Join-Path $msvcLib "lib\x64"
    }
}

$windowsKitRoot = Find-FirstExistingPath @(
    ${env:WindowsSdkDir},
    "C:\Program Files (x86)\Windows Kits\10",
    "C:\Program Files\Windows Kits\10"
)

$windowsLibVersion = $null
if ($windowsKitRoot) {
    $windowsLibVersion = Find-NewestDirectory (Join-Path $windowsKitRoot "Lib")
}

$ucrtLib = $null
$umLib = $null
if ($windowsLibVersion) {
    $ucrtLib = Join-Path $windowsLibVersion "ucrt\x64"
    $umLib = Join-Path $windowsLibVersion "um\x64"
}

$missingPrereqs = @()
if (-not $msvcLib -or -not (Test-Path -LiteralPath (Join-Path $msvcLib "msvcrt.lib"))) {
    $missingPrereqs += "MSVC libraries (msvcrt.lib)"
}
if (-not $ucrtLib -or -not (Test-Path -LiteralPath (Join-Path $ucrtLib "ucrt.lib"))) {
    $missingPrereqs += "Windows SDK UCRT libraries (ucrt.lib)"
}
if (-not $umLib -or -not (Test-Path -LiteralPath (Join-Path $umLib "kernel32.lib"))) {
    $missingPrereqs += "Windows SDK UM libraries (kernel32.lib)"
}

if ($missingPrereqs.Count -gt 0) {
    $lines = @("Native Tauri build prerequisites are missing:")
    $lines += ($missingPrereqs | ForEach-Object { "- $_" })
    $lines += ""
    $lines += "Install Microsoft Visual Studio Build Tools with the C++ workload and a Windows 10/11 SDK, then rerun this script."
    $message = $lines -join [Environment]::NewLine

    throw $message
}

$env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER = $rustLld
$env:LIB = @($msvcLib, $ucrtLib, $umLib, $env:LIB) -ne "" -join ";"

Push-Location $projectRoot
try {
    Write-Host "Using cargo: $($cargo.Source)"
    Write-Host "Using rustc: $($rustc.Source)"
    Write-Host "Using rust-lld: $rustLld"
    Write-Host "Using LIB paths:"
    Write-Host "  $msvcLib"
    Write-Host "  $ucrtLib"
    Write-Host "  $umLib"
    npm run tauri:build
}
finally {
    Pop-Location
}
