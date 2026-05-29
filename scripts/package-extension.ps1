param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$DistDir = Join-Path $RootDir "dist"
$Targets = @("chrome", "firefox")

if (-not $SkipBuild) {
  Push-Location $RootDir
  try {
    & node "scripts/build-extension.mjs"
  }
  finally {
    Pop-Location
  }
}

foreach ($Target in $Targets) {
  $SourceDir = Join-Path $DistDir $Target
  $ZipPath = Join-Path $RootDir "premiere-timer-$Target.zip"

  if (-not (Test-Path -LiteralPath $SourceDir -PathType Container)) {
    throw "Missing build output: $SourceDir"
  }

  $SourceItems = @(Get-ChildItem -LiteralPath $SourceDir -Force)
  if ($SourceItems.Count -eq 0) {
    throw "Build output is empty: $SourceDir"
  }

  if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
  }

  # Wildcard path keeps extension files at zip root. Do not zip the folder itself.
  Compress-Archive -Path (Join-Path $SourceDir "*") -DestinationPath $ZipPath -CompressionLevel Optimal
  Write-Host "Created $ZipPath"
}
