<?php
declare(strict_types=1);

/**
 * Server-issued session tokens (Bearer auth). Replaces trusting X-User-Id alone.
 *
 * @see .kiro/specs/session-token-authentication/requirements.md
 */

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/security_guard.php';
require_once __DIR__ . '/server_boot.php';

if (!function_exists('sessionsTableAvailable')) {
    function sessionsTableAvailable(PDO $pdo): bool
    {
        static $cached = null;
        if ($cached !== null) {
            return $cached;
        }

        try {
            ensureSessionsTable($pdo);
            $stmt = $pdo->prepare(
                'SELECT 1 FROM information_schema.tables
                 WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
            );
            $stmt->execute([':t' => 'sessions']);
            $cached = (bool)$stmt->fetchColumn();
        } catch (Throwable $e) {
            try {
                appLogEvent($pdo, 'session_table_unavailable', 'auth', 'failed', null, 'session', null, [
                    'reason' => 'bootstrap_failed',
                ]);
            } catch (Throwable $ignored) {
            }
            $cached = false;
        }

        return $cached;
    }
}

if (!function_exists('ensureSessionsTable')) {
    function ensureSessionsTable(PDO $pdo): void
    {
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS sessions (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    token_hash CHAR(64) NOT NULL,
                    user_id INT NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NOT NULL,
                    revoked_at DATETIME NULL DEFAULT NULL,
                    ip_address VARCHAR(64) NULL,
                    user_agent VARCHAR(255) NULL,
                    UNIQUE KEY uniq_session_token_hash (token_hash),
                    INDEX idx_sessions_user (user_id),
                    INDEX idx_sessions_expires (expires_at),
                    INDEX idx_sessions_revoked (revoked_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        } catch (Throwable $e) {
            try {
                appLogEvent($pdo, 'session_table_bootstrap_failed', 'auth', 'failed', null, 'session', null, [
                    'message' => $e->getMessage(),
                ]);
            } catch (Throwable $ignored) {
            }
        }
    }
}

if (!function_exists('sessionClientIp')) {
    function sessionClientIp(): ?string
    {
        $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
        return $ip !== '' ? $ip : null;
    }
}

if (!function_exists('sessionClientUserAgent')) {
    function sessionClientUserAgent(): ?string
    {
        $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
        if ($ua === '') {
            return null;
        }
        return mb_substr($ua, 0, 255);
    }
}

if (!function_exists('hashSessionToken')) {
    function hashSessionToken(string $token): string
    {
        return hash('sha256', $token);
    }
}

if (!function_exists('extractBearerToken')) {
    function extractBearerToken(): ?string
    {
        $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['Authorization'] ?? '');
        if ($header === '' && function_exists('getallheaders')) {
            foreach (getallheaders() as $name => $value) {
                if (strcasecmp((string)$name, 'Authorization') === 0) {
                    $header = (string)$value;
                    break;
                }
            }
        }
        if (preg_match('/^\s*Bearer\s+([A-Za-z0-9]+)\s*$/i', $header, $m)) {
            $token = trim($m[1]);
            return $token !== '' ? $token : null;
        }
        return null;
    }
}

if (!function_exists('authRejectJson')) {
    function authRejectJson(int $status, string $code, string $error, ?array $details = null): void
    {
        http_response_code($status);
        $body = ['success' => false, 'error' => $error, 'code' => $code];
        if ($details !== null) {
            $body['details'] = $details;
        }
        echo json_encode($body);
        exit;
    }
}

