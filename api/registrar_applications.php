<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}
require_once __DIR__ . '/logging.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table LIMIT 1'
    );
    $stmt->execute([':table' => $table]);
    return (bool)$stmt->fetchColumn();
}

function columnExists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1'
    );
    $stmt->execute([
        ':table' => $table,
        ':column' => $column,
    ]);
    return (bool)$stmt->fetchColumn();
}

function toUiStatus(string $status): string
{
    $normalized = strtolower(trim($status));
    if ($normalized === 'under_review' || $normalized === 'under review' || $normalized === 'review') {
        return 'Under Review';
    }
    if ($normalized === 'approved') {
        return 'Approved';
    }
    if ($normalized === 'rejected') {
        return 'Rejected';
    }
    return 'Pending';
}

$actorId = (int)($_SERVER['HTTP_X_USER_ID'] ?? 0);
if ($actorId <= 0) {
    appLogEvent($pdo, 'registrar_applications', 'registrar', 'failed', null, 'endpoint', 'registrar/applications', ['reason' => 'missing_user_context']);
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Missing user context']);
    exit;
}

$actorStmt = $pdo->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
$actorStmt->execute([':id' => $actorId]);
$actor = $actorStmt->fetch();
if (!$actor) {
    appLogEvent($pdo, 'registrar_applications', 'registrar', 'failed', $actorId, 'endpoint', 'registrar/applications', ['reason' => 'invalid_user']);
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid user']);
    exit;
}

$actorRole = getUserRole($pdo, $actorId);
if (!in_array($actorRole, ['registrar', 'admin'], true)) {
    appLogEvent($pdo, 'registrar_applications', 'registrar', 'failed', $actorId, 'endpoint', 'registrar/applications', ['reason' => 'access_denied', 'role' => $actorRole]);
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

require_once __DIR__ . '/security_guard.php';
runAuthenticatedSecurityGuards($pdo, $actorId, 'registrar/applications');

if (!tableExists($pdo, 'enrollments') || !tableExists($pdo, 'users')) {
    echo json_encode(['success' => true, 'applications' => []]);
    appLogEvent($pdo, 'registrar_applications', 'registrar', 'success', $actorId, 'endpoint', 'registrar/applications', ['count' => 0]);
    exit;
}

$docUsesEnrollmentId = tableExists($pdo, 'documents')
    && columnExists($pdo, 'documents', 'enrollment_id');
$docUsesStudentId = tableExists($pdo, 'documents')
    && tableExists($pdo, 'students')
    && columnExists($pdo, 'documents', 'student_id');
$hasReviewedFlag = tableExists($pdo, 'documents')
    && columnExists($pdo, 'documents', 'registrar_reviewed');
$hasAiStatus = tableExists($pdo, 'documents')
    && columnExists($pdo, 'documents', 'ai_status');

// Prefer the registrar's manual reviewed flag when the column exists; fall back to the
// AI verified count for un-migrated environments so this endpoint never crashes.
if ($hasReviewedFlag) {
    $verifiedClause = 'SUM(CASE WHEN registrar_reviewed = 1 THEN 1 ELSE 0 END)';
    $verifiedClauseAliased = 'SUM(CASE WHEN d.registrar_reviewed = 1 THEN 1 ELSE 0 END)';
} elseif ($hasAiStatus) {
    $verifiedClause = "SUM(CASE WHEN ai_status = 'verified' THEN 1 ELSE 0 END)";
    $verifiedClauseAliased = "SUM(CASE WHEN d.ai_status = 'verified' THEN 1 ELSE 0 END)";
} else {
    $verifiedClause = '0';
    $verifiedClauseAliased = '0';
}

try {
    // Applications page only shows in-flight applications. Once an
    // enrollment is approved (and certainly once it is enrolled), the
    // student moves to the dedicated Students page; surfacing them here
    // would clutter the registrar's review queue with already-decided
    // cases. Rejected applications stay so the registrar can audit them.
    $sql = "
        SELECT
            e.*,
            e.id AS enrollment_id,
            e.status AS enrollment_status,
            u.full_name,
            u.email,
            u.id AS user_id
        FROM enrollments e
        INNER JOIN users u ON u.id = e.user_id
        WHERE LOWER(e.status) IN ('pending', 'under_review', 'under review', 'review', 'rejected', 'draft')
        ORDER BY e.id DESC
    ";

    $rows = $pdo->query($sql)->fetchAll() ?: [];
    $applications = [];
    foreach ($rows as $row) {
        $enrollmentId = (int)$row['enrollment_id'];
        $userId = (int)$row['user_id'];

        $totalDocuments = 0;
        $documentsVerified = 0;

        if ($docUsesEnrollmentId) {
            $countStmt = $pdo->prepare(
                'SELECT COUNT(*) AS total_docs, ' . $verifiedClause . ' AS verified_docs
                 FROM documents
                 WHERE enrollment_id = :enrollment_id'
            );
            $countStmt->execute([
                ':enrollment_id' => $enrollmentId,
            ]);
            $count = $countStmt->fetch() ?: [];
            $totalDocuments = (int)($count['total_docs'] ?? 0);
            $documentsVerified = (int)($count['verified_docs'] ?? 0);
        } elseif ($docUsesStudentId) {
            $countStmt = $pdo->prepare(
                'SELECT
                    COUNT(d.id) AS total_docs,
                    ' . $verifiedClauseAliased . ' AS verified_docs
                 FROM students s
                 LEFT JOIN documents d ON d.student_id = s.id
                 WHERE s.user_id = :user_id'
            );
            $countStmt->execute([
                ':user_id' => $userId,
            ]);
            $count = $countStmt->fetch() ?: [];
            $totalDocuments = (int)($count['total_docs'] ?? 0);
            $documentsVerified = (int)($count['verified_docs'] ?? 0);
        }

        $applications[] = [
            'id' => 'APP-' . date('Y') . '-' . str_pad((string)$enrollmentId, 3, '0', STR_PAD_LEFT),
            'rawId' => (string)$enrollmentId,
            'studentName' => (string)($row['full_name'] ?? 'Unknown Applicant'),
            'email' => (string)($row['email'] ?? ''),
            'strand' => (string)($row['strand'] ?? ''),
            'gradeLevel' => (string)($row['grade_level'] ?? ''),
            'submittedDate' => (string)($row['applied_at'] ?? ''),
            'status' => toUiStatus((string)($row['enrollment_status'] ?? 'pending')),
            'documentsVerified' => $documentsVerified,
            'totalDocuments' => $totalDocuments,
        ];
    }

    echo json_encode([
        'success' => true,
        'applications' => $applications,
    ]);
    appLogEvent($pdo, 'registrar_applications', 'registrar', 'success', $actorId, 'endpoint', 'registrar/applications', ['count' => count($applications)]);
} catch (Throwable $e) {
    appLogEvent($pdo, 'registrar_applications', 'registrar', 'failed', $actorId, 'endpoint', 'registrar/applications', ['reason' => 'server_error']);
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to load applications',
    ]);
}
