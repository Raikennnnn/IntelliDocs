<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}
require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/user_role.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$rawBody = file_get_contents('php://input');
$payload = json_decode($rawBody ?: '{}', true);

if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
    exit;
}

$action = strtolower(trim((string)($payload['action'] ?? '')));

function columnExists(PDO $pdo, string $table, string $column): bool
{
    try {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1');
        $stmt->execute([':table' => $table, ':column' => $column]);
        return (bool)$stmt->fetchColumn();
    } catch (Throwable $e) {
        return false;
    }
}

/**
 * Restrict admin-created accounts to supported UI roles.
 *
 * @return string|null normalized role, or null when invalid.
 */
function normalizeAllowedRole(string $role): ?string
{
    $normalized = strtolower(trim($role));
    $allowed = ['admin', 'registrar', 'student'];
    return in_array($normalized, $allowed, true) ? $normalized : null;
}

/**
 * Looks up the currently authenticated user via X-User-Id header.
 *
 * @return array<string, mixed>|null
 */
function getActorUser(PDO $pdo): ?array
{
    $actorId = (int)($_SERVER['HTTP_X_USER_ID'] ?? 0);
    if ($actorId <= 0) {
        return null;
    }
    $actorStmt = $pdo->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
    $actorStmt->execute([':id' => $actorId]);
    $actor = $actorStmt->fetch();
    if (!$actor) {
        return null;
    }

    return ['id' => $actorId, 'role' => getUserRole($pdo, $actorId)];
}

