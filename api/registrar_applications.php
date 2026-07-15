<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}
require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/enrollment_status_helpers.php';

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
    if ($normalized === 'enrolled') {
        return 'Enrolled';
    }
    if ($normalized === 'rejected') {
        return 'Rejected';
    }
    if ($normalized === 'draft') {
        return 'Pending';
    }
    return 'Pending';
}

require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/permission_guard.php';
$actor = apiRequireActor($pdo, 'registrar/applications');
$actorId = $actor['id'];
$actorRole = $actor['role'];
if (!in_array($actorRole, ['registrar', 'admin'], true)) {
    appLogEvent($pdo, 'registrar_applications', 'registrar', 'failed', $actorId, 'endpoint', 'registrar/applications', ['reason' => 'access_denied', 'role' => $actorRole]);
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

requireActorPermission($pdo, $actor, 'viewApplications');

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
$hasDocType = tableExists($pdo, 'documents')
    && columnExists($pdo, 'documents', 'type');

// Progress on the applications list reflects only the registrar's manual
// "Mark as reviewed" action — not AI auto-verification.
if ($hasReviewedFlag) {
    $verifiedClauseAliased = 'SUM(CASE WHEN d.registrar_reviewed = 1 THEN 1 ELSE 0 END)';
} elseif ($hasAiStatus) {
    // Legacy fallback when the reviewed column has not been migrated yet.
    $verifiedClauseAliased = '0';
} else {
    $verifiedClauseAliased = '0';
}

try {
    // Applications page only shows in-flight applications. Once an
    // enrollment is approved (and certainly once it is enrolled), the
    // student moves to the dedicated Students page; surfacing them here
    // would clutter the registrar's review queue with already-decided
    // cases. Rejected applications stay so the registrar can audit them.
    // One in-flight application per student (newest row) so an older enrolled
    // record does not hide a current Grade 12 draft/pending application.
    $extraUserCols = '';
    foreach (['first_name', 'middle_name', 'last_name', 'extension_name'] as $col) {
        if (columnExists($pdo, 'users', $col)) {
            $extraUserCols .= ", u.{$col}";
        }
    }
    $sql = "
        SELECT
            e.*,
            e.id AS enrollment_id,
            e.status AS enrollment_status,
            u.full_name,
            u.email,
            u.id AS user_id
            {$extraUserCols}
        FROM enrollments e
        INNER JOIN users u ON u.id = e.user_id
        INNER JOIN (
            SELECT user_id, MAX(id) AS latest_id
            FROM enrollments
            WHERE (
                TRIM(COALESCE(status, '')) = ''
                OR LOWER(status) IN ('pending', 'under_review', 'under review', 'review', 'rejected', 'draft')
            )
            GROUP BY user_id
        ) open_apps ON open_apps.latest_id = e.id
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
            // Dedupe by requirement type so legacy duplicate uploads (created
            // before the "replace on re-upload" fix) don't inflate the
            // denominator on the registrar's progress bar. The derived
            // `latest` table keeps only the newest document id per type and
            // then the outer query joins back to read its verified flag.
            // When the `type` column is missing for legacy schemas we fall
            // back to grouping by id so each row stays distinct.
            $groupByExpr = $hasDocType ? 'type' : 'id';
            $countStmt = $pdo->prepare(
                'SELECT
                    COUNT(*) AS total_docs,
                    ' . $verifiedClauseAliased . ' AS verified_docs
                 FROM documents d
                 INNER JOIN (
                     SELECT MAX(id) AS latest_id
                     FROM documents
                     WHERE enrollment_id = :enrollment_id
                     GROUP BY ' . $groupByExpr . '
                 ) latest ON d.id = latest.latest_id'
            );
            $countStmt->execute([
                ':enrollment_id' => $enrollmentId,
            ]);
            $count = $countStmt->fetch() ?: [];
            $totalDocuments = (int)($count['total_docs'] ?? 0);
            $documentsVerified = (int)($count['verified_docs'] ?? 0);
        } elseif ($docUsesStudentId) {
            // Same dedupe strategy as the enrollment_id branch, but starting
            // from the user's student row when this deployment links
            // documents through student_id instead of enrollment_id.
            $groupByExpr = $hasDocType ? 'd2.type' : 'd2.id';
            $countStmt = $pdo->prepare(
                'SELECT
                    COUNT(*) AS total_docs,
                    ' . $verifiedClauseAliased . ' AS verified_docs
                 FROM students s
                 LEFT JOIN documents d ON d.student_id = s.id
                 INNER JOIN (
                     SELECT MAX(d2.id) AS latest_id
                     FROM students s2
                     INNER JOIN documents d2 ON d2.student_id = s2.id
                     WHERE s2.user_id = :user_id_inner
                     GROUP BY ' . $groupByExpr . '
                 ) latest ON d.id = latest.latest_id
                 WHERE s.user_id = :user_id'
            );
            $countStmt->execute([
                ':user_id' => $userId,
                ':user_id_inner' => $userId,
            ]);
            $count = $countStmt->fetch() ?: [];
            $totalDocuments = (int)($count['total_docs'] ?? 0);
            $documentsVerified = (int)($count['verified_docs'] ?? 0);
        }

        $formData = [];
        $stepsRaw = $row['enrollment_steps'] ?? null;
        if ($stepsRaw !== null && $stepsRaw !== '') {
            $steps = json_decode((string)$stepsRaw, true);
            if (is_array($steps) && is_array($steps['form_data'] ?? null)) {
                $formData = $steps['form_data'];
            }
        }
        $userRow = [
            'full_name' => (string)($row['full_name'] ?? ''),
            'first_name' => (string)($row['first_name'] ?? ''),
            'middle_name' => (string)($row['middle_name'] ?? ''),
            'last_name' => (string)($row['last_name'] ?? ''),
            'extension_name' => (string)($row['extension_name'] ?? ''),
        ];
        $studentName = studentEnrollmentFormDisplayName($formData, $userRow);
        if ($studentName === '') {
            $studentName = 'Unknown Applicant';
        }

        $applications[] = [
            'id' => 'APP-' . date('Y') . '-' . str_pad((string)$enrollmentId, 3, '0', STR_PAD_LEFT),
            'rawId' => (string)$enrollmentId,
            'studentName' => $studentName,
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
