# Repair XAMPP MariaDB when it fails to start (Aria recovery / plugin table errors).
# Run as Administrator if files are locked. Stop MySQL in XAMPP first when possible.
param(
    [string]$XamppRoot = "C:\xampp",
    [switch]$StartAfterRepair
)

$ErrorActionPreference = "Stop"
$mysqlBin = Join-Path $XamppRoot "mysql\bin"
$dataDir = Join-Path $XamppRoot "mysql\data"

if (-not (Test-Path (Join-Path $mysqlBin "mysqld.exe"))) {
    throw "XAMPP MySQL not found at $mysqlBin"
}

Write-Host "=== Stop stray mysqld processes ===" -ForegroundColor Cyan
Get-Process mysqld -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "=== Remove stale pid + corrupted Aria log files ===" -ForegroundColor Cyan
Remove-Item (Join-Path $dataDir "mysql.pid") -Force -ErrorAction SilentlyContinue
Get-ChildItem $dataDir -Filter "aria_log.*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $dataDir "aria_log_control") -Force -ErrorAction SilentlyContinue

Write-Host "=== Repair mysql system Aria tables ===" -ForegroundColor Cyan
Push-Location $mysqlBin
try {
    # aria_chk may warn about missing aria_log_control after we delete it — that is expected.
    $prevErr = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & .\aria_chk.exe -o -f "..\data\mysql\*.MAI" 2>&1 | Out-Host
    $ErrorActionPreference = $prevErr
}
finally {
    Pop-Location
}

if ($StartAfterRepair) {
    Write-Host "=== Start MySQL ===" -ForegroundColor Cyan
    $myIni = Join-Path $mysqlBin "my.ini"
    Start-Process -FilePath (Join-Path $mysqlBin "mysqld.exe") -ArgumentList "--defaults-file=$myIni", "--standalone" -WindowStyle Hidden
    Start-Sleep -Seconds 15
    $mysqlExe = Join-Path $mysqlBin "mysql.exe"
    & $mysqlExe -h 127.0.0.1 -u root -e "SELECT 1 AS ok;" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL did not start. Check C:\xampp\mysql\data\mysql_error.log"
    }
    Write-Host "MySQL is running." -ForegroundColor Green
}
else {
    Write-Host "Repair done. Start MySQL from XAMPP Control Panel." -ForegroundColor Green
}

Write-Host ""
Write-Host "If intellidocs_db is missing, restore from backups\mysql\*.sql" -ForegroundColor Yellow
