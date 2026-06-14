#!/usr/bin/env bash
# Deploy latest AI + registrar UI on the droplet (pull, AI restart, frontend rebuild).
# DigitalOcean console:
#   bash /var/www/intellidocs/scripts/deploy_all_hotfix.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$SCRIPT_DIR/deploy_ai_hotfix.sh"
bash "$SCRIPT_DIR/deploy_ui_hotfix.sh"

echo ""
echo "=== All hotfixes applied ==="
echo "  AI:    curl -s http://127.0.0.1:8080/health"
echo "  UI:    hard refresh registrar (Ctrl+Shift+R), then Re-run AI verify on documents"
