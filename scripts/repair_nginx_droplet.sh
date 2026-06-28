#!/usr/bin/env bash
# Fix nginx failing to start on the IntelliDocs droplet (Cloudflare 521).
# Run as root in DigitalOcean console:
#   bash /var/www/intellidocs/scripts/repair_nginx_droplet.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
SITE_NAME="intellidocs"
SITE_AVAIL="/etc/nginx/sites-available/${SITE_NAME}"
SITE_ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"
BACKUP_DIR="/etc/nginx/intellidocs-backup-$(date +%Y%m%d_%H%M%S)"

step() { printf '\n=== %s ===\n' "$1"; }

detect_php_socket() {
  for s in /run/php/php8.3-fpm.sock /run/php/php8.2-fpm.sock /run/php/php-fpm.sock; do
    if [ -S "$s" ]; then
      echo "$s"
      return 0
    fi
  done
  echo "/run/php/php8.3-fpm.sock"
}

clean_duplicate_fastcgi_timeouts() {
  local f
  for f in /etc/nginx/snippets/fastcgi-php.conf \
           /etc/nginx/sites-available/* \
           /etc/nginx/sites-enabled/* \
           /etc/nginx/conf.d/*.conf; do
    [ -f "$f" ] || continue
    sed -i '/intellidocs-php-timeouts/d' "$f" 2>/dev/null || true
    sed -i '/IntelliDocs AI verify/d' "$f" 2>/dev/null || true
    sed -i '/^[[:space:]]*fastcgi_read_timeout/d' "$f" 2>/dev/null || true
    sed -i '/^[[:space:]]*fastcgi_send_timeout/d' "$f" 2>/dev/null || true
    sed -i '/^[[:space:]]*fastcgi_connect_timeout/d' "$f" 2>/dev/null || true
  done
  rm -f /etc/nginx/snippets/intellidocs-php-timeouts.conf
}

step "Diagnose nginx failure"
nginx -t 2>&1 || true
journalctl -u nginx -n 25 --no-pager 2>/dev/null || true

step "Stop conflicting web servers on port 80"
if systemctl is-active --quiet apache2 2>/dev/null; then
  systemctl stop apache2
  systemctl disable apache2 2>/dev/null || true
  echo "Stopped apache2"
fi
if ss -tlnp 2>/dev/null | grep -q ':80 '; then
  echo "Port 80 is in use:"
  ss -tlnp | grep ':80 ' || true
fi

step "Back up current nginx site configs"
mkdir -p "$BACKUP_DIR"
cp -a /etc/nginx/sites-enabled "$BACKUP_DIR/" 2>/dev/null || true
cp -a /etc/nginx/sites-available "$BACKUP_DIR/" 2>/dev/null || true
echo "Backup: $BACKUP_DIR"

PHP_SOCK="$(detect_php_socket)"
echo "Using PHP socket: $PHP_SOCK"

step "Remove duplicate fastcgi timeout directives"
clean_duplicate_fastcgi_timeouts

step "Write clean IntelliDocs nginx site (HTTP)"
cat > "$SITE_AVAIL" <<EOF
# IntelliDocs — auto-repaired site config
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name nsdgam.com www.nsdgam.com _;

    root ${APP_ROOT}/public;
    index index.html index.php;

    client_max_body_size 32M;

    location /api/ {
        try_files \$uri /index.php?\$query_string;
    }

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        try_files \$uri =404;
    }

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files \$uri =404;
    }

    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${PHP_SOCK};
        fastcgi_param HTTP_AUTHORIZATION \$http_authorization;
        fastcgi_read_timeout 600;
        fastcgi_send_timeout 600;
        fastcgi_connect_timeout 60;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(png|jpg|jpeg|gif|webp|svg|ico|woff2?)\$ {
        expires 7d;
        add_header Cache-Control "public";
        try_files \$uri =404;
    }
}
EOF

step "Enable only IntelliDocs site"
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/*
ln -sf "$SITE_AVAIL" "$SITE_ENABLED"

step "Ensure PHP-FPM is running"
for svc in php8.3-fpm php8.2-fpm php-fpm; do
  if systemctl list-unit-files "${svc}.service" 2>/dev/null | grep -q "${svc}.service"; then
    systemctl enable "$svc" 2>/dev/null || true
    systemctl start "$svc" 2>/dev/null || true
  fi
done

step "Test and start nginx"
nginx -t
systemctl enable nginx
systemctl restart nginx
systemctl --no-pager --full status nginx | head -n 8

step "Smoke check"
curl -fsS -o /dev/null -w "HTTP /landing -> %{http_code}\n" "http://127.0.0.1/landing" || true
curl -fsS -o /dev/null -w "HTTP /api/school-year -> %{http_code}\n" "http://127.0.0.1/api/school-year" || true

printf '\nNginx repair finished.\n'
printf 'If curl shows 200/301/302, wait ~30s then reload https://nsdgam.com\n'
printf 'Old configs backed up under: %s\n' "$BACKUP_DIR"
