<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}
require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/school_year_helpers.php';

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

function getRecentActiveUserCount(PDO $pdo, int $minutes = 15): int
{
    if (!tableExists($pdo, 'activity_logs')) return 0;
    $minutes = max(1, min(1440, $minutes));
    $stmt = $pdo->prepare("
        SELECT COUNT(DISTINCT actor_user_id) AS c
        FROM activity_logs
        WHERE actor_user_id IS NOT NULL
          AND created_at >= (NOW() - INTERVAL {$minutes} MINUTE)
    ");
    $stmt->execute();
    return (int)$stmt->fetchColumn();
}

function getFailedLogins(PDO $pdo, int $minutes = 60): int
{
    if (!tableExists($pdo, 'login_attempts')) return 0;
    $minutes = max(1, min(10080, $minutes));
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM login_attempts
        WHERE success = 0
          AND attempted_at >= (NOW() - INTERVAL {$minutes} MINUTE)
    ");
    $stmt->execute();
    return (int)$stmt->fetchColumn();
}

$ongoingSchoolYearLabel = null;
$ongoingSchoolYearRange = ['startDate' => null, 'endDate' => null];
$enrollmentSchoolYearLabel = null;
try {
    $ongoingSchoolYearLabel = getOngoingSchoolYear($pdo); // null means not set
    $enrollmentSchoolYearLabel = getEnrollmentSchoolYear($pdo); // null means enrollment disabled
    if ($ongoingSchoolYearLabel !== null && tableExists($pdo, 'school_years')) {
        $stmtSy = $pdo->prepare('SELECT start_date, end_date FROM school_years WHERE year = :y LIMIT 1');
        $stmtSy->execute([':y' => $ongoingSchoolYearLabel]);
        $syRow = $stmtSy->fetch(PDO::FETCH_ASSOC) ?: [];
        $ongoingSchoolYearRange = [
            'startDate' => ($syRow['start_date'] ?? null) !== null ? (string)$syRow['start_date'] : null,
            'endDate' => ($syRow['end_date'] ?? null) !== null ? (string)$syRow['end_date'] : null,
        ];
    }
} catch (Throwable $e) {
    $ongoingSchoolYearLabel = null;
    $ongoingSchoolYearRange = ['startDate' => null, 'endDate' => null];
    $enrollmentSchoolYearLabel = null;
}

require_once __DIR__ . '/api_auth.php';
$actor = apiRequireActor($pdo, 'admin/overview');
$actorId = $actor['id'];
if ($actor['role'] !== 'admin') {
    appLogEvent($pdo, 'admin_overview', 'admin', 'failed', $actorId > 0 ? $actorId : null, 'endpoint', 'admin/overview', ['reason' => 'access_denied']);
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

try {
    $totalUsers = 0;
    $adminCount = 0;
    $registrarCount = 0;
    $studentCount = 0;

    if (tableExists($pdo, 'users')) {
        if (roleTablesExist($pdo)) {
            ensureRoleTables($pdo);
            $totalUsers = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
            $adminCount = (int)$pdo->query('SELECT COUNT(*) FROM admin_users')->fetchColumn();
            $registrarCount = (int)$pdo->query('SELECT COUNT(*) FROM registrar_users')->fetchColumn();
            $studentCount = (int)$pdo->query('SELECT COUNT(*) FROM student_users')->fetchColumn();
        } elseif (userRoleColumnExists($pdo)) {
            $userSummary = $pdo->query("
                SELECT
                  COUNT(*) AS total_users,
                  SUM(CASE WHEN LOWER(role) = 'admin' THEN 1 ELSE 0 END) AS admin_count,
                  SUM(CASE WHEN LOWER(role) = 'registrar' THEN 1 ELSE 0 END) AS registrar_count,
                  SUM(CASE WHEN LOWER(role) = 'student' THEN 1 ELSE 0 END) AS student_count
                FROM users
            ")->fetch() ?: [];
            $totalUsers = (int)($userSummary['total_users'] ?? 0);
            $adminCount = (int)($userSummary['admin_count'] ?? 0);
            $registrarCount = (int)($userSummary['registrar_count'] ?? 0);
            $studentCount = (int)($userSummary['student_count'] ?? 0);
        } else {
            $totalUsers = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        }
    }

    // "Online now" heuristic: distinct users with recent activity within last 15 minutes.
    $activeSessions = getRecentActiveUserCount($pdo, 15);

    $rejectedEnrollments = 0;
    $underReviewEnrollments = 0;
    if (tableExists($pdo, 'enrollments')) {
        $en = $pdo->query("
            SELECT
              SUM(CASE WHEN LOWER(status) = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
              SUM(CASE WHEN LOWER(status) IN ('under_review','under review','review') THEN 1 ELSE 0 END) AS review_count
            FROM enrollments
        ")->fetch() ?: [];
        $rejectedEnrollments = (int)($en['rejected_count'] ?? 0);
        $underReviewEnrollments = (int)($en['review_count'] ?? 0);
    }

    $failedLogins1h = getFailedLogins($pdo, 60);

    $totalDocuments = 0;
    $verifiedDocuments = 0;
    if (tableExists($pdo, 'documents')) {
        $doc = $pdo->query("
            SELECT
              COUNT(*) AS total_docs,
              SUM(CASE WHEN LOWER(ai_status) = 'verified' THEN 1 ELSE 0 END) AS verified_docs
            FROM documents
        ")->fetch() ?: [];
        $totalDocuments = (int)($doc['total_docs'] ?? 0);
        $verifiedDocuments = (int)($doc['verified_docs'] ?? 0);
    }

    $nowTs = date('Y-m-d H:i:s');
    $alertItems = [];

    if ($failedLogins1h > 0) {
        $alertItems[] = [
            'id' => 'alert-failed-logins-1h',
            'type' => 'Failed Login Attempts (Last hour)',
            'description' => "{$failedLogins1h} failed login attempt(s) detected in the last hour.",
            'severity' => $failedLogins1h >= 10 ? 'High' : 'Medium',
            'timestamp' => $nowTs,
        ];
    }

    if ($rejectedEnrollments > 0) {
        $alertItems[] = [
            'id' => 'alert-rejected',
            'type' => 'Rejected Enrollments',
            'description' => "{$rejectedEnrollments} rejected enrollment(s) detected and may need review.",
            'severity' => $rejectedEnrollments >= 5 ? 'High' : 'Medium',
            'timestamp' => $nowTs,
        ];
    }

    if ($underReviewEnrollments > 0) {
        $alertItems[] = [
            'id' => 'alert-under-review',
            'type' => 'Enrollments Under Review',
            'description' => "{$underReviewEnrollments} enrollment(s) are currently under review.",
            'severity' => 'Low',
            'timestamp' => $nowTs,
        ];
    }

    // Non-security informational alert (kept in list but excluded from security count).
    $alertItems[] = [
        'id' => 'alert-users',
        'type' => 'User Distribution',
        'description' => "Admins: {$adminCount}, Registrars: {$registrarCount}, Students: {$studentCount}",
        'severity' => 'Low',
        'timestamp' => $nowTs,
    ];

    $securityAlertCount = 0;
    foreach ($alertItems as $a) {
        $sev = strtolower((string)($a['severity'] ?? 'low'));
        if (strpos((string)($a['id'] ?? ''), 'alert-users') === 0) continue;
        if ($sev === 'low') continue;
        $securityAlertCount++;
    }

    // Recent activity logs (last N from DB; fall back to system messages if table missing).
    $activityLogs = [];
    if (tableExists($pdo, 'activity_logs')) {
        $rows = $pdo->query("
            SELECT
              al.id,
              al.action,
              al.status,
              al.created_at,
              al.ip_address,
              COALESCE(u.full_name, 'System') AS actor_name
            FROM activity_logs al
            LEFT JOIN users u ON u.id = al.actor_user_id
            ORDER BY al.created_at DESC, al.id DESC
            LIMIT 200
        ")->fetchAll() ?: [];
        foreach ($rows as $r) {
            $activityLogs[] = [
                'id' => 'log-' . (string)($r['id'] ?? ''),
                'action' => (string)($r['action'] ?? ''),
                'user' => (string)($r['actor_name'] ?? 'System'),
                'ipAddress' => (string)($r['ip_address'] ?? ''),
                'status' => ucfirst(strtolower((string)($r['status'] ?? 'success'))),
                'timestamp' => (string)($r['created_at'] ?? ''),
            ];
        }
    } else {
        $activityLogs = [
            [
                'id' => 'log-users',
                'action' => 'User summary refreshed',
                'user' => 'System',
                'ipAddress' => '127.0.0.1',
                'status' => 'Success',
                'timestamp' => $nowTs,
            ],
        ];
    }

    echo json_encode([
        'success' => true,
        'summary' => [
            'totalUsers' => $totalUsers,
            'activeSessions' => $activeSessions,
            'securityAlerts' => $securityAlertCount,
            'systemStatus' => 'Operational',
            'ongoingSchoolYear' => [
                'year' => $ongoingSchoolYearLabel,
                'startDate' => $ongoingSchoolYearRange['startDate'],
                'endDate' => $ongoingSchoolYearRange['endDate'],
            ],
            'ongoingEnrollment' => [
                'enabled' => $enrollmentSchoolYearLabel !== null,
                'year' => $enrollmentSchoolYearLabel,
            ],
            'documentCompletionRate' => $totalDocuments > 0 ? round(($verifiedDocuments / $totalDocuments) * 100, 1) : 0.0,
            'databaseSizeLabel' => $totalDocuments . ' docs',
            'securityEvents' => $rejectedEnrollments,
            'activeUsers' => $activeSessions,
        ],
        'alerts' => $alertItems,
        'activityLogs' => $activityLogs,
    ]);
    appLogEvent($pdo, 'admin_overview', 'admin', 'success', $actorId, 'endpoint', 'admin/overview');
} catch (Throwable $e) {
    appLogEvent($pdo, 'admin_overview', 'admin', 'failed', $actorId, 'endpoint', 'admin/overview', ['reason' => 'server_error']);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to load admin overview']);
}
