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
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
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
  for f in database_setup.sql database_migration_*.sql; do
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
npm run build

step "Publish frontend to public/app"
mkdir -p "$APP_ROOT/public/app"
rm -rf "$APP_ROOT/public/app/"*
cp -r dist/* "$APP_ROOT/public/app/"
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

step "Python AI service"
cd "$APP_ROOT/ai"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

if [ ! -f /etc/systemd/system/intellidocs-ai.service ]; then
  cat > /etc/systemd/system/intellidocs-ai.service <<'UNIT'
[Unit]
Description=IntelliDocs AI Service
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/intellidocs/ai
Environment=PORT=8080
Environment=AI_OCR_ENGINE=tesseract
Environment=DISABLE_EASYOCR=1
ExecStart=/var/www/intellidocs/ai/.venv/bin/gunicorn --bind 127.0.0.1:8080 --workers 1 --threads 4 --timeout 120 app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable intellidocs-ai
fi

systemctl restart intellidocs-ai
systemctl --no-pager --full status intellidocs-ai || true

step "Permissions + reload web stack"
chown -R www-data:www-data "$APP_ROOT/public" "$APP_ROOT/uploads" "$APP_ROOT/ai/assets" 2>/dev/null || true
chmod -R u+rwX "$APP_ROOT/uploads" 2>/dev/null || true
if systemctl is-active --quiet php8.3-fpm; then
  systemctl reload php8.3-fpm
elif systemctl is-active --quiet php-fpm; then
  systemctl reload php-fpm
fi
if systemctl is-active --quiet nginx; then
  nginx -t && systemctl reload nginx
fi

step "Smoke checks"
curl -fsS "http://127.0.0.1:8080/health" | head -c 200 || echo "AI health check failed"
echo ""
curl -fsS -o /dev/null -w "Frontend HTTP %{http_code}\n" "http://127.0.0.1/app/" || true

printf '\nDeploy finished.\n'
printf '  App:  http://%s/app/\n' "$PUBLIC_IP"
printf '  API:  http://%s/api/school-year\n' "$PUBLIC_IP"
printf 'Re-run AI on documents after deploy (payload version bump).\n'
