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
if (!in_array($actorRole, ['registrar', 'admin'], true)) {
    appLogEvent($pdo, 'registrar_overview', 'registrar', 'failed', $actorId, 'endpoint', 'registrar/overview', [
        'reason' => 'access_denied',
        'role' => $actorRole,
    ]);
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

    require_once __DIR__ . '/school_year_helpers.php';
    $enrollmentYear = trim((string)(getEnrollmentSchoolYear($pdo) ?? ''));
    $ongoingYear = trim((string)(getOngoingSchoolYear($pdo) ?? ''));
    if ($ongoingYear === '') {
        $ongoingYear = $enrollmentYear;
    }

    if ($enrollmentYear !== '' && $ongoingYear !== '' && $enrollmentYear !== $ongoingYear) {
        $schoolYearLabel = 'Ongoing SY ' . $ongoingYear . ' · Accepting enrollments for SY ' . $enrollmentYear;
    } elseif ($ongoingYear !== '') {
        $schoolYearLabel = 'SY ' . $ongoingYear . ' (ongoing)';
    } elseif ($enrollmentYear !== '') {
        $schoolYearLabel = 'SY ' . $enrollmentYear . ' (active enrollment)';
    } else {
        $schoolYearLabel = 'All school years';
    }

    $schoolYearScope = $ongoingYear !== '' ? $ongoingYear : $enrollmentYear;

    if (tableExists($pdo, 'enrollments')) {
        // Application queue totals must match /api/registrar/applications:
        // one latest in-flight row per user (pending/draft/review/rejected), no school-year filter.
        $openAppsJoin = "
            INNER JOIN (
                SELECT user_id, MAX(id) AS latest_id
                FROM enrollments
                WHERE (
                    TRIM(COALESCE(status, '')) = ''
                    OR LOWER(status) IN ('pending', 'under_review', 'under review', 'review', 'rejected', 'draft')
                )
                GROUP BY user_id
            ) open_apps ON open_apps.latest_id = e.id
        ";

        $appSummarySql = "
            SELECT
                COUNT(*) AS total_applications,
                SUM(CASE
                    WHEN TRIM(COALESCE(e.status, '')) = ''
                      OR LOWER(e.status) IN ('pending', 'draft')
                    THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN LOWER(e.status) IN ('under_review', 'under review', 'review') THEN 1 ELSE 0 END) AS review_count,
                SUM(CASE WHEN LOWER(e.status) = 'rejected' THEN 1 ELSE 0 END) AS rejected_count
            FROM enrollments e
            {$openAppsJoin}
        ";
        $appStmt = $pdo->query($appSummarySql);
        $appSummary = $appStmt ? ($appStmt->fetch() ?: []) : [];
        $applicationsTotal = (int)($appSummary['total_applications'] ?? 0);
        $pending = (int)($appSummary['pending_count'] ?? 0);
        $underReview = (int)($appSummary['review_count'] ?? 0);
        $rejected = (int)($appSummary['rejected_count'] ?? 0);

        // Enrolled roster → active enrollment year (same default as Students page).
        $enrollYearSql = '';
        $enrollYearParams = [];
        $enrolledCountYear = $enrollmentYear !== '' ? $enrollmentYear : $ongoingYear;
        if ($enrolledCountYear !== '') {
            $enrollYearSql = " AND TRIM(COALESCE(school_year, '')) = :enroll_sy";
            $enrollYearParams[':enroll_sy'] = $enrolledCountYear;
        }
        $enrollSummarySql = "
            SELECT
                SUM(CASE WHEN LOWER(status) IN ('approved', 'enrolled') THEN 1 ELSE 0 END) AS total_enrolled,
                SUM(CASE WHEN LOWER(status) IN ('approved', 'enrolled') THEN 1 ELSE 0 END) AS approved_count
            FROM enrollments
            WHERE 1=1 {$enrollYearSql}
        ";
        $enrollStmt = $pdo->prepare($enrollSummarySql);
        $enrollStmt->execute($enrollYearParams);
        $enrollSummary = $enrollStmt->fetch() ?: [];
        $enrolledTotal = (int)($enrollSummary['total_enrolled'] ?? 0);
        $approved = (int)($enrollSummary['approved_count'] ?? 0);

        // Per-strand: open applications from the same queue as Applications; enrolled from active enrollment year.
        $strandPendingSql = "
            SELECT
                COALESCE(NULLIF(TRIM(e.strand), ''), 'Unspecified') AS strand_name,
                COUNT(*) AS total_applications
            FROM enrollments e
            {$openAppsJoin}
            GROUP BY COALESCE(NULLIF(TRIM(e.strand), ''), 'Unspecified')
        ";
        $strandPendingStmt = $pdo->query($strandPendingSql);
        $pendingByStrand = [];
        foreach (($strandPendingStmt ? $strandPendingStmt->fetchAll() : []) ?: [] as $row) {
            $pendingByStrand[(string)$row['strand_name']] = (int)$row['total_applications'];
        }

        $strandEnrolledSql = "
            SELECT
                COALESCE(NULLIF(TRIM(strand), ''), 'Unspecified') AS strand_name,
                SUM(CASE WHEN LOWER(status) IN ('approved', 'enrolled') THEN 1 ELSE 0 END) AS enrolled_students
            FROM enrollments
            WHERE 1=1 {$enrollYearSql}
            GROUP BY COALESCE(NULLIF(TRIM(strand), ''), 'Unspecified')
            HAVING enrolled_students > 0
            ORDER BY enrolled_students DESC, strand_name ASC
        ";
        $strandEnrolledStmt = $pdo->prepare($strandEnrolledSql);
        $strandEnrolledStmt->execute($enrollYearParams);
        $enrolledByStrand = [];
        foreach ($strandEnrolledStmt->fetchAll() ?: [] as $row) {
            $enrolledByStrand[(string)$row['strand_name']] = (int)$row['enrolled_students'];
        }
        $strandNames = array_unique(array_merge(array_keys($pendingByStrand), array_keys($enrolledByStrand)));
        foreach ($strandNames as $name) {
            $apps = $pendingByStrand[$name] ?? 0;
            $enrolled = $enrolledByStrand[$name] ?? 0;
            if ($apps > 0 || $enrolled > 0) {
                $byStrand[] = [
                    'name' => $name,
                    'totalApplications' => $apps,
                    'enrolledStudents' => $enrolled,
                ];
            }
        }
        usort($byStrand, static function (array $a, array $b): int {
            $cmp = $b['enrolledStudents'] <=> $a['enrolledStudents'];
            return $cmp !== 0 ? $cmp : strcmp($a['name'], $b['name']);
        });
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
        'enrollmentSchoolYear' => $enrollmentYear !== '' ? $enrollmentYear : null,
        'ongoingSchoolYear' => $ongoingYear !== '' ? $ongoingYear : null,
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
