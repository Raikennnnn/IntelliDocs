#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# IntelliDocs — one-command local setup (mac/Linux/WSL)
#
# Mirrors setup.ps1 for non-Windows shells. Each step is idempotent: re-run
# it on a partially-set-up machine and only the missing pieces are filled in.
#
# Usage:
#   ./setup.sh                          # default: walks every step
#   ./setup.sh --skip-frontend          # don't touch node_modules
#   ./setup.sh --skip-python            # don't create the AI venv
#   ./setup.sh --skip-database          # don't run the SQL files
#   ./setup.sh --force                  # overwrite env files from templates
#   DB_USER=dev DB_HOST=10.0.0.5 ./setup.sh
#
# Environment knobs (read at the top of the script):
#   DB_HOST   default 127.0.0.1
#   DB_PORT   default 3306
#   DB_USER   default root
#   DB_NAME   default intellidocs_db
# -----------------------------------------------------------------------------

set -u

# Stop on hard errors but let individual steps catch their own exit codes so
# the final summary still prints when something goes wrong mid-flow.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
cd "$SCRIPT_DIR"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-intellidocs_db}"

skip_frontend=0
skip_python=0
skip_database=0
force_envs=0

for arg in "$@"; do
    case "$arg" in
        --skip-frontend)  skip_frontend=1 ;;
        --skip-python)    skip_python=1 ;;
        --skip-database)  skip_database=1 ;;
        --force)          force_envs=1 ;;
        -h|--help)
            sed -n '1,30p' "$0"
            exit 0
            ;;
        *) echo "Unknown argument: $arg" >&2; exit 2 ;;
    esac
done

# ANSI colors only when stdout is a terminal.
if [ -t 1 ]; then
    C_CYAN="\033[36m"; C_GREEN="\033[32m"; C_GRAY="\033[37m"
    C_YELLOW="\033[33m"; C_RED="\033[31m"; C_RESET="\033[0m"
else
    C_CYAN=""; C_GREEN=""; C_GRAY=""; C_YELLOW=""; C_RED=""; C_RESET=""
fi

step()  { printf "\n${C_CYAN}=== %s${C_RESET}\n" "$1"; }
info()  { printf "${C_GRAY}  %s${C_RESET}\n" "$1"; }
ok()    { printf "${C_GREEN}  ✓ %s${C_RESET}\n" "$1"; }
warn()  { printf "${C_YELLOW}  ! %s${C_RESET}\n" "$1"; }
fail()  { printf "${C_RED}  ✗ %s${C_RESET}\n" "$1"; }

results=()
record() {
    # $1 = step name, $2 = ok|skip|fail, $3 = optional detail
    results+=("$1|$2|${3:-}")
}

# -----------------------------------------------------------------------------
# Step 1: env templates
# -----------------------------------------------------------------------------
step "Environment files"

copy_template() {
    local src="$1" dst="$2"
    if [ ! -f "$src" ]; then
        fail "Missing template: $src"
        record "env: $dst" fail "template not found"
        return
    fi
    if [ -f "$dst" ] && [ "$force_envs" -eq 0 ]; then
        info "$dst already exists, leaving it alone (use --force to overwrite)."
        record "env: $dst" skip
        return
    fi
    cp "$src" "$dst"
    ok "Copied $src -> $dst"
    record "env: $dst" ok
}

copy_template "env.example" "env"
copy_template "frontend/.env.example" "frontend/.env.local"

# -----------------------------------------------------------------------------
# Step 2: frontend deps
# -----------------------------------------------------------------------------
step "Frontend dependencies"

if [ "$skip_frontend" -eq 1 ]; then
    info "Skipping (--skip-frontend)."
    record "frontend: npm install" skip
elif ! command -v npm >/dev/null 2>&1; then
    fail "npm not found on PATH. Install Node.js 20+ from https://nodejs.org and re-run."
    record "frontend: npm install" fail "npm missing"
else
    pushd frontend >/dev/null
    if [ -f package-lock.json ]; then
        info "Running 'npm ci' (matches the locked versions exactly)..."
        if npm ci; then
            ok "Frontend dependencies installed."
            record "frontend: npm install" ok
        else
            fail "npm ci failed"
            record "frontend: npm install" fail "npm ci"
        fi
    else
        info "No package-lock.json found, running 'npm install'..."
        if npm install; then
            ok "Frontend dependencies installed."
            record "frontend: npm install" ok
        else
            fail "npm install failed"
            record "frontend: npm install" fail "npm install"
        fi
    fi
    popd >/dev/null
fi

# -----------------------------------------------------------------------------
# Step 3: Python venv for AI service
# -----------------------------------------------------------------------------
step "AI service (Python venv)"

if [ "$skip_python" -eq 1 ]; then
    info "Skipping (--skip-python). AI verification will be unavailable."
    record "ai: venv + pip" skip