function generateOtpCode(): string
{
    return str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

function storeOtpCode(PDO $pdo, string $email, string $code, int $minutes = 10): void
{
    $pdo->prepare('UPDATE otp_codes SET used = 1 WHERE email = :email AND used = 0')->execute([
        ':email' => $email,
    ]);
    $stmt = $pdo->prepare(
        'INSERT INTO otp_codes (email, code, expires_at, used) VALUES (:email, :code, DATE_ADD(NOW(), INTERVAL :minutes MINUTE), 0)'
    );
    $stmt->bindValue(':email', $email);
    $stmt->bindValue(':code', $code);
    $stmt->bindValue(':minutes', $minutes, PDO::PARAM_INT);
    $stmt->execute();
}

function ensureOtpTable(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS otp_codes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(100),
            code VARCHAR(6),
            expires_at TIMESTAMP NULL,
            used TINYINT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
}

if ($action === 'register') {
    ensureOtpTable($pdo);
    $username = trim((string)($payload['username'] ?? ''));
    $email = strtolower(trim((string)($payload['email'] ?? '')));
    $password = (string)($payload['password'] ?? '');
    // Full name is now optional at signup; the enrollment form provides
    // first/middle/last names later. Default to empty so legacy NOT NULL
    // columns still get a value.
    $fullName = trim((string)($payload['full_name'] ?? ''));

    if ($username === '' || $email === '' || $password === '') {
        appLogEvent($pdo, 'register_attempt', 'auth', 'failed', null, 'user', null, ['reason' => 'missing_fields', 'email' => $email]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Email and password are required']);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        appLogEvent($pdo, 'register_attempt', 'auth', 'failed', null, 'user', null, ['reason' => 'invalid_email', 'email' => $email]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Invalid email address']);
        exit;
    }

    if (strlen($password) < 8) {
        appLogEvent($pdo, 'register_attempt', 'auth', 'failed', null, 'user', null, ['reason' => 'weak_password', 'email' => $email]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Password must be at least 8 characters']);
        exit;
    }

    try {
        $checkStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email OR username = :username LIMIT 1');
        $checkStmt->execute([
            ':email' => $email,
            ':username' => $username,
        ]);

        if ($checkStmt->fetch()) {
            appLogEvent($pdo, 'register_attempt', 'auth', 'failed', null, 'user', null, ['reason' => 'duplicate_account', 'email' => $email]);
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Email or username already exists']);
            exit;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $userId = insertUserWithRole($pdo, $username, $email, $hash, $fullName, 'student');
        appLogEvent($pdo, 'register', 'auth', 'success', $userId, 'user', (string)$userId, ['email' => $email, 'role' => 'student']);

        $otpCode = generateOtpCode();
        storeOtpCode($pdo, $email, $otpCode, 10);
        $queueId = queueEmail($pdo, $email, 'Nuestra Señora De Guia Academy — Email Verification OTP', buildOtpEmailBody($otpCode));
        $otpSent = processSingleQueuedEmail($pdo, $queueId);
        appLogEvent($pdo, 'otp_send', 'auth', $otpSent ? 'success' : 'failed', $userId, 'user', (string)$userId, ['email' => $email, 'channel' => 'email']);

        http_response_code(201);
        $response = [
            'success' => true,
            'message' => $otpSent ? 'Registration successful. OTP sent to your email.' : 'Registration successful. OTP generated but email delivery failed.',
            'otp_delivery' => $otpSent ? 'sent' : 'failed',
            'user' => [
                'id' => $userId,
                'username' => $username,
                'email' => $email,
                'full_name' => $fullName,
                'role' => 'student',
            ],
        ];
        $isLocal = in_array((string)($_SERVER['REMOTE_ADDR'] ?? ''), ['127.0.0.1', '::1'], true);
        if (!$otpSent && $isLocal) {
            // Local fallback for dev machines without SMTP.
            $response['dev_otp'] = $otpCode;
        }
        echo json_encode($response);
        exit;
    } catch (Throwable $e) {
        appLogEvent($pdo, 'register', 'auth', 'failed', null, 'user', null, ['reason' => 'server_error', 'email' => $email]);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Registration failed']);
        exit;
    }
}

if ($action === 'login') {
    // Accept either `credential` (preferred, set by the renamed login form
    // in task 10.4) or the legacy `email` field. The lookup value is
    // lowercased and trimmed and is used as the throttle key in
    // `login_attempts.email` regardless of whether it parses as an email or
    // as a school_username.
    $rawCredential = (string)($payload['credential'] ?? $payload['email'] ?? '');
    $email = strtolower(trim($rawCredential));
    $password = (string)($payload['password'] ?? '');

    if ($email === '' || $password === '') {
        appLogLoginAttempt($pdo, $email, false);
        appLogEvent($pdo, 'login_attempt', 'auth', 'failed', null, 'user', null, ['reason' => 'missing_credentials', 'email' => $email]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Email and password are required']);
        exit;
    }

    // Defensive column guards for the credentials feature (Pres.3).
    // The auth path NEVER issues ALTER TABLE — it only feature-detects the
    // columns added by `database_migration_credentials.sql` and silently
    // degrades when they are absent. This keeps existing email-only logins
    // working on environments that have not yet run the credentials migration.
    //
    //  - $hasSchoolUsernameColumn: when false, the school-username lookup
    //    branch (task 7.3) is skipped entirely.
    //  - $hasMustChangePasswordColumn: when false, the `must_change_password`
    //    field in the success response (task 7.4) defaults to false.
    $hasSchoolUsernameColumn = columnExists($pdo, 'users', 'school_username');
    $hasMustChangePasswordColumn = columnExists($pdo, 'users', 'must_change_password');

    // Throttle pre-check (Requirements 11.1, 11.2, 11.4, 11.5).
    // Counts recent failed `login_attempts` rows keyed on the lookup value
    // and short-circuits with HTTP 401 `account_locked` once the configured
    // threshold is reached within the configured window. The `login_attempts`
    // table is created lazily by `ensureLoggingTables()` (called from
    // `appLogLoginAttempt`), but on environments where it is genuinely
    // absent (e.g. permission-restricted shared hosting that blocked the
    // CREATE), the throttle is skipped — security-degrade rather than
    // fail-closed, matching the existing pattern in `admin_overview.php`
    // and `admin_reports.php`.
    $throttleThreshold = (int)(getenv('AUTH_LOGIN_FAILURE_THRESHOLD') ?: 5);
    if ($throttleThreshold < 1) {
        $throttleThreshold = 5;
    }
    $throttleWindowMinutes = (int)(getenv('AUTH_LOGIN_FAILURE_WINDOW_MINUTES') ?: 15);
    if ($throttleWindowMinutes < 1) {
        $throttleWindowMinutes = 15;
    }

    $loginAttemptsTableExists = false;
    try {
        $taStmt = $pdo->prepare(
            'SELECT 1 FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
        );
        $taStmt->execute([':t' => 'login_attempts']);
        $loginAttemptsTableExists = (bool)$taStmt->fetchColumn();
    } catch (Throwable $e) {
        $loginAttemptsTableExists = false;
    }

    if ($loginAttemptsTableExists) {
        try {
            $countStmt = $pdo->prepare(
                "SELECT COUNT(*) FROM login_attempts
                 WHERE email = :email
                   AND success = 0
                   AND attempted_at >= (NOW() - INTERVAL {$throttleWindowMinutes} MINUTE)"
            );
            $countStmt->execute([':email' => $email]);
            $recentFailures = (int)$countStmt->fetchColumn();

            if ($recentFailures >= $throttleThreshold) {
                appLogLoginAttempt($pdo, $email, false);
                appLogEvent(
                    $pdo,
                    'login_attempt',
                    'auth',
                    'failed',
                    null,
                    'user',
                    null,
                    [
                        'reason' => 'throttled',
                        'email' => $email,
                        'recent_failures' => $recentFailures,
                        'threshold' => $throttleThreshold,
                        'window_minutes' => $throttleWindowMinutes,
                    ]
                );
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'error' => 'account_locked',
                    'code' => 'throttled',
                ]);
                exit;
            }
        } catch (Throwable $e) {
            // If the throttle query itself fails, fall through and let the
            // normal auth path run rather than locking everyone out.
        }
    }

    try {
        // Build the SELECT column list dynamically so we only ask for credential
        // columns that exist on this environment. The auth path is feature-
        // detect-only (Pres.3) and never alters schema, so older deployments
        // that have not yet run database_migration_credentials.sql still work.
        $hasStatus = columnExists($pdo, 'users', 'status');
        $selectCols = ['id', 'username', 'email', 'password', 'full_name'];
        if ($hasStatus) {
            $selectCols[] = 'status';
        }
        if ($hasSchoolUsernameColumn) {
            $selectCols[] = 'school_username';
        }
        if ($hasMustChangePasswordColumn) {
            $selectCols[] = 'must_change_password';
        }
        // Guard the structured-name columns the same way: task 8.2 will read
        // them from the login response, but on un-migrated DBs they don't
        // exist yet. Including them here keeps 7.4's response shaping simple.
        foreach (['first_name', 'middle_name', 'last_name', 'extension_name'] as $nameCol) {
            if (columnExists($pdo, 'users', $nameCol)) {
                $selectCols[] = $nameCol;
            }
        }
        $colList = implode(', ', $selectCols);

        // Dual-identifier lookup (Requirements 6.1, 6.3, 6.4).
        // First try the personal email (legacy behavior, preserves Pres.3).
        // If no row matches AND the school_username column exists on this
        // environment, retry against school_username. We never disclose
        // which branch matched — both no-row outcomes and password-verify
        // failure return the same generic 401 `invalid_credentials` body.
        $stmt = $pdo->prepare("SELECT {$colList} FROM users WHERE email = :email LIMIT 1");
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user && $hasSchoolUsernameColumn) {
            $stmtSchool = $pdo->prepare("SELECT {$colList} FROM users WHERE school_username = :v LIMIT 1");
            $stmtSchool->execute([':v' => $email]);
            $user = $stmtSchool->fetch();
        }

        if (!$user || !password_verify($password, (string)$user['password'])) {
            // Identical body shape in both cases (no-row vs bad-password) so
            // attackers cannot enumerate which identifiers exist (Req 6.3, 6.4).
            // The throttle counter advances by recording this attempt against
            // the lookup value the user typed (Req 11.1).
            appLogLoginAttempt($pdo, $email, false);
            appLogEvent($pdo, 'login_attempt', 'auth', 'failed', null, 'user', null, ['reason' => 'invalid_credentials', 'email' => $email]);
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'invalid_credentials']);
            exit;
        }

        // Enforce Active/Inactive status after verifying credentials.
        if ($hasStatus) {
            $status = strtolower(trim((string)($user['status'] ?? 'active')));
            if ($status === 'inactive') {
                appLogLoginAttempt($pdo, $email, false);
                appLogEvent($pdo, 'login_attempt', 'auth', 'failed', (int)$user['id'], 'user', (string)$user['id'], ['reason' => 'inactive_account', 'email' => $email]);
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Account is inactive. Please contact the administrator.']);
                exit;
            }
        }

        $resolvedRole = getUserRole($pdo, (int)$user['id']);

        // Clear the failed-attempt window for this lookup value (Req 11.3).
        // Marking prior failures as `success = 1` causes the throttle
        // pre-check on subsequent logins to count zero recent failures, which
        // is the wire-level meaning of "the counter resets after a successful
        // login". Wrapped in try/catch and gated on table presence so an
        // environment without `login_attempts` (or one whose UPDATE is
        // blocked) still serves the success response.
        if ($loginAttemptsTableExists) {
            try {
                $clearStmt = $pdo->prepare(
                    "UPDATE login_attempts
                     SET success = 1
                     WHERE email = :email
                       AND success = 0
                       AND attempted_at >= (NOW() - INTERVAL {$throttleWindowMinutes} MINUTE)"
                );
                $clearStmt->execute([':email' => $email]);
            } catch (Throwable $e) {
                // Non-fatal: the next failed attempt will simply count one
                // more old row toward the threshold; we do not want to fail
                // a successful login because of a UPDATE permission issue.
            }
        }

        appLogLoginAttempt($pdo, $email, true);
        appLogEvent($pdo, 'login', 'auth', 'success', (int)$user['id'], 'user', (string)$user['id'], ['email' => $email, 'role' => $resolvedRole]);
        touchUserLastLogin($pdo, (int)$user['id']);

        // Build the success response payload using the explicit allow-list
        // documented in design.md ("Auth_API Extension" → response shape).
        // Pulling fields by name (rather than echoing the whole row) keeps
        // the password hash and any future internal columns from leaking,
        // and gracefully falls back to null when the credentials migration
        // has not yet added the column on this environment.
        $userPayload = [
            'id'              => (int)$user['id'],
            'username'        => (string)($user['username'] ?? ''),
            'email'           => (string)($user['email'] ?? ''),
            'school_username' => array_key_exists('school_username', $user) ? $user['school_username'] : null,
            'full_name'       => (string)($user['full_name'] ?? ''),
            'first_name'      => array_key_exists('first_name', $user) ? $user['first_name'] : null,
            'middle_name'     => array_key_exists('middle_name', $user) ? $user['middle_name'] : null,
            'last_name'       => array_key_exists('last_name', $user) ? $user['last_name'] : null,
            'extension_name'  => array_key_exists('extension_name', $user) ? $user['extension_name'] : null,
            'role'            => $resolvedRole,
        ];

        // `must_change_password` lives at the TOP LEVEL of the response (per
        // the design's "Response shape (success)" example), not nested under
        // `user`. When the column is absent on this environment, default to
        // false — the safe default that keeps un-migrated DBs serving logins.
        $mustChangePassword = false;
        if ($hasMustChangePasswordColumn && array_key_exists('must_change_password', $user)) {
            $mustChangePassword = (bool)(int)$user['must_change_password'];
        }

        echo json_encode([
            'success'              => true,
            'user'                 => $userPayload,
            'must_change_password' => $mustChangePassword,
        ]);
        exit;
    } catch (Throwable $e) {
        appLogLoginAttempt($pdo, $email, false);
        appLogEvent($pdo, 'login', 'auth', 'failed', null, 'user', null, ['reason' => 'server_error', 'email' => $email]);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Login failed']);
        exit;
    }
}

