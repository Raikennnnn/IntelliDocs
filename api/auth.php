<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}
require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/system_settings_helpers.php';
require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/user_consents.php';
require_once __DIR__ . '/session_token.php';
require_once __DIR__ . '/password_policy.php';
require_once __DIR__ . '/email_deliverability.php';
require_once __DIR__ . '/pending_registration.php';
require_once __DIR__ . '/otp_guard.php';

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

require_once __DIR__ . '/email_verification.php';

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
 * Looks up the currently authenticated user via Bearer token or legacy header.
 *
 * @return array<string, mixed>|null
 */
function getActorUser(PDO $pdo): ?array
{
    $actor = tryResolveActorFromRequest($pdo, 'auth');
    if (!$actor) {
        return null;
    }

    return ['id' => (int)$actor['id'], 'role' => (string)$actor['role'], 'session_id' => $actor['session_id']];
}

function maskEmailForOtp(string $email): string
{
    if (!str_contains($email, '@')) {
        return '***';
    }
    [$local, $domain] = explode('@', $email, 2);
    $visible = mb_substr($local, 0, min(2, mb_strlen($local)));
    return $visible . '***@' . $domain;
}

/**
 * @return array<string, mixed>|null
 */
function findUserByCredential(PDO $pdo, string $credential): ?array
{
    $lookup = strtolower(trim($credential));
    if ($lookup === '') {
        return null;
    }

    $hasSchoolUsernameColumn = columnExists($pdo, 'users', 'school_username');
    $hasStatus = columnExists($pdo, 'users', 'status');
    $hasMustChangePasswordColumn = columnExists($pdo, 'users', 'must_change_password');

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
    foreach (['first_name', 'middle_name', 'last_name', 'extension_name'] as $nameCol) {
        if (columnExists($pdo, 'users', $nameCol)) {
            $selectCols[] = $nameCol;
        }
    }
    $colList = implode(', ', $selectCols);

    $stmt = $pdo->prepare("SELECT {$colList} FROM users WHERE email = :email LIMIT 1");
    $stmt->execute([':email' => $lookup]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user && $hasSchoolUsernameColumn) {
        $stmtSchool = $pdo->prepare("SELECT {$colList} FROM users WHERE school_username = :v LIMIT 1");
        $stmtSchool->execute([':v' => $lookup]);
        $user = $stmtSchool->fetch(PDO::FETCH_ASSOC);
    }

    return $user ?: null;
}

/**
 * @param array<string, mixed> $user
 * @return array<string, mixed>
 */
