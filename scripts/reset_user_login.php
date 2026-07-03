<?php
declare(strict_types=1);

/**
 * Reset a stuck student/login account on the server (password, lockouts, email verified).
 *
 * Usage on droplet:
 *   php scripts/reset_user_login.php --email=student@example.com --password=NewPass123!
 *   php scripts/reset_user_login.php --username=jdela001 --clear-lockouts
 *
 * Omit --password to set a random temporary password (printed once).
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Run from CLI only.\n");
    exit(1);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../api/email_verification.php';

$opts = getopt('', ['email:', 'username:', 'password:', 'clear-lockouts', 'verify-email', 'help']);

if (isset($opts['help']) || (!isset($opts['email']) && !isset($opts['username']))) {
    echo "Usage: php scripts/reset_user_login.php --email=ADDR [--password=NEW] [--clear-lockouts] [--verify-email]\n";
    echo "   or: php scripts/reset_user_login.php --username=SCHOOL_USER [--password=NEW] ...\n";
    exit(isset($opts['help']) ? 0 : 1);
}

$lookupEmail = isset($opts['email']) ? strtolower(trim((string)$opts['email'])) : '';
$lookupUsername = isset($opts['username']) ? strtolower(trim((string)$opts['username'])) : '';
$newPassword = isset($opts['password']) ? (string)$opts['password'] : '';
$clearLockouts = array_key_exists('clear-lockouts', $opts);
$verifyEmail = array_key_exists('verify-email', $opts);

if ($lookupEmail !== '') {
    $stmt = $pdo->prepare('SELECT id, email, school_username, username, full_name FROM users WHERE email = :v LIMIT 1');
    $stmt->execute([':v' => $lookupEmail]);
} else {
    $stmt = $pdo->prepare('SELECT id, email, school_username, username, full_name FROM users WHERE school_username = :v LIMIT 1');
    $stmt->execute([':v' => $lookupUsername]);
}
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    fwrite(STDERR, "No user found for that email/username.\n");
    exit(1);
}

$userId = (int)$user['id'];
$accountEmail = strtolower(trim((string)($user['email'] ?? '')));

if ($newPassword === '') {
    $newPassword = 'Temp' . bin2hex(random_bytes(4)) . '!';
}

if (strlen($newPassword) < 8) {
    fwrite(STDERR, "Password must be at least 8 characters.\n");
    exit(1);
}

$hash = password_hash($newPassword, PASSWORD_DEFAULT);
$pdo->prepare('UPDATE users SET password = :pw WHERE id = :id')->execute([':pw' => $hash, ':id' => $userId]);

if ($verifyEmail && $accountEmail !== '') {
    markEmailVerified($pdo, $userId);
}

if ($clearLockouts || $verifyEmail) {
    try {
        $pdo->exec('CREATE TABLE IF NOT EXISTS login_attempts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            success TINYINT(1) NOT NULL DEFAULT 0,
            attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_login_attempted_at (attempted_at)
        )');
    } catch (Throwable $e) {
    }

    $keys = array_values(array_unique(array_filter([
        $accountEmail,
        $lookupEmail,
        $lookupUsername,
        strtolower(trim((string)($user['school_username'] ?? ''))),
        strtolower(trim((string)($user['username'] ?? ''))),
    ])));

    foreach ($keys as $key) {
        if ($key === '') {
            continue;
        }
        $pdo->prepare('DELETE FROM login_attempts WHERE email = :e')->execute([':e' => $key]);
    }

    if ($accountEmail !== '') {
        try {
            $pdo->prepare('DELETE FROM otp_guard_state WHERE email = :e')->execute([':e' => $accountEmail]);
        } catch (Throwable $e) {
        }
    }
}

echo "OK: reset login for user id {$userId}\n";
echo "  email:           " . ($accountEmail !== '' ? $accountEmail : '(none)') . "\n";
echo "  school_username: " . (trim((string)($user['school_username'] ?? '')) ?: '(none)') . "\n";
echo "  new_password:    {$newPassword}\n";
if ($verifyEmail) {
    echo "  email_verified:  yes\n";
}
if ($clearLockouts || $verifyEmail) {
    echo "  lockouts:        cleared\n";
}
echo "\nSign in with email OR school username and the password above.\n";
echo "All portal roles need the login OTP emailed after the password step when MFA is enabled.\n";
