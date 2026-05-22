<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}
require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table LIMIT 1');
    $stmt->execute([':table' => $table]);
    return (bool)$stmt->fetchColumn();
}

$actorId = (int)($_SERVER['HTTP_X_USER_ID'] ?? 0);
if ($actorId <= 0) {
    appLogEvent($pdo, 'admin_reports', 'admin', 'failed', null, 'endpoint', 'admin/reports', ['reason' => 'missing_user_context']);
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Missing user context']);
    exit;
}

if (getUserRole($pdo, $actorId) !== 'admin') {
    appLogEvent($pdo, 'admin_reports', 'admin', 'failed', $actorId > 0 ? $actorId : null, 'endpoint', 'admin/reports', ['reason' => 'access_denied']);
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

try {
    $tableRows = $pdo->query("
        SELECT
            table_name,
            COALESCE(data_length, 0) + COALESCE(index_length, 0) AS table_bytes
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        ORDER BY table_bytes DESC, table_name ASC
    ")->fetchAll() ?: [];

    $totalBytes = 0;
    foreach ($tableRows as $r) {
        $totalBytes += (int)($r['table_bytes'] ?? 0);
    }

    $formatBytes = static function (int $bytes): string {
        if ($bytes >= 1073741824) return round($bytes / 1073741824, 2) . ' GB';
        if ($bytes >= 1048576) return round($bytes / 1048576, 2) . ' MB';
        if ($bytes >= 1024) return round($bytes / 1024, 2) . ' KB';
        return $bytes . ' B';
    };

    $dbReports = [];
    foreach ($tableRows as $r) {
        $name = (string)($r['table_name'] ?? '');
        $bytes = (int)($r['table_bytes'] ?? 0);
        $dbReports[] = [
            'database' => $name,
            'size' => $formatBytes($bytes),
            'growth' => 'N/A',
            'lastBackup' => 'N/A',
            'status' => 'Healthy',
        ];
    }

    $byRole = ['student' => 0, 'registrar' => 0, 'admin' => 0];
    if (roleTablesExist($pdo)) {
        ensureRoleTables($pdo);
        $byRole['admin'] = (int)$pdo->query('SELECT COUNT(*) FROM admin_users')->fetchColumn();
        $byRole['registrar'] = (int)$pdo->query('SELECT COUNT(*) FROM registrar_users')->fetchColumn();
        $byRole['student'] = (int)$pdo->query('SELECT COUNT(*) FROM student_users')->fetchColumn();
    } elseif (userRoleColumnExists($pdo)) {
        $roleRows = $pdo->query("
            SELECT LOWER(role) AS role_name, COUNT(*) AS total_users
            FROM users
            GROUP BY LOWER(role)
        ")->fetchAll() ?: [];
        foreach ($roleRows as $r) {
            $roleName = (string)($r['role_name'] ?? '');
            $count = (int)($r['total_users'] ?? 0);
            if ($roleName === 'applicant') {
                $roleName = 'student';
            }
            if (isset($byRole[$roleName])) {
                $byRole[$roleName] += $count;
            }
        }
    }

    $enrollmentCounts = ['rejected_count' => 0, 'review_count' => 0];
    if (tableExists($pdo, 'enrollments')) {
        $enrollmentCounts = $pdo->query("
            SELECT
                SUM(CASE WHEN LOWER(status) = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
                SUM(CASE WHEN LOWER(status) IN ('under_review','under review','review') THEN 1 ELSE 0 END) AS review_count
            FROM enrollments
        ")->fetch() ?: ['rejected_count' => 0, 'review_count' => 0];
    }

    $failedLogins24h = 0;
    if (tableExists($pdo, 'login_attempts')) {
        $failedLogins24h = (int)$pdo->query("
            SELECT COUNT(*) FROM login_attempts
            WHERE success = 0 AND attempted_at >= (NOW() - INTERVAL 1 DAY)
        ")->fetchColumn();
    }

    $createUserEvents24h = 0;
    if (tableExists($pdo, 'activity_logs')) {
        $createUserEvents24h = (int)$pdo->query("
            SELECT COUNT(*) FROM activity_logs
            WHERE action = 'create_user' AND created_at >= (NOW() - INTERVAL 1 DAY)
        ")->fetchColumn();
    }

    $securityReports = [
        [
            'date' => date('Y-m-d'),
            'type' => 'Failed Login Attempts',
            'count' => $failedLogins24h,
            'severity' => $failedLogins24h >= 10 ? 'High' : ($failedLogins24h > 0 ? 'Medium' : 'Low'),
            'details' => 'Count from login_attempts in last 24 hours',
        ],
        [
            'date' => date('Y-m-d'),
            'type' => 'Rejected Enrollments',
            'count' => (int)($enrollmentCounts['rejected_count'] ?? 0),
            'severity' => ((int)($enrollmentCounts['rejected_count'] ?? 0)) > 0 ? 'Medium' : 'Low',
            'details' => 'Count of rejected enrollment applications',
        ],
        [
            'date' => date('Y-m-d'),
            'type' => 'Under Review Enrollments',
            'count' => (int)($enrollmentCounts['review_count'] ?? 0),
            'severity' => 'Low',
            'details' => 'Count of applications pending registrar review',
        ],
        [
            'date' => date('Y-m-d'),
            'type' => 'Admin User Creation Events',
            'count' => $createUserEvents24h,
            'severity' => 'Low',
            'details' => 'create_user actions in activity_logs over last 24 hours',
        ],
    ];

    $loginByRole = ['student' => 0, 'registrar' => 0, 'admin' => 0];
    $failedByRole = ['student' => 0, 'registrar' => 0, 'admin' => 0];
    if (tableExists($pdo, 'activity_logs')) {
        $roleExpr = roleTablesExist($pdo)
            ? "LOWER(CASE WHEN au_r.user_id IS NOT NULL THEN 'admin' WHEN ru_r.user_id IS NOT NULL THEN 'registrar' ELSE 'student' END)"
            : (userRoleColumnExists($pdo) ? 'LOWER(u.role)' : "'student'");
        $joinSplit = roleTablesExist($pdo)
            ? 'LEFT JOIN admin_users au_r ON au_r.user_id = u.id LEFT JOIN registrar_users ru_r ON ru_r.user_id = u.id LEFT JOIN student_users su_r ON su_r.user_id = u.id'
            : '';
        $roleLoginRows = $pdo->query("
            SELECT {$roleExpr} AS role_name, COUNT(*) AS total_count
            FROM activity_logs al
            INNER JOIN users u ON u.id = al.actor_user_id
            {$joinSplit}
            WHERE al.action = 'login'
            GROUP BY {$roleExpr}
        ")->fetchAll() ?: [];
        foreach ($roleLoginRows as $row) {
            $rn = (string)($row['role_name'] ?? '');
            if ($rn === 'applicant') $rn = 'student';
            if (isset($loginByRole[$rn])) $loginByRole[$rn] = (int)($row['total_count'] ?? 0);
        }

        $roleFailedRows = $pdo->query("
            SELECT {$roleExpr} AS role_name, COUNT(*) AS total_count
            FROM activity_logs al
            INNER JOIN users u ON u.id = al.actor_user_id
            {$joinSplit}
            WHERE al.action = 'login_attempt' AND al.status = 'failed'
            GROUP BY {$roleExpr}
        ")->fetchAll() ?: [];
        foreach ($roleFailedRows as $row) {
            $rn = (string)($row['role_name'] ?? '');
            if ($rn === 'applicant') $rn = 'student';
            if (isset($failedByRole[$rn])) $failedByRole[$rn] = (int)($row['total_count'] ?? 0);
        }
    }

    $userActivity = [
        ['role' => 'Student', 'logins' => $loginByRole['student'], 'avgDuration' => 'N/A', 'activeUsers' => $byRole['student'], 'failedLogins' => $failedByRole['student']],
        ['role' => 'Registrar', 'logins' => $loginByRole['registrar'], 'avgDuration' => 'N/A', 'activeUsers' => $byRole['registrar'], 'failedLogins' => $failedByRole['registrar']],
        ['role' => 'Admin', 'logins' => $loginByRole['admin'], 'avgDuration' => 'N/A', 'activeUsers' => $byRole['admin'], 'failedLogins' => $failedByRole['admin']],
    ];

    $auditTrail = [];
    if (tableExists($pdo, 'activity_logs')) {
        $auditRows = $pdo->query("
            SELECT
              al.created_at,
              al.action,
              al.module,
              al.status,
              COALESCE(u.full_name, 'System') AS actor_name
            FROM activity_logs al
            LEFT JOIN users u ON u.id = al.actor_user_id
            ORDER BY al.created_at DESC, al.id DESC
            LIMIT 20
        ")->fetchAll() ?: [];
        foreach ($auditRows as $r) {
            $auditTrail[] = [
                'timestamp' => (string)($r['created_at'] ?? ''),
                'user' => (string)($r['actor_name'] ?? 'System'),
                'action' => (string)($r['action'] ?? ''),
                'module' => (string)($r['module'] ?? ''),
                'status' => ucfirst(strtolower((string)($r['status'] ?? 'Success'))),
            ];
        }
    } else {
        $auditTrail[] = [
            'timestamp' => date('Y-m-d H:i:s'),
            'user' => 'System',
            'action' => 'activity_logs table not initialized',
            'module' => 'Database',
            'status' => 'Failed',
        ];
    }

    $performance = [
        ['metric' => 'System Uptime', 'value' => 'Operational', 'status' => 'Good', 'trend' => 'stable'],
        ['metric' => 'Database Size', 'value' => $formatBytes($totalBytes), 'status' => 'Good', 'trend' => 'up'],
        ['metric' => 'Total Users', 'value' => (string)array_sum($byRole), 'status' => 'Good', 'trend' => 'up'],
        ['metric' => 'Error Rate', 'value' => 'N/A', 'status' => 'Normal', 'trend' => 'stable'],
    ];

    echo json_encode([
        'success' => true,
        'performance' => $performance,
        'securityReports' => $securityReports,
        'databaseReports' => $dbReports,
        'userActivityReports' => $userActivity,
        'auditTrail' => $auditTrail,
    ]);
    appLogEvent($pdo, 'admin_reports', 'admin', 'success', $actorId, 'endpoint', 'admin/reports');
} catch (Throwable $e) {
    appLogEvent($pdo, 'admin_reports', 'admin', 'failed', $actorId, 'endpoint', 'admin/reports', ['reason' => 'server_error']);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to load admin reports']);
}
