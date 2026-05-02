<#
.SYNOPSIS
  Build Android APK or AAB using EAS Build.
.PARAMETER Profile
  One of: development, preview, production. Default: preview.
.PARAMETER Local
  Switch: run the build locally (requires Android SDK) instead of EAS cloud.
.EXAMPLE
  ./scripts/build-android.ps1 -Profile preview
  ./scripts/build-android.ps1 -Profile production -Local
#>
param(
  [ValidateSet('development', 'preview', 'production')]
  [string]$Profile = 'preview',
  [switch]$Local
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Push-Location "$PSScriptRoot\.."

foreach ($cmd in @('node', 'npx')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Error "$cmd is not on PATH. Install it and try again."
    Pop-Location
    exit 1
  }
}

if (-not (Test-Path '.env.local') -and -not $env:EXPO_PUBLIC_API_ENV) {
  Write-Warning ".env.local not found. API keys will be empty."
}

$easArgs = @('eas', 'build', '--platform', 'android', '--profile', $Profile, '--non-interactive')
if ($Local) { $easArgs += '--local' }

Write-Host "Building Android [$Profile]$(if ($Local){' (local)'}else{' (EAS cloud)'})..." -ForegroundColor Cyan
npx @easArgs

if ($LASTEXITCODE -ne 0) {
  Write-Error "Build failed with exit code $LASTEXITCODE"
  Pop-Location
  exit $LASTEXITCODE
}

Write-Host "Android build complete." -ForegroundColor Green
Pop-Location
