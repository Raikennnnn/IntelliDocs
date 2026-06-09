<?php
declare(strict_types=1);

/**
 * Security guard helpers for IntelliDocs APIs.
 *
 * One include, three checks, exposed as small functions any endpoint can
 * invoke after `getUserRole(...)` has approved the role:
 *
 *   - sessionGuard($pdo, $userId)            -- idle session expiry
 *   - rapidActionGuard($pdo, $userId)        -- > N actions / window
 *   - flagUnusualHoursIfAny($pdo, $userId)   -- log anomaly outside window
 *
 * The first two SHORT-CIRCUIT the request when they fire (HTTP 401 / 429)
 * and write a row to `activity_logs` with `action = 'anomaly_*'` so the
 * registrar/admin pages can surface them. The third is fire-and-forget;
 * it logs but does not block, because blocking on time-of-day is too
 * fragile for a real school's operations.
 *
 * Configuration (env, all optional with sensible defaults):
 *
 *   SESSION_IDLE_TIMEOUT_MINUTES   default 30
 *   RAPID_ACTION_WINDOW_MINUTES    default 2
 *   RAPID_ACTION_THRESHOLD         default 15 (sensitive actions only)
 *   APP_ACTIVE_HOURS_START         default 00:00 (always-on)
 *   APP_ACTIVE_HOURS_END           default 23:59
 *
 * Every check fails OPEN on internal exceptions (e.g. activity_logs table
 * absent on a fresh install) so the guard never bricks a working system —
 * the worst-case is "no enforcement", which matches existing throttle
 * behavior in api/auth.php.
 */

require_once __DIR__ . '/logging.php';

// ---------------------------------------------------------------------------
// Schema bootstrap: users.last_activity_at column
// ---------------------------------------------------------------------------

if (!function_exists('ensureUserLastActivityColumn')) {
    function ensureUserLastActivityColumn(PDO $pdo): void
    {
        try {
            $stmt = $pdo->prepare(
                'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c LIMIT 1'
            );
            $stmt->execute([':t' => 'users', ':c' => 'last_activity_at']);
            if (!$stmt->fetchColumn()) {
                $pdo->exec('ALTER TABLE users ADD COLUMN last_activity_at TIMESTAMP NULL DEFAULT NULL');
            }
        } catch (Throwable $e) {
            // Permission-restricted environments may not allow ALTER.
            // The guards below treat a missing column as "no prior activity"
            // which means a fresh login can't be expired-out by mistake.
        }
    }
}

// ---------------------------------------------------------------------------
// 1. Idle-session expiry
// ---------------------------------------------------------------------------

if (!function_exists('sessionGuard')) {
    /**
     * Reject the request when the actor has been idle longer than the
     * configured timeout. On success, refreshes `users.last_activity_at`
     * so the next call resets the clock.
     *
     * Returns silently on success; calls exit() with HTTP 401 on expiry.
     */
    function sessionGuard(PDO $pdo, int $userId, string $endpointLabel): void
    {
        if ($userId <= 0) return;

        $timeout = (int)(getenv('SESSION_IDLE_TIMEOUT_MINUTES') ?: 30);
        if ($timeout < 1) $timeout = 30;

        ensureUserLastActivityColumn($pdo);

        try {
            $stmt = $pdo->prepare(
                'SELECT last_activity_at FROM users WHERE id = :id LIMIT 1'
            );
            $stmt->execute([':id' => $userId]);
            $last = $stmt->fetchColumn();
            // No prior activity timestamp = first call after login or
            // legacy account from before this column existed. Treat as
            // fresh; do not expire.
            if ($last !== false && $last !== null && $last !== '') {
                $lastTs = strtotime((string)$last);
                if ($lastTs !== false) {
                    $idleSeconds = time() - $lastTs;
                    if ($idleSeconds > $timeout * 60) {
                        appLogEvent(
                            $pdo,
                            'anomaly_session_expired',
                            'security',
                            'failed',
                            $userId,
                            'endpoint',
                            $endpointLabel,
                            ['idle_seconds' => $idleSeconds, 'timeout_minutes' => $timeout]
                        );
                        http_response_code(401);
                        header('Content-Type: application/json');
                        echo json_encode([
                            'success' => false,
                            'error' => 'session_expired',
                            'code' => 'session_expired',
                            'details' => ['idle_minutes' => (int)floor($idleSeconds / 60)],
                        ]);
                        exit;
                    }
                }
            }

            // Stamp activity. Lock-light UPDATE; ignored if column missing.
            $upd = $pdo->prepare('UPDATE users SET last_activity_at = NOW() WHERE id = :id LIMIT 1');
            $upd->execute([':id' => $userId]);
        } catch (Throwable $e) {
            // Fail-open: a logging-table issue must not lock everyone out.
        }
    }
}

// ---------------------------------------------------------------------------
// 2. Rapid-action throttle (anomaly detection rule #4)
// ---------------------------------------------------------------------------

if (!function_exists('rapidActionGuardSensitiveActions')) {
    /**
     * Only these actions count toward the rapid-action limit. Routine registrar
     * work (document_review, loading an application, draft saves) is excluded
     * so reviewing all five uploads in one session does not trip a false positive.
     *
     * @return list<string>
     */
    function rapidActionGuardSensitiveActions(): array
    {
        return [
            'admin_delete_user',
            'admin_update_user',
            'create_user',
            'change_password',
            'registrar_decision',
            'issue_credentials',
            'section_create',
            'section_delete',
            'section_reassign',
            'student_enrollment_submit',
            'student_enrollment_cancel',
            'document_upload',
            'document_decision',
            'registrar_announcement_create',
            'registrar_announcement_update',
            'registrar_announcement_delete',
            'cohort_rebuild',
        ];
    }
}

