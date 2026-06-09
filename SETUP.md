# IntelliDocs - Local Setup

This project has three runtimes that must run together:

| Tier      | Tech                       | Port (default)        |
| --------- | -------------------------- | --------------------- |
| Frontend  | React + Vite               | 3001                  |
| Backend   | CodeIgniter 4 (PHP 8.2+)   | 80 via XAMPP, or 8080 |
| AI        | Flask + OCR (Python 3.12)  | 5000                  |
| Database  | MariaDB / MySQL            | 3306                  |

The setup is path-independent: nothing in the code assumes
`C:\xampp\htdocs\IntelliDocs`, so you can clone anywhere.

## Quick start (one command)

If you have the [Prerequisites](#prerequisites) installed, run the bundled
setup script and it will walk every step below. The script is idempotent:
re-running it on a partially-set-up machine fills in only what is missing,
and never overwrites your `env` file (use `-Force` / `--force` to do that).

**Windows (PowerShell):**

```powershell
.\setup.ps1
```

**macOS / Linux / WSL:**

```bash
chmod +x setup.sh
./setup.sh
```

The script prompts for your MySQL password once (read silently — never logged
or echoed). At the end you get a summary table and a "Next steps" block telling
you which servers to start.

If a step fails, the rest still runs, the failure is highlighted in red, and
the script exits with a non-zero code so CI / wrapper scripts notice. The
manual instructions below are a drop-in fallback for any step you'd rather do
by hand.

## Prerequisites

Install once per machine:

- **Git**
- **Node.js 20 LTS or newer** (`node --version`)
- **Python 3.12** (`py -3.12 --version` on Windows, `python3.12 --version` elsewhere).
  Python 3.13/3.14 may not have prebuilt wheels for `numpy==1.26.4` and `opencv-python==4.10.0.82`.
- **PHP 8.2+** with extensions: `mysqli`, `mbstring`, `curl`, `gd`, `intl`, `xml`.
  XAMPP ships with all of these.
- **Composer** (https://getcomposer.org)
- **MySQL/MariaDB**.  XAMPP includes it.
- **Tesseract OCR** (optional, only for OCR text extraction).
  Windows: https://github.com/UB-Mannheim/tesseract/wiki

## One-time setup after `git clone`

### 1. PHP backend dependencies

```bash
composer install
```

This creates `vendor/` (already gitignored).

### 2. Frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 3. Python AI service dependencies

Windows:

```powershell
cd ai
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
deactivate
cd ..
```

macOS / Linux:

```bash
cd ai
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..
```

If `Activate.ps1` is blocked on Windows, run once:
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

### 4. Environment files

```bash
# Project root: PHP / API config
cp env.example env

# Frontend: Vite proxy + AI URL
cp frontend/.env.example frontend/.env.local
```

Edit each file:

- `env`: set `DB_USER`, `DB_PASS`, `DB_NAME`.  Leave `AI_BASE_URL=http://127.0.0.1:5000`.
- `frontend/.env.local`: only change `VITE_API_BASE` if your project folder
  isn't named `IntelliDocs` or you're not using XAMPP.

Optional `env` overrides for the credentials feature (sensible defaults are baked in):

| Variable | Default | Purpose |
| --- | --- | --- |
| `MAIL_FROM_NAME` | `Nuestra Señora De Guia Academy` | "From" name on welcome / OTP / reminder emails |
| `MAIL_FROM_ADDRESS` | `no-reply@intellidocs.local` | "From" address on outgoing email |
| `BREVO_API_KEY` | empty | Brevo transactional API key (leave blank to fall back to PHP `mail()`) |
| `APP_PUBLIC_URL` | empty | Host portion used in welcome-email login links |
| `AUTH_LOGIN_FAILURE_THRESHOLD` | `5` | Failed attempts in the window before throttling |
| `AUTH_LOGIN_FAILURE_WINDOW_MINUTES` | `5` | Minutes the failure counter spans (paper: 5 min) |

#### Brevo (transactional email) deployment notes

OTP and welcome-email delivery goes through Brevo when `MAIL_PROVIDER=brevo`
in `env`. Two account-side settings will silently break delivery and have
nothing to do with the code:

1. **Authorised IPs must be deactivated** unless you intend to maintain the
   allowlist by hand. Brevo dashboard → bottom-left profile → **Settings →
   Security → Authorized IPs**. If `Activate for API keys` or
   `Activate for SMTP keys` is on, only listed IPs can send. A laptop
   moving between Wi-Fi networks and any cloud host with a rotating
   outbound IP will hit `HTTP 401 unauthorized` until you add the new IP.
   Recommended: keep both deactivated; the API key itself is the auth.

2. **`MAIL_FROM_ADDRESS` must be a verified sender.** Brevo dashboard →
   **Senders, Domains & Dedicated IPs → Senders → Add a sender**, fill in
   the address you set in `env`, then click the verification link Brevo
   emails. Until verified, every send fails with HTTP 400.

To verify both before going live, hit `/api/mail-health` from the deployed
host. The endpoint calls Brevo `/v3/account` and `/v3/senders` without
sending real mail and returns a JSON report with `ready: true` (or the
exact issue if not). Admins can also `POST /api/mail-health` with
`{ "recipient": "..." }` to send a real round-trip test message.

Other Brevo failure modes the same endpoint surfaces:

- `HTTP 401 unauthorized` on the API key → key was revoked (Brevo's
  GitHub secret-scanning partner auto-revokes leaked keys). Generate a
  new one in Brevo → SMTP & API → API Keys, paste into `env`.
- `Could not resolve host: api.brevo.com` → DNS / captive-portal issue
  on the network the server is on. Not a Brevo or code problem.
- Free-tier daily send cap hit (300/day) → upgrade or wait until the
  counter rolls over at UTC midnight.

### 5. Database

Start MariaDB/MySQL (via XAMPP control panel or your service of choice).  Then in phpMyAdmin or via CLI:

1. Create the database (CI4 will not create it for you):
   ```sql
   CREATE DATABASE intellidocs_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Import the base schema:
   ```bash
   mysql -u root intellidocs_db < database_setup.sql
   ```
   Or in phpMyAdmin: select `intellidocs_db` -> Import -> upload `database_setup.sql`.
3. Apply incremental migrations *in order* (each is idempotent — safe to re-run):
   ```bash
   mysql -u root intellidocs_db < database_migration_credentials.sql
   mysql -u root intellidocs_db < database_migration_physical_docs.sql
   ```
   Skip the credentials migration and the registrar's "Issue Credentials" flow
   will return HTTP 503 `schema_not_migrated`.  Skip the physical-docs
   migration and the in-person enrollment checklist will return the same
   503 in the registrar's Students panel.  The auth path silently degrades
   when these columns are absent, so existing email-only logins keep working
   — but new students cannot have credentials issued or be marked as
   enrolled until the migrations run.

   If you see other `database_migration_*.sql` files in the repo root (e.g.
   `database_migration_logging.sql`, `database_migration_email_queue.sql`,
   `database_migration_student_portal.sql`), apply them in the order documented
   at the top of `database_migration_credentials.sql` before running this one.

## Running it

Open three terminals.

### Terminal 1 - Frontend

```bash
cd frontend
npm run dev
```

Visit http://127.0.0.1:3001/

### Terminal 2 - AI service

Windows:

```powershell
cd ai
.\.venv\Scripts\python.exe app.py
```

macOS / Linux:

```bash
cd ai
.venv/bin/python app.py
```

Health check: http://127.0.0.1:5000/health

### Terminal 3 - PHP backend

**Option A: XAMPP** (Windows-friendly)
1. Start Apache + MySQL from XAMPP control panel.
2. Place this project under `htdocs/`.  If the folder name isn't `IntelliDocs`,
   adjust `VITE_API_BASE` in `frontend/.env.local`.
3. Visit http://localhost/IntelliDocs/public/ once to confirm.

**Option B: Built-in server** (cross-platform, no XAMPP)

```bash
php spark serve --port=8080
```

Then in `frontend/.env.local`:

```
VITE_API_TARGET=http://127.0.0.1:8080
VITE_API_BASE=
```

Restart `npm run dev` after changing those.

## Pushing / pulling notes

These files **do** belong in git (and are committed):
- `composer.json`, `composer.lock`
- `package.json`, `package-lock.json`
- `requirements.txt`
- `env.example`, `frontend/.env.example`
- `database_setup.sql`

These files **do not** belong in git (and are gitignored):
- `vendor/`
- `node_modules/`
- `ai/.venv/`
- `env`, `.env`, `frontend/.env`, `frontend/.env.local`
- `frontend/dist/`
- `writable/cache/*`, `writable/logs/*`, `writable/session/*`
- `ai/uploads/*` (user uploads), `uploads/documents/*` (CI4 uploads)

## Common issues

**Smoke test after setup (5 minutes):**
Before debugging anything, log in as the seeded admin (`admin@nsdga.com` / `admin123`)
and walk these three checks:
1. `Admin → User Management` loads four rows (admin, registrar, student1, you can see Names).
   If "Failed to load users", check the activity log row for the actual SQL error:
   ```sql
   SELECT details_json FROM activity_logs WHERE action='admin_users_list' AND status='failed' ORDER BY id DESC LIMIT 1;
   ```
2. `Admin → Students` loads the directory page (empty if nobody has enrolled yet).
3. As a student, submit an enrollment.  As the registrar, click `Approve` on the
   application — they should be redirected to the change-password screen on first login.
   If approval errors with HTTP 503 `schema_not_migrated`, the credentials migration
   from step 5.3 didn't run.

**`npm run dev` errors with "Cannot find module"**
`node_modules` got corrupted.  Run:
```bash
cd frontend
rm -rf node_modules package-lock.json   # Windows: rmdir /s /q node_modules
npm install
```

**Vite proxy returns 404 for `/api/...`**
Either `VITE_API_BASE` doesn't match your XAMPP folder, or Apache isn't running.

**AI service `/health` returns `ocr_engine: none`**
Tesseract OCR binary is missing.  Install it; `app.py` autodiscovers
`C:\Program Files\Tesseract-OCR\tesseract.exe` on Windows or the system
`tesseract` on macOS/Linux.  Set `TESSERACT_CMD` in your shell to override.

**Composer says "ext-mbstring missing"**
PHP wasn't installed with that extension.  XAMPP has it; for clean PHP
builds, enable the extension in `php.ini`.


## Production deployment (InfinityFree + Railway)

The same three-tier setup deploys to three different homes:

| Tier | Host | Why |
| --- | --- | --- |
| Frontend (React build) | InfinityFree `htdocs/` | Static files, free tier |
| PHP API + MySQL | InfinityFree `htdocs/IntelliDocs/public/` + InfinityFree MySQL | PHP 8 + MariaDB included |
| AI service (Flask) | Railway | InfinityFree is PHP-only; Flask needs Python |
| Email | Brevo | Cloud transactional API |

InfinityFree cannot run Python, so the AI verification service moves to
Railway (or Render / Fly / any host with Python 3.12). The PHP backend
calls the AI service over HTTPS via `AI_BASE_URL` in `env`.

### Pre-flight

Before deploying, the seeded `admin@nsdga.com / admin123` and
`registrar@nsdga.com / registrar123` accounts will exist in production
the moment `database_setup.sql` is imported. **Log in and change both
passwords immediately after the first deploy** — `database_setup.sql`
is a public file in the repo.

Confirm Brevo is ready (see "Brevo (transactional email) deployment
notes" above): both Authorised IP toggles deactivated, sender verified,
API key valid.

### 1. Build the frontend for production

Create `frontend/.env.production`:

```
VITE_API_TARGET=https://intellidocs.infinityfreeapp.com
VITE_API_BASE=/IntelliDocs/public
VITE_AI_BASE_URL=https://your-ai-service.up.railway.app
```

Then build:

```powershell
cd frontend
npm run build
```

That produces `frontend/dist/` — these static files are uploaded to
InfinityFree in step 6.

### 2. InfinityFree MySQL

InfinityFree dashboard → **MySQL Databases** → create a database. Note
the values it returns (host looks like `sqlXYZ.infinityfree.com`, name
and user have a `if0_<account>_` prefix).

Open phpMyAdmin from the panel, select the new DB, **Import** →
`database_setup.infinityfree.sql`. Then import each migration in this
order (each is idempotent):

```
database_migration_logging.sql
database_migration_email_queue.sql
database_migration_credentials.sql
database_migration_physical_docs.sql
database_migration_role_tables.sql
database_migration_users_role_enum.sql
database_migration_users_role_strict.sql
database_migration_student_portal.sql
database_migration_app_settings.sql
database_migration_documents_upload.sql
database_migration_document_review.sql
```

### 3. Production `env`

Make a fresh `env` for the deployed host (do NOT reuse the local one —
DB credentials and `APP_PUBLIC_URL` are different):

```
DB_HOST=sqlXYZ.infinityfree.com
DB_PORT=3306
DB_NAME=if0_<account>_intellidocs
DB_USER=if0_<account>
DB_PASS=<your DB password>

# AI service URL (set after step 5)
AI_BASE_URL=https://your-ai-service.up.railway.app

# Mail
MAIL_PROVIDER=brevo
BREVO_API_KEY=<your Brevo key>
MAIL_FROM_ADDRESS=<verified Brevo sender>
MAIL_FROM_NAME=Nuestra Señora De Guia Academy

# Public URL (welcome-email links)
APP_BASE_URL=https://intellidocs.infinityfreeapp.com
APP_PUBLIC_URL=https://intellidocs.infinityfreeapp.com

# Security knobs
AUTH_LOGIN_FAILURE_THRESHOLD=5
AUTH_LOGIN_FAILURE_WINDOW_MINUTES=5
SESSION_IDLE_TIMEOUT_MINUTES=30
RAPID_ACTION_THRESHOLD=10
RAPID_ACTION_WINDOW_MINUTES=2
```

`config/database.php` reads `DB_HOST` / `DB_PORT` / `DB_NAME` /
`DB_USER` / `DB_PASS` from env (falling back to local defaults), so the
same code runs in dev and prod with no edits.

### 4. Upload PHP backend

Use InfinityFree's **File Manager** or FTP. Upload to `htdocs/`:

```
htdocs/
├── api/                    (entire folder)
├── app/                    (entire folder)
├── config/                 (entire folder)
├── public/                 (entire folder)
├── system/                 (CodeIgniter)
├── vendor/                 (run `composer install` LOCALLY first)
├── writable/
├── env                     (production env from step 3)
├── preload.php
└── composer.json, composer.lock, spark
```

**Skip:**
- `frontend/` (built separately)
- `ai/` (lives on Railway)
- `node_modules/`, `.kiro/`, `.git/`, `tests/`, `scripts/`
- `_fix_engine.py`, `*.sql` (already imported)
- The local `env` file (use the production one)

InfinityFree free tier caps file count around 30,000. `vendor/` is
~5,000 files; if you hit the cap, upload `vendor/` as a zip via the
online File Manager and extract on the server. If you still hit it,
delete `vendor/codeigniter4/framework/{tests,user_guide_src}` (not
needed at runtime) or upgrade to Premium.

### 5. Deploy AI service to Railway

Files committed to the repo make the AI service Railway-ready:

- `ai/requirements.txt` — Python deps including `gunicorn`
- `ai/runtime.txt` — pins Python 3.12
- `ai/nixpacks.toml` — installs Tesseract OCR system binary
- `ai/Procfile` — start command for gunicorn

Steps:

1. railway.app → **New Project → Deploy from GitHub** → IntelliDocs repo
2. **Settings → Service → Root Directory** = `ai`
3. **Settings → Networking → Generate Domain** — copy the URL
4. Wait for build (~5 minutes; pulls Tesseract + numpy + opencv)
5. Verify: `https://<railway-url>/health` returns `ocr_engine: tesseract`
6. Paste the Railway URL into the production `env` as `AI_BASE_URL`
   and re-upload `env`

The Flask app reads `PORT` from the environment (set by Railway) and
runs in production mode unless `FLASK_DEBUG=1`.

### 6. Upload the React build

Two layout options:

**Same domain as PHP (simplest):** drop the contents of
`frontend/dist/` into `htdocs/` directly. Frontend at
`https://intellidocs.infinityfreeapp.com/`, API at
`https://intellidocs.infinityfreeapp.com/IntelliDocs/public/api/...`.

**Subfolder:** drop `dist/` into `htdocs/app/`. Set `VITE_BASE=/app/`
in `frontend/.env.production` and rebuild.

Add `htdocs/.htaccess` so React Router deep links survive page
refresh:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  # Let API requests pass through to PHP.
  RewriteCond %{REQUEST_URI} ^/IntelliDocs/public/ [OR]
  RewriteCond %{REQUEST_URI} ^/api/
  RewriteRule ^ - [L]

  # Don't rewrite real files or directories.
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Everything else → SPA entry point.
  RewriteRule ^ index.html [L]
</IfModule>
```

### 7. Live smoke test

In order, with DevTools Network tab open:

1. `https://<infinityfree-domain>/IntelliDocs/public/api/mail-health`
   → `{ "success": true, "report": { "ready": true, ... } }`
2. `https://<railway-url>/health` → `ocr_engine: tesseract`
3. SPA root loads → register a test student → OTP arrives in inbox
4. Log in as seeded admin → **change the password immediately**
5. Smoke-test the same three checks from "Common issues" above
   (admin/users, admin/students, registrar approve flow)

### 8. Known production gotchas

| Symptom | Cause | Fix |
| --- | --- | --- |
| `mail-health` returns `Brevo unreachable` only in prod | InfinityFree blocks outbound cURL on free tier | Upgrade to Premium, or switch `MAIL_PROVIDER=phpmail` (lower deliverability) |
| `MySQL server has gone away` after idle | InfinityFree drops idle MySQL conns | Already mitigated by `PDO::ATTR_TIMEOUT`; if persistent, move DB to Railway/PlanetScale |
| File count error during upload | `vendor/` has thousands of files | Upload as zip, extract on server, or delete `vendor/codeigniter4/framework/{tests,user_guide_src}` |
| Frontend works but API calls 404 | `VITE_API_BASE` doesn't match the deploy path | Re-check `frontend/.env.production` and rebuild |
| OTP works locally but fails in prod | Brevo `Authorized IPs` was re-enabled, or sender un-verified | Brevo dashboard → Security → deactivate; re-verify sender |

### 9. Updating production

Code change → push to GitHub → Railway auto-redeploys the AI service.
PHP and frontend updates are manual (re-upload via File Manager) until
you set up CI. For frequent deploys, consider an FTP-based GitHub
Action that syncs `htdocs/`.
