<?php
declare(strict_types=1);

/**
 * Student notification feed derived from activity logs and enrollment state.
 *
 * GET  /api/student/notifications
 * POST /api/student/notifications  { "mark_read": ["id", ...] } | { "mark_all_read": true }
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/permission_guard.php';
require_once __DIR__ . '/school_year_helpers.php';
require_once __DIR__ . '/enrollment_status_helpers.php';

header('Content-Type: application/json');

$actor = apiRequireActor($pdo, 'student/notifications');
if ($actor['role'] !== 'student') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

requireActorPermission($pdo, $actor, 'viewNotifications', false);

$userId = (int)$actor['id'];
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

function notificationsTableExists(PDO $pdo): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1');
    $stmt->execute([':t' => 'student_notification_reads']);
    return (bool)$stmt->fetchColumn();
}

function ensureNotificationReadsTable(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS student_notification_reads (
            user_id INT NOT NULL,
            notification_key VARCHAR(160) NOT NULL,
            read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, notification_key),
            INDEX idx_notif_reads_user (user_id)
        )
    ");
}

/** @return array<string, true> */
function fetchReadKeys(PDO $pdo, int $userId): array
{
    if (!notificationsTableExists($pdo)) {
        return [];
    }
    $stmt = $pdo->prepare('SELECT notification_key FROM student_notification_reads WHERE user_id = :uid');
    $stmt->execute([':uid' => $userId]);
    $out = [];
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) ?: [] as $key) {
        $k = trim((string)$key);
        if ($k !== '') {
            $out[$k] = true;
        }
    }
    return $out;
}

/**
 * @param array<string, mixed> $details
 * @return array{type: string, title: string, message: string}|null
 */
function mapLogToNotification(string $action, string $status, ?string $targetType, array $details): ?array
{
    $action = strtolower(trim($action));
    $st = strtolower(trim($status));

    return match ($action) {
        'student_enrollment_submit' => [
            'type' => 'success',
            'title' => 'Application submitted',
            'message' => 'Your enrollment application was submitted and is awaiting review.',
        ],
        'student_enrollment_cancel' => [
            'type' => 'info',
            'title' => 'Application cancelled',
            'message' => 'You cancelled your enrollment application. You may start a new application when ready.',
        ],
        'register' => [
            'type' => 'info',
            'title' => 'Welcome to IntelliDocs',
            'message' => 'Your account was created. You can now begin your enrollment application.',
        ],
        'document_decision' => match ((string)($details['action'] ?? '')) {
            'clear' => [
                'type' => 'update',
                'title' => 'Document resubmission cleared',
                'message' => 'A registrar has cleared a resubmission requirement on one of your documents.',
            ],
            'reject' => [
                'type' => 'warning',
                'title' => 'Document resubmission required',
                'message' => trim((string)($details['remarks'] ?? '')) !== ''
                    ? trim((string)$details['remarks'])
                    : 'Please resubmit a document marked for resubmission in Application Status.',
            ],
            default => null,
        },
        'issue_credentials' => $st === 'success'
            ? [
                'type' => 'success',
                'title' => 'Enrollment approved',
                'message' => 'Your enrollment was approved. Check your email for school account credentials.',
            ]
            : null,
        'registrar_decision' => match (strtolower(trim((string)($details['decision'] ?? '')))) {
            'rejected', 'reject' => [
                'type' => 'warning',
                'title' => 'Application rejected',
                'message' => trim((string)($details['remarks'] ?? '')) !== ''
                    ? trim((string)$details['remarks'])
                    : 'Your enrollment application was rejected. Contact the registrar for details.',
            ],
            'approved', 'enrolled' => [
                'type' => 'success',
                'title' => 'Enrollment approved',
                'message' => 'Your enrollment application was approved.',
            ],
            default => null,
        },
        default => str_starts_with($action, 'anomaly_')
            ? [
                'type' => 'warning',
                'title' => 'Security notice',
                'message' => 'Unusual account activity was detected on your profile.',
            ]
            : null,
    };
}

