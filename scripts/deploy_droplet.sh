#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# IntelliDocs — update an existing DigitalOcean droplet deployment.
# Run ON the server as root (or sudo) from any directory:
#   bash /var/www/intellidocs/scripts/deploy_droplet.sh
#
# First-time setup: clone repo to /var/www/intellidocs, configure env, nginx,
# mysql, and intellidocs-ai systemd unit (see SETUP.md / RELEASE.md).
# -----------------------------------------------------------------------------

set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/intellidocs}"
BRANCH="${BRANCH:-IntelliDocs-V4}"
GIT_REMOTE="${GIT_REMOTE:-https://github.com/Raikennnnn/IntelliDocs.git}"
PUBLIC_IP="${PUBLIC_IP:-$(curl -fsS --max-time 3 ifconfig.me 2>/dev/null || echo 127.0.0.1)}"

step() { printf '\n=== %s ===\n' "$1"; }

step "Ensure project directory ($APP_ROOT)"
if [ ! -d "$APP_ROOT" ]; then
  mkdir -p "$(dirname "$APP_ROOT")"
  git clone -b "$BRANCH" "$GIT_REMOTE" "$APP_ROOT"
elif [ ! -d "$APP_ROOT/.git" ]; then
  echo "WARNING: $APP_ROOT exists but is NOT a git clone (no .git folder)."
  echo "  Upload-only / SFTP folders cannot 'git pull'."
  echo ""
  echo "  Fix (pick one):"
  echo "    A) Fresh clone (backs up current folder):"
  echo "         mv $APP_ROOT ${APP_ROOT}.bak.\$(date +%Y%m%d)"
  echo "         git clone -b $BRANCH $GIT_REMOTE $APP_ROOT"
  echo "    B) Turn existing folder into a git checkout (keeps env/uploads if present):"
  echo "         cd $APP_ROOT && git init && git remote add origin $GIT_REMOTE"
  echo "         git fetch origin && git checkout -B $BRANCH origin/$BRANCH"
  echo ""
  echo "  Continuing without git pull — using files already on disk."
  SKIP_GIT=1
else
  SKIP_GIT=0
fi

cd "$APP_ROOT"

if [ "${SKIP_GIT:-0}" = "0" ] && [ -d .git ]; then
  step "Pull latest code ($BRANCH)"
  git fetch origin
  # IMPORTANT: a legacy tag also named "IntelliDocs-V4" exists on GitHub.
  # `git checkout IntelliDocs-V4` can land on that old tag instead of the branch.
  if ! git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
    echo "ERROR: origin/${BRANCH} not found after fetch. Check GIT_REMOTE and branch name."
    exit 1
  fi
  git checkout -B "$BRANCH" "origin/${BRANCH}"
  git reset --hard "origin/${BRANCH}"
  echo "Checked out branch ${BRANCH} at $(git rev-parse --short HEAD) ($(git log -1 --format=%s))"
else
  step "Skip git pull (not a repository)"
fi

step "Ensure production env exists"
if [ ! -f env ]; then
  cp env.example env
  echo "Created env from template — edit $APP_ROOT/env before going live."
fi

step "Apply database migrations (optional)"
DB_NAME="${DB_NAME:-intellidocs_db}"
DB_USER="${DB_USER:-intellidocs}"
if command -v mysql >/dev/null 2>&1 && [ -n "${MYSQL_PWD:-}" ]; then
  # NEVER run database_setup.sql here — it DROP DATABASE and wipes production data.
  for f in database_migration_*.sql; do
    [ -f "$f" ] || continue
    echo "  -> $f"
    mysql -u "$DB_USER" "$DB_NAME" < "$f" || true
  done
else
  echo "Skipping auto-migrations (set MYSQL_PWD or run SQL manually)."
  echo "  mysql -u intellidocs -p intellidocs_db < database_migration_*.sql"
fi

step "Build React frontend"
cd "$APP_ROOT/frontend"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Vite/React build needs ~1–1.5 GB RAM. On a 2 GB droplet, ensure swap exists.
if [ "$(swapon --show 2>/dev/null | wc -l)" -eq 0 ]; then
  echo "No swap detected — creating 2G swapfile (recommended for npm run build)…"
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

echo "Running vite build (often 2–6 minutes on a small droplet — wait for 'built in')…"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"
export CI=true
npm run build

