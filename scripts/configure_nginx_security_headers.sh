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

step "Ensure nginx site includes security snippet (server + location blocks)"
cp -a "$SITE_FILE" "${SITE_FILE}.bak.$(date +%Y%m%d%H%M%S)"

# Server block: one include after server_name.
if ! grep -qF "$INCLUDE_LINE" "$SITE_FILE"; then
  sed -i "0,/server_name[^;]*;/s#&#\n    ${INCLUDE_LINE}#" "$SITE_FILE"
  echo "Added server-level include to $SITE_FILE"
else
  echo "Server-level include already present"
fi

# Nginx drops server-level add_header when a location defines its own add_header.
# Patch any location block that has add_header (or PHP) but not the security include.
awk -v inc="        include snippets/intellidocs-security-headers.conf;" '
  /^[[:space:]]*location[[:space:]]/ {
    flush()
    in_block = 1
    depth = 1
    block[0] = $0
    n = 1
    has_add = ($0 ~ /add_header/)
    has_sec = ($0 ~ /intellidocs-security-headers/)
    has_php = ($0 ~ /\.php/)
    next
  }
  in_block {
    block[n++] = $0
    if ($0 ~ /intellidocs-security-headers/) has_sec = 1
    if ($0 ~ /add_header/) has_add = 1
    if ($0 ~ /\.php/) has_php = 1
    if ($0 ~ /\{/) depth++
    if ($0 ~ /\}/) depth--
    if (depth <= 0) {
      flush()
      in_block = 0
    }
    next
  }
  { print }
  END { flush() }

  function flush(    i) {
    if (!in_block && n == 0) return
    if (n == 0) return
    print block[0]
    if ((has_add || has_php) && !has_sec) {
      print inc
      print "Patched location block" > "/dev/stderr"
    }
    for (i = 1; i < n; i++) print block[i]
    delete block
    n = 0
    has_add = has_sec = has_php = 0
    in_block = 0
  }
' "$SITE_FILE" > "${SITE_FILE}.tmp" && mv "${SITE_FILE}.tmp" "$SITE_FILE"

step "Test and reload nginx"
nginx -t
systemctl reload nginx

step "Verify headers on homepage (local nginx)"
curl -sSI "http://127.0.0.1/" | grep -iE '^(content-security-policy|strict-transport-security|referrer-policy|x-content-type-options|x-frame-options):' || {
  echo "WARNING: No security headers on /. Run: bash scripts/repair_nginx_droplet.sh"
}

step "Verify headers on API (local nginx)"
curl -sSI "http://127.0.0.1/api/school-year" | grep -iE '^(content-security-policy|strict-transport-security|referrer-policy|x-content-type-options|x-frame-options):' || true

printf '\nDone. Re-scan https://nsdgam.com after Cloudflare cache clears (~1 min).\n'
printf 'If the scanner still fails, add the same headers in Cloudflare → Rules → Transform Rules → Modify response header.\n'
