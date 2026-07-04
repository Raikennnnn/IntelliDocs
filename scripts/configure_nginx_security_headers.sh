#!/usr/bin/env bash
# Install IntelliDocs HTTP security headers on nginx (no app code changes).
# Rewrites the nginx site with inline add_header directives (include alone is
# unreliable when locations also set Cache-Control headers).
# Run on the droplet as root:
#   bash /var/www/intellidocs/scripts/configure_nginx_security_headers.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"

step() { printf '\n=== %s ===\n' "$1"; }

if [ ! -f "${APP_ROOT}/scripts/nginx/intellidocs-security-headers.conf" ]; then
  echo "ERROR: Missing security headers snippet — run git pull first."
  exit 1
fi

step "Rewrite nginx site with inline security headers"
bash "${APP_ROOT}/scripts/repair_nginx_droplet.sh"

step "Verify headers on homepage (local nginx)"
if curl -sSI "http://127.0.0.1/index.html" | grep -qi 'content-security-policy:'; then
  curl -sSI "http://127.0.0.1/index.html" | grep -iE '^(content-security-policy|strict-transport-security|referrer-policy|x-content-type-options|x-frame-options):'
else
  echo "ERROR: Security headers still missing after repair."
  echo "Check: nginx -T | grep -i add_header | head -20"
  exit 1
fi

step "Verify headers on API (local nginx)"
curl -sSI "http://127.0.0.1/api/school-year" | grep -iE '^(content-security-policy|strict-transport-security|referrer-policy|x-content-type-options|x-frame-options):' || true

printf '\nDone. Re-scan https://nsdgam.com after ~1 minute.\n'