/** @return list<array<string, mixed>> */
function buildStudentNotifications(PDO $pdo, int $userId): array
{
    ensureNotificationReadsTable($pdo);
    $readKeys = fetchReadKeys($pdo, $userId);
    $items = [];
    $seen = [];

    $enrollmentIds = [];
    if (tableExists($pdo, 'enrollments')) {
        $eStmt = $pdo->prepare('SELECT id FROM enrollments WHERE user_id = :uid');
        $eStmt->execute([':uid' => $userId]);
        foreach ($eStmt->fetchAll(PDO::FETCH_COLUMN) ?: [] as $eid) {
            $enrollmentIds[] = (string)(int)$eid;
        }
    }

    if (tableExists($pdo, 'activity_logs')) {
        $params = [':uid' => $userId];
        $enrollmentClause = '';
        $extraClauses = [];
        if ($enrollmentIds !== []) {
            $placeholders = [];
            foreach ($enrollmentIds as $i => $eid) {
                $key = ':eid' . $i;
                $placeholders[] = $key;
                $params[$key] = $eid;
            }
            $inList = implode(',', $placeholders);
            $extraClauses[] = "(al.target_type = 'enrollment' AND al.target_id IN ({$inList}))";
        }
        if (tableExists($pdo, 'documents') && $enrollmentIds !== []) {
            $extraClauses[] = "(
                al.target_type = 'document'
                AND al.target_id IN (
                    SELECT CAST(d.id AS CHAR)
                      FROM documents d
                     INNER JOIN enrollments e ON e.id = d.enrollment_id
                     WHERE e.user_id = :uid_docs
                )
            )";
            $params[':uid_docs'] = $userId;
        }
        $enrollmentClause = $extraClauses !== [] ? ' OR ' . implode(' OR ', $extraClauses) : '';

        $sql = "
            SELECT al.id, al.action, al.status, al.target_type, al.target_id, al.details_json, al.created_at
              FROM activity_logs al
             WHERE al.actor_user_id = :uid
                {$enrollmentClause}
             ORDER BY al.created_at DESC
             LIMIT 60
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $details = [];
            if (!empty($row['details_json'])) {
                $decoded = json_decode((string)$row['details_json'], true);
                if (is_array($decoded)) {
                    $details = $decoded;
                }
            }
            $mapped = mapLogToNotification(
                (string)($row['action'] ?? ''),
                (string)($row['status'] ?? ''),
                isset($row['target_type']) ? (string)$row['target_type'] : null,
                $details
            );
            if ($mapped === null) {
                continue;
            }
            $logId = (int)($row['id'] ?? 0);
            $key = 'log-' . $logId;
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $created = (string)($row['created_at'] ?? '');
            $items[] = [
                'id' => $key,
                'type' => $mapped['type'],
                'title' => $mapped['title'],
                'message' => $mapped['message'],
                'date' => $created,
                'read' => isset($readKeys[$key]),
            ];
        }
    }

    // Current-state hints when logs are sparse.
    $sy = function_exists('getEnrollmentSchoolYear') ? getEnrollmentSchoolYear($pdo) : null;
    $row = pickPrimaryEnrollmentRow($pdo, $userId, $sy);
    if ($row) {
        $st = strtolower(trim((string)($row['status'] ?? '')));
        $eid = (int)($row['id'] ?? 0);
        if ($st === 'pending' || $st === 'under_review' || $st === 'under review' || $st === 'review') {
            $key = 'state-under-review-' . $eid;
            if (!isset($seen[$key])) {
                $items[] = [
                    'id' => $key,
                    'type' => 'update',
                    'title' => 'Application under review',
                    'message' => 'The registrar is reviewing your submitted documents.',
                    'date' => (string)($row['updated_at'] ?? ''),
                    'read' => isset($readKeys[$key]),
                ];
            }
        }
    }

    usort($items, static function (array $a, array $b): int {
        return strcmp((string)($b['date'] ?? ''), (string)($a['date'] ?? ''));
    });

    return array_slice($items, 0, 40);
}

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1');
    $stmt->execute([':t' => $table]);
    return (bool)$stmt->fetchColumn();
}

if ($method === 'GET') {
    try {
        $notifications = buildStudentNotifications($pdo, $userId);
        echo json_encode([
            'success' => true,
            'notifications' => $notifications,
            'unread_count' => count(array_filter($notifications, static fn(array $n): bool => empty($n['read']))),
        ]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to load notifications']);
    }
    exit;
}

if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    ensureNotificationReadsTable($pdo);
    $keys = [];
    if (!empty($payload['mark_all_read'])) {
        foreach (buildStudentNotifications($pdo, $userId) as $n) {
            $keys[] = (string)($n['id'] ?? '');
        }
    } elseif (is_array($payload['mark_read'] ?? null)) {
        foreach ($payload['mark_read'] as $id) {
            $k = trim((string)$id);
            if ($k !== '') {
                $keys[] = $k;
            }
        }
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Provide mark_read or mark_all_read']);
        exit;
    }

    $ins = $pdo->prepare('
        INSERT INTO student_notification_reads (user_id, notification_key, read_at)
        VALUES (:uid, :key, NOW())
        ON DUPLICATE KEY UPDATE read_at = NOW()
    ');
    foreach (array_unique($keys) as $key) {
        if ($key === '') {
            continue;
        }
        $ins->execute([':uid' => $userId, ':key' => $key]);
    }

    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
