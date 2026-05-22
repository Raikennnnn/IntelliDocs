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
    $fullName = trim((string)($payload['full_name'] ?? ''));

    if ($username === '' || $email === '' || $password === '' || $fullName === '') {
        appLogEvent($pdo, 'register_attempt', 'auth', 'failed', null, 'user', null, ['reason' => 'missing_fields', 'email' => $email]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'All required fields must be provided']);
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
        $queueId = queueEmail($pdo, $email, 'IntelliDocs Email Verification OTP', buildOtpEmailBody($otpCode));
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
    $email = strtolower(trim((string)($payload['email'] ?? '')));
    $password = (string)($payload['password'] ?? '');

    if ($email === '' || $password === '') {
        appLogLoginAttempt($pdo, $email, false);
        appLogEvent($pdo, 'login_attempt', 'auth', 'failed', null, 'user', null, ['reason' => 'missing_credentials', 'email' => $email]);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Email and password are required']);
        exit;
    }

    try {
        $hasStatus = columnExists($pdo, 'users', 'status');
        $stmt = $pdo->prepare(
            $hasStatus
                ? 'SELECT id, username, email, password, full_name, status FROM users WHERE email = :email LIMIT 1'
                : 'SELECT id, username, email, password, full_name FROM users WHERE email = :email LIMIT 1'
        );
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, (string)$user['password'])) {
            appLogLoginAttempt($pdo, $email, false);
            appLogEvent($pdo, 'login_attempt', 'auth', 'failed', null, 'user', null, ['reason' => 'invalid_credentials', 'email' => $email]);
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Invalid email or password']);
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
        appLogLoginAttempt($pdo, $email, true);
        appLogEvent($pdo, 'login', 'auth', 'success', (int)$user['id'], 'user', (string)$user['id'], ['email' => $email, 'role' => $resolvedRole]);
        touchUserLastLogin($pdo, (int)$user['id']);
        unset($user['password']);
        unset($user['status']);
        $user['role'] = $resolvedRole;

        echo json_encode([
            'success' => true,
            'user' => $user,
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
        $queueId = queueEmail($pdo, $email, 'IntelliDocs Email Verification OTP', buildOtpEmailBody($otpCode));
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