if ($action === 'change_password') {
    // Authenticated password change (Requirement 7.3). The user is already
    // signed in — the X-User-Id header carries the actor — so this endpoint
    // does not re-validate the old password. It is the second half of the
    // forced-first-login flow: when a row has `must_change_password = 1`,
    // the frontend `First_Login_Guard` redirects here and POSTs the new
    // password. On success we clear the flag so subsequent logins return
    // `must_change_password: false` and the guard lets the user through.
    $actor = getActorUser($pdo);
    if (!$actor) {
        appLogEvent($pdo, 'change_password', 'auth', 'failed', null, 'user', null, ['reason' => 'missing_actor']);
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Missing user context']);
        exit;
    }

    $userId = (int)$actor['id'];
    $newPassword = (string)($payload['new_password'] ?? '');

    // Same length rule as register/create_user (>= 8). Returning a stable
    // machine-readable error code (`password_too_short`) lets the React
    // change-password screen surface a localized message without parsing
    // free-form English.
    if (strlen($newPassword) < 8) {
        appLogEvent($pdo, 'change_password', 'auth', 'failed', $userId, 'user', (string)$userId, ['reason' => 'password_too_short']);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'password_too_short']);
        exit;
    }

    try {
        $hash = password_hash($newPassword, PASSWORD_DEFAULT);

        // Defensive column guard (Pres.3): on environments where the
        // credentials migration has not yet run, `must_change_password` is
        // absent. We still want the password update itself to succeed —
        // the flag is informational and defaults to 0/false elsewhere.
        if (columnExists($pdo, 'users', 'must_change_password')) {
            $stmt = $pdo->prepare(
                'UPDATE users SET password = :hash, must_change_password = 0 WHERE id = :id'
            );
        } else {
            $stmt = $pdo->prepare('UPDATE users SET password = :hash WHERE id = :id');
        }
        $stmt->execute([
            ':hash' => $hash,
            ':id'   => $userId,
        ]);

        appLogEvent($pdo, 'change_password', 'auth', 'success', $userId, 'user', (string)$userId, []);

        echo json_encode([
            'success'              => true,
            'must_change_password' => false,
        ]);
        exit;
    } catch (Throwable $e) {
        appLogEvent($pdo, 'change_password', 'auth', 'failed', $userId, 'user', (string)$userId, ['reason' => 'server_error']);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to change password']);
        exit;
    }
}

