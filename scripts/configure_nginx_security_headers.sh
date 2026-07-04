#!/usr/bin/env bash
# Install IntelliDocs HTTP security headers on nginx (no app code changes).
# Run on the droplet as root:
#   bash /var/www/intellidocs/scripts/configure_nginx_security_headers.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
SNIP_SRC="${APP_ROOT}/scripts/nginx/intellidocs-security-headers.conf"
SNIP_DST="/etc/nginx/snippets/intellidocs-security-headers.conf"
SITE_FILE="/etc/nginx/sites-available/intellidocs"
INCLUDE_LINE="include snippets/intellidocs-security-headers.conf;"

step() { printf '\n=== %s ===\n' "$1"; }

if [ ! -f "$SNIP_SRC" ]; then
  echo "ERROR: Missing $SNIP_SRC — run git pull first."
  exit 1
fi

step "Install security headers snippet"
install -m 0644 "$SNIP_SRC" "$SNIP_DST"
echo "Wrote $SNIP_DST"

if [ ! -f "$SITE_FILE" ]; then
  echo "WARNING: $SITE_FILE not found. Run repair_nginx_droplet.sh or create the site first."
  exit 1
fi

step "Ensure nginx site includes security snippet"
if grep -qF "$INCLUDE_LINE" "$SITE_FILE"; then
  echo "Already included in $SITE_FILE"
else
  # Insert after the first server_name line inside the server block.
  sed -i "0,/server_name[^;]*;/s//&\n    ${INCLUDE_LINE}/" "$SITE_FILE"
  echo "Added include to $SITE_FILE"
fi

step "Test and reload nginx"
nginx -t
systemctl reload nginx

step "Verify headers on homepage"
curl -sSI "http://127.0.0.1/" | grep -iE '^(content-security-policy|strict-transport-security|referrer-policy|x-content-type-options|x-frame-options):' || true

printf '\nSecurity headers configured. Re-scan https://nsdgam.com after Cloudflare cache clears (~1 min).\n'