function buildAuthUserPayload(PDO $pdo, array $user): array
{
    $resolvedRole = getUserRole($pdo, (int)$user['id']);

    return [
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
}

/**
 * @param array<string, mixed> $user
 * @return array<string, mixed>
 */
function finalizeLoginResponse(PDO $pdo, array $user, string $throttleKey): array
{
    $hasMustChangePasswordColumn = columnExists($pdo, 'users', 'must_change_password');
    $mustChangePassword = false;
    if ($hasMustChangePasswordColumn && array_key_exists('must_change_password', $user)) {
        $mustChangePassword = (bool)(int)$user['must_change_password'];
    }

    $session = createSessionToken($pdo, (int)$user['id']);
    $legacyOnly = $session === null;

    $response = [
        'success'              => true,
        'user'                 => buildAuthUserPayload($pdo, $user),
        'must_change_password' => $mustChangePassword,
        'token'                => $session['token'] ?? null,
        'legacy_auth_only'     => $legacyOnly,
    ];

    return $response;
}

function generateOtpCode(): string
{
    return str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

function ensureOtpPurposeColumn(PDO $pdo): void
{
    if (!columnExists($pdo, 'otp_codes', 'purpose')) {
        try {
            $pdo->exec("ALTER TABLE otp_codes ADD COLUMN purpose VARCHAR(20) NOT NULL DEFAULT 'registration' AFTER code");
        } catch (Throwable $e) {
            // ignore if concurrent migration
        }
    }
}

function storeOtpCode(PDO $pdo, string $email, string $code, int $minutes = 10, string $purpose = 'registration'): void
{
    ensureOtpPurposeColumn($pdo);
    $pdo->prepare('UPDATE otp_codes SET used = 1 WHERE email = :email AND used = 0 AND purpose = :purpose')->execute([
        ':email' => $email,
        ':purpose' => $purpose,
    ]);
    if (columnExists($pdo, 'otp_codes', 'purpose')) {
        $stmt = $pdo->prepare(
            'INSERT INTO otp_codes (email, code, purpose, expires_at, used) VALUES (:email, :code, :purpose, DATE_ADD(NOW(), INTERVAL :minutes MINUTE), 0)'
        );
        $stmt->bindValue(':purpose', $purpose);
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO otp_codes (email, code, expires_at, used) VALUES (:email, :code, DATE_ADD(NOW(), INTERVAL :minutes MINUTE), 0)'
        );
    }
    $stmt->bindValue(':email', $email);
    $stmt->bindValue(':code', $code);
    $stmt->bindValue(':minutes', $minutes, PDO::PARAM_INT);
    $stmt->execute();
}

/**
 * Issue a login MFA code. Reuses a still-valid code from the last 2 minutes
 * unless $forceNew is set — prevents double-submit / duplicate login requests
 * from invalidating the OTP the user already received by email.
 */
function issueLoginOtp(PDO $pdo, string $email, int $minutes = 10, bool $forceNew = false): ?string
{
    ensureOtpPurposeColumn($pdo);
    $normalizedEmail = strtolower(trim($email));
    if (!$forceNew && columnExists($pdo, 'otp_codes', 'purpose')) {
        $stmt = $pdo->prepare(
            "SELECT code FROM otp_codes
              WHERE email = :email
                AND purpose = 'login'
                AND used = 0
                AND expires_at > NOW()
                AND created_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
              ORDER BY id DESC
              LIMIT 1"
        );
        $stmt->execute([':email' => $normalizedEmail]);
        $existing = $stmt->fetchColumn();
        if ($existing !== false && $existing !== null && $existing !== '') {
            return (string)$existing;
        }
    }
    $sendCheck = otpGuardCheckSendAllowed($pdo, $normalizedEmail, 'login');
    if (!$sendCheck['allowed']) {
        return null;
    }
    $code = generateOtpCode();
    storeOtpCode($pdo, $normalizedEmail, $code, $minutes, 'login');

    return $code;
}

function ensureOtpTable(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS otp_codes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(100),
            code VARCHAR(6),
            purpose VARCHAR(20) NOT NULL DEFAULT 'registration',
            expires_at TIMESTAMP NULL,
            used TINYINT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    ensureOtpPurposeColumn($pdo);
}

if ($action === 'register') {
    ensureOtpTable($pdo);
    ensurePendingRegistrationsTable($pdo);
    ensureUserConsentColumns($pdo);
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

    $emailDeliverability = validateEmailDeliverable($email);
    if ($emailDeliverability !== null) {
        appLogEvent($pdo, 'register_attempt', 'auth', 'failed', null, 'user', null, [
            'reason' => $emailDeliverability['code'],
            'email' => $email,
            'domain' => extractEmailDomain($email),
        ]);
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'error' => $emailDeliverability['error'],
            'code' => $emailDeliverability['code'],
        ]);
        exit;
    }

    $passwordCheck = validatePasswordStrength($password);
    if ($passwordCheck !== null) {
        appLogEvent($pdo, 'register_attempt', 'auth', 'failed', null, 'user', null, [
            'reason' => $passwordCheck['code'],
            'email' => $email,
        ]);
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'error' => $passwordCheck['error'],
            'code' => $passwordCheck['code'],
        ]);
        exit;
    }

    $termsPrivacyAccepted = parseConsentFlag($payload['terms_privacy_accepted'] ?? false);
    $dpaAccepted = parseConsentFlag($payload['dpa_accepted'] ?? false);

    if (!$termsPrivacyAccepted) {
        appLogEvent($pdo, 'register_attempt', 'auth', 'failed', null, 'user', null, ['reason' => 'terms_not_accepted', 'email' => $email]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'You must accept the Terms of Use and Privacy Policy']);
        exit;
    }

    if (!$dpaAccepted) {
        appLogEvent($pdo, 'register_attempt', 'auth', 'failed', null, 'user', null, ['reason' => 'dpa_not_accepted', 'email' => $email]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'You must accept the Data Processing Agreement (DPA)']);
        exit;
    }

    try {
        purgeExpiredPendingRegistrations($pdo);

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

        if (pendingRegistrationUsernameTaken($pdo, $username, $email)) {
            appLogEvent($pdo, 'register_attempt', 'auth', 'failed', null, 'user', null, ['reason' => 'pending_username_taken', 'email' => $email]);
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Username is already reserved. Try a different email address.']);
            exit;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        savePendingRegistration(
            $pdo,
            $email,
            $username,
            $hash,
            $fullName,
            $termsPrivacyAccepted,
            $dpaAccepted,
        );
        appLogEvent($pdo, 'register_pending', 'auth', 'success', null, 'pending_registration', $email, [
            'email' => $email,
            'role' => 'student',
            'terms_privacy_accepted' => true,
            'dpa_accepted' => true,
        ]);

        $sendCheck = otpGuardCheckSendAllowed($pdo, $email, 'registration');
        if (!$sendCheck['allowed']) {
            $limitResp = otpGuardSendLimitResponse('registration');
            appLogEvent($pdo, 'otp_send', 'auth', 'failed', null, 'pending_registration', $email, ['reason' => 'send_limit']);
            http_response_code($limitResp['http']);
            echo json_encode([
                'success' => false,
                'error' => $limitResp['error'],
                'code' => $limitResp['code'],
            ]);
            exit;
        }

        $otpCode = generateOtpCode();
        $otpMinutes = getOtpExpiryMinutes($pdo);
        storeOtpCode($pdo, $email, $otpCode, $otpMinutes, 'registration');
        $queueId = queueEmail($pdo, $email, otpEmailSubject(), buildOtpEmailBodyWithExpiry($pdo, $otpCode));
        $otpSent = processSingleQueuedEmail($pdo, $queueId);
        $mailError = $otpSent ? null : getEmailQueueLastError($pdo, $queueId);
        appLogEvent($pdo, 'otp_send', 'auth', $otpSent ? 'success' : 'failed', null, 'pending_registration', $email, [
            'email' => $email,
            'channel' => 'email',
            'mail_error' => $mailError,
            'purpose' => 'registration',
        ]);

        http_response_code(201);
        $response = [
            'success' => true,
            'pending_verification' => true,
            'message' => $otpSent
                ? 'Verification code sent. Enter it below to create your account.'
                : 'Verification code generated but email delivery failed. Use Resend OTP or try again.',
            'otp_delivery' => $otpSent ? 'sent' : 'failed',
            'email' => $email,
        ];
        if (!$otpSent && $mailError !== null) {
            $response['mail_error'] = $mailError;
        }
        $isLocal = in_array((string)($_SERVER['REMOTE_ADDR'] ?? ''), ['127.0.0.1', '::1'], true);
        if (!$otpSent && $isLocal && mailDevOtpFallbackEnabled()) {
            $response['dev_otp'] = $otpCode;
        } elseif ($otpSent && $isLocal && mailLocalOtpInResponseEnabled()) {
            $response['dev_otp'] = $otpCode;
            $response['dev_otp_note'] = 'Local development: OTP also sent by email (check Spam / search brevosend.com).';
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
    $throttleWindowMinutes = (int)(getenv('AUTH_LOGIN_FAILURE_WINDOW_MINUTES') ?: 5);
    if ($throttleWindowMinutes < 1) {
        $throttleWindowMinutes = 5;
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
                    'anomaly_excessive_login_failures',
                    'security',
                    'flagged',
                    null,
                    'user',
                    null,
                    [
                        'email' => $email,
                        'recent_failures' => $recentFailures,
                        'threshold' => $throttleThreshold,
                        'window_minutes' => $throttleWindowMinutes,
                    ]
                );
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
        if (columnExists($pdo, 'users', 'email_verified_at')) {
            $selectCols[] = 'email_verified_at';
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

        if (!studentEmailVerified($pdo, $user, $resolvedRole)) {
            appLogLoginAttempt($pdo, $email, false);
            appLogEvent($pdo, 'login_attempt', 'auth', 'failed', (int)$user['id'], 'user', (string)$user['id'], [
                'reason' => 'email_not_verified',
                'email' => $email,
            ]);
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error' => 'email_not_verified',
                'message' => 'Please complete email verification before signing in. Finish signup and enter your OTP.',
            ]);
            exit;
        }

        // Clear the failed-attempt window for this lookup value (Req 11.3).
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
            }
        }

        appLogLoginAttempt($pdo, $email, true);
        touchUserLastLogin($pdo, (int)$user['id']);

        try {
            require_once __DIR__ . '/security_guard.php';
            ensureUserLastActivityColumn($pdo);
            $resetActivity = $pdo->prepare('UPDATE users SET last_activity_at = NOW() WHERE id = :id LIMIT 1');
            $resetActivity->execute([':id' => (int)$user['id']]);
        } catch (Throwable $e) {
        }

        $accountEmail = strtolower(trim((string)($user['email'] ?? '')));

        if (loginOtpRequiredForRole($resolvedRole)) {
            ensureOtpTable($pdo);
            $otpMinutes = getOtpExpiryMinutes($pdo);
            $otpCode = issueLoginOtp($pdo, $accountEmail, $otpMinutes, false);
            if ($otpCode === null) {
                $limitResp = otpGuardSendLimitResponse('login');
                appLogEvent($pdo, 'login_otp_send', 'auth', 'failed', (int)$user['id'], 'user', (string)$user['id'], [
                    'email' => $accountEmail,
                    'reason' => 'send_limit',
                ]);
                http_response_code($limitResp['http']);
                echo json_encode([
                    'success' => false,
                    'error' => $limitResp['error'],
                    'code' => $limitResp['code'],
                ]);
                exit;
            }
            $queueId = queueEmail($pdo, $accountEmail, otpEmailSubject('login'), buildOtpEmailBodyWithExpiry($pdo, $otpCode, 'login'));
            $otpSent = processSingleQueuedEmail($pdo, $queueId);
            $mailError = $otpSent ? null : getEmailQueueLastError($pdo, $queueId);
            appLogEvent($pdo, 'login_password_verified', 'auth', 'success', (int)$user['id'], 'user', (string)$user['id'], [
                'email' => $accountEmail,
                'otp_required' => true,
            ]);
            appLogEvent($pdo, 'login_otp_send', 'auth', $otpSent ? 'success' : 'failed', (int)$user['id'], 'user', (string)$user['id'], [
                'email' => $accountEmail,
                'mail_error' => $mailError,
            ]);

            $response = [
                'success' => true,
                'requires_otp' => true,
                'message' => $otpSent
                    ? 'Password verified. Enter the OTP sent to your email.'
                    : 'Password verified. OTP generated but email delivery failed.',
                'email' => $accountEmail,
                'email_masked' => maskEmailForOtp($accountEmail),
                'otp_delivery' => $otpSent ? 'sent' : 'failed',
            ];
            if (!$otpSent && $mailError !== null) {
                $response['mail_error'] = $mailError;
            }
            $isLocal = in_array((string)($_SERVER['REMOTE_ADDR'] ?? ''), ['127.0.0.1', '::1'], true);
            if ($isLocal && ((!$otpSent && mailDevOtpFallbackEnabled()) || ($otpSent && mailLocalOtpInResponseEnabled()))) {
                $response['dev_otp'] = $otpCode;
            }
            echo json_encode($response);
            exit;
        }

        echo json_encode(finalizeLoginResponse($pdo, $user, $email));
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
    $passwordCheck = validatePasswordStrength($newPassword);
    if ($passwordCheck !== null) {
        appLogEvent($pdo, 'change_password', 'auth', 'failed', $userId, 'user', (string)$userId, [
            'reason' => $passwordCheck['code'],
        ]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => $passwordCheck['code'], 'message' => $passwordCheck['error']]);
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

        revokeAllUserSessions($pdo, $userId);
        $session = createSessionToken($pdo, $userId);

        echo json_encode([
            'success'              => true,
            'must_change_password' => false,
            'token'                => $session['token'] ?? null,
            'legacy_auth_only'     => $session === null,
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
    $role = normalizeAllowedRole((string)($payload['role'] ?? 'registrar'));

    if ($username === '' || $email === '' || $password === '' || $fullName === '' || $role === null) {
        appLogEvent($pdo, 'create_user', 'admin', 'failed', (int)$actor['id'], 'user', null, ['reason' => 'validation_error', 'email' => $email, 'role' => (string)($payload['role'] ?? '')]);
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'error' => 'username, email, full_name, password, and role (admin|registrar) are required',
        ]);
        exit;
    }

    if ($role === 'student') {
        appLogEvent($pdo, 'create_user', 'admin', 'failed', (int)$actor['id'], 'user', null, ['reason' => 'student_create_blocked']);
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'error' => 'Student accounts are created through public registration, not admin user management.',
            'code' => 'student_role_locked',
        ]);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        appLogEvent($pdo, 'create_user', 'admin', 'failed', (int)$actor['id'], 'user', null, ['reason' => 'invalid_email', 'email' => $email]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Invalid email address']);
        exit;
    }

    $passwordCheck = validatePasswordStrength($password);
    if ($passwordCheck !== null) {
        appLogEvent($pdo, 'create_user', 'admin', 'failed', (int)$actor['id'], 'user', null, [
            'reason' => $passwordCheck['code'],
            'email' => $email,
        ]);
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'error' => $passwordCheck['error'],
            'code' => $passwordCheck['code'],
        ]);
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
        markEmailVerified($pdo, $createdId);
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

