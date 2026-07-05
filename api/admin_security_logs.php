<?php
declare(strict_types=1);

/**
 * GET /api/admin/security-logs
 * Query: search, action, status, range (today|week|month), limit, offset
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/activity_log_search_helpers.php';

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/permission_guard.php';
$actor = apiRequireAdmin($pdo, 'admin/security-logs');
requireActorPermission($pdo, $actor, 'viewActivityLogs', false);

function tableExistsLocal(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1');
    $stmt->execute([':t' => $table]);
    return (bool)$stmt->fetchColumn();
}

$search = trim((string)($_GET['search'] ?? ''));
$actionFilter = trim((string)($_GET['action'] ?? ''));
$statusFilter = strtolower(trim((string)($_GET['status'] ?? '')));
$range = strtolower(trim((string)($_GET['range'] ?? 'week')));
$limit = min(200, max(1, (int)($_GET['limit'] ?? 50)));
$offset = max(0, (int)($_GET['offset'] ?? 0));

$sinceSql = match ($range) {
    'today' => 'NOW() - INTERVAL 1 DAY',
    'month' => 'NOW() - INTERVAL 30 DAY',
    default => 'NOW() - INTERVAL 7 DAY',
};

if (!tableExistsLocal($pdo, 'activity_logs')) {
    echo json_encode([
        'success' => true,
        'logs' => [],
        'summary' => [
            'total_events' => 0,
            'successful_logins' => 0,
            'failed_attempts' => 0,
            'suspicious_activity' => 0,
        ],
    ]);
    exit;
}

ensureActivityLogColumns($pdo);
$ipSelect = activityLogColumnExists($pdo, 'activity_logs', 'ip_address')
    ? 'al.ip_address'
    : 'NULL AS ip_address';
$actorSelect = buildActivityLogActorNameSelect($pdo, 'u');

$where = ["al.created_at >= ({$sinceSql})"];
$params = [];

if ($actionFilter !== '' && $actionFilter !== 'all') {
    $where[] = 'al.action = :action';
    $params[':action'] = $actionFilter;
}
if ($statusFilter !== '' && $statusFilter !== 'all') {
    $where[] = 'LOWER(al.status) = :status';
    $params[':status'] = $statusFilter;
}
if ($search !== '') {
    $where[] = buildActivityLogSearchWhere($pdo, $search, $params);
}

$whereClause = implode(' AND ', $where);

try {
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM activity_logs al LEFT JOIN users u ON u.id = al.actor_user_id WHERE {$whereClause}");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $listStmt = $pdo->prepare("
        SELECT
            al.id,
            al.created_at,
            al.actor_user_id,
            {$actorSelect},
            al.action,
            al.module,
            al.status,
            {$ipSelect},
            al.details_json
        FROM activity_logs al
        LEFT JOIN users u ON u.id = al.actor_user_id
        WHERE {$whereClause}
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT {$limit} OFFSET {$offset}
    ");
    $listStmt->execute($params);
    $rows = $listStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
} catch (Throwable $e) {
    error_log('admin_security_logs search failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not search security logs. Please try again.']);
    exit;
}

$logs = [];
foreach ($rows as $r) {
    $details = [];
    if (!empty($r['details_json'])) {
        $decoded = json_decode((string)$r['details_json'], true);
        if (is_array($decoded)) {
            $details = $decoded;
        }
    }
    $logs[] = [
        'id' => (int)$r['id'],
        'timestamp' => (string)$r['created_at'],
        'user_id' => $r['actor_user_id'] !== null ? (int)$r['actor_user_id'] : null,
        'user' => (string)($r['actor_name'] ?? 'System'),
        'action' => (string)($r['action'] ?? ''),
        'module' => (string)($r['module'] ?? ''),
        'status' => ucfirst(strtolower((string)($r['status'] ?? 'success'))),
        'ip_address' => ($ip = resolveActivityLogIpAddress(isset($r['ip_address']) ? (string)$r['ip_address'] : null, $details)) !== ''
            ? $ip
            : '—',
        'details' => $details,
    ];
}

$summaryRow = $pdo->query("
    SELECT
        COUNT(*) AS total_events,
        SUM(CASE WHEN action IN ('login', 'login_success', 'login_otp_verify') AND status = 'success' THEN 1 ELSE 0 END) AS successful_logins,
        SUM(CASE WHEN action IN ('login_attempt', 'login_otp_verify', 'session_token_invalid', 'session_replay_blocked') AND status = 'failed' THEN 1 ELSE 0 END) AS failed_attempts,
        SUM(CASE WHEN action LIKE 'anomaly_%' OR action IN ('auth_header_mismatch', 'session_replay_blocked') THEN 1 ELSE 0 END) AS suspicious_activity
    FROM activity_logs
    WHERE created_at >= ({$sinceSql})
")->fetch(PDO::FETCH_ASSOC) ?: [];

echo json_encode([
    'success' => true,
    'logs' => $logs,
    'total' => $total,
    'summary' => [
        'total_events' => (int)($summaryRow['total_events'] ?? 0),
        'successful_logins' => (int)($summaryRow['successful_logins'] ?? 0),
        'failed_attempts' => (int)($summaryRow['failed_attempts'] ?? 0),
        'suspicious_activity' => (int)($summaryRow['suspicious_activity'] ?? 0),
    ],
]);
