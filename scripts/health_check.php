<?php
declare(strict_types=1);

/**
 * Quick stack health check — DB, enrollments, cohorts, physical docs helpers.
 * Usage: php scripts/health_check.php
 */

$root = dirname(__DIR__);
require $root . '/config/database.php';
require $root . '/api/enrollment_status_helpers.php';
require $root . '/api/cohort_helpers.php';
require $root . '/api/physical_docs_helpers.php';
require $root . '/api/school_year_helpers.php';

if (!function_exists('tableExists')) {
    function tableExists(PDO $pdo, string $table): bool
    {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1');
        $stmt->execute([':t' => $table]);
        return (bool)$stmt->fetchColumn();
    }
}
if (!function_exists('columnExists')) {
    function columnExists(PDO $pdo, string $table, string $column): bool
    {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c LIMIT 1');
        $stmt->execute([':t' => $table, ':c' => $column]);
        return (bool)$stmt->fetchColumn();
    }
}

$results = [];

try {
    $dbName = (string)$pdo->query('SELECT DATABASE()')->fetchColumn();
    $results['database'] = ['ok' => true, 'name' => $dbName];
} catch (Throwable $e) {
    $results['database'] = ['ok' => false, 'error' => $e->getMessage()];
    echo json_encode($results, JSON_PRETTY_PRINT) . PHP_EOL;
    exit(1);
}

$requiredTables = ['users', 'enrollments', 'documents', 'enrollment_physical_docs', 'student_cohorts'];
$missing = [];
foreach ($requiredTables as $t) {
    if (!tableExists($pdo, $t)) {
        $missing[] = $t;
    }
}
$results['tables'] = ['ok' => $missing === [], 'missing' => $missing];

try {
    $sy = getEnrollmentSchoolYear($pdo);
    $active = null;
    if (function_exists('getActiveSchoolYear')) {
        $active = getActiveSchoolYear($pdo);
    }
    $results['school_year'] = [
        'ok' => $sy !== null,
        'enrollment_school_year' => $sy,
        'active_school_year' => $active,
    ];
} catch (Throwable $e) {
    $results['school_year'] = ['ok' => false, 'error' => $e->getMessage()];
}

try {
    $counts = cohortCounts($pdo, $sy ?? '');
    $results['cohorts'] = ['ok' => true, 'counts' => $counts];
} catch (Throwable $e) {
    $results['cohorts'] = ['ok' => false, 'error' => $e->getMessage()];
}

try {
    $g12 = $pdo->query(
        "SELECT COUNT(*) FROM enrollments
         WHERE LOWER(status) IN ('enrolled','approved')
           AND grade_level LIKE '%12%'"
    )->fetchColumn();
    $pendingG12 = $pdo->query(
        "SELECT COUNT(*) FROM enrollments e
         WHERE e.grade_level LIKE '%12%'
           AND LOWER(e.status) IN ('pending','under_review','review','draft')
           AND EXISTS (
             SELECT 1 FROM enrollments p
             WHERE p.user_id = e.user_id AND p.id <> e.id
               AND LOWER(p.status) IN ('enrolled','approved')
           )"
    )->fetchColumn();
    $results['grade12_rollover'] = [
        'ok' => true,
        'enrolled_grade12' => (int)$g12,
        'pending_continuation_should_be_zero' => (int)$pendingG12,
    ];
} catch (Throwable $e) {
    $results['grade12_rollover'] = ['ok' => false, 'error' => $e->getMessage()];
}

// Sample user 36 / enrollment 17 if present
try {
    $row = $pdo->query(
        "SELECT e.id, e.user_id, e.grade_level, e.school_year, e.status,
                e.physical_docs_completed_at,
                sc.cohort_type, sc.enrollment_status AS cohort_status
           FROM enrollments e
           LEFT JOIN student_cohorts sc ON sc.enrollment_id = e.id
          WHERE e.id = 17
          LIMIT 1"
    )->fetch(PDO::FETCH_ASSOC);
    $results['sample_enrollment_17'] = $row ?: ['ok' => false, 'note' => 'not found'];
} catch (Throwable $e) {
    $results['sample_enrollment_17'] = ['ok' => false, 'error' => $e->getMessage()];
}

$allOk = ($results['database']['ok'] ?? false)
    && ($results['tables']['ok'] ?? false)
    && ($results['school_year']['ok'] ?? false)
    && ($results['cohorts']['ok'] ?? false)
    && ($results['grade12_rollover']['ok'] ?? false);

$results['overall'] = $allOk ? 'healthy' : 'issues_detected';

echo json_encode($results, JSON_PRETTY_PRINT) . PHP_EOL;
exit($allOk ? 0 : 1);