if (!function_exists('cleanupStaleSessions')) {
    function cleanupStaleSessions(PDO $pdo): void
    {
        if (!sessionsTableAvailable($pdo)) {
            return;
        }
        try {
            $pdo->exec("
                DELETE FROM sessions
                WHERE expires_at < (NOW() - INTERVAL 7 DAY)
                  AND (revoked_at IS NULL OR revoked_at < (NOW() - INTERVAL 7 DAY))
            ");
        } catch (Throwable $e) {
            try {
                appLogEvent($pdo, 'session_cleanup_failed', 'auth', 'failed', null, 'session', null, []);
            } catch (Throwable $ignored) {
            }
        }
    }
}

if (!function_exists('createSessionToken')) {
    /**
     * @return array{token: string, session_id: int}|null
     */
    function createSessionToken(PDO $pdo, int $userId): ?array
    {
        if ($userId <= 0 || !sessionsTableAvailable($pdo)) {
            return null;
        }

        cleanupStaleSessions($pdo);

        $plaintext = bin2hex(random_bytes(32));
        $hash = hashSessionToken($plaintext);
        $absoluteHours = (int)(getenv('SESSION_ABSOLUTE_LIFETIME_HOURS') ?: 12);
        if ($absoluteHours < 1) {
            $absoluteHours = 12;
        }

        $stmt = $pdo->prepare("
            INSERT INTO sessions (token_hash, user_id, last_activity_at, expires_at, ip_address, user_agent)
            VALUES (:hash, :uid, NOW(), DATE_ADD(NOW(), INTERVAL :hours HOUR), :ip, :ua)
        ");
        $stmt->execute([
            ':hash' => $hash,
            ':uid' => $userId,
            ':hours' => $absoluteHours,
            ':ip' => sessionClientIp(),
            ':ua' => sessionClientUserAgent(),
        ]);

        $sessionId = (int)$pdo->lastInsertId();

        try {
            appLogEvent($pdo, 'login_success', 'auth', 'success', $userId, 'session', (string)$sessionId, [
                'ip_address' => sessionClientIp(),
                'user_agent' => sessionClientUserAgent(),
            ]);
        } catch (Throwable $e) {
        }

        return ['token' => $plaintext, 'session_id' => $sessionId];
    }
}

if (!function_exists('revokeSessionById')) {
    function revokeSessionById(PDO $pdo, int $sessionId, int $userId): void
    {
        if (!sessionsTableAvailable($pdo) || $sessionId <= 0) {
            return;
        }
        $pdo->prepare('UPDATE sessions SET revoked_at = NOW() WHERE id = :id AND user_id = :uid AND revoked_at IS NULL')
            ->execute([':id' => $sessionId, ':uid' => $userId]);
    }
}

if (!function_exists('revokeSessionByToken')) {
    function revokeSessionByToken(PDO $pdo, string $token): ?array
    {
        if (!sessionsTableAvailable($pdo) || $token === '') {
            return null;
        }
        $hash = hashSessionToken($token);
        $stmt = $pdo->prepare(
            'SELECT id, user_id FROM sessions WHERE token_hash = :hash LIMIT 1'
        );
        $stmt->execute([':hash' => $hash]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }
        $sessionId = (int)$row['id'];
        $userId = (int)$row['user_id'];
        revokeSessionById($pdo, $sessionId, $userId);
        return ['session_id' => $sessionId, 'user_id' => $userId];
    }
}

if (!function_exists('revokeAllUserSessions')) {
    function revokeAllUserSessions(PDO $pdo, int $userId): void
    {
        if (!sessionsTableAvailable($pdo) || $userId <= 0) {
            return;
        }
        $pdo->prepare('UPDATE sessions SET revoked_at = NOW() WHERE user_id = :uid AND revoked_at IS NULL')
            ->execute([':uid' => $userId]);
    }
}

if (!function_exists('userAccountIsActive')) {
    /** Returns false when users.status is explicitly inactive. */
    function userAccountIsActive(PDO $pdo, int $userId): bool
    {
        if ($userId <= 0) {
            return false;
        }
        static $statusColumnExists = null;
        if ($statusColumnExists === null) {
            try {
                $stmt = $pdo->prepare(
                    'SELECT 1 FROM information_schema.columns
                     WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c LIMIT 1'
                );
                $stmt->execute([':t' => 'users', ':c' => 'status']);
                $statusColumnExists = (bool)$stmt->fetchColumn();
            } catch (Throwable $e) {
                $statusColumnExists = false;
            }
        }
        if (!$statusColumnExists) {
            return true;
        }
        $stmt = $pdo->prepare('SELECT LOWER(TRIM(COALESCE(status, \'\'))) FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $userId]);
        $status = strtolower(trim((string)($stmt->fetchColumn() ?: '')));

        return $status === '' || $status === 'active';
    }
}

if (!function_exists('rejectInactiveAccountSession')) {
    function rejectInactiveAccountSession(PDO $pdo, int $userId, int $sessionId): void
    {
        try {
            $pdo->prepare('UPDATE sessions SET revoked_at = NOW() WHERE id = :id')->execute([':id' => $sessionId]);
            appLogEvent($pdo, 'session_revoked_inactive_account', 'auth', 'failed', $userId, 'session', (string)$sessionId, []);
        } catch (Throwable $e) {
        }
        authRejectJson(403, 'account_inactive', 'Account is inactive. Please contact the administrator.');
    }
}

if (!function_exists('resolveSessionRow')) {
    function resolveSessionRow(PDO $pdo, string $token): ?array
    {
        if (!sessionsTableAvailable($pdo)) {
            return null;
        }
        $hash = hashSessionToken($token);
        $stmt = $pdo->prepare(
            'SELECT id, user_id, created_at, last_activity_at, expires_at, revoked_at
             FROM sessions WHERE token_hash = :hash LIMIT 1'
        );
        $stmt->execute([':hash' => $hash]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }
}

if (!function_exists('validateSessionToken')) {
    /**
     * @return array{id: int, role: string, session_id: int}|null rejects via exit
     */
    function validateSessionToken(
        PDO $pdo,
        string $token,
        string $endpointLabel,
        bool $touchActivity = true,
    ): ?array {
        $row = resolveSessionRow($pdo, $token);
        if (!$row) {
            try {
                appLogEvent($pdo, 'session_token_invalid', 'auth', 'failed', null, 'session', null, [
                    'ip_address' => sessionClientIp(),
                    'user_agent' => sessionClientUserAgent(),
                ]);
            } catch (Throwable $e) {
            }
            authRejectJson(401, 'invalid_token', 'unauthorized');
        }

        $sessionId = (int)$row['id'];
        $userId = (int)$row['user_id'];

        if ($row['revoked_at'] !== null) {
            try {
                appLogEvent($pdo, 'session_replay_blocked', 'auth', 'failed', $userId, 'session', (string)$sessionId, [
                    'ip_address' => sessionClientIp(),
                    'user_agent' => sessionClientUserAgent(),
                ]);
            } catch (Throwable $e) {
            }
            authRejectJson(401, 'session_revoked', 'session_revoked');
        }

        if (sessionInvalidatedByServerRestart((string)$row['created_at'])) {
            try {
                $pdo->prepare('UPDATE sessions SET revoked_at = NOW() WHERE id = :id')->execute([':id' => $sessionId]);
                appLogEvent($pdo, 'session_server_restart', 'auth', 'failed', $userId, 'session', (string)$sessionId, []);
            } catch (Throwable $e) {
            }
            authRejectJson(401, 'server_restarted', 'server_restarted');
        }

        $expiresAt = strtotime((string)$row['expires_at']);
        if ($expiresAt !== false && $expiresAt <= time()) {
            try {
                $pdo->prepare('UPDATE sessions SET revoked_at = NOW() WHERE id = :id')->execute([':id' => $sessionId]);
                appLogEvent($pdo, 'session_expired', 'auth', 'failed', $userId, 'session', (string)$sessionId, [
                    'reason' => 'absolute_lifetime',
                ]);
            } catch (Throwable $e) {
            }
            authRejectJson(401, 'session_expired', 'session_expired', ['reason' => 'absolute_lifetime']);
        }

        $idleMinutes = (int)(getenv('SESSION_IDLE_TIMEOUT_MINUTES') ?: 30);
        if ($idleMinutes < 1) {
            $idleMinutes = 30;
        }
        $lastActivity = strtotime((string)$row['last_activity_at']);
        if ($lastActivity !== false) {
            $idleSeconds = time() - $lastActivity;
            if ($idleSeconds > ($idleMinutes * 60)) {
                try {
                    $pdo->prepare('UPDATE sessions SET revoked_at = NOW() WHERE id = :id')->execute([':id' => $sessionId]);
                    appLogEvent($pdo, 'session_expired', 'auth', 'failed', $userId, 'session', (string)$sessionId, [
                        'idle_minutes' => (int)floor($idleSeconds / 60),
                    ]);
                } catch (Throwable $e) {
                }
                authRejectJson(401, 'session_expired', 'session_expired', [
                    'idle_minutes' => (int)floor($idleSeconds / 60),
                ]);
            }
        }

        $legacyHeaderId = (int)($_SERVER['HTTP_X_USER_ID'] ?? 0);
        if ($legacyHeaderId > 0 && $legacyHeaderId !== $userId) {
            try {
                appLogEvent($pdo, 'auth_header_mismatch', 'auth', 'flagged', $userId, 'session', (string)$sessionId, [
                    'token_user_id' => $userId,
                    'header_user_id' => $legacyHeaderId,
                ]);
            } catch (Throwable $e) {
            }
        }

        if (!userAccountIsActive($pdo, $userId)) {
            rejectInactiveAccountSession($pdo, $userId, $sessionId);
        }

        if ($touchActivity) {
            try {
                $pdo->prepare('UPDATE sessions SET last_activity_at = NOW() WHERE id = :id')->execute([':id' => $sessionId]);
            } catch (Throwable $e) {
            }
        }

        rapidActionGuard($pdo, $userId, $endpointLabel);
        flagUnusualHoursIfAny($pdo, $userId, $endpointLabel);

        return [
            'id' => $userId,
            'role' => getUserRole($pdo, $userId),
            'session_id' => $sessionId,
        ];
    }
}

if (!function_exists('legacyHeaderAllowed')) {
    function legacyHeaderAllowed(): bool
    {
        $val = getenv('AUTH_ALLOW_LEGACY_HEADER');
        if ($val === false || $val === '') {
            return true;
        }
        return $val !== '0' && strtolower((string)$val) !== 'false';
    }
}

if (!function_exists('resolveLegacyActor')) {
    function resolveLegacyActor(PDO $pdo, string $endpointLabel): ?array
    {
        $actorId = (int)($_SERVER['HTTP_X_USER_ID'] ?? 0);
        if ($actorId <= 0) {
            return null;
        }
        $stmt = $pdo->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $actorId]);
        if (!$stmt->fetchColumn()) {
            return null;
        }
        if (!userAccountIsActive($pdo, $actorId)) {
            authRejectJson(403, 'account_inactive', 'Account is inactive. Please contact the administrator.');
        }
        runAuthenticatedSecurityGuards($pdo, $actorId, $endpointLabel);
        return [
            'id' => $actorId,
            'role' => getUserRole($pdo, $actorId),
            'session_id' => null,
        ];
    }
}

if (!function_exists('requireAuthenticatedActor')) {
    /**
     * @return array{id: int, role: string, session_id: int|null}
     */
    function requireAuthenticatedActor(PDO $pdo, string $endpointLabel, bool $touchActivity = true): array
    {
        $token = extractBearerToken();
        if ($token !== null && sessionsTableAvailable($pdo)) {
            $actor = validateSessionToken($pdo, $token, $endpointLabel, $touchActivity);
            if ($actor !== null) {
                return $actor;
            }
        }

        if ($token !== null && !sessionsTableAvailable($pdo)) {
            authRejectJson(401, 'auth_disabled', 'unauthorized');
        }

        if ($token !== null && sessionsTableAvailable($pdo)) {
            authRejectJson(401, 'invalid_token', 'unauthorized');
        }

        if (!legacyHeaderAllowed()) {
            authRejectJson(401, 'missing_token', 'unauthorized');
        }

        $legacy = resolveLegacyActor($pdo, $endpointLabel);
        if ($legacy !== null) {
            return $legacy;
        }

        authRejectJson(401, 'missing_token', 'unauthorized');
    }
}

if (!function_exists('tryResolveActorFromRequest')) {
    /**
     * Non-blocking actor resolution for auth.php actions (logout, change_password).
     *
     * @return array{id: int, role: string, session_id: int|null}|null
     */
    function tryResolveActorFromRequest(PDO $pdo, string $endpointLabel = 'auth'): ?array
    {
        $token = extractBearerToken();
        if ($token !== null && sessionsTableAvailable($pdo)) {
            $row = resolveSessionRow($pdo, $token);
            if (!$row || $row['revoked_at'] !== null) {
                return null;
            }
            $expiresAt = strtotime((string)$row['expires_at']);
            if ($expiresAt !== false && $expiresAt <= time()) {
                return null;
            }
            $userId = (int)$row['user_id'];
            return [
                'id' => $userId,
                'role' => getUserRole($pdo, $userId),
                'session_id' => (int)$row['id'],
            ];
        }

        $legacy = resolveLegacyActor($pdo, $endpointLabel);
        return $legacy;
    }
}

if (!function_exists('loginOtpRequired')) {
    function loginOtpRequired(): bool
    {
        $val = getenv('AUTH_LOGIN_OTP_REQUIRED');
        if ($val === false || $val === '') {
            return true;
        }
        return $val !== '0' && strtolower((string)$val) !== 'false';
    }
}

if (!function_exists('loginOtpRequiredForRole')) {
    /** Login MFA applies to students/applicants only; staff portals skip OTP. */
    function loginOtpRequiredForRole(string $role): bool
    {
        if (!loginOtpRequired()) {
            return false;
        }
        $r = strtolower(trim($role));
        return !in_array($r, ['admin', 'registrar'], true);
    }
}