if ($action === 'verify_login_otp') {
    ensureOtpTable($pdo);

    $email = strtolower(trim((string)($payload['email'] ?? $payload['credential'] ?? '')));
    $otp = preg_replace('/\D/', '', (string)($payload['otp'] ?? ''));

    if ($email === '' || $otp === '') {
        appLogEvent($pdo, 'login_otp_verify', 'auth', 'failed', null, 'otp', null, ['reason' => 'missing_fields']);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Email and OTP are required']);
        exit;
    }

    try {
        $user = findUserByCredential($pdo, $email);
        if (!$user) {
            appLogEvent($pdo, 'login_otp_verify', 'auth', 'failed', null, 'user', null, ['reason' => 'user_not_found']);
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'invalid_otp', 'code' => 'invalid_otp']);
            exit;
        }

        $accountEmail = strtolower(trim((string)($user['email'] ?? '')));
        $verifyCheck = otpGuardCheckVerificationAllowed($pdo, $accountEmail, 'login');
        if (!$verifyCheck['allowed']) {
            $lockedResp = otpGuardLockedResponse($verifyCheck);
            appLogEvent($pdo, 'login_otp_verify', 'auth', 'failed', (int)$user['id'], 'otp', null, ['reason' => 'locked']);
            http_response_code($lockedResp['http']);
            echo json_encode([
                'success' => false,
                'error' => $lockedResp['error'],
                'code' => $lockedResp['code'],
                'retry_after_minutes' => $lockedResp['retry_after_minutes'],
            ]);
            exit;
        }

        $purposeClause = columnExists($pdo, 'otp_codes', 'purpose')
            ? " AND purpose = 'login'"
            : '';

        $stmt = $pdo->prepare(
            "SELECT id FROM otp_codes
             WHERE email = :email AND code = :code AND used = 0 AND expires_at >= NOW(){$purposeClause}
             ORDER BY id DESC LIMIT 1"
        );
        $stmt->execute([
            ':email' => $accountEmail,
            ':code' => $otp,
        ]);
        $otpRow = $stmt->fetch();
        if (!$otpRow) {
            $failure = otpGuardRecordVerifyFailure($pdo, $accountEmail, 'login');
            $invalidResp = otpGuardInvalidVerifyResponse($failure);
            appLogEvent($pdo, 'login_otp_verify', 'auth', 'failed', (int)$user['id'], 'otp', null, [
                'reason' => 'invalid_or_expired',
                'attempts_remaining' => $invalidResp['attempts_remaining'] ?? null,
            ]);
            http_response_code($invalidResp['http']);
            echo json_encode([
                'success' => false,
                'error' => $invalidResp['error'],
                'code' => $invalidResp['code'],
                'attempts_remaining' => $invalidResp['attempts_remaining'] ?? null,
                'retry_after_minutes' => $invalidResp['retry_after_minutes'] ?? null,
            ]);
            exit;
        }

        $pdo->prepare('UPDATE otp_codes SET used = 1 WHERE id = :id')->execute([':id' => (int)$otpRow['id']]);
        otpGuardClearVerifyFailures($pdo, $accountEmail, 'login');
        appLogEvent($pdo, 'login_otp_verify', 'auth', 'success', (int)$user['id'], 'otp', (string)$otpRow['id'], []);

        echo json_encode(finalizeLoginResponse($pdo, $user, $accountEmail));
        exit;
    } catch (Throwable $e) {
        appLogEvent($pdo, 'login_otp_verify', 'auth', 'failed', null, 'otp', null, ['reason' => 'server_error']);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'OTP verification failed']);
        exit;
    }
}

