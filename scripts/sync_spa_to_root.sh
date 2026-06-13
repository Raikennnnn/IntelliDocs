#!/usr/bin/env bash
# Copy the built SPA from public/app/ to public/ (index.html + assets/).
# Use when nginx serves /landing from site root but deploy only updated public/app/.
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
APP_DIR="$APP_ROOT/public/app"
ROOT="$APP_ROOT/public"

if [ ! -f "$APP_DIR/index.html" ]; then
  echo "Missing $APP_DIR/index.html — run: cd $APP_ROOT/frontend && npm run build && cp -r dist/* $APP_DIR/"
  exit 1
fi

echo "Syncing SPA: $APP_DIR -> $ROOT"
mkdir -p "$ROOT/assets"
cp "$APP_DIR/index.html" "$ROOT/index.html"
rm -rf "$ROOT/assets/"*
cp -r "$APP_DIR/assets/"* "$ROOT/assets/"
for f in favicon.png apple-touch-icon.png; do
  if [ -f "$APP_DIR/$f" ]; then
    cp "$APP_DIR/$f" "$ROOT/$f"
  fi
done
# Drop legacy CodeIgniter flame icon if present
rm -f "$ROOT/favicon.ico"

BUNDLE="$(ls -1 "$ROOT/assets"/index-*.js | head -1)"
echo "Root index.html now points to assets under $(basename "$BUNDLE")"
if grep -q 'SIGNATURE SCANNED' "$BUNDLE" 2>/dev/null; then
  echo "WARNING: Bundle still looks old. Rebuild frontend on the server or copy a fresh dist/ from your PC."
else
  echo "OK: Bundle looks current."
fi
echo "Hard refresh the browser: Ctrl+Shift+R on http://YOUR_IP/landing"
