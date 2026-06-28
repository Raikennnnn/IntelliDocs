#!/usr/bin/env bash
# Deploy latest code WITHOUT restarting services or logging users out.
# Use while testing session idle timeout / keepalive — normal deploy invalidates sessions.
#
# DigitalOcean console:
#   bash /var/www/intellidocs/scripts/deploy_no_restart.sh
#
# Includes UI rebuild by default. AI-only (faster, no npm):
#   DEPLOY_UI=0 bash /var/www/intellidocs/scripts/deploy_no_restart.sh
#
# After session testing, run a full deploy to restart AI + reload PHP:
#   bash /var/www/intellidocs/scripts/deploy_all_hotfix.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export INVALIDATE_SESSIONS=0
export SKIP_SERVICE_RESTART=1

echo "=== Deploy (no restart, keep sessions) ==="
echo "  INVALIDATE_SESSIONS=0"
echo "  SKIP_SERVICE_RESTART=1"
echo ""

bash "$SCRIPT_DIR/deploy_ai_hotfix.sh"

if [ "${DEPLOY_UI:-1}" = "1" ]; then
  bash "$SCRIPT_DIR/deploy_ui_hotfix.sh"
else
  echo "SKIP: DEPLOY_UI=0 — frontend not rebuilt."
fi

echo ""
echo "=== Done (sessions preserved) ==="
echo "  - Login sessions were NOT invalidated."
echo "  - PHP-FPM, nginx, and intellidocs-ai were NOT restarted."
echo "  - AI Python changes need a manual restart when testing is done:"
echo "      systemctl restart intellidocs-ai"
echo "  - Hard refresh registrar UI after frontend publish: Ctrl+Shift+R"
