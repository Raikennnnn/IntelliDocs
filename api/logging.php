<?php
declare(strict_types=1);

/**
 * Lightweight in-app logging (no external SIEM).
 *
 * Writes structured events to MySQL and never throws to callers.
 */
function loggingTableExists(PDO $pdo, string $tableName): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute([':t' => $tableName]);

    return (bool)$stmt->fetchColumn();
}

function loggingColumnExists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column
         LIMIT 1'
    );
    $stmt->execute([':table' => $table, ':column' => $column]);
    return (bool)$stmt->fetchColumn();
}

function ensureActivityLogColumns(PDO $pdo): void
{
    if (!loggingTableExists($pdo, 'activity_logs')) {
        return;
    }
    try {
        if (!loggingColumnExists($pdo, 'activity_logs', 'ip_address')) {
            $pdo->exec('ALTER TABLE activity_logs ADD COLUMN ip_address VARCHAR(64) NULL AFTER status');
        }
        if (!loggingColumnExists($pdo, 'activity_logs', 'user_agent')) {
            $pdo->exec('ALTER TABLE activity_logs ADD COLUMN user_agent VARCHAR(255) NULL AFTER ip_address');
        }
    } catch (Throwable $e) {
        // Tolerant: logging still works without optional columns.
    }
}

function resolveClientIpAddress(): string
{
    $candidates = [];
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        foreach (explode(',', (string)$_SERVER['HTTP_X_FORWARDED_FOR']) as $part) {
            $ip = trim($part);
            if ($ip !== '') {
                $candidates[] = $ip;
            }
        }
    }
    if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
        $candidates[] = trim((string)$_SERVER['HTTP_X_REAL_IP']);
    }
    if (!empty($_SERVER['REMOTE_ADDR'])) {
        $candidates[] = trim((string)$_SERVER['REMOTE_ADDR']);
    }
    foreach ($candidates as $ip) {
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }
    return '';
}

function resolveActivityLogIpAddress(?string $columnValue, array $details): string
{
    $ip = trim((string)($columnValue ?? ''));
    if ($ip === '' && isset($details['ip_address'])) {
        $ip = trim((string)$details['ip_address']);
    }
    if ($ip === '' && isset($details['ip'])) {
        $ip = trim((string)$details['ip']);
    }
    return $ip;
}

function ensureLoggingTables(PDO $pdo): void
{
    // CREATE TABLE (even IF NOT EXISTS) implicitly commits an open transaction
    // in MySQL. Skip DDL when tables already exist so callers can log safely
    // inside beginTransaction() blocks.
    if (loggingTableExists($pdo, 'activity_logs') && loggingTableExists($pdo, 'login_attempts')) {
        ensureActivityLogColumns($pdo);
        return;
    }

    if (!loggingTableExists($pdo, 'activity_logs')) {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS activity_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                actor_user_id INT NULL,
                action VARCHAR(120) NOT NULL,
                module VARCHAR(80) NOT NULL,
                target_type VARCHAR(80) NULL,
                target_id VARCHAR(120) NULL,
                status VARCHAR(40) NOT NULL,
                ip_address VARCHAR(64) NULL,
                user_agent VARCHAR(255) NULL,
                details_json JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_activity_created_at (created_at),
                INDEX idx_activity_action (action),
                INDEX idx_activity_status (status),
                INDEX idx_activity_actor (actor_user_id)
            )
        ");
    }

    if (!loggingTableExists($pdo, 'login_attempts')) {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS login_attempts (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(120) NOT NULL,
                success TINYINT(1) NOT NULL DEFAULT 0,
                ip_address VARCHAR(64) NULL,
                user_agent VARCHAR(255) NULL,
                attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_login_email (email),
                INDEX idx_login_success (success),
                INDEX idx_login_attempted_at (attempted_at)
            )
        ");
    }

    ensureActivityLogColumns($pdo);
}

/**
 * @param array<string,mixed> $details
 */
function appLogEvent(
    PDO $pdo,
    string $action,
    string $module,
    string $status,
    ?int $actorUserId = null,
    ?string $targetType = null,
    ?string $targetId = null,
    array $details = []
): void {
    try {
        ensureLoggingTables($pdo);
        $stmt = $pdo->prepare("
            INSERT INTO activity_logs
                (actor_user_id, action, module, target_type, target_id, status, ip_address, user_agent, details_json)
            VALUES
                (:actor_user_id, :action, :module, :target_type, :target_id, :status, :ip_address, :user_agent, :details_json)
        ");
        $stmt->execute([
            ':actor_user_id' => $actorUserId,
            ':action' => $action,
            ':module' => $module,
            ':target_type' => $targetType,
            ':target_id' => $targetId,
            ':status' => $status,
            ':ip_address' => resolveClientIpAddress(),
            ':user_agent' => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
            ':details_json' => json_encode($details, JSON_UNESCAPED_UNICODE),
        ]);
    } catch (Throwable $e) {
        // Intentionally ignore logging failures to avoid breaking API operations.
    }
}

function ensureUserLastLoginColumn(PDO $pdo): void
{
    try {
        $stmt = $pdo->prepare(
            'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1'
        );
        $stmt->execute([':table' => 'users', ':column' => 'last_login_at']);
        if (!$stmt->fetchColumn()) {
            $pdo->exec('ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL DEFAULT NULL');
        }
    } catch (Throwable $e) {
        // Tolerant: listing users still falls back to activity_logs.
    }
}

function touchUserLastLogin(PDO $pdo, int $userId): void
{
    if ($userId <= 0) {
        return;
    }
    try {
        ensureUserLastLoginColumn($pdo);
        $stmt = $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $userId]);
    } catch (Throwable $e) {
        // Do not block login on timestamp update failure.
    }
}

function formatUserLastLogin(?string $raw): string
{
    if ($raw === null || trim($raw) === '') {
        return 'Never';
    }
    $ts = strtotime($raw);
    if ($ts === false) {
        return 'Never';
    }
    return date('M j, Y g:i A', $ts);
}

function userLastLoginSelectSql(string $userAlias = 'u'): string
{
    return "COALESCE(
        {$userAlias}.last_login_at,
        (SELECT MAX(al.created_at) FROM activity_logs al
         WHERE al.actor_user_id = {$userAlias}.id AND al.action = 'login' AND al.status = 'success')
    )";
}

function appLogLoginAttempt(PDO $pdo, string $email, bool $success): void
{
    try {
        ensureLoggingTables($pdo);
        $stmt = $pdo->prepare("
            INSERT INTO login_attempts (email, success, ip_address, user_agent)
            VALUES (:email, :success, :ip_address, :user_agent)
        ");
        $stmt->execute([
            ':email' => $email,
            ':success' => $success ? 1 : 0,
            ':ip_address' => resolveClientIpAddress(),
            ':user_agent' => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
        ]);
    } catch (Throwable $e) {
        // Intentionally ignore logging failures.
    }
}
