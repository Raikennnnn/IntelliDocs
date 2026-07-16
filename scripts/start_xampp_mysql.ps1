# Quick-start XAMPP MySQL (repairs Aria if needed, then starts mysqld).
param(
    [string]$XamppRoot = "C:\xampp"
)

$mysqlBin = Join-Path $XamppRoot "mysql\bin"
$mysqlExe = Join-Path $mysqlBin "mysql.exe"

if (Test-Path $mysqlExe) {
    & $mysqlExe -h 127.0.0.1 -u root -e "SELECT 1;" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "MySQL is already running." -ForegroundColor Green
        exit 0
    }
}

& "$PSScriptRoot\repair_xampp_mysql.ps1" -XamppRoot $XamppRoot -StartAfterRepair
