#!/usr/bin/env bash
# Fix / reinstall IntelliDocs AI systemd unit on the droplet.
# Run on the server as root:
#   bash /var/www/intellidocs/scripts/fix_ai_service.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
AI_PORT="${AI_PORT:-8080}"
HEALTH_URL="http://127.0.0.1:${AI_PORT}/health"
MAX_WAIT="${MAX_WAIT:-90}"

echo "=== Install Tesseract (if missing) ==="
command -v tesseract >/dev/null 2>&1 || apt-get install -y tesseract-ocr

echo "=== Ensure env AI_BASE_URL ==="
ENV_FILE="$APP_ROOT/env"
if [ -f "$ENV_FILE" ]; then
  if grep -q '^AI_BASE_URL=' "$ENV_FILE"; then
    sed -i.bak "s|^AI_BASE_URL=.*|AI_BASE_URL=http://127.0.0.1:${AI_PORT}|" "$ENV_FILE"
  else
    echo "AI_BASE_URL=http://127.0.0.1:${AI_PORT}" >> "$ENV_FILE"
  fi
  grep -q '^AI_OCR_ENGINE=' "$ENV_FILE" || echo 'AI_OCR_ENGINE=tesseract' >> "$ENV_FILE"
  grep -q '^DISABLE_EASYOCR=' "$ENV_FILE" || echo 'DISABLE_EASYOCR=1' >> "$ENV_FILE"
  echo "  AI_BASE_URL=$(grep '^AI_BASE_URL=' "$ENV_FILE" | cut -d= -f2-)"
fi

echo "=== Write systemd unit (gthread — /health works during OCR) ==="
cat > /etc/systemd/system/intellidocs-ai.service <<UNIT
[Unit]
Description=IntelliDocs AI Service
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=${APP_ROOT}/ai
Environment=PORT=${AI_PORT}
Environment=AI_OCR_ENGINE=tesseract
Environment=DISABLE_EASYOCR=1
ExecStart=${APP_ROOT}/ai/.venv/bin/gunicorn --bind 127.0.0.1:${AI_PORT} --workers 1 --worker-class gthread --threads 4 --timeout 300 --graceful-timeout 60 app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable intellidocs-ai
systemctl restart intellidocs-ai

echo "=== Wait for ${HEALTH_URL} (up to ${MAX_WAIT}s) ==="
deadline=$((SECONDS + MAX_WAIT))
while [ "$SECONDS" -lt "$deadline" ]; do
  if curl -fsS "$HEALTH_URL" >/tmp/intellidocs-ai-health.json 2>/dev/null; then
    cat /tmp/intellidocs-ai-health.json
    echo ""
    if grep -qE '"ok"[[:space:]]*:[[:space:]]*true' /tmp/intellidocs-ai-health.json; then
      echo "OK: AI service healthy on port ${AI_PORT}."
      ss -tlnp | grep ":${AI_PORT} " || true
      exit 0
    fi
    if grep -qE '"ok"[[:space:]]*:[[:space:]]*false' /tmp/intellidocs-ai-health.json; then
      echo "ERROR: AI running but OCR not ready. Check: journalctl -u intellidocs-ai -n 50 --no-pager"
      exit 1
    fi
  fi
  sleep 2
done

echo "ERROR: AI did not respond on ${HEALTH_URL} within ${MAX_WAIT}s."
echo "  systemctl status intellidocs-ai"
systemctl --no-pager --full status intellidocs-ai || true
echo "  journalctl -u intellidocs-ai -n 40 --no-pager"
journalctl -u intellidocs-ai -n 40 --no-pager || true
exit 1
