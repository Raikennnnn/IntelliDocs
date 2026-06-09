<?php
declare(strict_types=1);

/**
 * Student cohort lists — applicants, enrolled Grade 11, enrolled Grade 12.
 *
 * GET  /api/registrar/cohorts?cohort=applicant|enrolled_grade_11|enrolled_grade_12&school_year=current|all|YYYY-YYYY
 * POST /api/registrar/cohorts  { "action": "rebuild" }  — resync from enrollments
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/cohort_helpers.php';
require_once __DIR__ . '/school_year_helpers.php';
require_once __DIR__ . '/physical_docs_helpers.php';

ini_set('display_errors', '0');
header('Content-Type: application/json');

require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/permission_guard.php';
$actor = apiRequireActor($pdo, 'registrar/cohorts');
$actorId = $actor['id'];
$actorRole = $actor['role'];
if (!in_array($actorRole, ['registrar', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

requireActorPermission($pdo, $actor, 'viewApplications');

cohortMigrateSchema($pdo);
if (cohortTableExists($pdo)) {
    $cohortRowTotal = (int)$pdo->query('SELECT COUNT(*) FROM student_cohorts')->fetchColumn();
    if ($cohortRowTotal === 0) {
        rebuildAllStudentCohorts($pdo);
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }
    $action = strtolower(trim((string)($payload['action'] ?? '')));
    if ($action !== 'rebuild') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Unknown action']);
        exit;
    }
    try {
        $n = rebuildAllStudentCohorts($pdo);
        appLogEvent($pdo, 'cohort_rebuild', 'registrar', 'success', $actorId, 'student_cohorts', 'all', ['rows' => $n]);
        echo json_encode(['success' => true, 'rebuilt' => $n, 'counts' => cohortCounts($pdo)]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to rebuild cohorts']);
    }
    exit;
}

if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$cohortRaw = strtolower(trim((string)($_GET['cohort'] ?? 'all')));
$syRaw = trim((string)($_GET['school_year'] ?? 'current'));

$syFilter = '';
if (strtolower($syRaw) === 'all') {
    $syFilter = '';
} elseif ($syRaw === '' || strtolower($syRaw) === 'current') {
    $ctx = rosterEnrollmentContext($pdo);
    $syFilter = (string)$ctx['school_year'];
} elseif (preg_match('/^\d{4}-\d{4}$/', $syRaw) === 1) {
    $syFilter = $syRaw;
}

try {
    if (!cohortTableExists($pdo)) {
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'error' => 'schema_not_ready',
            'message' => 'Run database_migration_student_cohorts.sql to enable student cohort tables.',
        ]);
        exit;
    }

    $rows = [];
    if ($cohortRaw !== 'all' && in_array($cohortRaw, COHORT_TYPES, true)) {
        $sql = 'SELECT * FROM student_cohorts WHERE cohort_type = :cohort';
        $params = [':cohort' => $cohortRaw];
        if ($syFilter !== '') {
            $sql .= ' AND TRIM(school_year) = :sy';
            $params[':sy'] = $syFilter;
        }
        $sql .= ' ORDER BY display_name ASC, enrollment_id ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rawRows as $row) {
            $enrollmentId = (int)($row['enrollment_id'] ?? 0);
            if ($enrollmentId > 0) {
                reconcileCohortRowIfStale($pdo, $enrollmentId);
            }
        }
        if ($rawRows !== []) {
            $stmt->execute($params);
            $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }
        $physicalDocsCompleteByEnrollment = cohortPhysicalDocsCompleteMap($pdo, $rawRows);
        foreach ($rawRows as $row) {
            $enrollmentId = (int)($row['enrollment_id'] ?? 0);
            $rows[] = [
                'userId' => (int)($row['user_id'] ?? 0),
                'enrollmentId' => $enrollmentId,
                'cohortType' => (string)($row['cohort_type'] ?? ''),
                'fullName' => (string)($row['display_name'] ?? ''),
                'email' => (string)($row['email'] ?? ''),
                'schoolUsername' => $row['school_username'] ?? null,
                'strand' => (string)($row['strand'] ?? ''),
                'gradeLevel' => (string)($row['grade_level'] ?? ''),
                'schoolYear' => (string)($row['school_year'] ?? ''),
                'enrollmentStatus' => (string)($row['enrollment_status'] ?? ''),
                'status' => cohortStatusLabel((string)($row['cohort_type'] ?? ''), (string)($row['enrollment_status'] ?? '')),
                'physicalDocsComplete' => !empty($physicalDocsCompleteByEnrollment[$enrollmentId]),
            ];
        }
    }

    echo json_encode([
        'success' => true,
        'cohort' => $cohortRaw,
        'schoolYearApplied' => $syFilter !== '' ? $syFilter : null,
        'schoolYearLabel' => $syFilter !== '' ? 'SY ' . $syFilter : 'All school years',
        'students' => $rows,
        'counts' => cohortCounts($pdo, $syFilter),
        'cohortTypes' => COHORT_TYPES,
        'features' => [
            'credentials' => enrollmentColumnExists($pdo, 'users', 'school_username'),
        ],
        'filters' => [
            'school_year_options' => cohortSchoolYearOptions($pdo),
            'enrollment_school_year_current' => getEnrollmentSchoolYear($pdo),
        ],
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to load cohorts']);
}

function cohortStatusLabel(string $cohortType, string $rawStatus): string
{
    if ($cohortType === 'applicant') {
        return match (strtolower(trim($rawStatus))) {
            'rejected' => 'Rejected',
            'draft' => 'Draft',
            'under_review', 'under review', 'review' => 'Under Review',
            default => 'Pending',
        };
    }

    return in_array(strtolower(trim($rawStatus)), ['enrolled', 'approved'], true)
        ? 'Enrolled'
        : ucfirst($rawStatus);
}

/**
 * @param list<array<string, mixed>> $cohortRows
 * @return array<int, bool>
 */