if ($action === 'create_user') {
    $actor = getActorUser($pdo);
    if (!$actor || strtolower((string)($actor['role'] ?? '')) !== 'admin') {
        appLogEvent($pdo, 'create_user', 'admin', 'failed', null, 'user', null, ['reason' => 'forbidden']);
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Only admin users can create accounts']);
        exit;
    }

    $username = trim((string)($payload['username'] ?? ''));
    $email = strtolower(trim((string)($payload['email'] ?? '')));
    $password = (string)($payload['password'] ?? '');
    $fullName = trim((string)($payload['full_name'] ?? ''));
    $role = normalizeAllowedRole((string)($payload['role'] ?? 'student'));

    if ($username === '' || $email === '' || $password === '' || $fullName === '' || $role === null) {
        appLogEvent($pdo, 'create_user', 'admin', 'failed', (int)$actor['id'], 'user', null, ['reason' => 'validation_error', 'email' => $email, 'role' => (string)($payload['role'] ?? '')]);
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'error' => 'username, email, full_name, password, and role (admin|registrar|student) are required',
        ]);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        appLogEvent($pdo, 'create_user', 'admin', 'failed', (int)$actor['id'], 'user', null, ['reason' => 'invalid_email', 'email' => $email]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Invalid email address']);
        exit;
    }

    if (strlen($password) < 8) {
        appLogEvent($pdo, 'create_user', 'admin', 'failed', (int)$actor['id'], 'user', null, ['reason' => 'weak_password', 'email' => $email]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Password must be at least 8 characters']);
        exit;
    }

    try {
        $existsStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email OR username = :username LIMIT 1');
        $existsStmt->execute([
            ':email' => $email,
            ':username' => $username,
        ]);

        if ($existsStmt->fetch()) {
            appLogEvent($pdo, 'create_user', 'admin', 'failed', (int)$actor['id'], 'user', null, ['reason' => 'duplicate_account', 'email' => $email]);
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Email or username already exists']);
            exit;
        }

        $createdId = insertUserWithRole(
            $pdo,
            $username,
            $email,
            password_hash($password, PASSWORD_BCRYPT),
            $fullName,
            $role
        );
        appLogEvent($pdo, 'create_user', 'admin', 'success', (int)$actor['id'], 'user', (string)$createdId, ['email' => $email, 'role' => $role]);
        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'User created successfully',
            'user' => [
                'id' => $createdId,
                'username' => $username,
                'email' => $email,
                'full_name' => $fullName,
                'role' => $role,
            ],
        ]);
        exit;
    } catch (Throwable $e) {
        appLogEvent($pdo, 'create_user', 'admin', 'failed', (int)$actor['id'], 'user', null, ['reason' => 'server_error', 'email' => $email]);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to create user']);
        exit;
    }
}

