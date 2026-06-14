#!/usr/bin/env bash
# Print why AI verify returns HTTP 502 on the droplet.
#   bash /var/www/intellidocs/scripts/diagnose_ai_502.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"

echo "=== IntelliDocs AI 502 diagnostic ==="
echo "Time: $(date -Is 2>/dev/null || date)"
echo ""

echo "--- Git commit ---"
git -C "$APP_ROOT" log -1 --oneline 2>/dev/null || echo "Not a git clone"
echo ""

echo "--- AI service ---"
systemctl is-active intellidocs-ai 2>/dev/null || echo "intellidocs-ai not active"
curl -fsS --max-time 5 http://127.0.0.1:8080/health 2>/dev/null || echo "AI health FAILED on :8080"
echo ""

echo "--- nginx fastcgi timeouts (need 300+ for Form 137) ---"
grep -rh "fastcgi_read_timeout" /etc/nginx/ 2>/dev/null | sort -u || echo "NONE FOUND — run configure_nginx_ai_timeouts.sh"
echo ""

echo "--- PHP-FPM request_terminate_timeout ---"
grep -rh "^request_terminate_timeout" /etc/php/*/fpm/pool.d/www.conf 2>/dev/null || echo "not set"
echo ""

echo "--- PHP max_execution_time ---"
grep -rh "^max_execution_time" /etc/php/*/fpm/php.ini 2>/dev/null | head -3 || echo "not found"
echo ""

echo "--- Memory / swap ---"
free -h 2>/dev/null || true
echo ""

echo "--- Recent AI errors ---"
journalctl -u intellidocs-ai -n 15 --no-pager 2>/dev/null || true
echo ""
echo "If fastcgi_read_timeout is missing or under 300, run:"
echo "  bash $APP_ROOT/scripts/configure_nginx_ai_timeouts.sh"
echo "Then use Run AI on ONE document at a time in the registrar portal."
