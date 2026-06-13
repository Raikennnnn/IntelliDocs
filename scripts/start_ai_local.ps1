# Start the IntelliDocs AI service for local XAMPP development (port 5000).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "ai")

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Error "Python not found. Install Python 3.11+ and Tesseract OCR."
}

Write-Host "Starting AI service on http://127.0.0.1:5000 ..."
Write-Host "Leave this window open while reviewing documents."
Write-Host "Health check: http://127.0.0.1:5000/health"
Write-Host ""

$env:PORT = "5000"
$env:AI_OCR_ENGINE = "auto"
python app.py
