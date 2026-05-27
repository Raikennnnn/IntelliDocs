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
| `AUTH_LOGIN_FAILURE_WINDOW_MINUTES` | `15` | Minutes the failure counter spans |

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