else
    requirements="ai/requirements.txt"
    venv_dir="ai/.venv"
    if [ ! -f "$requirements" ]; then
        fail "Missing $requirements"
        record "ai: venv + pip" fail "requirements.txt missing"
    else
        # Prefer python3.12 if installed; the requirements pin numpy / opencv
        # versions that have prebuilt wheels for that minor version.
        py_exe=""
        if command -v python3.12 >/dev/null 2>&1; then
            py_exe="python3.12"
        elif command -v python3 >/dev/null 2>&1; then
            py_exe="python3"
            warn "python3.12 not found; falling back to $(python3 --version 2>&1). If pip install fails, install 3.12 explicitly."
        elif command -v python >/dev/null 2>&1; then
            py_exe="python"
        fi

        if [ -z "$py_exe" ]; then
            fail "No Python interpreter found. Install Python 3.12 and re-run."
            record "ai: venv + pip" fail "no python"
        else
            if [ ! -d "$venv_dir" ]; then
                info "Creating venv at $venv_dir ..."
                if ! "$py_exe" -m venv "$venv_dir"; then
                    fail "venv create failed"
                    record "ai: venv + pip" fail "venv create"
                fi
            else
                info "venv already exists, reusing it."
            fi

            venv_python="$venv_dir/bin/python"
            if [ ! -x "$venv_python" ]; then
                fail "venv python not found at $venv_python"
                record "ai: venv + pip" fail "venv layout unexpected"
            else
                info "Upgrading pip + installing requirements (a few minutes on first run)..."
                if "$venv_python" -m pip install --upgrade pip && "$venv_python" -m pip install -r "$requirements"; then
                    ok "AI service environment ready."
                    record "ai: venv + pip" ok
                else
                    fail "pip install failed"
                    record "ai: venv + pip" fail "pip install"
                fi
            fi
        fi
    fi
fi

# -----------------------------------------------------------------------------
# Step 4: Database
# -----------------------------------------------------------------------------
step "Database"

if [ "$skip_database" -eq 1 ]; then
    info "Skipping (--skip-database). Run database_setup.sql + every database_migration_*.sql manually."
    record "db: schema" skip
elif ! command -v mysql >/dev/null 2>&1; then
    fail "mysql client not on PATH. Install mariadb-client / mysql-client or pass --skip-database."
    record "db: schema" fail "mysql missing"
else
    # Read password without echoing it. mysql consumes MYSQL_PWD from the
    # environment, so the password never appears in argv / process listing.
    printf "MySQL password for %s@%s (press Enter for empty): " "$DB_USER" "$DB_HOST"
    stty -echo
    read -r MYSQL_PASS || true
    stty echo
    printf "\n"
    export MYSQL_PWD="$MYSQL_PASS"

    mysql_args=(
        "--host=$DB_HOST" "--port=$DB_PORT" "--user=$DB_USER"
        "--default-character-set=utf8mb4" "--protocol=TCP"
    )

    # 4a: create the database if missing.
    if echo "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" | mysql "${mysql_args[@]}"; then
        ok "Database '$DB_NAME' exists."
        record "db: create database" ok
    else
        fail "Could not create database '$DB_NAME'."
        record "db: create database" fail
        unset MYSQL_PWD
        echo
        # Don't bail entirely — still print the summary below.
    fi

    # 4b: apply schema + migrations in fixed order.
    sql_files=(
        "database_setup.sql"
        "database_migration_logging.sql"
        "database_migration_email_queue.sql"
        "database_migration_role_tables.sql"
        "database_migration_users_role_enum.sql"
        "database_migration_users_role_strict.sql"
        "database_migration_app_settings.sql"
        "database_migration_student_portal.sql"
        "database_migration_documents_upload.sql"
        "database_migration_credentials.sql"
    )
    applied=0; failed_count=0
    for f in "${sql_files[@]}"; do
        if [ ! -f "$f" ]; then
            warn "Missing $f (older snapshot?). Skipping."
            continue
        fi
        info "Applying $f ..."
        if mysql "${mysql_args[@]}" "--database=$DB_NAME" < "$f"; then
            ok "$f applied."
            applied=$((applied + 1))
        else
            fail "$f failed."
            failed_count=$((failed_count + 1))
        fi
    done
    if [ "$failed_count" -eq 0 ]; then
        record "db: $applied migrations" ok
    else
        record "db: $applied applied, $failed_count failed" fail
    fi

    unset MYSQL_PWD
    MYSQL_PASS=""
fi

# -----------------------------------------------------------------------------
# Summary + next steps
# -----------------------------------------------------------------------------
step "Summary"
fail_total=0
for entry in "${results[@]}"; do
    IFS='|' read -r name status detail <<<"$entry"
    case "$status" in
        ok)   color="$C_GREEN" ;;
        skip) color="$C_GRAY" ;;
        fail) color="$C_RED";  fail_total=$((fail_total + 1)) ;;
        *)    color="" ;;
    esac
    if [ -n "$detail" ]; then
        printf "${color}  [%-4s] %s -- %s${C_RESET}\n" "${status^^}" "$name" "$detail"
    else
        printf "${color}  [%-4s] %s${C_RESET}\n" "${status^^}" "$name"
    fi
done

step "Next steps"
echo "  1. Edit 'env' if your DB password is non-default."
echo "  2. Start XAMPP (or run 'php spark serve --port=8080')."
echo "  3. In one terminal: cd frontend && npm run dev"
echo "  4. (Optional) In another terminal: cd ai && .venv/bin/python app.py"
echo "  5. Open http://127.0.0.1:3001 and log in as admin@nsdga.com / admin123"
echo

if [ "$fail_total" -gt 0 ]; then
    printf "${C_YELLOW}Setup completed with %d failed step(s). See the ✗ lines above.${C_RESET}\n" "$fail_total"
    exit 1
fi
printf "${C_GREEN}Setup completed successfully.${C_RESET}\n"
