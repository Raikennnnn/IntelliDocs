#!/usr/bin/env bash
# Raise nginx + PHP timeouts so long OCR/verify requests return JSON, not HTML 502/504 pages.
# Run on the droplet as root:
#   bash /var/www/intellidocs/scripts/configure_nginx_ai_timeouts.sh
set -euo pipefail

TIMEOUT="${AI_FASTCGI_TIMEOUT:-600}"
APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"

patch_file() {
  local file="$1"
  [ -f "$file" ] || return 0
  local changed=0
  for key in fastcgi_read_timeout fastcgi_send_timeout; do
    if grep -qE "[[:space:]]${key}[[:space:]]" "$file"; then
      sed -i "s/^[[:space:]]*${key}[[:space:]].*/        ${key} ${TIMEOUT};/" "$file"
      changed=1
    elif grep -q "fastcgi_pass" "$file"; then
      sed -i "/fastcgi_pass/a\\        ${key} ${TIMEOUT};" "$file"
      changed=1
    fi
  done
  if grep -qE "[[:space:]]fastcgi_connect_timeout[[:space:]]" "$file"; then
    sed -i "s/^[[:space:]]*fastcgi_connect_timeout[[:space:]].*/        fastcgi_connect_timeout 60;/" "$file"
  elif grep -q "fastcgi_pass" "$file"; then
    sed -i "/fastcgi_pass/a\\        fastcgi_connect_timeout 60;" "$file"
    changed=1
  fi
  if [ "$changed" = "1" ]; then
    echo "  Patched: $file"
    PATCHED=1
  fi
}

echo "=== Configure nginx fastcgi timeouts (${TIMEOUT}s) ==="
PATCHED=0

# Drop-in snippet (included by many Debian/Ubuntu nginx setups).
SNIP_DIR="/etc/nginx/snippets"
SNIP_FILE="${SNIP_DIR}/intellidocs-php-timeouts.conf"
mkdir -p "$SNIP_DIR"
cat > "$SNIP_FILE" <<EOF
# IntelliDocs — long AI OCR verify (auto-generated)
fastcgi_read_timeout ${TIMEOUT};
fastcgi_send_timeout ${TIMEOUT};
fastcgi_connect_timeout 60;
EOF
echo "  Wrote snippet: $SNIP_FILE"
PATCHED=1

for f in /etc/nginx/sites-enabled/* /etc/nginx/sites-available/* /etc/nginx/conf.d/*.conf; do
  [ -f "$f" ] || continue
  grep -q "fastcgi_pass" "$f" || continue
  patch_file "$f"
  if ! grep -q "intellidocs-php-timeouts.conf" "$f" 2>/dev/null; then
    if grep -q "location.*php" "$f"; then
      sed -i "/location.*php/i\\    include snippets/intellidocs-php-timeouts.conf;" "$f" 2>/dev/null || true
    fi
  fi
done

if [ "$PATCHED" = "0" ]; then
  echo "WARNING: No nginx PHP config found to patch."
else
  nginx -t
  systemctl reload nginx
  echo "OK: nginx reloaded."
fi

echo "=== Configure PHP-FPM request timeout (${TIMEOUT}s) ==="
for POOL in /etc/php/*/fpm/pool.d/www.conf; do
  [ -f "$POOL" ] || continue
  if grep -q '^request_terminate_timeout' "$POOL"; then
    sed -i "s/^request_terminate_timeout.*/request_terminate_timeout = ${TIMEOUT}/" "$POOL"
  else
    echo "request_terminate_timeout = ${TIMEOUT}" >> "$POOL"
  fi
  echo "  Pool: $POOL"
  ver="$(basename "$(dirname "$(dirname "$POOL")")")"
  systemctl reload "${ver}-fpm" 2>/dev/null || true
done

echo "=== Configure PHP max_execution_time (${TIMEOUT}s) ==="
for INI in /etc/php/*/fpm/php.ini; do
  [ -f "$INI" ] || continue
  if grep -q '^max_execution_time' "$INI"; then
    sed -i "s/^max_execution_time = .*/max_execution_time = ${TIMEOUT}/" "$INI"
  else
    echo "max_execution_time = ${TIMEOUT}" >> "$INI"
  fi
  echo "  Updated: $INI"
done

# Apache + mod_php fallback (some XAMPP-style droplet images).
for APACHE in /etc/apache2/sites-enabled/* /etc/httpd/conf.d/*.conf; do
  [ -f "$APACHE" ] || continue
  grep -qi "intellidocs\|/var/www" "$APACHE" || continue
  if grep -q "Timeout" "$APACHE"; then
    sed -i "s/^[[:space:]]*Timeout.*/Timeout ${TIMEOUT}/" "$APACHE" 2>/dev/null || true
  fi
  echo "  Apache: $APACHE (check Timeout manually if using Apache)"
done

echo ""
echo "Done. Current nginx fastcgi_read_timeout values:"
grep -rh "fastcgi_read_timeout" /etc/nginx/ 2>/dev/null | head -5 || true
