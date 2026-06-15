<?php
declare(strict_types=1);

/**
 * OTP verification limits: failed attempts, lockout, and hourly send cap.
 */

const OTP_GUARD_MAX_ATTEMPTS = 5;
const OTP_GUARD_LOCKOUT_MINUTES = 15;
/** Default hourly send caps per flow. */
const OTP_GUARD_MAX_SENDS_PER_HOUR = 6;
const OTP_GUARD_MAX_SENDS_PER_HOUR_LOGIN = 6;
const OTP_GUARD_MAX_SENDS_PER_HOUR_REGISTRATION = 6;
const OTP_GUARD_MAX_SENDS_PER_HOUR_PASSWORD_RESET = 6;

function otpGuardMaxAttempts(): int
{
    $v = (int)(getenv('OTP_MAX_ATTEMPTS') ?: OTP_GUARD_MAX_ATTEMPTS);

    return max(1, min(20, $v));
}

function otpGuardLockoutMinutes(): int
{
    $v = (int)(getenv('OTP_LOCKOUT_MINUTES') ?: OTP_GUARD_LOCKOUT_MINUTES);

    return max(1, min(120, $v));
}

function otpGuardMaxSendsPerHour(?string $purpose = null): int
{
    $purposeNorm = $purpose !== null && trim($purpose) !== ''
        ? otpGuardNormalizePurpose($purpose)
        : '';

    $global = (int)(getenv('OTP_MAX_REQUESTS_PER_HOUR') ?: 0);

    if ($purposeNorm === 'login') {
        $v = (int)(getenv('OTP_MAX_REQUESTS_PER_HOUR_LOGIN')
            ?: ($global > 0 ? $global : OTP_GUARD_MAX_SENDS_PER_HOUR_LOGIN));
    } elseif ($purposeNorm === 'registration') {
        $v = (int)(getenv('OTP_MAX_REQUESTS_PER_HOUR_REGISTRATION')
            ?: ($global > 0 ? $global : OTP_GUARD_MAX_SENDS_PER_HOUR_REGISTRATION));
    } elseif ($purposeNorm === 'password_reset') {
        $v = (int)(getenv('OTP_MAX_REQUESTS_PER_HOUR_PASSWORD_RESET')
            ?: ($global > 0 ? $global : OTP_GUARD_MAX_SENDS_PER_HOUR_PASSWORD_RESET));
    } else {
        $v = (int)($global > 0 ? $global : OTP_GUARD_MAX_SENDS_PER_HOUR);
    }

    return max(1, min(30, $v));
}

function otpGuardNormalizeEmail(string $email): string
{
    return strtolower(trim($email));
}

function otpGuardNormalizePurpose(string $purpose): string
{
    $p = strtolower(trim($purpose));
    $allowed = ['registration', 'login', 'password_reset'];
    return in_array($p, $allowed, true) ? $p : 'registration';
}