if ($action === 'resend_login_otp') {
    ensureOtpTable($pdo);

    $credential = strtolower(trim((string)($payload['email'] ?? $payload['credential'] ?? '')));
    if ($credential === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Email or username is required']);
        exit;
    }

    try {
        $user = findUserByCredential($pdo, $credential);
        if (!$user) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Account not found']);
            exit;
        }

        $accountEmail = strtolower(trim((string)($user['email'] ?? '')));
        if ($accountEmail === '') {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Account has no email on file']);
            exit;
        }

        $verifyCheck = otpGuardCheckVerificationAllowed($pdo, $accountEmail, 'login');
        if (!$verifyCheck['allowed']) {
            $lockedResp = otpGuardLockedResponse($verifyCheck);
            http_response_code($lockedResp['http']);
            echo json_encode([
                'success' => false,
                'error' => $lockedResp['error'],
                'code' => $lockedResp['code'],
                'retry_after_minutes' => $lockedResp['retry_after_minutes'],
            ]);
            exit;
        }

        $otpMinutes = getOtpExpiryMinutes($pdo);
        $otpCode = issueLoginOtp($pdo, $accountEmail, $otpMinutes, true);
        if ($otpCode === null) {
            $limitResp = otpGuardSendLimitResponse('login');
            http_response_code($limitResp['http']);
            echo json_encode([
                'success' => false,
                'error' => $limitResp['error'],
                'code' => $limitResp['code'],
            ]);
            exit;
        }
        $queueId = queueEmail($pdo, $accountEmail, otpEmailSubject('login'), buildOtpEmailBodyWithExpiry($pdo, $otpCode, 'login'));
        $sent = processSingleQueuedEmail($pdo, $queueId);
        $mailError = $sent ? null : getEmailQueueLastError($pdo, $queueId);

        appLogEvent($pdo, 'login_otp_resend', 'auth', $sent ? 'success' : 'failed', (int)$user['id'], 'user', (string)$user['id'], [
            'email' => $accountEmail,
            'mail_error' => $mailError,
        ]);

        $response = [
            'success' => true,
            'message' => $sent ? 'A new login code was sent to your email.' : 'New code generated but email delivery failed.',
            'email' => $accountEmail,
            'email_masked' => maskEmailForOtp($accountEmail),
            'otp_delivery' => $sent ? 'sent' : 'failed',
        ];
        if (!$sent && $mailError !== null) {
            $response['mail_error'] = $mailError;
        }
        $isLocal = in_array((string)($_SERVER['REMOTE_ADDR'] ?? ''), ['127.0.0.1', '::1'], true);
        if ($isLocal && ((!$sent && mailDevOtpFallbackEnabled()) || ($sent && mailLocalOtpInResponseEnabled()))) {
            $response['dev_otp'] = $otpCode;
        }
        echo json_encode($response);
        exit;
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to resend login code']);
        exit;
    }
}

