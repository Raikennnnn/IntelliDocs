#requires -version 5
<#
.SYNOPSIS
    One-command local setup for IntelliDocs on Windows.

.DESCRIPTION
    Copies env templates, installs frontend dependencies, creates the Python
    virtualenv for the AI service, creates the database, and runs every SQL
    migration in order. Each step is idempotent: re-running this script on
    a partially-set-up machine only fills in what is missing.

    The script never deletes data and never overwrites an existing `env` or
    `frontend/.env.local` file (use `-Force` to overwrite the env files; even
    then the database is left alone).

.PARAMETER SkipFrontend
    Skip `npm install` (useful when you only want to (re)apply migrations).

.PARAMETER SkipPython
    Skip creating the Python virtualenv / installing AI deps. The PHP backend
    and React frontend run fine without it; AI verification will be unavailable.

.PARAMETER SkipDatabase
    Skip the database create + migration step (use when the DB is on a remote
    host you've already provisioned).

.PARAMETER DatabaseHost
    MySQL host. Defaults to 127.0.0.1.

.PARAMETER DatabasePort
    MySQL port. Defaults to 3306.

.PARAMETER DatabaseName
    Database name. Defaults to intellidocs_db.

.PARAMETER DatabaseUser
    MySQL user. Defaults to root.

.PARAMETER MysqlExe
    Full path to mysql.exe. When omitted, the script searches the typical
    XAMPP, MariaDB, and MySQL Server locations, and falls back to PATH.

.PARAMETER Force
    Overwrite `env` and `frontend/.env.local` from the templates even when
    they already exist. Database data is never touched by this flag.

.EXAMPLE
    .\setup.ps1
    First-run on a default XAMPP machine. Walks through every step.

.EXAMPLE
    .\setup.ps1 -SkipPython -SkipDatabase
    You only want to refresh frontend deps and env files.

.EXAMPLE
    .\setup.ps1 -DatabaseUser dev -DatabaseHost 192.168.1.50
    Setting up against a non-default DB endpoint.
#>

[CmdletBinding()]
param(
    [switch]$SkipFrontend,
    [switch]$SkipPython,
    [switch]$SkipDatabase,
    [string]$DatabaseHost = '127.0.0.1',
    [int]$DatabasePort = 3306,
    [string]$DatabaseName = 'intellidocs_db',
    [string]$DatabaseUser = 'root',
    [string]$MysqlExe,
    [switch]$Force
)

# Stop on the first hard error so a botched step doesn't cascade. Each
# expensive operation that can legitimately fail (npm install, pip install,
# the SQL imports) is wrapped in its own try/catch so the script can still
# print a useful summary even when one step blows up.
$ErrorActionPreference = 'Stop'

$repoRoot = $PSScriptRoot
if (-not $repoRoot) { $repoRoot = (Get-Location).Path }
Set-Location -Path $repoRoot

function Write-Step {
    param([string]$Message)
    Write-Host ''
    Write-Host ('=== ' + $Message) -ForegroundColor Cyan
}

function Write-Info {
    param([string]$Message)
    Write-Host ('  ' + $Message) -ForegroundColor Gray
}

function Write-Ok {
    param([string]$Message)
    Write-Host ('  ' + [char]0x2713 + ' ' + $Message) -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host ('  ! ' + $Message) -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host ('  X ' + $Message) -ForegroundColor Red
}

# Track step outcomes for the final summary.
$results = @()
function Record-Result {
    param(
        [string]$Step,
        [ValidateSet('ok', 'skip', 'fail')] [string]$Status,
        [string]$Detail = ''
    )
    $script:results += [pscustomobject]@{
        Step   = $Step
        Status = $Status
        Detail = $Detail
    }
}

function Resolve-MysqlExe {
    param([string]$Hint)

    if ($Hint -and (Test-Path -LiteralPath $Hint -PathType Leaf)) {
        return (Resolve-Path -LiteralPath $Hint).Path
    }

    $candidates = @()
    # XAMPP default install on a few common drives.
    foreach ($drive in @('C:\', 'D:\', 'E:\')) {
        $candidates += (Join-Path $drive 'xampp\mysql\bin\mysql.exe')
    }
    # MariaDB / MySQL Server defaults (Program Files).
    $programDirs = @($env:ProgramFiles, ${env:ProgramFiles(x86)}) | Where-Object { $_ }
    foreach ($pf in $programDirs) {
        if (Test-Path -LiteralPath $pf) {
            Get-ChildItem -LiteralPath $pf -Filter 'MariaDB*' -Directory -ErrorAction SilentlyContinue |
                ForEach-Object { $candidates += (Join-Path $_.FullName 'bin\mysql.exe') }
            Get-ChildItem -LiteralPath $pf -Filter 'MySQL*' -Directory -ErrorAction SilentlyContinue |
                ForEach-Object {
                    $sub = Get-ChildItem -LiteralPath $_.FullName -Filter 'MySQL Server*' -Directory -ErrorAction SilentlyContinue |
                        Select-Object -First 1
                    if ($sub) { $candidates += (Join-Path $sub.FullName 'bin\mysql.exe') }
                }
        }
    }
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return $candidate
        }
    }
    # Last resort: PATH.
    $cmd = Get-Command 'mysql.exe' -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

# -----------------------------------------------------------------------------
# Step 1: env templates -> active env files
# -----------------------------------------------------------------------------
Write-Step 'Environment files'

function Copy-Template {
    param(
        [string]$Source,
        [string]$Target
    )
    if (-not (Test-Path -LiteralPath $Source)) {
        Write-Err ("Missing template: " + $Source)
        Record-Result -Step ("env: " + $Target) -Status fail -Detail 'template not found'
        return
    }
    if ((Test-Path -LiteralPath $Target) -and -not $Force) {
        Write-Info ($Target + ' already exists, leaving it alone (use -Force to overwrite).')
        Record-Result -Step ("env: " + $Target) -Status skip
        return
    }
    Copy-Item -LiteralPath $Source -Destination $Target -Force
    Write-Ok ('Copied ' + $Source + ' -> ' + $Target)
    Record-Result -Step ("env: " + $Target) -Status ok
}

Copy-Template -Source (Join-Path $repoRoot 'env.example') -Target (Join-Path $repoRoot 'env')
Copy-Template -Source (Join-Path $repoRoot 'frontend\.env.example') -Target (Join-Path $repoRoot 'frontend\.env.local')

# -----------------------------------------------------------------------------
# Step 2: frontend dependencies
# -----------------------------------------------------------------------------
Write-Step 'Frontend dependencies'

if ($SkipFrontend) {
    Write-Info 'Skipping (-SkipFrontend).'
    Record-Result -Step 'frontend: npm install' -Status skip
} else {
    $npm = Get-Command 'npm' -ErrorAction SilentlyContinue
    if (-not $npm) {
        Write-Err 'npm not found on PATH. Install Node.js 20+ from https://nodejs.org and re-run.'
        Record-Result -Step 'frontend: npm install' -Status fail -Detail 'npm missing'
    } else {
        $frontendDir = Join-Path $repoRoot 'frontend'
        $packageLock = Join-Path $frontendDir 'package-lock.json'
        try {
            Push-Location $frontendDir
            if (Test-Path -LiteralPath $packageLock) {
                Write-Info 'Running `npm ci` (matches the locked versions exactly)...'
                & npm ci
                if ($LASTEXITCODE -ne 0) { throw "npm ci exited with code $LASTEXITCODE" }
            } else {
                Write-Info 'No package-lock.json found, running `npm install`...'
                & npm install
                if ($LASTEXITCODE -ne 0) { throw "npm install exited with code $LASTEXITCODE" }
            }
            Write-Ok 'Frontend dependencies installed.'
            Record-Result -Step 'frontend: npm install' -Status ok
        } catch {
            Write-Err ('npm install failed: ' + $_.Exception.Message)
            Record-Result -Step 'frontend: npm install' -Status fail -Detail $_.Exception.Message
        } finally {
            Pop-Location
        }
    }
}

# -----------------------------------------------------------------------------
# Step 3: Python virtualenv for the AI service
# -----------------------------------------------------------------------------
Write-Step 'AI service (Python venv)'

if ($SkipPython) {
    Write-Info 'Skipping (-SkipPython). AI verification will not be available until you run this step.'
    Record-Result -Step 'ai: venv + pip' -Status skip
} else {
    $aiDir = Join-Path $repoRoot 'ai'
    $venvDir = Join-Path $aiDir '.venv'
    $requirements = Join-Path $aiDir 'requirements.txt'

    if (-not (Test-Path -LiteralPath $requirements)) {
        Write-Err ('requirements.txt not found at ' + $requirements)
        Record-Result -Step 'ai: venv + pip' -Status fail -Detail 'requirements.txt missing'
    } else {
        # Prefer Python 3.12 (the requirements pin numpy/opencv versions that
        # have prebuilt wheels for that line). Fall back to whatever `python`
        # is on PATH and warn loudly if it is not 3.12.
        $py = Get-Command 'py' -ErrorAction SilentlyContinue
        $launcher = $null
        if ($py) {
            try {
                & py -3.12 --version *> $null
                if ($LASTEXITCODE -eq 0) { $launcher = @('py', '-3.12') }
            } catch {
                # py -3.12 not installed
            }
        }
        if (-not $launcher) {
            $python = Get-Command 'python' -ErrorAction SilentlyContinue
            if ($python) { $launcher = @('python') }
        }
        if (-not $launcher) {
            Write-Err 'No Python found. Install Python 3.12 from https://www.python.org/downloads/ and re-run with -SkipPython:$false.'
            Record-Result -Step 'ai: venv + pip' -Status fail -Detail 'no python interpreter'
        } else {
            try {
                if (-not (Test-Path -LiteralPath $venvDir)) {
                    Write-Info ('Creating venv at ' + $venvDir + ' ...')
                    & $launcher[0] $launcher[1..($launcher.Length - 1)] -m venv $venvDir
                    if ($LASTEXITCODE -ne 0) { throw "venv create exited with code $LASTEXITCODE" }
                } else {
                    Write-Info 'venv already exists, reusing it.'
                }
                $venvPython = Join-Path $venvDir 'Scripts\python.exe'
                if (-not (Test-Path -LiteralPath $venvPython)) {
                    throw "venv python not found at $venvPython"
                }
                Write-Info 'Upgrading pip + installing requirements (this can take a few minutes on first run)...'
                & $venvPython -m pip install --upgrade pip
                if ($LASTEXITCODE -ne 0) { throw "pip upgrade exited with code $LASTEXITCODE" }
                & $venvPython -m pip install -r $requirements
                if ($LASTEXITCODE -ne 0) { throw "pip install exited with code $LASTEXITCODE" }
                Write-Ok 'AI service environment ready.'
                Record-Result -Step 'ai: venv + pip' -Status ok
            } catch {
                Write-Err ('AI venv setup failed: ' + $_.Exception.Message)
                Record-Result -Step 'ai: venv + pip' -Status fail -Detail $_.Exception.Message
            }
        }
    }
}

# -----------------------------------------------------------------------------
# Step 4: Database (create + run migrations in order)
# -----------------------------------------------------------------------------
Write-Step 'Database'

if ($SkipDatabase) {
    Write-Info 'Skipping (-SkipDatabase). Remember to import database_setup.sql + every database_migration_*.sql by hand.'
    Record-Result -Step 'db: schema' -Status skip
} else {
    $mysqlExeResolved = Resolve-MysqlExe -Hint $MysqlExe
    if (-not $mysqlExeResolved) {
        Write-Err 'Could not find mysql.exe. Pass -MysqlExe "C:\path\to\mysql.exe" or install XAMPP / MySQL Server.'
        Record-Result -Step 'db: schema' -Status fail -Detail 'mysql.exe not found'
    } else {
        Write-Info ('Using ' + $mysqlExeResolved)
        # Prompt for password as a SecureString so it never appears in the
        # process list or PowerShell history. mysql reads MYSQL_PWD from the
        # process environment, so we set it just for the child invocations.
        $secure = Read-Host -Prompt ('MySQL password for ' + $DatabaseUser + '@' + $DatabaseHost + ' (press Enter for empty)') -AsSecureString
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try {
            $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        } finally {
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }

        function Invoke-Mysql {
            param(
                [string[]]$ExtraArgs,
                [string]$InputFile
            )
            $args = @(
                '--host=' + $DatabaseHost,
                '--port=' + $DatabasePort,
                '--user=' + $DatabaseUser,
                '--default-character-set=utf8mb4',
                '--protocol=TCP'
            )
            if ($ExtraArgs) { $args += $ExtraArgs }
            $oldPwd = $env:MYSQL_PWD
            try {
                $env:MYSQL_PWD = $plain
                if ($InputFile) {
                    # PowerShell does not support stdin redirection (`<`),
                    # so we read the SQL file and pipe its contents into the
                    # mysql client's stdin via Get-Content.
                    Get-Content -LiteralPath $InputFile -Raw | & $mysqlExeResolved @args
                } else {
                    & $mysqlExeResolved @args
                }
                return $LASTEXITCODE
            } finally {
                if ($null -eq $oldPwd) {
                    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
                } else {
                    $env:MYSQL_PWD = $oldPwd
                }
            }
        }

        # 4a: create database if missing.
        try {
            $createSql = "CREATE DATABASE IF NOT EXISTS ``$DatabaseName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            $tmpFile = New-TemporaryFile
            Set-Content -LiteralPath $tmpFile -Value $createSql -Encoding ASCII
            $code = Invoke-Mysql -InputFile $tmpFile.FullName
            Remove-Item -LiteralPath $tmpFile -ErrorAction SilentlyContinue
            if ($code -ne 0) { throw "CREATE DATABASE exited with code $code" }
            Write-Ok ("Database '" + $DatabaseName + "' exists (created if it didn't).")
            Record-Result -Step 'db: create database' -Status ok
        } catch {
            Write-Err ('Could not create database: ' + $_.Exception.Message)
            Record-Result -Step 'db: create database' -Status fail -Detail $_.Exception.Message
            $plain = $null
            return
        }

        # 4b: apply schema + migrations in a fixed order.
        # database_setup.sql is the base; every migration after it is
        # idempotent (guarded with IF NOT EXISTS / column-exists checks) so
        # re-running the script on a populated DB is safe.
        $sqlFiles = @(
            'database_setup.sql',
            'database_migration_logging.sql',
            'database_migration_email_queue.sql',
            'database_migration_role_tables.sql',
            'database_migration_users_role_enum.sql',
            'database_migration_users_role_strict.sql',
            'database_migration_app_settings.sql',
            'database_migration_student_portal.sql',
            'database_migration_documents_upload.sql',
            'database_migration_credentials.sql'
        )

        $applied = 0
        $skipped = 0
        $failed = 0
        foreach ($file in $sqlFiles) {
            $path = Join-Path $repoRoot $file
            if (-not (Test-Path -LiteralPath $path)) {
                Write-Warn ('Missing ' + $file + ' (older snapshot of the repo?). Skipping.')
                $skipped++
                continue
            }
            try {
                Write-Info ('Applying ' + $file + ' ...')
                $code = Invoke-Mysql -ExtraArgs @('--database=' + $DatabaseName) -InputFile $path
                if ($code -ne 0) { throw "mysql exited with code $code" }
                Write-Ok ($file + ' applied.')
                $applied++
            } catch {
                Write-Err ($file + ' failed: ' + $_.Exception.Message)
                $failed++
            }
        }
        if ($failed -eq 0) {
            Record-Result -Step ('db: ' + $applied + ' migrations') -Status ok
        } else {
            Record-Result -Step ('db: ' + $applied + ' applied, ' + $failed + ' failed') -Status fail
        }

        # Wipe the password from memory as soon as we're done with it.
        $plain = $null
    }
}

# -----------------------------------------------------------------------------
# Final summary + next steps
# -----------------------------------------------------------------------------
Write-Step 'Summary'
foreach ($r in $results) {
    $color = switch ($r.Status) {
        'ok'   { 'Green' }
        'skip' { 'Gray' }
        'fail' { 'Red' }
        default { 'White' }
    }
    $line = '  [' + $r.Status.ToUpper().PadRight(4) + '] ' + $r.Step
    if ($r.Detail) { $line = $line + '  -- ' + $r.Detail }
    Write-Host $line -ForegroundColor $color
}

$failedCount = ($results | Where-Object { $_.Status -eq 'fail' }).Count

Write-Step 'Next steps'
Write-Host '  1. Edit `env` if your DB password is non-default.'
Write-Host '  2. Start XAMPP (Apache + MySQL) OR run `php spark serve --port=8080`.'
Write-Host '  3. In one terminal: `cd frontend; npm run dev`.'
Write-Host '  4. (Optional) In another terminal: `cd ai; .\.venv\Scripts\python.exe app.py`.'
Write-Host '  5. Open http://127.0.0.1:3001 and log in as admin@nsdga.com / admin123.'
Write-Host ''
if ($failedCount -gt 0) {
    Write-Host ('Setup completed with ' + $failedCount + ' failed step(s). See the X lines above.') -ForegroundColor Yellow
    exit 1
}
Write-Host 'Setup completed successfully.' -ForegroundColor Green
exit 0
