# Deploy IntelliDocs V4 to DigitalOcean Droplet

Target path: `/var/www/intellidocs`  
Branch: `IntelliDocs-V4`  
Example IP: check your DigitalOcean dashboard (e.g. `129.213.234.3`).

## Before you deploy (on your PC)

1. **Commit and push** all local changes to GitHub:
   ```powershell
   cd C:\xampp\htdocs\IntelliDocs
   git add ai/ api/ frontend/src frontend/public/report-assets scripts/deploy_droplet.sh DEPLOY_DROPLET.md
   git status
   git commit -m "AI verification fixes and droplet deploy script for V4."
   git push origin IntelliDocs-V4
   ```
   Include any other modified files your deployment needs (`git status`).

2. Ensure the repo is accessible from the droplet (public repo or deploy key / PAT).

## On the droplet (SSH or DigitalOcean web console)

### First time only

```bash
apt update && apt upgrade -y
apt install -y nginx mysql-server php-fpm php-mysql php-mbstring php-xml php-curl php-zip php-gd \
  python3 python3-venv tesseract-ocr git unzip certbot python3-certbot-nginx

# swap (recommended on 2 GB RAM)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

cd /var/www
git clone -b IntelliDocs-V4 https://github.com/Raikennnnn/IntelliDocs.git intellidocs
cd intellidocs
cp env.example env
nano env   # set DB_*, AI_BASE_URL=http://127.0.0.1:8080, MAIL_PROVIDER, BREVO_API_KEY, APP_BASE_URL
```

Create MySQL DB/user, import `database_setup.sql` and `database_migration_*.sql`.

Configure Nginx (root = `/var/www/intellidocs/public`, SPA at `/app/`, API at `/api/`).

### Every update

```bash
bash /var/www/intellidocs/scripts/deploy_droplet.sh
```

Or manually:

```bash
cd /var/www/intellidocs
git pull origin IntelliDocs-V4
bash scripts/deploy_droplet.sh
```

## Production `env` essentials

```ini
DB_HOST=127.0.0.1
DB_NAME=intellidocs_db
DB_USER=intellidocs
DB_PASS=your_password

AI_BASE_URL=http://127.0.0.1:8080
AI_OCR_ENGINE=tesseract
DISABLE_EASYOCR=1

MAIL_PROVIDER=brevo
BREVO_API_KEY=your_key
MAIL_FROM_ADDRESS=no-reply@yourdomain.net

APP_BASE_URL=http://YOUR_DROPLET_IP
AUTH_ALLOW_LEGACY_HEADER=0
```

## After deploy

1. Open `http://YOUR_IP/app/`
2. Test API: `http://YOUR_IP/api/school-year`
3. Test AI: `curl http://127.0.0.1:8080/health` on the server
4. **Re-run AI** on documents in registrar review (payload version updated)
5. Change default admin/registrar passwords if still on seeds

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `fatal: not a git repository` | You uploaded files without `git clone`. See **Fix: not a git repo** below. |
| `git pull` auth failed | Use GitHub PAT or upload via SFTP |
| AI 502 / verify fails | `systemctl status intellidocs-ai`, check `AI_BASE_URL` in `env` |
| Blank `/app/` | Re-run deploy script; check `public/app/index.html` exists |
| OCR errors | `apt install tesseract-ocr`; restart `intellidocs-ai` |

### Fix: `fatal: not a git repository`

This means `/var/www/intellidocs` has **no `.git` folder** (SFTP/zip upload, or wrong directory).

**Option A — fresh clone (recommended):**

```bash
cd /var/www
mv intellidocs intellidocs.backup    # keeps your old env/uploads if any
git clone -b IntelliDocs-V4 https://github.com/Raikennnnn/IntelliDocs.git intellidocs
cd intellidocs
cp ../intellidocs.backup/env env 2>/dev/null || cp env.example env
bash scripts/deploy_droplet.sh
```

**Option B — attach git to existing folder:**

```bash
cd /var/www/intellidocs
git init
git remote add origin https://github.com/Raikennnnn/IntelliDocs.git
git fetch origin
git checkout -B IntelliDocs-V4 origin/IntelliDocs-V4
bash scripts/deploy_droplet.sh
```

Private repo: use `https://YOUR_GITHUB_TOKEN@github.com/Raikennnnn/IntelliDocs.git` for clone/fetch.