function cohortPhysicalDocsCompleteMap(PDO $pdo, array $cohortRows): array
{
    if ($cohortRows === [] || !enrollmentTableExists($pdo, 'enrollments')) {
        return [];
    }

    $enrollmentIds = [];
    foreach ($cohortRows as $row) {
        $cohortType = (string)($row['cohort_type'] ?? '');
        if ($cohortType === 'applicant') {
            continue;
        }
        $enrollmentId = (int)($row['enrollment_id'] ?? 0);
        if ($enrollmentId > 0) {
            $enrollmentIds[$enrollmentId] = true;
        }
    }
    if ($enrollmentIds === []) {
        return [];
    }

    $ids = array_keys($enrollmentIds);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $hasPhysicalComplete = enrollmentColumnExists($pdo, 'enrollments', 'physical_docs_completed_at');
    $physicalCompleteExpr = $hasPhysicalComplete
        ? 'physical_docs_completed_at'
        : 'NULL AS physical_docs_completed_at';
    $stmt = $pdo->prepare(
        "SELECT id AS enrollment_id, status AS enrollment_status, enrollment_steps, {$physicalCompleteExpr}
           FROM enrollments
          WHERE id IN ({$placeholders})"
    );
    $stmt->execute($ids);
    $enrollmentRows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    foreach ($enrollmentRows as $row) {
        $enrollmentId = (int)($row['enrollment_id'] ?? 0);
        if ($enrollmentId > 0) {
            carryForwardPhysicalDocsForEnrollment($pdo, $enrollmentId, $row);
        }
    }

    $completeMap = batchEnrollmentPhysicalDocsComplete($pdo, $enrollmentRows);

    if ($hasPhysicalComplete && enrollmentTableExists($pdo, 'enrollment_physical_docs')) {
        foreach ($enrollmentRows as $row) {
            $enrollmentId = (int)($row['enrollment_id'] ?? 0);
            if ($enrollmentId <= 0 || empty($completeMap[$enrollmentId])) {
                continue;
            }
            if (!empty($row['physical_docs_completed_at'])) {
                continue;
            }
            syncEnrollmentPhysicalDocsCompletion(
                $pdo,
                $enrollmentId,
                null,
                (string)($row['enrollment_steps'] ?? '{}'),
                strtolower(trim((string)($row['enrollment_status'] ?? '')))
            );
        }
    }

    return $completeMap;
}

function reconcileCohortRowIfStale(PDO $pdo, int $enrollmentId): void
{
    if ($enrollmentId <= 0 || !cohortTableExists($pdo) || !enrollmentTableExists($pdo, 'enrollments')) {
        return;
    }

    $stmt = $pdo->prepare(
        'SELECT sc.cohort_type, sc.enrollment_status AS cohort_status,
                e.status AS actual_status, e.grade_level
           FROM student_cohorts sc
           INNER JOIN enrollments e ON e.id = sc.enrollment_id
          WHERE sc.enrollment_id = :id
          LIMIT 1'
    );
    $stmt->execute([':id' => $enrollmentId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return;
    }

    $expected = classifyEnrollmentCohort(
        (string)($row['actual_status'] ?? ''),
        (string)($row['grade_level'] ?? '')
    );
    $cohortType = (string)($row['cohort_type'] ?? '');
    $cohortStatus = strtolower(trim((string)($row['cohort_status'] ?? '')));
    $actualStatus = strtolower(trim((string)($row['actual_status'] ?? '')));

    if ($expected === null) {
        return;
    }

    if ($expected !== $cohortType || $cohortStatus !== $actualStatus) {
        syncStudentCohortForEnrollment($pdo, $enrollmentId);
    }
}