if ($action === 'logout') {
    if (sessionsTableAvailable($pdo)) {
        $token = extractBearerToken();
        if ($token !== null) {
            $revoked = revokeSessionByToken($pdo, $token);
            if ($revoked) {
                appLogEvent($pdo, 'logout_success', 'auth', 'success', (int)$revoked['user_id'], 'session', (string)$revoked['session_id'], []);
            }
        }
    }
    echo json_encode(['success' => true, 'message' => 'logged_out']);
    exit;
}

if ($action === 'verify_otp') {
    ensureOtpTable($pdo);
    ensureUserConsentColumns($pdo);
    ensurePendingRegistrationsTable($pdo);
    if (roleTablesExist($pdo) === false) {
        ensureRoleTables($pdo);
        ensureRoleTablesUsernameColumn($pdo);
    }
    $email = strtolower(trim((string)($payload['email'] ?? '')));
    $otp = preg_replace('/\D/', '', (string)($payload['otp'] ?? ''));
    if ($email === '' || $otp === '') {
        appLogEvent($pdo, 'otp_verify', 'auth', 'failed', null, 'otp', null, ['reason' => 'missing_fields', 'email' => $email]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Email and OTP are required']);
        exit;
    }
    try {
        $verifyCheck = otpGuardCheckVerificationAllowed($pdo, $email, 'registration');
        if (!$verifyCheck['allowed']) {
            $lockedResp = otpGuardLockedResponse($verifyCheck);
            appLogEvent($pdo, 'otp_verify', 'auth', 'failed', null, 'otp', null, ['reason' => 'locked', 'email' => $email]);
            http_response_code($lockedResp['http']);
            echo json_encode([
                'success' => false,
                'error' => $lockedResp['error'],
                'code' => $lockedResp['code'],
                'retry_after_minutes' => $lockedResp['retry_after_minutes'],
            ]);
            exit;
        }

        $purposeClause = columnExists($pdo, 'otp_codes', 'purpose')
            ? " AND purpose = 'registration'"
            : '';
        $stmt = $pdo->prepare(
            "SELECT id FROM otp_codes
              WHERE email = :email AND code = :code AND used = 0 AND expires_at >= NOW()
                {$purposeClause}
              ORDER BY id DESC
              LIMIT 1"
        );
        $stmt->execute([
            ':email' => $email,
            ':code' => $otp,
        ]);
        $otpRow = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$otpRow) {
            $failure = otpGuardRecordVerifyFailure($pdo, $email, 'registration');
            $invalidResp = otpGuardInvalidVerifyResponse($failure);
            appLogEvent($pdo, 'otp_verify', 'auth', 'failed', null, 'otp', null, [
                'reason' => 'invalid_or_expired',
                'email' => $email,
                'attempts_remaining' => $invalidResp['attempts_remaining'] ?? null,
            ]);
            http_response_code($invalidResp['http']);
            echo json_encode([
                'success' => false,
                'error' => $invalidResp['error'],
                'code' => $invalidResp['code'],
                'attempts_remaining' => $invalidResp['attempts_remaining'] ?? null,
                'retry_after_minutes' => $invalidResp['retry_after_minutes'] ?? null,
            ]);
            exit;
        }

        $existingUserStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $existingUserStmt->execute([':email' => $email]);
        if ($existingUserStmt->fetch()) {
            $pdo->prepare('UPDATE otp_codes SET used = 1 WHERE id = :id')->execute([
                ':id' => (int)$otpRow['id'],
            ]);
            deletePendingRegistration($pdo, $email);
            echo json_encode(['success' => true, 'message' => 'Account already exists. Please sign in.']);
            exit;
        }

        $pending = getPendingRegistrationByEmail($pdo, $email);
        if (!$pending) {
            appLogEvent($pdo, 'otp_verify', 'auth', 'failed', null, 'otp', null, ['reason' => 'pending_not_found', 'email' => $email]);
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Signup session expired. Please register again.']);
            exit;
        }

        $userId = insertUserWithRole(
            $pdo,
            (string)$pending['username'],
            $email,
            (string)$pending['password_hash'],
            (string)($pending['full_name'] ?? ''),
            'student',
        );
        markEmailVerified($pdo, $userId);
        saveUserRegistrationConsents(
            $pdo,
            $userId,
            (bool)(int)($pending['terms_privacy_accepted'] ?? 0),
            (bool)(int)($pending['dpa_accepted'] ?? 0),
        );
        deletePendingRegistration($pdo, $email);
        $pdo->prepare('UPDATE otp_codes SET used = 1 WHERE id = :id')->execute([
            ':id' => (int)$otpRow['id'],
        ]);
        otpGuardClearVerifyFailures($pdo, $email, 'registration');

        appLogEvent($pdo, 'register', 'auth', 'success', $userId, 'user', (string)$userId, [
            'email' => $email,
            'role' => 'student',
            'verified_via' => 'otp',
        ]);
        appLogEvent($pdo, 'otp_verify', 'auth', 'success', $userId, 'otp', (string)$otpRow['id'], ['email' => $email]);

        echo json_encode([
            'success' => true,
            'message' => 'Account created successfully. You can now sign in.',
            'user' => [
                'id' => $userId,
                'email' => $email,
                'role' => 'student',
            ],
        ]);
        exit;
    } catch (Throwable $e) {
        appLogEvent($pdo, 'otp_verify', 'auth', 'failed', null, 'otp', null, [
            'reason' => 'server_error',
            'email' => $email,
            'detail' => $e->getMessage(),
        ]);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'OTP verification failed. Please try again or register again.']);
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
        purgeExpiredPendingRegistrations($pdo);

        $userStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $userStmt->execute([':email' => $email]);
        $user = $userStmt->fetch(PDO::FETCH_ASSOC);
        if ($user) {
            appLogEvent($pdo, 'otp_resend', 'auth', 'failed', (int)$user['id'], 'user', (string)$user['id'], ['reason' => 'already_registered', 'email' => $email]);
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Account already exists. Please sign in.']);
            exit;
        }

        $pending = getPendingRegistrationByEmail($pdo, $email);
        if (!$pending) {
            appLogEvent($pdo, 'otp_resend', 'auth', 'failed', null, 'user', null, ['reason' => 'pending_not_found', 'email' => $email]);
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'No pending signup found. Please register again.']);
            exit;
        }

        touchPendingRegistrationExpiry($pdo, $email);
        $sendCheck = otpGuardCheckSendAllowed($pdo, $email, 'registration');
        if (!$sendCheck['allowed']) {
            $limitResp = otpGuardSendLimitResponse('registration');
            appLogEvent($pdo, 'otp_resend', 'auth', 'failed', null, 'pending_registration', $email, ['reason' => 'send_limit']);
            http_response_code($limitResp['http']);
            echo json_encode([
                'success' => false,
                'error' => $limitResp['error'],
                'code' => $limitResp['code'],
            ]);
            exit;
        }
        $otpCode = generateOtpCode();
        $otpMinutes = getOtpExpiryMinutes($pdo);
        storeOtpCode($pdo, $email, $otpCode, $otpMinutes, 'registration');
        $queueId = queueEmail($pdo, $email, otpEmailSubject(), buildOtpEmailBodyWithExpiry($pdo, $otpCode));
        $sent = processSingleQueuedEmail($pdo, $queueId);
        $mailError = $sent ? null : getEmailQueueLastError($pdo, $queueId);
        appLogEvent($pdo, 'otp_resend', 'auth', $sent ? 'success' : 'failed', null, 'pending_registration', $email, [
            'email' => $email,
            'mail_error' => $mailError,
            'purpose' => 'registration',
        ]);
        $response = ['success' => true, 'message' => $sent ? 'OTP resent successfully' : 'OTP regenerated but email delivery failed', 'otp_delivery' => $sent ? 'sent' : 'failed'];
        if (!$sent && $mailError !== null) {
            $response['mail_error'] = $mailError;
        }
        $isLocal = in_array((string)($_SERVER['REMOTE_ADDR'] ?? ''), ['127.0.0.1', '::1'], true);
        if (!$sent && $isLocal && mailDevOtpFallbackEnabled()) {
            $response['dev_otp'] = $otpCode;
        } elseif ($sent && $isLocal && mailLocalOtpInResponseEnabled()) {
            $response['dev_otp'] = $otpCode;
            $response['dev_otp_note'] = 'Local development: OTP also sent by email (check Spam / search brevosend.com).';
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

if ($action === 'forgot_password') {
    ensureOtpTable($pdo);
    $email = strtolower(trim((string)($payload['email'] ?? '')));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Valid email is required']);
        exit;
    }

    $genericMessage = 'If an account exists for this email, a password reset code has been sent.';
    try {
        $user = findUserByCredential($pdo, $email);
        if (!$user) {
            echo json_encode(['success' => true, 'message' => $genericMessage]);
            exit;
        }

        $accountEmail = strtolower(trim((string)($user['email'] ?? '')));
        if ($accountEmail === '') {
            echo json_encode(['success' => true, 'message' => $genericMessage]);
            exit;
        }

        $sendCheck = otpGuardCheckSendAllowed($pdo, $accountEmail, 'password_reset');
        if (!$sendCheck['allowed']) {
            $limitResp = otpGuardSendLimitResponse('password_reset');
            http_response_code($limitResp['http']);
            echo json_encode([
                'success' => false,
                'error' => $limitResp['error'],
                'code' => $limitResp['code'],
            ]);
            exit;
        }

        $otpMinutes = getOtpExpiryMinutes($pdo);
        $otpCode = generateOtpCode();
        storeOtpCode($pdo, $accountEmail, $otpCode, $otpMinutes, 'password_reset');
        $subject = 'NSDGA IntelliDocs password reset code';
        $body = buildOtpEmailBodyWithExpiry($pdo, $otpCode, 'password_reset');
        $queueId = queueEmail($pdo, $accountEmail, $subject, $body);
        $sent = processSingleQueuedEmail($pdo, $queueId);
        $mailError = $sent ? null : getEmailQueueLastError($pdo, $queueId);

        appLogEvent($pdo, 'password_reset_otp_send', 'auth', $sent ? 'success' : 'failed', (int)$user['id'], 'user', (string)$user['id'], [
            'email' => $accountEmail,
            'mail_error' => $mailError,
        ]);

        $response = [
            'success' => true,
            'message' => $sent ? $genericMessage : 'Reset code generated but email delivery failed. Try again shortly.',
            'email' => $accountEmail,
            'email_masked' => maskEmailForOtp($accountEmail),
            'otp_delivery' => $sent ? 'sent' : 'failed',
        ];
        if (!$sent && $mailError !== null) {
            $response['mail_error'] = $mailError;
        }
        $isLocal = in_array((string)($_SERVER['REMOTE_ADDR'] ?? ''), ['127.0.0.1', '::1'], true);
        if ($isLocal && ((!$sent && mailDevOtpFallbackEnabled()) || ($sent && mailLocalOtpInResponseEnabled()))) {
            $response['dev_otp'] = $otpCode;
        }
        echo json_encode($response);
        exit;
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to process password reset request']);
        exit;
    }
}

