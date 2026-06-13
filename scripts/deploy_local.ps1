# Build frontend and publish to public/ like the DigitalOcean droplet (XAMPP / IntelliDocs/public).
param(
    [string]$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string]$ApiBase = "/IntelliDocs/public",
    [switch]$SkipBuild,
    [switch]$SkipAiCheck
)

$ErrorActionPreference = "Stop"
$frontend = Join-Path $AppRoot "frontend"
$public = Join-Path $AppRoot "public"

Write-Host "`n=== Build React frontend (XAMPP base: $ApiBase) ===" -ForegroundColor Cyan
Push-Location $frontend
try {
    if (-not $SkipBuild) {
        @"
VITE_API_BASE=$ApiBase
VITE_API_TARGET=http://127.0.0.1
VITE_AI_BASE_URL=
"@ | Set-Content -Encoding utf8 .env.production

        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
    }
}
finally {
    Pop-Location
}

Write-Host "`n=== Publish frontend to public/ (same layout as droplet) ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path (Join-Path $public "assets") | Out-Null
Remove-Item -Recurse -Force (Join-Path $public "assets\*") -ErrorAction SilentlyContinue
Copy-Item -Force (Join-Path $frontend "dist\index.html") (Join-Path $public "index.html")
Copy-Item -Recurse -Force (Join-Path $frontend "dist\assets\*") (Join-Path $public "assets")

foreach ($f in @("favicon.png", "apple-touch-icon.png")) {
    $src = Join-Path $frontend "dist\$f"
    if (Test-Path $src) {
        Copy-Item -Force $src (Join-Path $public $f)
    }
}
$legacyIco = Join-Path $public "favicon.ico"
if (Test-Path $legacyIco) { Remove-Item -Force $legacyIco }

New-Item -ItemType Directory -Force -Path (Join-Path $public "app") | Out-Null
Remove-Item -Recurse -Force (Join-Path $public "app\*") -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force (Join-Path $frontend "dist\*") (Join-Path $public "app")

foreach ($dir in @("admission-samples", "strands", "report-assets")) {
    $src = Join-Path $frontend "public\$dir"
    $dst = Join-Path $public $dir
    if (Test-Path $src) {
        New-Item -ItemType Directory -Force -Path $dst | Out-Null
        Copy-Item -Recurse -Force (Join-Path $src "*") $dst
    }
}

if (-not $SkipAiCheck) {
    Write-Host "`n=== AI service (optional health check) ===" -ForegroundColor Cyan
    $aiPy = Join-Path $AppRoot "ai\.venv\Scripts\python.exe"
    if (Test-Path $aiPy) {
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:5000/health" -TimeoutSec 3
            Write-Host "AI OK: $($health | ConvertTo-Json -Compress)"
            if ($null -eq $health.ocr_fallback_enabled) {
                Write-Host "Tip: restart AI to load multi-level OCR - cd ai; .\.venv\Scripts\python.exe app.py" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "AI not running on :5000 - start: cd ai; .\.venv\Scripts\python.exe app.py" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "AI venv not found - run setup.ps1 or: cd ai; py -3.12 -m venv .venv; .\.venv\Scripts\pip install -r requirements.txt" -ForegroundColor Yellow
    }
}

Write-Host "`nDeploy finished (local)." -ForegroundColor Green
Write-Host "  XAMPP (matches droplet): http://localhost$ApiBase/landing"
Write-Host "  Vite dev (hot reload):   http://127.0.0.1:3001/landing"
Write-Host "  Hard refresh: Ctrl+Shift+R"