function ensureOtpGuardTable(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS otp_guard_state (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(100) NOT NULL,
            purpose VARCHAR(20) NOT NULL,
            failed_attempts INT NOT NULL DEFAULT 0,
            locked_until TIMESTAMP NULL DEFAULT NULL,
            last_failed_at TIMESTAMP NULL DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_otp_guard_email_purpose (email, purpose),
            INDEX idx_otp_guard_locked (locked_until)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $done = true;
}

/**
 * @return array{allowed: bool, locked_until?: string|null, retry_after_minutes?: int, failed_attempts?: int}
 */
function otpGuardCheckVerificationAllowed(PDO $pdo, string $email, string $purpose): array
{
    ensureOtpGuardTable($pdo);
    $email = otpGuardNormalizeEmail($email);
    $purpose = otpGuardNormalizePurpose($purpose);

    $stmt = $pdo->prepare(
        'SELECT failed_attempts, locked_until FROM otp_guard_state WHERE email = :email AND purpose = :purpose LIMIT 1'
    );
    $stmt->execute([':email' => $email, ':purpose' => $purpose]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return ['allowed' => true, 'failed_attempts' => 0];
    }

    $lockedUntil = $row['locked_until'] ?? null;
    if ($lockedUntil !== null && $lockedUntil !== '') {
        $lockTs = strtotime((string)$lockedUntil);
        if ($lockTs !== false && $lockTs > time()) {
            $retryMinutes = (int)max(1, ceil(($lockTs - time()) / 60));

            return [
                'allowed' => false,
                'locked_until' => (string)$lockedUntil,
                'retry_after_minutes' => $retryMinutes,
                'failed_attempts' => (int)($row['failed_attempts'] ?? 0),
            ];
        }
    }

    return [
        'allowed' => true,
        'failed_attempts' => (int)($row['failed_attempts'] ?? 0),
    ];
}

/**
 * @return array{locked: bool, attempts_remaining: int, retry_after_minutes?: int}
 */
function otpGuardRecordVerifyFailure(PDO $pdo, string $email, string $purpose): array
{
    ensureOtpGuardTable($pdo);
    $email = otpGuardNormalizeEmail($email);
    $purpose = otpGuardNormalizePurpose($purpose);
    $maxAttempts = otpGuardMaxAttempts();
    $lockoutMinutes = otpGuardLockoutMinutes();

    $pdo->prepare(
        'INSERT INTO otp_guard_state (email, purpose, failed_attempts, last_failed_at)
         VALUES (:email, :purpose, 0, NULL)
         ON DUPLICATE KEY UPDATE email = email'
    )->execute([':email' => $email, ':purpose' => $purpose]);

    $pdo->prepare(
        'UPDATE otp_guard_state
         SET failed_attempts = failed_attempts + 1,
             last_failed_at = NOW(),
             locked_until = CASE
               WHEN failed_attempts + 1 >= :max THEN DATE_ADD(NOW(), INTERVAL :lockout MINUTE)
               ELSE locked_until
             END
         WHERE email = :email AND purpose = :purpose'
    )->execute([
        ':email' => $email,
        ':purpose' => $purpose,
        ':max' => $maxAttempts,
        ':lockout' => $lockoutMinutes,
    ]);

    $stmt = $pdo->prepare(
        'SELECT failed_attempts, locked_until FROM otp_guard_state WHERE email = :email AND purpose = :purpose LIMIT 1'
    );
    $stmt->execute([':email' => $email, ':purpose' => $purpose]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: ['failed_attempts' => $maxAttempts, 'locked_until' => null];

    $failed = (int)($row['failed_attempts'] ?? 0);
    $lockedUntil = $row['locked_until'] ?? null;
    $locked = false;
    $retryMinutes = null;
    if ($lockedUntil !== null && $lockedUntil !== '') {
        $lockTs = strtotime((string)$lockedUntil);
        if ($lockTs !== false && $lockTs > time()) {
            $locked = true;
            $retryMinutes = (int)max(1, ceil(($lockTs - time()) / 60));
        }
    }

    return [
        'locked' => $locked,
        'attempts_remaining' => max(0, $maxAttempts - $failed),
        'retry_after_minutes' => $retryMinutes,
    ];
}

function otpGuardClearVerifyFailures(PDO $pdo, string $email, string $purpose): void
{
    ensureOtpGuardTable($pdo);
    $email = otpGuardNormalizeEmail($email);
    $purpose = otpGuardNormalizePurpose($purpose);

    $pdo->prepare(
        'UPDATE otp_guard_state
         SET failed_attempts = 0, locked_until = NULL, last_failed_at = NULL
         WHERE email = :email AND purpose = :purpose'
    )->execute([':email' => $email, ':purpose' => $purpose]);
}

function otpGuardCountSendsLastHour(PDO $pdo, string $email, string $purpose): int
{
    ensureOtpTableForGuard($pdo);
    $email = otpGuardNormalizeEmail($email);
    $purpose = otpGuardNormalizePurpose($purpose);

    $purposeClause = otpGuardHasPurposeColumn($pdo)
        ? ' AND purpose = :purpose'
        : '';

    $sql = "SELECT COUNT(*) FROM otp_codes
            WHERE email = :email{$purposeClause}
              AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)";
    $stmt = $pdo->prepare($sql);
    $params = [':email' => $email];
    if ($purposeClause !== '') {
        $params[':purpose'] = $purpose;
    }
    $stmt->execute($params);

    return (int)$stmt->fetchColumn();
}

/**
 * @return array{allowed: bool, sends_in_last_hour?: int, limit?: int}
 */
function otpGuardCheckSendAllowed(PDO $pdo, string $email, string $purpose): array
{
    $purpose = otpGuardNormalizePurpose($purpose);
    $limit = otpGuardMaxSendsPerHour($purpose);
    $count = otpGuardCountSendsLastHour($pdo, $email, $purpose);
    if ($count >= $limit) {
        return [
            'allowed' => false,
            'sends_in_last_hour' => $count,
            'limit' => $limit,
        ];
    }

    return [
        'allowed' => true,
        'sends_in_last_hour' => $count,
        'limit' => $limit,
    ];
}

function otpGuardHasPurposeColumn(PDO $pdo): bool
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    try {
        $stmt = $pdo->prepare(
            'SELECT 1 FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1'
        );
        $stmt->execute([':table' => 'otp_codes', ':column' => 'purpose']);
        $cache = (bool)$stmt->fetchColumn();
    } catch (Throwable $e) {
        $cache = false;
    }

    return $cache;
}