if ($action === 'reset_password') {
    ensureOtpTable($pdo);
    $email = strtolower(trim((string)($payload['email'] ?? '')));
    $otp = preg_replace('/\D/', '', (string)($payload['otp'] ?? ''));
    $newPassword = (string)($payload['new_password'] ?? '');

    if ($email === '' || $otp === '' || $newPassword === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Email, OTP, and new password are required']);
        exit;
    }

    $policy = validatePasswordStrength($newPassword);
    if ($policy !== null) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => $policy['error'], 'code' => $policy['code']]);
        exit;
    }

    try {
        $user = findUserByCredential($pdo, $email);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Invalid or expired reset code', 'code' => 'invalid_otp']);
            exit;
        }

        $accountEmail = strtolower(trim((string)($user['email'] ?? '')));
        $verifyCheck = otpGuardCheckVerificationAllowed($pdo, $accountEmail, 'password_reset');
        if (!$verifyCheck['allowed']) {
            $lockedResp = otpGuardLockedResponse($verifyCheck);
            http_response_code($lockedResp['http']);
            echo json_encode([
                'success' => false,
                'error' => $lockedResp['error'],
                'code' => $lockedResp['code'],
                'retry_after_minutes' => $lockedResp['retry_after_minutes'],
            ]);
            exit;
        }

        $purposeClause = columnExists($pdo, 'otp_codes', 'purpose')
            ? " AND purpose = 'password_reset'"
            : '';
        $stmt = $pdo->prepare(
            "SELECT id FROM otp_codes
             WHERE email = :email AND code = :code AND used = 0 AND expires_at >= NOW(){$purposeClause}
             ORDER BY id DESC LIMIT 1"
        );
        $stmt->execute([':email' => $accountEmail, ':code' => $otp]);
        $otpRow = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$otpRow) {
            $failure = otpGuardRecordVerifyFailure($pdo, $accountEmail, 'password_reset');
            $invalidResp = otpGuardInvalidVerifyResponse($failure);
            http_response_code($invalidResp['http']);
            echo json_encode([
                'success' => false,
                'error' => $invalidResp['error'],
                'code' => $invalidResp['code'],
                'attempts_remaining' => $invalidResp['attempts_remaining'] ?? null,
                'retry_after_minutes' => $invalidResp['retry_after_minutes'] ?? null,
            ]);
            exit;
        }

        $hash = password_hash($newPassword, PASSWORD_BCRYPT);
        if (columnExists($pdo, 'users', 'must_change_password')) {
            $pdo->prepare('UPDATE users SET password = :hash, must_change_password = 0 WHERE id = :id')
                ->execute([':hash' => $hash, ':id' => (int)$user['id']]);
        } else {
            $pdo->prepare('UPDATE users SET password = :hash WHERE id = :id')
                ->execute([':hash' => $hash, ':id' => (int)$user['id']]);
        }

        $pdo->prepare('UPDATE otp_codes SET used = 1 WHERE id = :id')->execute([':id' => (int)$otpRow['id']]);
        otpGuardClearVerifyFailures($pdo, $accountEmail, 'password_reset');

        appLogEvent($pdo, 'password_reset', 'auth', 'success', (int)$user['id'], 'user', (string)$user['id'], [
            'email' => $accountEmail,
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Password updated. You can now sign in with your new password.',
        ]);
        exit;
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to reset password']);
        exit;
    }
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Unsupported action']);
