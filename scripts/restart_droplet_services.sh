#!/usr/bin/env bash
# Safe restart of IntelliDocs web stack on the DigitalOcean droplet.
# Run ONLY on the server (DO web console or SSH), as root:
#   bash /var/www/intellidocs/scripts/restart_droplet_services.sh
#
# Do NOT run systemctl on your Windows PC — it will fail.
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"

step() { printf '\n=== %s ===\n' "$1"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: Run as root on the droplet (DigitalOcean console or: sudo bash $0)"
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "ERROR: systemctl not found. This script runs on the Linux droplet, not Windows/XAMPP."
  exit 1
fi

step "Fix nginx config if duplicate fastcgi timeouts exist"
if ! nginx -t 2>/dev/null; then
  echo "nginx -t failed — running repair..."
  if [ -f "$APP_ROOT/scripts/repair_nginx_droplet.sh" ]; then
    bash "$APP_ROOT/scripts/repair_nginx_droplet.sh"
  else
    sed -i '/fastcgi_read_timeout/d;/fastcgi_send_timeout/d;/fastcgi_connect_timeout/d;/intellidocs-php-timeouts/d' \
      /etc/nginx/snippets/fastcgi-php.conf 2>/dev/null || true
    rm -f /etc/nginx/snippets/intellidocs-php-timeouts.conf
    nginx -t
  fi
else
  echo "nginx config OK"
fi

step "Restart PHP-FPM"
PHP_RESTARTED=0
for svc in php8.3-fpm php8.2-fpm php8.1-fpm php-fpm; do
  if systemctl list-unit-files "${svc}.service" 2>/dev/null | grep -q "${svc}.service"; then
    systemctl restart "$svc"
    echo "OK: restarted $svc"
    PHP_RESTARTED=1
    break
  fi
done
if [ "$PHP_RESTARTED" = "0" ]; then
  echo "WARNING: No php-fpm service found (php8.3-fpm, php8.2-fpm, ...)"
fi

step "Restart nginx"
systemctl restart nginx
systemctl --no-pager --full status nginx | head -n 6

step "Restart IntelliDocs AI (optional)"
if systemctl list-unit-files intellidocs-ai.service 2>/dev/null | grep -q intellidocs-ai.service; then
  systemctl restart intellidocs-ai
  systemctl --no-pager --full status intellidocs-ai | head -n 6
else
  echo "SKIP: intellidocs-ai not installed. Run: bash $APP_ROOT/scripts/deploy_droplet.sh"
fi

step "Smoke checks"
sleep 2
curl -fsS -o /dev/null -w "HTTP /landing -> %{http_code}\n" "http://127.0.0.1/landing" || echo "FAIL: /landing"
curl -fsS -o /dev/null -w "HTTP /api/school-year -> %{http_code}\n" "http://127.0.0.1/api/school-year" || echo "FAIL: /api/school-year"

printf '\nDone. If HTTP codes are 200/301/302, reload https://nsdgam.com\n'
