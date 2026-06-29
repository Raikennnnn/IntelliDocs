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

step "Ensure OpenCV face cascade is available for 2×2 photo checks"
CASCADE_DEST="$APP_ROOT/ai/assets/cascades/haarcascade_frontalface_default.xml"
if [ ! -f "$CASCADE_DEST" ]; then
  CASCADE_SRC="$(.venv/bin/python - <<'PY' 2>/dev/null || true
import os
try:
    import cv2
    root = getattr(getattr(cv2, "data", None), "haarcascades", None)
    if root:
        print(os.path.join(str(root), "haarcascade_frontalface_default.xml"))
except Exception:
    pass
PY
)"
  if [ -n "$CASCADE_SRC" ] && [ -f "$CASCADE_SRC" ]; then
    mkdir -p "$(dirname "$CASCADE_DEST")"
    cp "$CASCADE_SRC" "$CASCADE_DEST"
    echo "Cached cascade at $CASCADE_DEST"
  else
    echo "WARNING: Could not cache haarcascade — 2×2 face checks may warn until opencv-python is healthy."
  fi
fi

step "Restart AI service"
if [ "${SKIP_SERVICE_RESTART:-0}" = "1" ]; then
  echo "SKIP: SKIP_SERVICE_RESTART=1 — intellidocs-ai not restarted (restart manually when done testing sessions)."
else
  systemctl daemon-reload
  systemctl restart intellidocs-ai
  sleep 2
  systemctl --no-pager --full status intellidocs-ai || true
fi

step "Configure nginx/PHP timeouts (prevents HTML 502 on long OCR)"
if [ "${SKIP_SERVICE_RESTART:-0}" = "1" ]; then
  echo "SKIP: SKIP_SERVICE_RESTART=1 — nginx/PHP timeout config not applied."
elif [ -f "$APP_ROOT/scripts/configure_nginx_ai_timeouts.sh" ]; then
  bash "$APP_ROOT/scripts/configure_nginx_ai_timeouts.sh" || true
fi

step "Health check"
HEALTH="$(curl -fsS --max-time 15 http://127.0.0.1:8080/health || true)"
echo "$HEALTH"
if echo "$HEALTH" | grep -qE '"ok"[[:space:]]*:[[:space:]]*true'; then
  echo "OK: AI service running with commit $(git -C "$APP_ROOT" rev-parse --short HEAD)"
else
  echo "WARNING: AI health check failed — running fix_ai_service.sh…"
  if [ -f "$APP_ROOT/scripts/fix_ai_service.sh" ]; then
    bash "$APP_ROOT/scripts/fix_ai_service.sh" || true
    HEALTH="$(curl -fsS --max-time 15 http://127.0.0.1:8080/health || true)"
    echo "$HEALTH"
  fi
  if ! echo "$HEALTH" | grep -qE '"ok"[[:space:]]*:[[:space:]]*true'; then
    echo "ERROR: AI still unhealthy. Run: journalctl -u intellidocs-ai -n 40 --no-pager"
    exit 1
  fi
fi

step "Verify /screen-readability route exists"
SCREEN_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8080/screen-readability || echo 000)"
echo "POST /screen-readability => HTTP $SCREEN_CODE"
if [ "$SCREEN_CODE" = "404" ]; then
  echo "ERROR: /screen-readability missing — AI code is stale. Re-run deploy after git pull."
  exit 1
fi
if [ "$SCREEN_CODE" != "400" ] && [ "$SCREEN_CODE" != "503" ]; then
  echo "WARNING: expected HTTP 400 (no file) or 503 (OCR warming up), got $SCREEN_CODE"
fi

step "Verify AI code markers and /health build"
if [ -f "$APP_ROOT/scripts/verify_ai_deploy.sh" ]; then
  bash "$APP_ROOT/scripts/verify_ai_deploy.sh" || exit 1
fi

step "Reload PHP-FPM (API files updated with git pull)"
if [ "${SKIP_SERVICE_RESTART:-0}" = "1" ]; then
  echo "SKIP: SKIP_SERVICE_RESTART=1 — PHP-FPM not reloaded (existing logins unchanged)."
else
  for svc in php8.3-fpm php8.2-fpm php-fpm; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
      systemctl reload "$svc" || true
      echo "Reloaded $svc"
      break
    fi
  done
fi

echo ""
echo "AI hotfix deployed. Session/API-only changes need PHP reload (done above)."
echo "For registrar UI or session keepalive also run: bash scripts/deploy_ui_hotfix.sh"
echo "Or deploy everything: bash scripts/deploy_all_hotfix.sh"
echo "Re-run AI verify on documents in the portal (old results are cached)."
