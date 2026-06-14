#!/usr/bin/env bash
# One-shot fix for recurring "AI verify timed out (HTTP 502)" on the droplet.
# Run as root in DigitalOcean console:
#   bash /var/www/intellidocs/scripts/fix_ai_502_droplet.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
BRANCH="${BRANCH:-IntelliDocs-V4}"

step() { printf '\n=== %s ===\n' "$1"; }

step "Pull latest code (OCR speed + verify-on-demand fixes)"
cd "$APP_ROOT"
git fetch origin
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
echo "At: $(git log -1 --oneline)"

step "Diagnose current 502 cause"
bash "$APP_ROOT/scripts/diagnose_ai_502.sh" || true

step "Deploy AI service"
bash "$APP_ROOT/scripts/deploy_ai_hotfix.sh"

step "Deploy registrar UI (Run AI per document — one file at a time)"
bash "$APP_ROOT/scripts/deploy_ui_hotfix.sh"

step "Summary"
echo "502 fix checklist:"
echo "  1. nginx fastcgi_read_timeout should be 600 (see diagnose output above)"
echo "  2. In registrar portal: click Run AI on ONE file at a time"
echo "  3. Order: 2x2 photo → good moral → SF9 → PSA → Form 137 last (slowest)"
echo "  4. Wait for each to finish before starting the next"
