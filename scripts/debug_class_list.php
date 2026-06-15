<?php
declare(strict_types=1);

/**
 * CLI smoke test for GET /api/registrar/sections?section_id=N class list query.
 * Usage: php scripts/debug_class_list.php [section_id]
 */

require __DIR__ . '/../config/database.php';
require __DIR__ . '/../api/school_year_helpers.php';
require __DIR__ . '/../api/section_grade_helpers.php';
require __DIR__ . '/../api/enrollment_status_helpers.php';
require __DIR__ . '/../api/grade12_continuation_helpers.php';

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table LIMIT 1');
    $stmt->execute([':table' => $table]);

    return (bool)$stmt->fetchColumn();
}

function columnExists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1');
    $stmt->execute([':table' => $table, ':column' => $column]);

    return (bool)$stmt->fetchColumn();
}

function studentShiftSqlExpr(PDO $pdo): string
{
    $hasShiftCol = tableExists($pdo, 'students') && columnExists($pdo, 'students', 'section_shift');

    return $hasShiftCol
        ? "CASE
               WHEN LOWER(TRIM(COALESCE(s.section_shift, ''))) = 'afternoon' THEN 'afternoon'
               WHEN LOWER(TRIM(COALESCE(s.section_shift, ''))) = 'morning'   THEN 'morning'
               WHEN e.enrollment_steps LIKE '%\"Afternoon Shift\"%' THEN 'afternoon'
               ELSE 'morning'
           END"
        : "CASE
               WHEN e.enrollment_steps LIKE '%\"Afternoon Shift\"%' THEN 'afternoon'
               ELSE 'morning'
           END";
}

$sectionId = (int)($argv[1] ?? 0);
if ($sectionId <= 0) {
    $sectionId = (int)($pdo->query('SELECT id FROM sections ORDER BY id ASC LIMIT 1')->fetchColumn() ?: 0);
}
if ($sectionId <= 0) {
    echo "No sections in database\n";
    exit(1);
}

$secStmt = $pdo->prepare('SELECT * FROM sections WHERE id = :id LIMIT 1');
$secStmt->execute([':id' => $sectionId]);
$sec = $secStmt->fetch(PDO::FETCH_ASSOC);
if (!$sec) {
    echo "Section not found\n";
    exit(1);
}

echo 'Section: ' . json_encode($sec) . PHP_EOL;

$name = (string)$sec['name'];
$strand = (string)$sec['strand'];
$shift = strtolower((string)($sec['shift'] ?? 'morning'));
$sectionGrade = normaliseGradeLevel((string)($sec['grade_level'] ?? '11'));
$gradeKeyExpr = sqlEnrollmentGradeKey('e.grade_level');
$rosterSy = getEnrollmentSchoolYear($pdo) ?? '';
$hasEnrollments = tableExists($pdo, 'enrollments');
$enrollmentJoin = $hasEnrollments
    ? sqlEnrolledEnrollmentJoin('s.user_id', $sectionGrade)
    : 'LEFT JOIN enrollments e ON 1=0';
$shiftExpr = studentShiftSqlExpr($pdo);

$sql = "
    SELECT u.id AS user_id,
           u.full_name,
           u.gender,
           e.grade_level,
           e.school_year,
           e.enrollment_steps,
           {$shiftExpr} AS resolved_shift
      FROM students s
INNER JOIN users u ON u.id = s.user_id
    {$enrollmentJoin}
     WHERE LOWER(TRIM(s.section)) = LOWER(TRIM(:name))
       AND (
           LOWER(TRIM(COALESCE(e.strand, ''))) = LOWER(TRIM(:strand))
           OR TRIM(COALESCE(e.strand, '')) = ''
       )
       AND {$gradeKeyExpr} = :section_grade
";
$params = [
    ':name' => $name,
    ':strand' => $strand,
    ':section_grade' => $sectionGrade,
];
if ($hasEnrollments) {
    $params = array_merge($params, rosterEnrollmentJoinParams($rosterSy, true, $sectionGrade));
}
if ($rosterSy !== '') {
    $sql .= " AND TRIM(COALESCE(e.school_year, '')) = :roster_sy_match";
    $params[':roster_sy_match'] = $rosterSy;
}
$sql .= ' ORDER BY u.id ASC';

echo 'rosterSy=' . $rosterSy . PHP_EOL;

try {
    $rows = pdoFetchAllWithEmulatedPrepares($pdo, $sql, $params);
    echo 'emulated count=' . count($rows) . PHP_EOL;
} catch (Throwable $e) {
    echo 'emulated ERROR: ' . $e->getMessage() . PHP_EOL;
    exit(1);
}

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    echo 'native count=' . count($stmt->fetchAll(PDO::FETCH_ASSOC)) . PHP_EOL;
} catch (Throwable $e) {
    echo 'native ERROR: ' . $e->getMessage() . PHP_EOL;
}

try {
    grade12DeclineMigrateSchema($pdo);
    echo "grade12DeclineMigrateSchema OK\n";
} catch (Throwable $e) {
    echo 'grade12DeclineMigrateSchema ERROR: ' . $e->getMessage() . PHP_EOL;
}

try {
    $ended = getEndedSchoolYears($pdo);
    echo 'endedSchoolYears=' . json_encode($ended) . PHP_EOL;
} catch (Throwable $e) {
    echo 'getEndedSchoolYears ERROR: ' . $e->getMessage() . PHP_EOL;
}

echo "done\n";
