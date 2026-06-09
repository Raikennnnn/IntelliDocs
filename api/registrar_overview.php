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
require_once __DIR__ . '/section_grade_helpers.php';

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

require_once __DIR__ . '/api_auth.php';
$actor = apiRequireActor($pdo, 'registrar/overview');
$actorId = $actor['id'];
$actorRole = $actor['role'];

$overallQuota = 4000;

try {
    $applicationsTotal = 0;
    $enrolledTotal = 0;
    $pending = 0;
    $underReview = 0;
    $approved = 0;
    $rejected = 0;
    $byStrand = [];

    $schoolYearScope = rosterEnrollmentContext($pdo)['school_year'] ?? '';
    $schoolYearLabel = $schoolYearScope !== ''
        ? 'SY ' . $schoolYearScope . ' (active enrollment)'
        : 'All school years';
    $schoolYearSql = '';
    $schoolYearParams = [];
    if ($schoolYearScope !== '') {
        $schoolYearSql = " AND TRIM(COALESCE(school_year, '')) = :overview_sy";
        $schoolYearParams[':overview_sy'] = $schoolYearScope;
    }

    if (tableExists($pdo, 'enrollments')) {
        // Scope counts to the active enrollment school year so historical rows
        // from ended years do not inflate dashboard totals.
        // total_applications: in-flight queue items only — once an enrollment
        // is approved (or fully enrolled) it leaves the registrar's review
        // queue and stops counting toward this stat. Rejected rows are also
        // excluded since the registrar can no longer act on them.
        // total_enrolled: every student already approved or enrolled, since
        // both states represent a student who has secured a seat.
        $summarySql = "
            SELECT
                SUM(CASE WHEN LOWER(status) IN ('pending', 'under_review', 'under review', 'review') THEN 1 ELSE 0 END) AS total_applications,
                SUM(CASE WHEN LOWER(status) IN ('approved', 'enrolled') THEN 1 ELSE 0 END) AS total_enrolled,
                SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN LOWER(status) IN ('under_review', 'under review', 'review') THEN 1 ELSE 0 END) AS review_count,
                SUM(CASE WHEN LOWER(status) IN ('approved', 'enrolled') THEN 1 ELSE 0 END) AS approved_count,
                SUM(CASE WHEN LOWER(status) = 'rejected' THEN 1 ELSE 0 END) AS rejected_count
            FROM enrollments
            WHERE 1=1 {$schoolYearSql}
        ";
        $summaryStmt = $pdo->prepare($summarySql);
        $summaryStmt->execute($schoolYearParams);
        $summary = $summaryStmt->fetch() ?: [];
        $applicationsTotal = (int)($summary['total_applications'] ?? 0);
        $enrolledTotal = (int)($summary['total_enrolled'] ?? 0);
        $pending = (int)($summary['pending_count'] ?? 0);
        $underReview = (int)($summary['review_count'] ?? 0);
        $approved = (int)($summary['approved_count'] ?? 0);
        $rejected = (int)($summary['rejected_count'] ?? 0);

        // Per-strand stats use the same semantics: only in-flight rows count
        // as applications, and approved + enrolled both count as enrolled.
        $strandSql = "
            SELECT
                COALESCE(NULLIF(TRIM(strand), ''), 'Unspecified') AS strand_name,
                SUM(CASE WHEN LOWER(status) IN ('pending', 'under_review', 'under review', 'review') THEN 1 ELSE 0 END) AS total_applications,
                SUM(CASE WHEN LOWER(status) IN ('approved', 'enrolled') THEN 1 ELSE 0 END) AS enrolled_students
            FROM enrollments
            WHERE 1=1 {$schoolYearSql}
            GROUP BY COALESCE(NULLIF(TRIM(strand), ''), 'Unspecified')
            HAVING total_applications > 0 OR enrolled_students > 0
            ORDER BY enrolled_students DESC, strand_name ASC
        ";
        $strandStmt = $pdo->prepare($strandSql);
        $strandStmt->execute($schoolYearParams);
        $strandRows = $strandStmt->fetchAll() ?: [];
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
        'schoolYear' => $schoolYearScope !== '' ? $schoolYearScope : null,
        'schoolYearLabel' => $schoolYearLabel,
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
