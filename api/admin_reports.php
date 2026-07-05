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

/** @return array{key: string, label: string, days: int} */
function adminReportRangeSpec(string $raw): array
{
    $raw = strtolower(trim($raw));
    return match ($raw) {
        'today' => ['key' => 'today', 'label' => 'Today', 'days' => 1],
        '30days' => ['key' => '30days', 'label' => 'Last 30 Days', 'days' => 30],
        '90days' => ['key' => '90days', 'label' => 'Last 90 Days', 'days' => 90],
        default => ['key' => '7days', 'label' => 'Last 7 Days', 'days' => 7],
    };
}

function adminFormatBytes(int $bytes): string
{
    if ($bytes >= 1073741824) {
        return round($bytes / 1073741824, 2) . ' GB';
    }
    if ($bytes >= 1048576) {
        return round($bytes / 1048576, 2) . ' MB';
    }
    if ($bytes >= 1024) {
        return round($bytes / 1024, 2) . ' KB';
    }

    return $bytes . ' B';
}

/** Read information_schema row keys regardless of PDO/MySQL column casing. */
function adminReportAssocValue(array $row, string $key, mixed $default = null): mixed
{
    if (array_key_exists($key, $row)) {
        return $row[$key];
    }
    $target = strtolower($key);
    foreach ($row as $column => $value) {
        if (strtolower((string)$column) === $target) {
            return $value;
        }
    }

    return $default;
}

function adminReportTableRowCount(PDO $pdo, string $tableName): int
{
    if ($tableName === '' || !preg_match('/^[A-Za-z0-9_]+$/', $tableName)) {
        return 0;
    }
    try {
        $quoted = '`' . str_replace('`', '``', $tableName) . '`';
        return (int)$pdo->query("SELECT COUNT(*) FROM {$quoted}")->fetchColumn();
    } catch (Throwable $e) {
        return 0;
    }
}

function adminReportTableLabel(string $tableName, array $friendlyNames): string
{
    if ($tableName === '') {
        return 'Unknown table';
    }
    $friendly = $friendlyNames[$tableName] ?? null;
    if ($friendly !== null && $friendly !== $tableName) {
        return "{$friendly} ({$tableName})";
    }

    return $tableName;
}

function adminParseIniBytes(string $value): int
{
    $value = trim($value);
    if ($value === '' || $value === '-1') {
        return 0;
    }
    $unit = strtolower(substr($value, -1));
    $num = (float)$value;
    if ($unit === 'g') {
        return (int)round($num * 1073741824);
    }
    if ($unit === 'm') {
        return (int)round($num * 1048576);
    }
    if ($unit === 'k') {
        return (int)round($num * 1024);
    }

    return (int)$num;
}

function adminDirectorySize(string $path): int
{
    if (!is_dir($path)) {
        return 0;
    }
    $size = 0;
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $size += (int)$file->getSize();
        }
    }

    return $size;
}

/** @return array{lastBackup: string, backupPath: string, backupCount: int, latestFile: string|null} */
function adminLatestBackupInfo(): array
{
    $dir = realpath(__DIR__ . '/../backups/mysql');
    if ($dir === false || !is_dir($dir)) {
        return [
            'lastBackup' => 'No backups found',
            'backupPath' => 'backups/mysql',
            'backupCount' => 0,
            'latestFile' => null,
        ];
    }

    $files = glob($dir . DIRECTORY_SEPARATOR . '*.sql') ?: [];
    if ($files === []) {
        return [
            'lastBackup' => 'No backups found',
            'backupPath' => 'backups/mysql',
            'backupCount' => 0,
            'latestFile' => null,
        ];
    }

    usort($files, static fn (string $a, string $b): int => filemtime($b) <=> filemtime($a));
    $latest = $files[0];
    $mtime = filemtime($latest);

    return [
        'lastBackup' => $mtime !== false ? date('Y-m-d h:i A', $mtime) : 'Unknown',
        'backupPath' => 'backups/mysql',
        'backupCount' => count($files),
        'latestFile' => basename($latest),
    ];
}

