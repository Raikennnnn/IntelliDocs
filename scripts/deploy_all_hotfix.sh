#!/usr/bin/env bash
# Deploy latest AI + PHP API + registrar UI on the droplet.
# Includes: AI verification, session idle logout (/api/session/touch + keepalive UI).
# DigitalOcean console:
#   bash /var/www/intellidocs/scripts/deploy_all_hotfix.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

step() { printf '\n=== %s ===\n' "$1"; }

bash "$SCRIPT_DIR/deploy_ai_hotfix.sh"
bash "$SCRIPT_DIR/deploy_ui_hotfix.sh"

step "Reload PHP-FPM (session API: ping/touch routes)"
for svc in php8.3-fpm php8.2-fpm php-fpm; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    systemctl reload "$svc" || true
    echo "Reloaded $svc"
    break
  fi
done

step "Verify session API routes"
if ! grep -q "session/touch" "$APP_ROOT/public/api_index.php" 2>/dev/null; then
  echo "WARNING: session/touch route missing from public/api_index.php"
fi
if ! grep -q "session/ping" "$APP_ROOT/public/api_index.php" 2>/dev/null; then
  echo "WARNING: session/ping route missing from public/api_index.php"
fi
ROOT_BUNDLE="$(ls -1 "$APP_ROOT/public/assets"/index-*.js 2>/dev/null | head -1 || true)"
if [ -n "$ROOT_BUNDLE" ] && grep -q 'session/touch' "$ROOT_BUNDLE" 2>/dev/null; then
  echo "OK: Frontend bundle includes session activity touch."
else
  echo "WARNING: Frontend bundle may be missing session/touch keepalive — hard refresh after deploy."
fi

echo ""
echo "=== All hotfixes applied ==="
echo "  AI:      curl -s http://127.0.0.1:8080/health"
echo "  Session: idle logout after 30 min without activity (ping validates only; touch on interaction)"
echo "  UI:      hard refresh registrar (Ctrl+Shift+R), then Re-run AI verify on documents"
