#!/usr/bin/env bash
# Find why AI verify returns HTTP 502 (nginx HTML) on the droplet.
#   bash /var/www/intellidocs/scripts/diagnose_ai_502.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
TIMEOUT_NEED="${AI_FASTCGI_TIMEOUT:-600}"

echo "=== IntelliDocs AI 502 diagnostic ==="
echo "Time: $(date -Is 2>/dev/null || date)"
echo ""

echo "--- Git commit (live code on disk) ---"
git -C "$APP_ROOT" log -1 --oneline 2>/dev/null || echo "Not a git clone — deploy may be stale"
echo ""

echo "--- AI service (direct, bypasses nginx) ---"
if systemctl is-active intellidocs-ai >/dev/null 2>&1; then
  echo "intellidocs-ai: active"
else
  echo "intellidocs-ai: NOT ACTIVE — run: bash $APP_ROOT/scripts/fix_ai_service.sh"
fi
HEALTH="$(curl -fsS --max-time 8 http://127.0.0.1:8080/health 2>/dev/null || true)"
if [ -n "$HEALTH" ]; then
  echo "$HEALTH"
else
  echo "AI health FAILED on :8080"
fi
echo ""

echo "--- Gunicorn timeout (must be >= ${TIMEOUT_NEED}s) ---"
if [ -f /etc/systemd/system/intellidocs-ai.service ]; then
  grep -E "ExecStart|workers|timeout" /etc/systemd/system/intellidocs-ai.service || true
else
  echo "No intellidocs-ai.service unit file"
fi
echo ""

echo "--- nginx EFFECTIVE fastcgi_read_timeout (nginx -T) ---"
if command -v nginx >/dev/null 2>&1; then
  EFFECTIVE="$(nginx -T 2>/dev/null | grep -E "fastcgi_read_timeout|fastcgi_send_timeout" | sort -u || true)"
  if [ -n "$EFFECTIVE" ]; then
    echo "$EFFECTIVE"
    if echo "$EFFECTIVE" | grep -qvE "${TIMEOUT_NEED}|300|[4-9][0-9]{2,}"; then
      echo ""
      echo "PROBLEM: Active nginx timeout looks like 60s default — PHP is killed before AI finishes."
    fi
  else
    echo "NONE in nginx -T — default is 60s. Run configure_nginx_ai_timeouts.sh"
  fi
else
  echo "nginx not installed (Apache/XAMPP?) — use configure_xampp_ai_timeouts.ps1 on Windows"
fi
echo ""

echo "--- PHP-FPM request_terminate_timeout ---"
grep -rh "^request_terminate_timeout" /etc/php/*/fpm/pool.d/www.conf 2>/dev/null || echo "not set (may default to unlimited or 60s pool config)"
echo ""

echo "--- Memory / swap (OOM kills AI mid-verify → 502) ---"
free -h 2>/dev/null || true
echo ""

echo "--- Direct AI verify timing (bypasses nginx — proves AI can finish) ---"
SAMPLE=""
for candidate in \
  "$APP_ROOT/frontend/public/admission-samples/good-moral-certificate.jpg" \
  "$APP_ROOT/ai/uploads/goodmoral_1_1.jpg" \
  "$APP_ROOT/frontend/public/admission-samples/id-picture-2x2.jpg"; do
  if [ -f "$candidate" ]; then
    SAMPLE="$candidate"
    break
  fi
done
if [ -n "$SAMPLE" ]; then
  echo "Sample: $SAMPLE"
  START=$(date +%s)
  HTTP="$(curl -sS -o /tmp/intellidocs-verify-test.json -w '%{http_code}' --max-time 180 \
    -X POST -F "image=@${SAMPLE}" -F "doc_type=good_moral" \
    http://127.0.0.1:8080/verify 2>/dev/null || echo "000")"
  END=$(date +%s)
  ELAPSED=$((END - START))
  echo "Direct /verify HTTP ${HTTP} in ${ELAPSED}s"
  if [ "$HTTP" = "200" ]; then
    echo "OK: AI service completes verify in ${ELAPSED}s when nginx is not in the path."
    if [ "$ELAPSED" -ge 55 ]; then
      echo "NOTE: Took ${ELAPSED}s — if nginx fastcgi_read_timeout is 60, browser will get 502."
    fi
  else
    echo "PROBLEM: AI verify failed directly — check: journalctl -u intellidocs-ai -n 40 --no-pager"
    head -c 300 /tmp/intellidocs-verify-test.json 2>/dev/null || true
    echo ""
  fi
else
  echo "No sample image found for timing test."
fi
echo ""

echo "--- Recent AI journal errors ---"
journalctl -u intellidocs-ai -n 12 --no-pager 2>/dev/null || true
echo ""

echo "=== Root cause checklist ==="
echo "  1. HTML '502 Bad Gateway' in browser = nginx gave up waiting for PHP (usually 60s default)."
echo "  2. Fix: bash $APP_ROOT/scripts/configure_nginx_ai_timeouts.sh (must show ${TIMEOUT_NEED} in nginx -T above)."
echo "  3. Also: bash $APP_ROOT/scripts/fix_ai_service.sh (gunicorn timeout 620s, 1 worker on small droplet)."
echo "  4. Then: bash $APP_ROOT/scripts/deploy_ui_hotfix.sh && hard refresh browser (Ctrl+Shift+R)."
echo "  5. In portal: Run AI on ONE file at a time; Form 137 / SF10 last."
