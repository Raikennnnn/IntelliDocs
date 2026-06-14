#!/usr/bin/env bash
# Raise nginx + PHP timeouts so long OCR/verify requests return JSON, not HTML 502/504 pages.
# Run on the droplet as root:
#   bash /var/www/intellidocs/scripts/configure_nginx_ai_timeouts.sh
set -euo pipefail

TIMEOUT="${AI_FASTCGI_TIMEOUT:-300}"
APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"

set_or_replace() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -qE "^[[:space:]]*${key}[[:space:]]" "$file"; then
    sed -i "s/^[[:space:]]*${key}[[:space:]].*/        ${key} ${value};/" "$file"
  elif grep -q "fastcgi_pass" "$file"; then
    sed -i "/fastcgi_pass/a\\        ${key} ${value};" "$file"
  fi
}

echo "=== Configure nginx fastcgi timeouts (${TIMEOUT}s) ==="
CANDIDATES=(
  /etc/nginx/sites-enabled/*
  /etc/nginx/sites-available/*
  /etc/nginx/conf.d/*.conf
)
PATCHED=0
for f in "${CANDIDATES[@]}"; do
  [ -f "$f" ] || continue
  if ! grep -qE 'intellidocs|/var/www/intellidocs|fastcgi_pass' "$f" 2>/dev/null; then
    continue
  fi
  if ! grep -q 'fastcgi_pass' "$f"; then
    continue
  fi
  set_or_replace "$f" "fastcgi_read_timeout" "${TIMEOUT}"
  set_or_replace "$f" "fastcgi_send_timeout" "${TIMEOUT}"
  set_or_replace "$f" "fastcgi_connect_timeout" "60"
  # Long AI verify responses can be large JSON payloads.
  if grep -qE 'client_max_body_size' "$f"; then
    sed -i "s/^[[:space:]]*client_max_body_size[[:space:]].*/    client_max_body_size 32M;/" "$f"
  else
    sed -i "/server_name/a\\    client_max_body_size 32M;" "$f" 2>/dev/null || true
  fi
  echo "  Patched: $f"
  PATCHED=1
done

if [ "$PATCHED" = "0" ]; then
  echo "WARNING: Could not auto-patch nginx site config."
  echo "  Add inside your PHP location block:"
  echo "    fastcgi_read_timeout ${TIMEOUT};"
  echo "    fastcgi_send_timeout ${TIMEOUT};"
  echo "    fastcgi_connect_timeout 60;"
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

echo "=== Configure PHP max_execution_time (${TIMEOUT}s) ==="
for INI in /etc/php/*/fpm/php.ini; do
  [ -f "$INI" ] || continue
  if grep -q '^max_execution_time' "$INI"; then
    sed -i "s/^max_execution_time = .*/max_execution_time = ${TIMEOUT}/" "$INI"
  else
    echo "max_execution_time = ${TIMEOUT}" >> "$INI"
  fi
  echo "  Updated: $INI"
  PHP_FPM="$(echo "$INI" | sed 's|/php.ini||')"
  if systemctl is-active --quiet "$(basename "$(dirname "$PHP_FPM")")-fpm" 2>/dev/null; then
    systemctl reload "$(basename "$(dirname "$PHP_FPM")")-fpm" || true
  fi
done

echo "Done. AI verify can take up to ${TIMEOUT}s per document on a small server."
