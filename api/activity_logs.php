<?php
declare(strict_types=1);

/**
 * GET /api/admin/activity-logs
 * GET /api/registrar/activity-logs
 *
 * Query: search, type, range (today|week|month|all), limit, offset
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/user_role.php';

header('Content-Type: application/json');

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/permission_guard.php';
$actor = apiRequireActor($pdo, 'activity-logs');
if (!in_array($actor['role'], ['admin', 'registrar'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

if ($actor['role'] === 'admin') {
    requireActorPermission($pdo, $actor, 'viewActivityLogs', false);
} else {
    requireActorPermission($pdo, $actor, 'viewApplications');
}

function activityLogsTableExists(PDO $pdo): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute([':t' => 'activity_logs']);

    return (bool)$stmt->fetchColumn();
}

/** @return 'login'|'upload'|'approval'|'rejection'|'user_management'|'system_config'|'security'|'view'|'remark'|'registration'|'other' */
function mapActivityLogUiType(string $action, string $module, string $status): string
{
    $a = strtolower(trim($action));
    $m = strtolower(trim($module));
    $st = strtolower(trim($status));

    if (
        str_contains($a, 'login')
        || $a === 'login_success'
        || $a === 'login_otp_verify'
    ) {
        return $st === 'failed' ? 'security' : 'login';
    }
    if (
        str_contains($a, 'anomaly')
        || str_contains($a, 'replay')
        || str_contains($a, 'mismatch')
        || str_contains($a, 'invalid')
        || str_contains($a, 'blocked')
        || ($st === 'failed' && str_contains($a, 'auth'))
    ) {
        return 'security';
    }
    if (
        str_contains($a, 'upload')
        || str_contains($a, 'document')
        || str_contains($a, 'student_enrollment_submit')
        || str_contains($a, 'student_enrollment_save')
    ) {
        return 'upload';
    }
    if (
        str_contains($a, 'approve')
        || $a === 'issue_credentials'
    ) {
        return 'approval';
    }
    if (str_contains($a, 'reject') || str_contains($a, 'decline')) {
        return 'rejection';
    }
    if (
        str_contains($a, 'create_user')
        || str_contains($a, 'user_')
        || str_contains($a, 'deactivate')
        || str_contains($a, 'credentials')
    ) {
        return 'user_management';
    }
    if (
        str_contains($a, 'setting')
        || str_contains($a, 'config')
        || str_contains($a, 'school_year')
        || str_contains($a, 'mail_health')
    ) {
        return 'system_config';
    }
    if (str_contains($a, 'remark')) {
        return 'remark';
    }
    if (str_contains($a, 'register') || str_contains($a, 'signup')) {
        return 'registration';
    }
    if (str_contains($a, 'detail') || str_contains($a, 'review') || str_contains($a, 'view')) {
        return 'view';
    }
    if ($m === 'registrar' && str_contains($a, 'decision')) {
        return 'approval';
    }

    return 'other';
}

function formatActivityActionLabel(string $action): string
{
    $labels = [
        'login_success' => 'User Login',
        'login_otp_verify' => 'OTP Verified',
        'registrar_decision' => 'Application Decision',
        'issue_credentials' => 'Credentials Issued',
        'student_enrollment_submit' => 'Application Submitted',
        'student_enrollment_save' => 'Enrollment Saved',
        'registrar_save_remarks' => 'Remark Added',
        'registrar_application_detail' => 'Application Reviewed',
        'registrar_document_review' => 'Document Reviewed',
        'section_create' => 'Section Created',
        'section_delete' => 'Section Deleted',
        'section_assignment' => 'Section Assigned',
        'create_user' => 'New User Created',
        'grade12_decline' => 'Grade 12 Declined',
    ];
    if (isset($labels[$action])) {
        return $labels[$action];
    }

    return ucwords(str_replace('_', ' ', trim($action)));
}

/**
 * @param array<string, mixed> $details
 */