/** Minimal table ensure when auth.php helpers are not loaded yet. */
function ensureOtpTableForGuard(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
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
    $done = true;
}

function otpGuardInvalidVerifyResponse(array $failure): array
{
    if (!empty($failure['locked'])) {
        $mins = (int)($failure['retry_after_minutes'] ?? otpGuardLockoutMinutes());

        return [
            'http' => 429,
            'code' => 'otp_locked',
            'error' => "Too many incorrect OTP attempts. Try again in {$mins} minute(s).",
            'retry_after_minutes' => $mins,
            'attempts_remaining' => 0,
        ];
    }

    $remaining = (int)($failure['attempts_remaining'] ?? 0);
    $msg = $remaining > 0
        ? "Invalid or expired OTP. {$remaining} attempt(s) remaining."
        : 'Invalid or expired OTP.';

    return [
        'http' => 401,
        'code' => 'invalid_otp',
        'error' => $msg,
        'attempts_remaining' => $remaining,
    ];
}

function otpGuardSendLimitResponse(?string $purpose = null): array
{
    $purposeNorm = $purpose !== null && trim($purpose) !== ''
        ? otpGuardNormalizePurpose($purpose)
        : '';
    $limit = otpGuardMaxSendsPerHour($purposeNorm !== '' ? $purposeNorm : null);
    $flowLabel = match ($purposeNorm) {
        'login' => 'sign-in',
        'password_reset' => 'password reset',
        'registration' => 'registration',
        default => 'verification',
    };

    return [
        'http' => 429,
        'code' => 'otp_resend_limit',
        'error' => "Maximum {$limit} {$flowLabel} code requests per hour reached. Please wait before requesting another code.",
        'limit' => $limit,
        'purpose' => $purposeNorm !== '' ? $purposeNorm : null,
    ];
}

function otpGuardLockedResponse(array $check): array
{
    $mins = (int)($check['retry_after_minutes'] ?? otpGuardLockoutMinutes());

    return [
        'http' => 429,
        'code' => 'otp_locked',
        'error' => "OTP verification is locked. Try again in {$mins} minute(s).",
        'retry_after_minutes' => $mins,
    ];
}
