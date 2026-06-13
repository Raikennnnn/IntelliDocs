#!/usr/bin/env bash
# Raise nginx + PHP timeouts so SF10 OCR (2–3 min) does not return HTML 504 pages.
# Run on the droplet as root:
#   bash /var/www/intellidocs/scripts/configure_nginx_ai_timeouts.sh
set -euo pipefail

TIMEOUT="${AI_FASTCGI_TIMEOUT:-300}"
APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"

echo "=== Configure nginx fastcgi timeouts (${TIMEOUT}s) ==="
CANDIDATES=(
  /etc/nginx/sites-enabled/*
  /etc/nginx/sites-available/*
  /etc/nginx/conf.d/*.conf
)
PATCHED=0
for f in "${CANDIDATES[@]}"; do
  [ -f "$f" ] || continue
  if ! grep -qE 'intellidocs|/var/www/intellidocs' "$f" 2>/dev/null; then
    continue
  fi
  if grep -q 'fastcgi_read_timeout' "$f"; then
    echo "  Already has fastcgi_read_timeout: $f"
    PATCHED=1
    continue
  fi
  if grep -q 'fastcgi_pass' "$f"; then
    sed -i "/fastcgi_pass/a\\        fastcgi_read_timeout ${TIMEOUT};\\n        fastcgi_send_timeout ${TIMEOUT};" "$f"
    echo "  Patched: $f"
    PATCHED=1
  fi
done

if [ "$PATCHED" = "0" ]; then
  echo "WARNING: Could not auto-patch nginx site config."
  echo "  Add inside your PHP location block:"
  echo "    fastcgi_read_timeout ${TIMEOUT};"
  echo "    fastcgi_send_timeout ${TIMEOUT};"
else
  nginx -t
  systemctl reload nginx
  echo "OK: nginx reloaded."
fi

echo "=== Configure PHP-FPM request timeout (${TIMEOUT}s) ==="
POOL="$(ls /etc/php/*/fpm/pool.d/www.conf 2>/dev/null | head -1 || true)"
if [ -n "$POOL" ]; then
  if grep -q '^request_terminate_timeout' "$POOL"; then
    sed -i "s/^request_terminate_timeout.*/request_terminate_timeout = ${TIMEOUT}/" "$POOL"
  else
    echo "request_terminate_timeout = ${TIMEOUT}" >> "$POOL"
  fi
  if systemctl is-active --quiet php8.3-fpm; then
    systemctl reload php8.3-fpm
  elif systemctl is-active --quiet php-fpm; then
    systemctl reload php-fpm
  fi
  echo "OK: PHP-FPM pool updated ($POOL)."
else
  echo "WARNING: PHP-FPM pool not found — set request_terminate_timeout = ${TIMEOUT} manually."
fi

echo "Done. Re-run AI on SF10 documents after this change."