function formatActivityDescription(
    string $action,
    array $details,
    ?string $targetType,
    ?string $targetId,
    string $status
): string {
    $decision = strtolower(trim((string)($details['decision'] ?? '')));
    if ($action === 'login_success') {
        return 'Successful login to the portal';
    }
    if ($action === 'registrar_decision') {
        if ($decision === 'approve' || $decision === 'approved') {
            return 'Approved enrollment application'
                . ($targetId !== null && $targetId !== '' ? ' (enrollment #' . $targetId . ')' : '');
        }
        if ($decision === 'reject' || $decision === 'rejected') {
            return 'Rejected enrollment application'
                . ($targetId !== null && $targetId !== '' ? ' (enrollment #' . $targetId . ')' : '');
        }
    }
    if ($action === 'student_enrollment_submit') {
        return 'Student submitted enrollment application';
    }
    if ($action === 'registrar_save_remarks') {
        $remarks = trim((string)($details['remarks'] ?? ''));
        if ($remarks !== '') {
            return 'Added remarks: "' . mb_substr($remarks, 0, 120) . '"';
        }

        return 'Added remarks to an application';
    }
    if ($action === 'issue_credentials') {
        $username = trim((string)($details['school_username'] ?? ''));
        if ($username !== '') {
            return 'Issued portal credentials (username: ' . $username . ')';
        }

        return 'Issued student portal credentials';
    }
    if ($action === 'section_assignment' && !empty($details['section'])) {
        return 'Auto-assigned student to section ' . (string)$details['section'];
    }
    if (!empty($details['reason'])) {
        return ucfirst(str_replace('_', ' ', (string)$details['reason']));
    }
    if ($targetType !== null && $targetType !== '' && $targetId !== null && $targetId !== '') {
        return ucfirst($targetType) . ' #' . $targetId . ' (' . $status . ')';
    }

    return formatActivityActionLabel($action);
}

function formatActivityTimestampLabel(string $raw): string
{
    try {
        $dt = new DateTimeImmutable($raw);

        return $dt->format('F j, Y - g:i A');
    } catch (Throwable $e) {
        return $raw;
    }
}

function formatRelatedTo(?string $targetType, ?string $targetId): ?string
{
    if ($targetType !== 'enrollment' || $targetId === null || trim($targetId) === '') {
        return null;
    }

    return 'APP-' . date('Y') . '-' . str_pad(trim($targetId), 3, '0', STR_PAD_LEFT);
}

function resolveActivityLogUiType(string $action, string $module, string $status, array $details): string
{
    $decision = strtolower(trim((string)($details['decision'] ?? '')));
    if ($action === 'registrar_decision') {
        if (in_array($decision, ['reject', 'rejected'], true)) {
            return 'rejection';
        }
        if (in_array($decision, ['approve', 'approved'], true)) {
            return 'approval';
        }
    }

    return mapActivityLogUiType($action, $module, $status);
}

$search = trim((string)($_GET['search'] ?? ''));
$typeFilter = strtolower(trim((string)($_GET['type'] ?? 'all')));
$range = strtolower(trim((string)($_GET['range'] ?? 'month')));
$limit = min(200, max(1, (int)($_GET['limit'] ?? 100)));
$offset = max(0, (int)($_GET['offset'] ?? 0));

$emptyStats = [
    'totalActions' => 0,
    'logins' => 0,
    'uploads' => 0,
    'approvals' => 0,
    'rejections' => 0,
    'security' => 0,
    'registrations' => 0,
    'remarks' => 0,
    'views' => 0,
];

if (!activityLogsTableExists($pdo)) {
    echo json_encode([
        'success' => true,
        'logs' => [],
        'total' => 0,
        'stats' => $emptyStats,
        'message' => 'Activity logging is not initialized yet.',
    ]);
    exit;
}

$sinceSql = match ($range) {
    'today' => 'NOW() - INTERVAL 1 DAY',
    'week' => 'NOW() - INTERVAL 7 DAY',
    'all' => null,
    default => 'NOW() - INTERVAL 30 DAY',
};

