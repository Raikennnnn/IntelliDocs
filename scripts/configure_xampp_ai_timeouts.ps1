# Raise Apache + PHP timeouts for local XAMPP AI verify (Windows).
# Run in PowerShell as Administrator:
#   powershell -ExecutionPolicy Bypass -File C:\xampp\htdocs\IntelliDocs\scripts\configure_xampp_ai_timeouts.ps1

$ErrorActionPreference = "Stop"
$Timeout = 600
$HttpdConf = "C:\xampp\apache\conf\httpd.conf"
$PhpIni = "C:\xampp\php\php.ini"

Write-Host "=== XAMPP AI timeout configuration (${Timeout}s) ==="

if (Test-Path $HttpdConf) {
    $content = Get-Content $HttpdConf -Raw
    if ($content -match "(?m)^Timeout\s") {
        $content = $content -replace "(?m)^Timeout\s+.*", "Timeout $Timeout"
    } else {
        $content += "`nTimeout $Timeout`n"
    }
    Set-Content -Path $HttpdConf -Value $content -NoNewline
    Write-Host "Updated Apache Timeout in $HttpdConf"
} else {
    Write-Host "WARNING: $HttpdConf not found"
}

if (Test-Path $PhpIni) {
    $content = Get-Content $PhpIni -Raw
    if ($content -match "(?m)^max_execution_time\s*=") {
        $content = $content -replace "(?m)^max_execution_time\s*=.*", "max_execution_time = $Timeout"
    } else {
        $content += "`nmax_execution_time = $Timeout`n"
    }
    Set-Content -Path $PhpIni -Value $content -NoNewline
    Write-Host "Updated max_execution_time in $PhpIni"
} else {
    Write-Host "WARNING: $PhpIni not found"
}

Write-Host ""
Write-Host "Restart Apache from XAMPP Control Panel, then start AI:"
Write-Host "  cd C:\xampp\htdocs\IntelliDocs\ai"
Write-Host "  .\.venv\Scripts\python.exe app.py"
Write-Host ""
Write-Host "On the droplet (production), use configure_nginx_ai_timeouts.sh instead — not this script."