if ($action === 'verify_otp') {
    ensureOtpTable($pdo);
    $email = strtolower(trim((string)($payload['email'] ?? '')));
    $otp = trim((string)($payload['otp'] ?? ''));
    if ($email === '' || $otp === '') {
        appLogEvent($pdo, 'otp_verify', 'auth', 'failed', null, 'otp', null, ['reason' => 'missing_fields', 'email' => $email]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Email and OTP are required']);
        exit;
    }
    try {
        $stmt = $pdo->prepare(
            'SELECT id FROM otp_codes WHERE email = :email AND code = :code AND used = 0 AND expires_at >= NOW() ORDER BY id DESC LIMIT 1'
        );
        $stmt->execute([
            ':email' => $email,
            ':code' => $otp,
        ]);
        $otpRow = $stmt->fetch();
        if (!$otpRow) {
            appLogEvent($pdo, 'otp_verify', 'auth', 'failed', null, 'otp', null, ['reason' => 'invalid_or_expired', 'email' => $email]);
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid or expired OTP']);
            exit;
        }
        $pdo->prepare('UPDATE otp_codes SET used = 1 WHERE id = :id')->execute([
            ':id' => (int)$otpRow['id'],
        ]);
        appLogEvent($pdo, 'otp_verify', 'auth', 'success', null, 'otp', (string)$otpRow['id'], ['email' => $email]);
        echo json_encode(['success' => true, 'message' => 'OTP verified successfully']);
        exit;
    } catch (Throwable $e) {
        appLogEvent($pdo, 'otp_verify', 'auth', 'failed', null, 'otp', null, ['reason' => 'server_error', 'email' => $email]);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'OTP verification failed']);
        exit;
    }
}