$where = [];
$params = [];
if ($sinceSql !== null) {
    $where[] = "al.created_at >= ({$sinceSql})";
}
if ($search !== '') {
    $where[] = '(al.action LIKE :search OR al.module LIKE :search OR u.full_name LIKE :search OR u.email LIKE :search OR CAST(al.target_id AS CHAR) LIKE :search OR al.ip_address LIKE :search)';
    $params[':search'] = '%' . $search . '%';
}
$whereClause = $where === [] ? '1=1' : implode(' AND ', $where);

$listStmt = $pdo->prepare("
    SELECT
        al.id,
        al.created_at,
        al.actor_user_id,
        al.action,
        al.module,
        al.status,
        al.target_type,
        al.target_id,
        al.ip_address,
        al.details_json,
        COALESCE(u.full_name, u.username, 'System') AS actor_name
    FROM activity_logs al
    LEFT JOIN users u ON u.id = al.actor_user_id
    WHERE {$whereClause}
    ORDER BY al.created_at DESC, al.id DESC
    LIMIT 1000
");
$listStmt->execute($params);
$rows = $listStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

$logs = [];
$stats = $emptyStats;

foreach ($rows as $r) {
    $details = [];
    if (!empty($r['details_json'])) {
        $decoded = json_decode((string)$r['details_json'], true);
        if (is_array($decoded)) {
            $details = $decoded;
        }
    }

    $action = (string)($r['action'] ?? '');
    $module = (string)($r['module'] ?? '');
    $status = (string)($r['status'] ?? 'success');
    $targetType = $r['target_type'] !== null ? (string)$r['target_type'] : null;
    $targetId = $r['target_id'] !== null ? (string)$r['target_id'] : null;
    $uiType = resolveActivityLogUiType($action, $module, $status, $details);

    if ($typeFilter !== '' && $typeFilter !== 'all' && $uiType !== $typeFilter) {
        continue;
    }

    $actorId = $r['actor_user_id'] !== null ? (int)$r['actor_user_id'] : 0;
    $role = $actorId > 0 ? getUserRole($pdo, $actorId) : 'system';
    $ip = trim((string)($r['ip_address'] ?? ''));
    if ($ip === '' && isset($details['ip_address'])) {
        $ip = trim((string)$details['ip_address']);
    }

    $entry = [
        'id' => (string)($r['id'] ?? ''),
        'action' => formatActivityActionLabel($action),
        'description' => formatActivityDescription($action, $details, $targetType, $targetId, $status),
        'user' => (string)($r['actor_name'] ?? 'System'),
        'role' => $role === 'system' ? 'System' : ucfirst($role),
        'ipAddress' => $ip !== '' ? $ip : '—',
        'timestamp' => (string)($r['created_at'] ?? ''),
        'timestampLabel' => formatActivityTimestampLabel((string)($r['created_at'] ?? '')),
        'type' => $uiType,
        'relatedTo' => formatRelatedTo($targetType, $targetId),
        'rawAction' => $action,
        'status' => ucfirst(strtolower($status)),
    ];

    $logs[] = $entry;

    $stats['totalActions']++;
    if ($uiType === 'login') {
        $stats['logins']++;
    } elseif ($uiType === 'upload') {
        $stats['uploads']++;
    } elseif ($uiType === 'approval') {
        $stats['approvals']++;
    } elseif ($uiType === 'rejection') {
        $stats['rejections']++;
    } elseif ($uiType === 'security') {
        $stats['security']++;
    } elseif ($uiType === 'registration') {
        $stats['registrations']++;
    } elseif ($uiType === 'remark') {
        $stats['remarks']++;
    } elseif ($uiType === 'view') {
        $stats['views']++;
    }
}

$total = count($logs);
$logs = array_slice($logs, $offset, $limit);

echo json_encode([
    'success' => true,
    'logs' => $logs,
    'total' => $total,
    'stats' => $stats,
]);
