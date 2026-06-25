#!/usr/bin/env bash
# Fail deploy if index.html references JS/CSS chunks that are missing from public/assets/.
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
ASSETS="$APP_ROOT/public/assets"
INDEX="$APP_ROOT/public/index.html"

if [ ! -f "$INDEX" ]; then
  echo "ERROR: Missing $INDEX"
  exit 1
fi
if [ ! -d "$ASSETS" ]; then
  echo "ERROR: Missing $ASSETS"
  exit 1
fi

ROOT_BUNDLE="$(ls -1 "$ASSETS"/index-*.js 2>/dev/null | head -1 || true)"
if [ -z "$ROOT_BUNDLE" ]; then
  echo "ERROR: No index-*.js in $ASSETS"
  exit 1
fi

missing=0
check_file() {
  local name="$1"
  if [ ! -f "$ASSETS/$name" ]; then
    echo "MISSING: $ASSETS/$name"
    missing=1
  fi
}

# Assets linked directly from index.html
while IFS= read -r ref; do
  base="$(basename "$ref")"
  [ -n "$base" ] && check_file "$base"
done < <(grep -oE '/assets/[^"'\'' ]+\.(js|css)' "$INDEX" 2>/dev/null | sed 's|^/assets/||' || true)

# Lazy chunks referenced from the main bundle (e.g. Announcements-*.js)
while IFS= read -r chunk; do
  [ -n "$chunk" ] && check_file "$chunk"
done < <(grep -oE 'assets/[A-Za-z0-9_.-]+\.js' "$ROOT_BUNDLE" 2>/dev/null | sed 's|^assets/||' | sort -u || true)

if [ "$missing" -ne 0 ]; then
  echo ""
  echo "ERROR: Frontend asset mismatch — run: bash $APP_ROOT/scripts/deploy_ui_hotfix.sh"
  exit 1
fi

echo "OK: All referenced frontend chunks exist under $ASSETS ($(ls -1 "$ASSETS" | wc -l) files)"