if ($action === 'resend_otp') {
    ensureOtpTable($pdo);
    $email = strtolower(trim((string)($payload['email'] ?? '')));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        appLogEvent($pdo, 'otp_resend', 'auth', 'failed', null, 'otp', null, ['reason' => 'invalid_email', 'email' => $email]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Valid email is required']);
        exit;
    }
    try {
        $userStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $userStmt->execute([':email' => $email]);
        $user = $userStmt->fetch();
        if (!$user) {
            appLogEvent($pdo, 'otp_resend', 'auth', 'failed', null, 'user', null, ['reason' => 'user_not_found', 'email' => $email]);
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Account not found for this email']);
            exit;
        }
        $otpCode = generateOtpCode();
        storeOtpCode($pdo, $email, $otpCode, 10);
        $queueId = queueEmail($pdo, $email, 'Nuestra Señora De Guia Academy — Email Verification OTP', buildOtpEmailBody($otpCode));
        $sent = processSingleQueuedEmail($pdo, $queueId);
        appLogEvent($pdo, 'otp_resend', 'auth', $sent ? 'success' : 'failed', (int)$user['id'], 'user', (string)$user['id'], ['email' => $email]);
        $response = ['success' => true, 'message' => $sent ? 'OTP resent successfully' : 'OTP regenerated but email delivery failed', 'otp_delivery' => $sent ? 'sent' : 'failed'];
        $isLocal = in_array((string)($_SERVER['REMOTE_ADDR'] ?? ''), ['127.0.0.1', '::1'], true);
        if (!$sent && $isLocal) {
            $response['dev_otp'] = $otpCode;
        }
        echo json_encode($response);
        exit;
    } catch (Throwable $e) {
        appLogEvent($pdo, 'otp_resend', 'auth', 'failed', null, 'otp', null, ['reason' => 'server_error', 'email' => $email]);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to resend OTP']);
        exit;
    }
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Unsupported action']);
