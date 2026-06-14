#!/usr/bin/env bash
# Run ON the droplet when deploy keeps serving an old UI.
# DigitalOcean console:
#   curl -fsSL https://raw.githubusercontent.com/Raikennnnn/IntelliDocs/IntelliDocs-V4/scripts/fix_droplet_git_and_deploy.sh | bash
# Or if already cloned:
#   bash /var/www/intellidocs/scripts/fix_droplet_git_and_deploy.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
BRANCH="${BRANCH:-IntelliDocs-V4}"

step() { printf '\n=== %s ===\n' "$1"; }

step "Diagnose"
if [ ! -d "$APP_ROOT/.git" ]; then
  echo "ERROR: $APP_ROOT is not a git repository (SFTP upload?)."
  echo "Fix: mv $APP_ROOT ${APP_ROOT}.bak && git clone -b $BRANCH https://github.com/Raikennnnn/IntelliDocs.git $APP_ROOT"
  exit 1
fi

cd "$APP_ROOT"
echo "Directory: $APP_ROOT"
echo "Current HEAD: $(git rev-parse --short HEAD 2>/dev/null || echo unknown) — $(git log -1 --format=%s 2>/dev/null || true)"
if git show-ref --verify --quiet "refs/tags/${BRANCH}"; then
  tag_rev="$(git rev-parse --short "refs/tags/${BRANCH}")"
  echo "WARNING: legacy tag ${BRANCH} points at ${tag_rev} (may override branch checkout)."
fi

step "Force checkout origin/${BRANCH} (not the old tag)"
git fetch origin
git checkout -B "$BRANCH" "origin/${BRANCH}"
git reset --hard "origin/${BRANCH}"
echo "Now at: $(git log -1 --oneline)"

step "Run deploy"
bash "$APP_ROOT/scripts/deploy_droplet.sh"

step "Verify live bundle"
ROOT_BUNDLE="$(ls -1 "$APP_ROOT/public/assets"/index-*.js 2>/dev/null | head -1 || true)"
echo "JS bundle: ${ROOT_BUNDLE:-MISSING}"
if [ -n "$ROOT_BUNDLE" ]; then
  if grep -q 'forgot-password' "$ROOT_BUNDLE" 2>/dev/null; then
    echo "OK: bundle includes forgot-password (current UI)."
  else
    echo "ERROR: bundle still OLD — no forgot-password string. Check nginx root and public/assets/."
    exit 1
  fi
fi
echo ""
echo "Done. Hard refresh: http://$(curl -fsS --max-time 3 ifconfig.me 2>/dev/null || echo YOUR_IP)/login"
