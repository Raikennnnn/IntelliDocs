#!/usr/bin/env bash
# Fast frontend-only update on the droplet (registrar UI, review page, etc.).
# Use after pushing frontend changes to GitHub.
#
# DigitalOcean console:
#   bash /var/www/intellidocs/scripts/deploy_ui_hotfix.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
BRANCH="${BRANCH:-IntelliDocs-V4}"

step() { printf '\n=== %s ===\n' "$1"; }

step "Pull latest frontend code ($BRANCH)"
cd "$APP_ROOT"
if [ ! -d .git ]; then
  echo "ERROR: $APP_ROOT is not a git clone."
  exit 1
fi
git fetch origin
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
echo "Commit: $(git log -1 --oneline)"

step "Build React frontend"
cd "$APP_ROOT/frontend"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if [ "$(swapon --show 2>/dev/null | wc -l)" -eq 0 ]; then
  echo "No swap — creating 2G swapfile for npm build…"
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab 2>/dev/null || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

cat > .env.production <<EOF
VITE_API_BASE=
VITE_API_TARGET=http://127.0.0.1
VITE_AI_BASE_URL=
EOF
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"
export CI=true
npm run build

step "Publish frontend to public/"
mkdir -p "$APP_ROOT/public/assets"
rm -rf "$APP_ROOT/public/assets/"*
cp -r dist/assets/* "$APP_ROOT/public/assets/"
cp dist/index.html "$APP_ROOT/public/index.html"
for f in favicon.png apple-touch-icon.png; do
  [ -f "dist/$f" ] && cp "dist/$f" "$APP_ROOT/public/$f"
done
rm -f "$APP_ROOT/public/favicon.ico"

mkdir -p "$APP_ROOT/public/app"
rm -rf "$APP_ROOT/public/app/"*
cp -r dist/* "$APP_ROOT/public/app/"
bash "$APP_ROOT/scripts/sync_spa_to_root.sh"

step "Verify bundle"
ROOT_BUNDLE="$(ls -1 "$APP_ROOT/public/assets"/index-*.js 2>/dev/null | head -1 || true)"
if [ -z "$ROOT_BUNDLE" ]; then
  echo "ERROR: No JS bundle in public/assets/"
  exit 1
fi
echo "Bundle: $ROOT_BUNDLE"
if grep -q 'SF10 may take 2' "$ROOT_BUNDLE" 2>/dev/null; then
  echo "WARNING: Old SF10 spinner message still in bundle — build may be stale."
else
  echo "OK: SF10 wait banner removed from live bundle."
fi
if grep -q 'Reason preset' "$ROOT_BUNDLE" 2>/dev/null; then
  echo "OK: Rejection reason preset dropdown found in live bundle."
else
  echo "WARNING: Rejection reason preset UI not found — rebuild may have failed."
fi

echo ""
echo "UI hotfix deployed at commit $(git -C "$APP_ROOT" rev-parse --short HEAD)."
echo "Hard refresh the registrar page: Ctrl+Shift+R"