step "Publish frontend (SPA at site root + /app/)"
# Production nginx serves React at /landing, /registrar/… via try_files → /index.html
# and loads JS from /assets/*. Deploy must update public/index.html + public/assets/,
# not only public/app/ (otherwise the live site keeps an old cached bundle).
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

# Keep site root in sync (nginx try_files → /index.html for /landing, /registrar/…)
bash "$APP_ROOT/scripts/sync_spa_to_root.sh"
bash "$APP_ROOT/scripts/verify_frontend_assets.sh"
# Static marketing assets used by enrollment UI
if [ -d public/admission-samples ]; then
  mkdir -p "$APP_ROOT/public/admission-samples"
  cp -r public/admission-samples/* "$APP_ROOT/public/admission-samples/" 2>/dev/null || true
fi
if [ -d public/strands ]; then
  mkdir -p "$APP_ROOT/public/strands"
  cp -r public/strands/* "$APP_ROOT/public/strands/" 2>/dev/null || true
fi
if [ -d public/report-assets ]; then
  mkdir -p "$APP_ROOT/public/report-assets"
  cp -r public/report-assets/* "$APP_ROOT/public/report-assets/" 2>/dev/null || true
fi

step "Ensure Tesseract OCR (required for AI verification)"
if ! command -v tesseract >/dev/null 2>&1; then
  apt-get install -y tesseract-ocr || echo "WARNING: could not install tesseract-ocr"
fi

step "Ensure production env AI_BASE_URL"
ENV_FILE="$APP_ROOT/env"
if [ -f "$ENV_FILE" ]; then
  if grep -q '^AI_BASE_URL=' "$ENV_FILE"; then
    sed -i.bak 's|^AI_BASE_URL=.*|AI_BASE_URL=http://127.0.0.1:8080|' "$ENV_FILE"
  else
    echo 'AI_BASE_URL=http://127.0.0.1:8080' >> "$ENV_FILE"
  fi
  grep -q '^AI_OCR_ENGINE=' "$ENV_FILE" || echo 'AI_OCR_ENGINE=tesseract' >> "$ENV_FILE"
  grep -q '^DISABLE_EASYOCR=' "$ENV_FILE" || echo 'DISABLE_EASYOCR=1' >> "$ENV_FILE"
fi

step "Python AI service"
cd "$APP_ROOT/ai"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

AI_WORKERS="${AI_WORKERS:-1}"
GUNICORN_TIMEOUT="${GUNICORN_TIMEOUT:-620}"
write_ai_systemd_unit() {
  cat > /etc/systemd/system/intellidocs-ai.service <<UNIT
[Unit]
Description=IntelliDocs AI Service
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=${APP_ROOT}/ai
Environment=PORT=8080
Environment=AI_OCR_ENGINE=tesseract
Environment=DISABLE_EASYOCR=1
ExecStart=${APP_ROOT}/ai/.venv/bin/gunicorn --bind 127.0.0.1:8080 --workers ${AI_WORKERS} --worker-class gthread --threads 2 --timeout ${GUNICORN_TIMEOUT} --graceful-timeout 120 app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
}

wait_for_ai_health() {
  local url="http://127.0.0.1:8080/health"
  local max_wait="${1:-90}"
  local deadline=$((SECONDS + max_wait))
  echo "Waiting for AI health at ${url} (up to ${max_wait}s)…"
  while [ "$SECONDS" -lt "$deadline" ]; do
    if AI_HEALTH="$(curl -fsS "$url" 2>/dev/null)"; then
      echo "$AI_HEALTH" | head -c 400
      echo ""
      if echo "$AI_HEALTH" | grep -qE '"ok"[[:space:]]*:[[:space:]]*true'; then
        echo "OK: AI service healthy (OCR ready)."
        return 0
      fi
      if echo "$AI_HEALTH" | grep -qE '"ok"[[:space:]]*:[[:space:]]*false'; then
        echo "ERROR: AI service running but OCR not available."
        return 1
      fi
    fi
    sleep 2
  done
  echo "ERROR: AI health check timed out at ${url}"
  return 1
}

step "Install / update AI systemd unit"
write_ai_systemd_unit
systemctl daemon-reload
systemctl enable intellidocs-ai

systemctl restart intellidocs-ai
systemctl --no-pager --full status intellidocs-ai || true

if ! wait_for_ai_health 90; then
  journalctl -u intellidocs-ai -n 30 --no-pager || true
  exit 1
fi

step "Configure nginx/PHP timeouts for long AI OCR"
if [ -f "$APP_ROOT/scripts/configure_nginx_ai_timeouts.sh" ]; then
  bash "$APP_ROOT/scripts/configure_nginx_ai_timeouts.sh" || true
fi

step "Configure nginx security headers (CSP, HSTS, etc.)"
if [ -f "$APP_ROOT/scripts/configure_nginx_security_headers.sh" ]; then
  bash "$APP_ROOT/scripts/configure_nginx_security_headers.sh" || true
fi

step "Permissions + reload web stack"
chown -R www-data:www-data "$APP_ROOT/public" "$APP_ROOT/uploads" "$APP_ROOT/ai/assets" 2>/dev/null || true
chmod -R u+rwX "$APP_ROOT/uploads" 2>/dev/null || true
for svc in nginx mysql mariadb php8.3-fpm php8.2-fpm php-fpm intellidocs-ai; do
  if systemctl list-unit-files "${svc}.service" 2>/dev/null | grep -q "${svc}.service"; then
    systemctl enable "$svc" 2>/dev/null || true
  fi
done
if [ -f "$APP_ROOT/scripts/start_droplet_web_stack.sh" ]; then
  bash "$APP_ROOT/scripts/start_droplet_web_stack.sh" || true
elif systemctl is-active --quiet php8.3-fpm; then
  systemctl reload php8.3-fpm
elif systemctl is-active --quiet php-fpm; then
  systemctl reload php-fpm
fi
if systemctl is-active --quiet nginx; then
  nginx -t && systemctl reload nginx
fi

step "Smoke checks"
if ! wait_for_ai_health 15; then
  echo "WARNING: AI health re-check failed after nginx reload (OCR may be busy). Service status:"
  systemctl --no-pager --full status intellidocs-ai || true
fi
echo ""
curl -fsS -o /dev/null -w "SPA root HTTP %{http_code}\n" "http://127.0.0.1/landing" || true
curl -fsS -o /dev/null -w "SPA /app/ HTTP %{http_code}\n" "http://127.0.0.1/app/" || true

ROOT_BUNDLE="$(ls -1 "$APP_ROOT/public/assets"/index-*.js 2>/dev/null | head -1 || true)"
DEPLOY_REV="$(git -C "$APP_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "Git commit on server: $DEPLOY_REV"
if [ -n "$ROOT_BUNDLE" ]; then
  if grep -q 'SIGNATURE SCANNED' "$ROOT_BUNDLE" 2>/dev/null; then
    echo "WARNING: Root JS bundle still contains old signature overlay UI — check deploy paths."
  else
    echo "OK: Root JS bundle looks current (no signature overlay marker)."
  fi
  if grep -q 'Stop & re-run AI' "$ROOT_BUNDLE" 2>/dev/null; then
    echo "ERROR: Root JS bundle has stale auto-run AI UI — pull latest and rebuild."
    exit 1
  fi
  if grep -q 'SF10 and certificates may take 1' "$ROOT_BUNDLE" 2>/dev/null; then
    echo "ERROR: Root JS bundle has stale AI waiting banner — pull latest and rebuild."
    exit 1
  fi
  if grep -q '92vw,1120px' "$ROOT_BUNDLE" 2>/dev/null || grep -q '85dvh,780px' "$ROOT_BUNDLE" 2>/dev/null; then
    echo "ERROR: Root JS bundle uses old cramped document modal (1120×780). Pull latest and rebuild."
    exit 1
  fi
  if grep -q '98vw,1280px' "$ROOT_BUNDLE" 2>/dev/null; then
    echo "OK: Bundle includes wide document review modal (1280px)."
  elif grep -q '96vw,1440px' "$ROOT_BUNDLE" 2>/dev/null; then
    echo "OK: Bundle includes wide document review modal (1440px)."
  else
    echo "WARNING: Bundle may be missing wide document modal — confirm git pull succeeded."
  fi
  if grep -q 'Portrait authenticity check' "$ROOT_BUNDLE" 2>/dev/null; then
    echo "OK: Bundle includes current photo review UI (Portrait authenticity check)."
  else
    echo "WARNING: Bundle may be missing latest photo review UI — confirm git pull succeeded."
  fi
else
  echo "WARNING: No index-*.js found under public/assets/"
fi

printf '\nDeploy finished.\n'
printf '  App:  http://%s/landing  (hard refresh: Ctrl+Shift+R)\n' "$PUBLIC_IP"
printf '  API:  http://%s/api/school-year\n' "$PUBLIC_IP"
printf 'Re-run AI on documents after deploy (payload version bump).\n'