/** @param list<array<string, scalar|null>> $rows */
function adminEmitCsv(string $filename, array $columns, array $rows): void
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $out = fopen('php://output', 'w');
    if ($out === false) {
        throw new RuntimeException('Unable to open output stream');
    }
    fputcsv($out, $columns);
    foreach ($rows as $row) {
        $line = [];
        foreach ($columns as $col) {
            $line[] = (string)($row[$col] ?? '');
        }
        fputcsv($out, $line);
    }
    fclose($out);
    exit;
}

require_once __DIR__ . '/api_auth.php';
$actor = apiRequireActor($pdo, 'admin/reports');
$actorId = $actor['id'];
if ($actor['role'] !== 'admin') {
    appLogEvent($pdo, 'admin_reports', 'admin', 'failed', $actorId > 0 ? $actorId : null, 'endpoint', 'admin/reports', ['reason' => 'access_denied']);
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

require_once __DIR__ . '/permission_guard.php';
requireActorPermission($pdo, $actor, 'viewReports', false);

try {
    $range = adminReportRangeSpec((string)($_GET['range'] ?? '7days'));
    $rangeDays = max(1, (int)$range['days']);
    $rangeIntervalSql = (string)$rangeDays;

    $tableRows = $pdo->query("
        SELECT
            table_name,
            COALESCE(data_length, 0) + COALESCE(index_length, 0) AS table_bytes,
            table_rows
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        ORDER BY table_bytes DESC, table_name ASC
    ")->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $totalBytes = 0;
    foreach ($tableRows as $r) {
        $totalBytes += (int)($r['table_bytes'] ?? 0);
    }

    $friendlyTableNames = [
        'users' => 'User accounts',
        'enrollments' => 'Enrollments',
        'documents' => 'Documents',
        'activity_logs' => 'Activity logs',
        'login_attempts' => 'Login attempts',
        'student_cohorts' => 'Student cohorts',
        'sections' => 'Sections',
        'students' => 'Student records',
        'app_settings' => 'App settings',
        'school_years' => 'School years',
    ];

    $dbReports = [
        [
            'database' => 'intellidocs_db (total)',
            'size' => adminFormatBytes($totalBytes),
            'growth' => count($tableRows) . ' tables',
            'lastBackup' => adminLatestBackupInfo()['lastBackup'],
            'status' => 'Healthy',
        ],
    ];
    $topLimit = 8;
    $shown = 0;
    foreach ($tableRows as $r) {
        if ($shown >= $topLimit) {
            break;
        }
        $name = (string)adminReportAssocValue($r, 'table_name', '');
        $bytes = (int)adminReportAssocValue($r, 'table_bytes', 0);
        $estimateRows = (int)adminReportAssocValue($r, 'table_rows', 0);
        $rows = adminReportTableRowCount($pdo, $name);
        if ($rows === 0 && $estimateRows > 0) {
            $rows = $estimateRows;
        }
        $dbReports[] = [
            'database' => adminReportTableLabel($name, $friendlyTableNames),
            'size' => adminFormatBytes($bytes),
            'growth' => number_format($rows) . ' rows',
            'lastBackup' => '—',
            'status' => $bytes >= 524288000 ? 'Warning' : 'Healthy',
        ];
        $shown++;
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
        ")->fetchAll(PDO::FETCH_ASSOC) ?: [];
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

    $failedLoginsRange = 0;
    $failedLoginDays = [];
    if (tableExists($pdo, 'login_attempts')) {
        $failedStmt = $pdo->prepare("
            SELECT COUNT(*) FROM login_attempts
            WHERE success = 0 AND attempted_at >= (NOW() - INTERVAL {$rangeIntervalSql} DAY)
        ");
        $failedStmt->execute();
        $failedLoginsRange = (int)$failedStmt->fetchColumn();

        $dayStmt = $pdo->prepare("
            SELECT DATE(attempted_at) AS event_date, COUNT(*) AS total_count
            FROM login_attempts
            WHERE success = 0 AND attempted_at >= (NOW() - INTERVAL {$rangeIntervalSql} DAY)
            GROUP BY DATE(attempted_at)
            ORDER BY event_date DESC
            LIMIT 15
        ");
        $dayStmt->execute();
        foreach ($dayStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $failedLoginDays[] = [
                'date' => (string)($row['event_date'] ?? ''),
                'type' => 'Failed Login Attempts',
                'count' => (int)($row['total_count'] ?? 0),
                'severity' => ((int)($row['total_count'] ?? 0)) >= 10 ? 'High' : 'Medium',
                'details' => 'From login_attempts table',
            ];
        }
    }

    $enrollmentCounts = ['rejected_count' => 0, 'review_count' => 0, 'pending_count' => 0];
    if (tableExists($pdo, 'enrollments')) {
        $enrollmentCounts = $pdo->query("
            SELECT
                SUM(CASE WHEN LOWER(status) = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
                SUM(CASE WHEN LOWER(status) IN ('under_review','under review','review') THEN 1 ELSE 0 END) AS review_count,
                SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) AS pending_count
            FROM enrollments
        ")->fetch(PDO::FETCH_ASSOC) ?: $enrollmentCounts;
    }

    $createUserEventsRange = 0;
    $passwordChangesRange = 0;
    if (tableExists($pdo, 'activity_logs')) {
        $actStmt = $pdo->prepare("
            SELECT
                SUM(CASE WHEN action = 'create_user' THEN 1 ELSE 0 END) AS create_users,
                SUM(CASE WHEN action IN ('change_password', 'password_change') THEN 1 ELSE 0 END) AS password_changes
            FROM activity_logs
            WHERE created_at >= (NOW() - INTERVAL {$rangeIntervalSql} DAY)
        ");
        $actStmt->execute();
        $actRow = $actStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $createUserEventsRange = (int)($actRow['create_users'] ?? 0);
        $passwordChangesRange = (int)($actRow['password_changes'] ?? 0);
    }

    $securityReports = $failedLoginDays;
    if ($securityReports === [] && $failedLoginsRange > 0) {
        $securityReports[] = [
            'date' => date('Y-m-d'),
            'type' => 'Failed Login Attempts',
            'count' => $failedLoginsRange,
            'severity' => $failedLoginsRange >= 10 ? 'High' : 'Medium',
            'details' => "Total in {$range['label']}",
        ];
    }
    $securityReports[] = [
        'date' => date('Y-m-d'),
        'type' => 'Rejected Enrollments',
        'count' => (int)($enrollmentCounts['rejected_count'] ?? 0),
        'severity' => ((int)($enrollmentCounts['rejected_count'] ?? 0)) > 0 ? 'Medium' : 'Low',
        'details' => 'Current rejected enrollment applications',
    ];
    $securityReports[] = [
        'date' => date('Y-m-d'),
        'type' => 'Pending Applications',
        'count' => (int)($enrollmentCounts['pending_count'] ?? 0),
        'severity' => 'Low',
        'details' => 'Applications awaiting registrar action',
    ];
    if ($passwordChangesRange > 0) {
        $securityReports[] = [
            'date' => date('Y-m-d'),
            'type' => 'Password Changes',
            'count' => $passwordChangesRange,
            'severity' => 'Low',
            'details' => "Recorded in activity_logs ({$range['label']})",
        ];
    }
    if ($createUserEventsRange > 0) {
        $securityReports[] = [
            'date' => date('Y-m-d'),
            'type' => 'Admin User Creation Events',
            'count' => $createUserEventsRange,
            'severity' => 'Low',
            'details' => "create_user actions ({$range['label']})",
        ];
    }

    $loginByRole = ['student' => 0, 'registrar' => 0, 'admin' => 0];
    $failedByRole = ['student' => 0, 'registrar' => 0, 'admin' => 0];
    $activeByRole = ['student' => 0, 'registrar' => 0, 'admin' => 0];

    $roleJoinSplit = roleTablesExist($pdo)
        ? 'LEFT JOIN admin_users au_r ON au_r.user_id = u.id LEFT JOIN registrar_users ru_r ON ru_r.user_id = u.id LEFT JOIN student_users su_r ON su_r.user_id = u.id'
        : '';
    if (roleTablesExist($pdo)) {
        $roleExpr = "LOWER(CASE WHEN u.id IS NULL THEN 'student' WHEN au_r.user_id IS NOT NULL THEN 'admin' WHEN ru_r.user_id IS NOT NULL THEN 'registrar' ELSE 'student' END)";
    } elseif (userRoleColumnExists($pdo)) {
        $roleExpr = "LOWER(CASE WHEN u.id IS NULL THEN 'student' WHEN TRIM(COALESCE(u.role, '')) = '' THEN 'student' ELSE u.role END)";
    } else {
        $roleExpr = "'student'";
    }

    $successLoginActionsSql = "'login', 'login_success', 'login_otp_verify'";

    if (tableExists($pdo, 'activity_logs')) {
        $roleLoginStmt = $pdo->prepare("
            SELECT {$roleExpr} AS role_name, COUNT(*) AS total_count
            FROM activity_logs al
            INNER JOIN users u ON u.id = al.actor_user_id
            {$roleJoinSplit}
            WHERE al.action IN ({$successLoginActionsSql})
              AND LOWER(al.status) = 'success'
              AND al.created_at >= (NOW() - INTERVAL {$rangeIntervalSql} DAY)
            GROUP BY {$roleExpr}
        ");
        $roleLoginStmt->execute();
        foreach ($roleLoginStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $rn = (string)($row['role_name'] ?? '');
            if ($rn === 'applicant') {
                $rn = 'student';
            }
            if (isset($loginByRole[$rn])) {
                $loginByRole[$rn] = (int)($row['total_count'] ?? 0);
            }
        }

        $activeStmt = $pdo->prepare("
            SELECT {$roleExpr} AS role_name, COUNT(DISTINCT al.actor_user_id) AS total_count
            FROM activity_logs al
            INNER JOIN users u ON u.id = al.actor_user_id
            {$roleJoinSplit}
            WHERE al.actor_user_id IS NOT NULL
              AND al.created_at >= (NOW() - INTERVAL 15 MINUTE)
            GROUP BY {$roleExpr}
        ");
        $activeStmt->execute();
        foreach ($activeStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $rn = (string)($row['role_name'] ?? '');
            if ($rn === 'applicant') {
                $rn = 'student';
            }
            if (isset($activeByRole[$rn])) {
                $activeByRole[$rn] = (int)($row['total_count'] ?? 0);
            }
        }
    }

    if (tableExists($pdo, 'login_attempts')) {
        $roleFailedStmt = $pdo->prepare("
            SELECT {$roleExpr} AS role_name, COUNT(*) AS total_count
            FROM login_attempts la
            LEFT JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(la.email))
            {$roleJoinSplit}
            WHERE la.success = 0
              AND la.attempted_at >= (NOW() - INTERVAL {$rangeIntervalSql} DAY)
            GROUP BY {$roleExpr}
        ");
        $roleFailedStmt->execute();
        foreach ($roleFailedStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $rn = (string)($row['role_name'] ?? '');
            if ($rn === 'applicant') {
                $rn = 'student';
            }
            if (isset($failedByRole[$rn])) {
                $failedByRole[$rn] = (int)($row['total_count'] ?? 0);
            }
        }
    } elseif (tableExists($pdo, 'activity_logs')) {
        $roleFailedStmt = $pdo->prepare("
            SELECT {$roleExpr} AS role_name, COUNT(*) AS total_count
            FROM activity_logs al
            INNER JOIN users u ON u.id = al.actor_user_id
            {$roleJoinSplit}
            WHERE al.module = 'auth'
              AND LOWER(al.status) = 'failed'
              AND (
                al.action IN ('login_attempt', 'login_otp_verify', 'login_otp_send', 'login')
                OR al.action LIKE 'login_%'
              )
              AND al.created_at >= (NOW() - INTERVAL {$rangeIntervalSql} DAY)
            GROUP BY {$roleExpr}
        ");
        $roleFailedStmt->execute();
        foreach ($roleFailedStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $rn = (string)($row['role_name'] ?? '');
            if ($rn === 'applicant') {
                $rn = 'student';
            }
            if (isset($failedByRole[$rn])) {
                $failedByRole[$rn] = (int)($row['total_count'] ?? 0);
            }
        }
    }

    $userActivity = [
        ['role' => 'Student', 'logins' => $loginByRole['student'], 'avgDuration' => 'N/A', 'activeUsers' => $activeByRole['student'], 'failedLogins' => $failedByRole['student']],
        ['role' => 'Registrar', 'logins' => $loginByRole['registrar'], 'avgDuration' => 'N/A', 'activeUsers' => $activeByRole['registrar'], 'failedLogins' => $failedByRole['registrar']],
        ['role' => 'Admin', 'logins' => $loginByRole['admin'], 'avgDuration' => 'N/A', 'activeUsers' => $activeByRole['admin'], 'failedLogins' => $failedByRole['admin']],
    ];

    $auditTrail = [];
    if (tableExists($pdo, 'activity_logs')) {
        $auditStmt = $pdo->prepare("
            SELECT
              al.created_at,
              al.action,
              al.module,
              al.status,
              COALESCE(u.full_name, 'System') AS actor_name
            FROM activity_logs al
            LEFT JOIN users u ON u.id = al.actor_user_id
            WHERE al.created_at >= (NOW() - INTERVAL {$rangeIntervalSql} DAY)
            ORDER BY al.created_at DESC, al.id DESC
            LIMIT 50
        ");
        $auditStmt->execute();
        foreach ($auditStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $r) {
            $auditTrail[] = [
                'timestamp' => (string)($r['created_at'] ?? ''),
                'user' => (string)($r['actor_name'] ?? 'System'),
                'action' => (string)($r['action'] ?? ''),
                'module' => (string)($r['module'] ?? ''),
                'status' => ucfirst(strtolower((string)($r['status'] ?? 'success'))),
            ];
        }
    }

    $totalDocuments = 0;
    $verifiedDocuments = 0;
    if (tableExists($pdo, 'documents')) {
        $doc = $pdo->query("
            SELECT
              COUNT(*) AS total_docs,
              SUM(CASE WHEN LOWER(ai_status) = 'verified' THEN 1 ELSE 0 END) AS verified_docs
            FROM documents
        ")->fetch(PDO::FETCH_ASSOC) ?: [];
        $totalDocuments = (int)($doc['total_docs'] ?? 0);
        $verifiedDocuments = (int)($doc['verified_docs'] ?? 0);
    }

    $activitySuccessRate = 'N/A';
    if (tableExists($pdo, 'activity_logs')) {
        $rateStmt = $pdo->prepare("
            SELECT
                SUM(CASE WHEN LOWER(status) = 'success' THEN 1 ELSE 0 END) AS ok_count,
                COUNT(*) AS total_count
            FROM activity_logs
            WHERE created_at >= (NOW() - INTERVAL {$rangeIntervalSql} DAY)
        ");
        $rateStmt->execute();
        $rateRow = $rateStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $ok = (int)($rateRow['ok_count'] ?? 0);
        $total = (int)($rateRow['total_count'] ?? 0);
        if ($total > 0) {
            $activitySuccessRate = round(($ok / $total) * 100, 1) . '%';
        }
    }

    $docVerifyRate = $totalDocuments > 0
        ? round(($verifiedDocuments / $totalDocuments) * 100, 1) . '%'
        : 'N/A';

    $performance = [
        ['metric' => 'System Status', 'value' => 'Operational', 'status' => 'Good', 'trend' => 'stable'],
        ['metric' => 'Database Size', 'value' => adminFormatBytes($totalBytes), 'status' => 'Good', 'trend' => 'up'],
        ['metric' => 'Total Users', 'value' => (string)array_sum($byRole), 'status' => 'Good', 'trend' => 'stable'],
        ['metric' => 'Document Verification Rate', 'value' => $docVerifyRate, 'status' => 'Good', 'trend' => 'up'],
        ['metric' => 'Activity Success Rate', 'value' => $activitySuccessRate, 'status' => 'Good', 'trend' => 'stable'],
        ['metric' => 'Failed Logins', 'value' => (string)$failedLoginsRange, 'status' => $failedLoginsRange >= 10 ? 'Warning' : 'Good', 'trend' => $failedLoginsRange > 0 ? 'up' : 'down'],
    ];

    $memLimitBytes = adminParseIniBytes((string)ini_get('memory_limit'));
    $memUsedBytes = memory_get_usage(true);
    $memPct = $memLimitBytes > 0 ? min(100, (int)round(($memUsedBytes / $memLimitBytes) * 100)) : 0;
    $uploadsBytes = adminDirectorySize(realpath(__DIR__ . '/../uploads') ?: '');
    $backupInfo = adminLatestBackupInfo();

    $highSeverityCount = 0;
    foreach ($securityReports as $sr) {
        $sev = strtolower((string)($sr['severity'] ?? ''));
        if (in_array($sev, ['high', 'critical'], true)) {
            $highSeverityCount++;
        }
    }

    $activeUsersNow = array_sum($activeByRole);
    $totalSuccessfulLogins = array_sum($loginByRole);
    $totalFailedLoginsByRole = array_sum($failedByRole);
    $failedLoginRateLabel = ($totalSuccessfulLogins + $failedLoginsRange) > 0
        ? round(($failedLoginsRange / ($totalSuccessfulLogins + $failedLoginsRange)) * 100, 1) . '%'
        : '0.0%';

    $payload = [
        'success' => true,
        'meta' => [
            'dateRange' => $range['key'],
            'dateRangeLabel' => $range['label'],
            'generatedAt' => date('Y-m-d H:i:s'),
        ],
        'summary' => [
            'systemUptime' => 'Operational',
            'databaseSizeLabel' => adminFormatBytes($totalBytes),
            'securityEvents' => $failedLoginsRange,
            'activeUsers' => $activeUsersNow,
            'highSeveritySecurityEvents' => $highSeverityCount,
        ],
        'securityAlert' => [
            'show' => $highSeverityCount > 0 || $failedLoginsRange >= 10,
            'message' => $highSeverityCount > 0
                ? "{$highSeverityCount} high-severity security event(s) in {$range['label']}. Review the Security tab."
                : ($failedLoginsRange >= 10
                    ? "{$failedLoginsRange} failed login attempts in {$range['label']}. Review access logs."
                    : ''),
        ],
        'backupInfo' => [
            'lastBackup' => $backupInfo['lastBackup'],
            'backupCount' => $backupInfo['backupCount'],
            'backupPath' => $backupInfo['backupPath'],
            'latestFile' => $backupInfo['latestFile'],
            'status' => $backupInfo['backupCount'] > 0 ? 'Healthy' : 'Warning',
        ],
        'resourceUsage' => [
            'memoryPercent' => $memPct,
            'memoryLabel' => adminFormatBytes($memUsedBytes) . ' / ' . ($memLimitBytes > 0 ? adminFormatBytes($memLimitBytes) : 'unlimited'),
            'uploadsSize' => adminFormatBytes($uploadsBytes),
            'diskPercent' => null,
        ],
        'performance' => $performance,
        'securityReports' => $securityReports,
        'databaseReports' => $dbReports,
        'userActivityReports' => $userActivity,
        'userActivitySummary' => [
            'totalLogins' => $totalSuccessfulLogins,
            'totalFailedLogins' => $failedLoginsRange,
            'failedLoginsByRoleTotal' => $totalFailedLoginsByRole,
            'failedLoginRate' => $failedLoginRateLabel,
            'activeUsersNow' => $activeUsersNow,
        ],
        'auditTrail' => $auditTrail,
    ];

    $format = strtolower(trim((string)($_GET['format'] ?? 'json')));
    $section = strtolower(trim((string)($_GET['section'] ?? 'audit')));
    if ($format === 'csv') {
        if ($section === 'security') {
            adminEmitCsv(
                'admin-security-report.csv',
                ['date', 'type', 'count', 'details', 'severity'],
                $securityReports
            );
        }
        if ($section === 'audit') {
            adminEmitCsv(
                'admin-audit-trail.csv',
                ['timestamp', 'user', 'action', 'module', 'status'],
                $auditTrail
            );
        }
        adminEmitCsv(
            'admin-reports-summary.csv',
            ['metric', 'value', 'status'],
            array_map(
                static fn (array $row): array => [
                    'metric' => (string)($row['metric'] ?? ''),
                    'value' => (string)($row['value'] ?? ''),
                    'status' => (string)($row['status'] ?? ''),
                ],
                $performance
            )
        );
    }

    echo json_encode($payload);
    appLogEvent($pdo, 'admin_reports', 'admin', 'success', $actorId, 'endpoint', 'admin/reports');
} catch (Throwable $e) {
    appLogEvent($pdo, 'admin_reports', 'admin', 'failed', $actorId, 'endpoint', 'admin/reports', ['reason' => 'server_error']);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to load admin reports']);
}
