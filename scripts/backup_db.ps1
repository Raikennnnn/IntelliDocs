param(
  [string]$Database = "intellidocs_db",
  [string]$OutDir = "",
  [string]$MysqlBin = "C:\xampp\mysql\bin",
  [string]$DbHost = "127.0.0.1",
  [int]$Port = 3306,
  [string]$User = "root",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Require-File([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Label not found: $Path"
  }
}

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

$mysqldump = Join-Path $MysqlBin "mysqldump.exe"
$mysqladmin = Join-Path $MysqlBin "mysqladmin.exe"

Require-File $mysqldump "mysqldump.exe"
Require-File $mysqladmin "mysqladmin.exe"

if ([string]::IsNullOrWhiteSpace($OutDir)) {
  $OutDir = Join-Path $PSScriptRoot "..\backups\mysql"
}
$resolved = Resolve-Path -LiteralPath $OutDir -ErrorAction SilentlyContinue
if ($null -ne $resolved) {
  $OutDir = $resolved.Path
}
Ensure-Dir $OutDir

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile = Join-Path $OutDir "$($Database)_$stamp.sql"

Write-Host "Database : $Database"
Write-Host "Output   : $outFile"
Write-Host "Server   : $DbHost`:$Port (user: $User)"
Write-Host ""

Write-Host "Checking MySQL connection..."
& $mysqladmin --protocol=tcp --host=$DbHost --port=$Port --user=$User ping | Out-Null
Write-Host "OK"

$args = @(
  "--protocol=tcp",
  "--host=$DbHost",
  "--port=$Port",
  "--user=$User",
  "--databases", $Database,
  "--single-transaction",
  "--quick",
  "--skip-lock-tables",
  "--routines",
  "--events",
  "--hex-blob"
)

Write-Host ""
Write-Host "Running mysqldump..."
if ($DryRun) {
  Write-Host "DRY RUN (no file written). Command:"
  Write-Host ("  " + $mysqldump + " " + ($args -join " "))
  exit 0
}

& $mysqldump @args | Out-File -FilePath $outFile -Encoding ascii

if (-not (Test-Path -LiteralPath $outFile)) {
  throw "Backup failed: output file not created."
}

$size = (Get-Item -LiteralPath $outFile).Length
if ($size -lt 1024) {
  Write-Warning "Backup file is very small ($size bytes). Check if the database has tables and MySQL is healthy."
}

Write-Host "Done. Backup saved."
