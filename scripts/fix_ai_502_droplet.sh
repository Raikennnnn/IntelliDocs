#!/usr/bin/env bash
# One-shot fix for recurring "AI verify timed out (HTTP 502)" on the droplet.
# Run as root in DigitalOcean console:
#   bash /var/www/intellidocs/scripts/fix_ai_502_droplet.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
BRANCH="${BRANCH:-IntelliDocs-V4}"

step() { printf '\n=== %s ===\n' "$1"; }

step "Pull latest code"
cd "$APP_ROOT"
git fetch origin
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
echo "At: $(git log -1 --oneline)"

step "Diagnose (before fix)"
bash "$APP_ROOT/scripts/diagnose_ai_502.sh" || true

step "nginx + PHP timeouts (600s — fixes HTML 502 from 60s default)"
bash "$APP_ROOT/scripts/configure_nginx_ai_timeouts.sh"

step "AI systemd: gunicorn 620s, 1 worker (small droplet)"
AI_WORKERS=1 GUNICORN_TIMEOUT=620 bash "$APP_ROOT/scripts/fix_ai_service.sh"

step "Deploy AI code + restart"
bash "$APP_ROOT/scripts/deploy_ai_hotfix.sh"

step "Deploy registrar UI (Run AI per document)"
bash "$APP_ROOT/scripts/deploy_ui_hotfix.sh"

step "Diagnose (after fix)"
bash "$APP_ROOT/scripts/diagnose_ai_502.sh" || true

step "Summary"
echo "If direct /verify works in diagnose but browser still 502:"
echo "  - Hard refresh browser (Ctrl+Shift+R)"
echo "  - Run AI on ONE file at a time; Form 137 last"
echo "  - If using Cloudflare in front of the droplet, its proxy timeout is 100s — use DNS-only (grey cloud) or skip Cloudflare for /api"
