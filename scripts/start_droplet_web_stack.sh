#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Start IntelliDocs web stack after a droplet reboot (fixes Cloudflare 521).
# Run on the server:
#   bash /var/www/intellidocs/scripts/start_droplet_web_stack.sh
# -----------------------------------------------------------------------------
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"

step() { printf '\n=== %s ===\n' "$1"; }

detect_php_fpm() {
  for svc in php8.3-fpm php8.2-fpm php8.1-fpm php-fpm; do
    if systemctl list-unit-files "${svc}.service" 2>/dev/null | grep -q "${svc}.service"; then
      echo "$svc"
      return 0
    fi
  done
  return 1
}

start_enable() {
  local svc="$1"
  if systemctl list-unit-files "${svc}.service" 2>/dev/null | grep -q "${svc}.service"; then
    systemctl enable "$svc" 2>/dev/null || true
    if systemctl is-active --quiet "$svc"; then
      echo "OK: $svc already running"
    else
      systemctl start "$svc"
      echo "STARTED: $svc"
    fi
    systemctl --no-pager --full status "$svc" | head -n 5 || true
  else
    echo "SKIP: $svc not installed"
  fi
}

step "MySQL"
start_enable mysql
start_enable mariadb

step "PHP-FPM"
PHP_FPM="$(detect_php_fpm || true)"
if [ -n "$PHP_FPM" ]; then
  start_enable "$PHP_FPM"
else
  echo "WARNING: No php-fpm unit found"
fi

step "Nginx"
start_enable nginx
if command -v nginx >/dev/null 2>&1; then
  nginx -t
fi

step "IntelliDocs AI service"
if [ -f /etc/systemd/system/intellidocs-ai.service ]; then
  start_enable intellidocs-ai
else
  echo "SKIP: intellidocs-ai unit missing — run deploy_droplet.sh once"
fi

step "Listen ports"
ss -tlnp 2>/dev/null | grep -E ':80|:443' || echo "WARNING: nothing listening on 80/443"

step "Local smoke checks"
curl -fsS -o /dev/null -w "HTTP /landing -> %{http_code}\n" "http://127.0.0.1/landing" || echo "FAIL: /landing"
curl -fsS -o /dev/null -w "HTTP /api/school-year -> %{http_code}\n" "http://127.0.0.1/api/school-year" || echo "FAIL: /api/school-year"

printf '\nDone. If HTTP codes are 200/301/302, refresh https://nsdgam.com in ~30s.\n'
printf 'If nginx failed: journalctl -u nginx -n 40 --no-pager\n'
