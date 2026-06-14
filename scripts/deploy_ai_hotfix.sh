#!/usr/bin/env bash
# Fast AI-only update on the droplet (no frontend rebuild).
# Use after pushing ai/app.py changes to GitHub.
#
# DigitalOcean console:
#   bash /var/www/intellidocs/scripts/deploy_ai_hotfix.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
BRANCH="${BRANCH:-IntelliDocs-V4}"

step() { printf '\n=== %s ===\n' "$1"; }

step "Pull latest AI code ($BRANCH)"
cd "$APP_ROOT"
if [ ! -d .git ]; then
  echo "ERROR: $APP_ROOT is not a git clone."
  exit 1
fi
git fetch origin
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
echo "Commit: $(git log -1 --oneline)"
git rev-parse --short HEAD > "$APP_ROOT/ai/BUILD_REV"
git log -1 --format=%s > "$APP_ROOT/ai/BUILD_MSG" 2>/dev/null || true
echo "Stamped ai/BUILD_REV=$(cat "$APP_ROOT/ai/BUILD_REV")"

step "Install Python deps (if requirements changed)"
cd "$APP_ROOT/ai"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

step "Restart AI service"
systemctl daemon-reload
systemctl restart intellidocs-ai
sleep 2
systemctl --no-pager --full status intellidocs-ai || true

step "Configure nginx/PHP timeouts (prevents HTML 502 on long OCR)"
if [ -f "$APP_ROOT/scripts/configure_nginx_ai_timeouts.sh" ]; then
  bash "$APP_ROOT/scripts/configure_nginx_ai_timeouts.sh" || true
fi

step "Health check"
HEALTH="$(curl -fsS --max-time 15 http://127.0.0.1:8080/health || true)"
echo "$HEALTH"
if echo "$HEALTH" | grep -qE '"ok"[[:space:]]*:[[:space:]]*true'; then
  echo "OK: AI service running with commit $(git -C "$APP_ROOT" rev-parse --short HEAD)"
else
  echo "WARNING: AI health check failed. Run: journalctl -u intellidocs-ai -n 40 --no-pager"
  exit 1
fi

step "Verify AI code markers and /health build"
if [ -f "$APP_ROOT/scripts/verify_ai_deploy.sh" ]; then
  bash "$APP_ROOT/scripts/verify_ai_deploy.sh" || exit 1
fi

echo ""
echo "AI hotfix deployed. For registrar UI changes also run: bash scripts/deploy_ui_hotfix.sh"
echo "Or deploy both: bash scripts/deploy_all_hotfix.sh"
echo "Re-run AI verify on documents in the portal (old results are cached)."
