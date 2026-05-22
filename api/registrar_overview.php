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
    appLogEvent($pdo, 'registrar_overview', 'registrar', 'failed', null, 'endpoint', 'registrar/overview', ['reason' => 'missing_user_context']);
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Missing user context']);
    exit;
}

$actorStmt = $pdo->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
$actorStmt->execute([':id' => $actorId]);
$actor = $actorStmt->fetch();
if (!$actor) {
    appLogEvent($pdo, 'registrar_overview', 'registrar', 'failed', $actorId, 'endpoint', 'registrar/overview', ['reason' => 'invalid_user']);
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid user']);
    exit;
}

$actorRole = getUserRole($pdo, $actorId);
if (!in_array($actorRole, ['registrar', 'admin'], true)) {
    appLogEvent($pdo, 'registrar_overview', 'registrar', 'failed', $actorId, 'endpoint', 'registrar/overview', ['reason' => 'access_denied', 'role' => $actorRole]);
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

$overallQuota = 4000;

try {
    $applicationsTotal = 0;
    $enrolledTotal = 0;
    $pending = 0;
    $underReview = 0;
    $approved = 0;
    $rejected = 0;
    $byStrand = [];

    if (tableExists($pdo, 'enrollments')) {
        $summarySql = "
            SELECT
                COUNT(*) AS total_applications,
                SUM(CASE WHEN LOWER(status) = 'approved' THEN 1 ELSE 0 END) AS total_enrolled,
                SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN LOWER(status) IN ('under_review', 'under review', 'review') THEN 1 ELSE 0 END) AS review_count,
                SUM(CASE WHEN LOWER(status) = 'approved' THEN 1 ELSE 0 END) AS approved_count,
                SUM(CASE WHEN LOWER(status) = 'rejected' THEN 1 ELSE 0 END) AS rejected_count
            FROM enrollments
        ";
        $summary = $pdo->query($summarySql)->fetch() ?: [];
        $applicationsTotal = (int)($summary['total_applications'] ?? 0);
        $enrolledTotal = (int)($summary['total_enrolled'] ?? 0);
        $pending = (int)($summary['pending_count'] ?? 0);
        $underReview = (int)($summary['review_count'] ?? 0);
        $approved = (int)($summary['approved_count'] ?? 0);
        $rejected = (int)($summary['rejected_count'] ?? 0);

        $strandSql = "
            SELECT
                COALESCE(NULLIF(TRIM(strand), ''), 'Unspecified') AS strand_name,
                COUNT(*) AS total_applications,
                SUM(CASE WHEN LOWER(status) = 'approved' THEN 1 ELSE 0 END) AS enrolled_students
            FROM enrollments
            GROUP BY COALESCE(NULLIF(TRIM(strand), ''), 'Unspecified')
            ORDER BY total_applications DESC, strand_name ASC
        ";
        $strandRows = $pdo->query($strandSql)->fetchAll() ?: [];
        foreach ($strandRows as $row) {
            $byStrand[] = [
                'name' => (string)$row['strand_name'],
                'totalApplications' => (int)$row['total_applications'],
                'enrolledStudents' => (int)$row['enrolled_students'],
            ];
        }
    }

    $totalSections = 0;
    if (tableExists($pdo, 'students')) {
        $sectionsSql = "
            SELECT COUNT(DISTINCT CONCAT(COALESCE(grade_level, ''), '-', COALESCE(section, '')))
            FROM students
            WHERE COALESCE(section, '') <> ''
        ";
        $totalSections = (int)$pdo->query($sectionsSql)->fetchColumn();
    }

    $totalDocuments = 0;
    $verifiedDocuments = 0;
    if (tableExists($pdo, 'documents')) {
        $docSql = "
            SELECT
                COUNT(*) AS total_docs,
                SUM(CASE WHEN LOWER(ai_status) = 'verified' THEN 1 ELSE 0 END) AS verified_docs
            FROM documents
        ";
        $doc = $pdo->query($docSql)->fetch() ?: [];
        $totalDocuments = (int)($doc['total_docs'] ?? 0);
        $verifiedDocuments = (int)($doc['verified_docs'] ?? 0);
    }

    $remainingSlots = max(0, $overallQuota - $enrolledTotal);
    $quotaUtilization = $overallQuota > 0 ? round(($enrolledTotal / $overallQuota) * 100, 1) : 0.0;
    $documentCompletionRate = $totalDocuments > 0 ? round(($verifiedDocuments / $totalDocuments) * 100, 1) : 0.0;

    echo json_encode([
        'success' => true,
        'summary' => [
            'overallQuota' => $overallQuota,
            'totalApplications' => $applicationsTotal,
            'totalEnrolled' => $enrolledTotal,
            'remainingSlots' => $remainingSlots,
            'pending' => $pending,
            'underReview' => $underReview,
            'approved' => $approved,
            'rejected' => $rejected,
            'totalSections' => $totalSections,
            'quotaUtilization' => $quotaUtilization,
            'documentCompletionRate' => $documentCompletionRate,
            'totalDocuments' => $totalDocuments,
            'verifiedDocuments' => $verifiedDocuments,
        ],
        'strands' => $byStrand,
    ]);
    appLogEvent($pdo, 'registrar_overview', 'registrar', 'success', $actorId, 'endpoint', 'registrar/overview');
} catch (Throwable $e) {
    appLogEvent($pdo, 'registrar_overview', 'registrar', 'failed', $actorId, 'endpoint', 'registrar/overview', ['reason' => 'server_error']);
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to load registrar overview',
    ]);
}
