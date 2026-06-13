# Copy built SPA from public/app/ to public/ (index.html + assets/) — same as droplet sync_spa_to_root.sh.
param(
    [string]$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$appDir = Join-Path $AppRoot "public\app"
$root = Join-Path $AppRoot "public"

if (-not (Test-Path (Join-Path $appDir "index.html"))) {
    Write-Error "Missing $appDir\index.html — run scripts\deploy_local.ps1 first."
    exit 1
}

Write-Host "Syncing SPA: $appDir -> $root"
New-Item -ItemType Directory -Force -Path (Join-Path $root "assets") | Out-Null
Copy-Item -Force (Join-Path $appDir "index.html") (Join-Path $root "index.html")
Remove-Item -Recurse -Force (Join-Path $root "assets\*") -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force (Join-Path $appDir "assets\*") (Join-Path $root "assets")

foreach ($f in @("favicon.png", "apple-touch-icon.png")) {
    $src = Join-Path $appDir $f
    if (Test-Path $src) {
        Copy-Item -Force $src (Join-Path $root $f)
    }
}

$legacyIco = Join-Path $root "favicon.ico"
if (Test-Path $legacyIco) {
    Remove-Item -Force $legacyIco
}

$bundle = Get-ChildItem (Join-Path $root "assets\index-*.js") -ErrorAction SilentlyContinue | Select-Object -First 1
if ($bundle) {
    Write-Host "Root index.html -> assets\$($bundle.Name)"
}
Write-Host "Done. Open http://localhost/IntelliDocs/public/landing (hard refresh: Ctrl+Shift+R)"