if (!function_exists('rapidActionGuard')) {
    /**
     * Short-circuit with HTTP 429 when the actor has exceeded the configured
     * action rate (default >10 *mutations* in the last 2 minutes) — picked
     * from the IntelliDocs anomaly rules table. Reads `activity_logs.created_at`
     * so it works without any new schema.
     *
     * Scope: counts only sensitive mutations (see rapidActionGuardSensitiveActions).
     * Routine registrar document review, application loads, and draft saves are
     * not counted — those were causing false rate_limited errors during review.
     */
    function rapidActionGuard(PDO $pdo, int $userId, string $endpointLabel): void
    {
        if ($userId <= 0) return;

        // Only enforce on mutating verbs. GETs (dashboard fan-out, polling,
        // refreshes) are not "actions" the anomaly rule was designed to catch.
        $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        if (!in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return;
        }

        $window = (int)(getenv('RAPID_ACTION_WINDOW_MINUTES') ?: 2);
        if ($window < 1) $window = 2;
        $threshold = (int)(getenv('RAPID_ACTION_THRESHOLD') ?: 15);
        if ($threshold < 1) $threshold = 15;

        try {
            // activity_logs is created lazily by ensureLoggingTables(); if
            // it isn't there yet, skip silently.
            $stmt = $pdo->prepare(
                'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
            );
            $stmt->execute([':t' => 'activity_logs']);
            if (!$stmt->fetchColumn()) return;

            $sensitive = rapidActionGuardSensitiveActions();
            if ($sensitive === []) {
                return;
            }
            $placeholders = implode(',', array_fill(0, count($sensitive), '?'));
            $countStmt = $pdo->prepare(
                "SELECT COUNT(*) FROM activity_logs
                 WHERE actor_user_id = ?
                   AND created_at >= (NOW() - INTERVAL {$window} MINUTE)
                   AND action IN ({$placeholders})"
            );
            $countStmt->execute(array_merge([$userId], $sensitive));
            $count = (int)$countStmt->fetchColumn();
            if ($count > $threshold) {
                appLogEvent(
                    $pdo,
                    'anomaly_rapid_actions',
                    'security',
                    'failed',
                    $userId,
                    'endpoint',
                    $endpointLabel,
                    ['count' => $count, 'window_minutes' => $window, 'threshold' => $threshold]
                );
                http_response_code(429);
                header('Content-Type: application/json');
                echo json_encode([
                    'success' => false,
                    'error' => 'rate_limited',
                    'code' => 'rapid_actions',
                    'details' => [
                        'window_minutes' => $window,
                        'threshold' => $threshold,
                        'observed' => $count,
                    ],
                ]);
                exit;
            }
        } catch (Throwable $e) {
            // Fail-open to avoid bricking the system on a logging glitch.
        }
    }
}

// ---------------------------------------------------------------------------
// 3. Unusual-hours flag (anomaly detection rule #5)
// ---------------------------------------------------------------------------

if (!function_exists('flagUnusualHoursIfAny')) {
    /**
     * Log (without blocking) when an authenticated request lands outside the
     * configured active-hours window. Defaults are 00:00-23:59, which means
     * "always on" and never logs — schools opt in by setting tighter env vars.
     *
     * Format: APP_ACTIVE_HOURS_START / APP_ACTIVE_HOURS_END as HH:MM, 24h.
     * Wrap-around windows (e.g. 22:00-06:00) are supported.
     */
    function flagUnusualHoursIfAny(PDO $pdo, int $userId, string $endpointLabel): void
    {
        if ($userId <= 0) return;
        $start = (string)(getenv('APP_ACTIVE_HOURS_START') ?: '00:00');
        $end = (string)(getenv('APP_ACTIVE_HOURS_END') ?: '23:59');
        if (!preg_match('/^\d{2}:\d{2}$/', $start) || !preg_match('/^\d{2}:\d{2}$/', $end)) return;

        $now = date('H:i');
        $inWindow = $start <= $end
            ? ($now >= $start && $now <= $end)              // normal range, e.g. 07:00-19:00
            : ($now >= $start || $now <= $end);             // wrap-around, e.g. 22:00-06:00

        if ($inWindow) return;

        try {
            appLogEvent(
                $pdo,
                'anomaly_unusual_hours',
                'security',
                'flagged',
                $userId,
                'endpoint',
                $endpointLabel,
                ['observed_time' => $now, 'window_start' => $start, 'window_end' => $end]
            );
        } catch (Throwable $e) {
            // best-effort
        }
    }
}

// ---------------------------------------------------------------------------
// Convenience composite: every authenticated endpoint can call this once
// after the actor's id + role are known.
// ---------------------------------------------------------------------------

if (!function_exists('runAuthenticatedSecurityGuards')) {
    function runAuthenticatedSecurityGuards(PDO $pdo, int $userId, string $endpointLabel): void
    {
        sessionGuard($pdo, $userId, $endpointLabel);
        rapidActionGuard($pdo, $userId, $endpointLabel);
        flagUnusualHoursIfAny($pdo, $userId, $endpointLabel);
    }
}
