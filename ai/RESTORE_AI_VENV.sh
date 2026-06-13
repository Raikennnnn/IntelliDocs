#!/usr/bin/env bash
# Restore AI venv after a broken pip install (e.g. bare `pip install easyocr`).
set -euo pipefail

AI_DIR="${1:-/var/www/intellidocs/ai}"
cd "$AI_DIR"

echo "==> Reinstall pinned core deps"
.venv/bin/pip install -q -r requirements.txt

if [ "${INSTALL_EASYOCR_CPU:-0}" = "1" ]; then
  echo "==> Install CPU PyTorch + EasyOCR (optional level-3 OCR)"
  .venv/bin/pip install -q torch torchvision --index-url https://download.pytorch.org/whl/cpu
  .venv/bin/pip install -q -r requirements-easyocr-cpu.txt
fi

echo "==> Restart AI service"
systemctl restart intellidocs-ai
sleep 4
curl -fsS "http://127.0.0.1:8080/health" || {
  echo "Health check failed — run: journalctl -u intellidocs-ai -n 40 --no-pager"
  exit 1
}
