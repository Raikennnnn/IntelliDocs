<?php
declare(strict_types=1);

/**
 * Registrar sections management.
 *
 *   GET    /api/registrar/sections                 → list sections grouped by strand
 *   GET    /api/registrar/sections?section_id=N    → class list for one section
 *   POST   /api/registrar/sections                 → create a section
 *   DELETE /api/registrar/sections?id=<id>         → delete an EMPTY section
 *
 * A "section" is a class roster bucket inside a strand. Default capacity is
 * 23 boys + 22 girls = 45 students per section, except for the EIM strand
 * which is "boys-first" (girls may still apply if they want; capacity is
 * just shifted toward boys).
 *
 * Sections are linked back to enrolled students via `students.section`
 * (existing VARCHAR column). Per-section boy/girl counts are computed from
 * the join with users.gender so the UI can show "filled X / max" in real
 * time.
 *
 * Auth: X-User-Id must be a registrar or admin.
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/enrollment_status_helpers.php';
require_once __DIR__ . '/school_year_helpers.php';
require_once __DIR__ . '/section_grade_helpers.php';
require_once __DIR__ . '/grade12_continuation_helpers.php';

ini_set('display_errors', '0');
header('Content-Type: application/json');

if (!function_exists('tableExists')) {
    function tableExists(PDO $pdo, string $table): bool
    {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table LIMIT 1');
        $stmt->execute([':table' => $table]);
        return (bool)$stmt->fetchColumn();
    }
}
if (!function_exists('columnExists')) {
    function columnExists(PDO $pdo, string $table, string $column): bool
    {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1');
        $stmt->execute([':table' => $table, ':column' => $column]);
        return (bool)$stmt->fetchColumn();
    }
}

function enrollmentsHasColumn(PDO $pdo, string $column): bool
{
    return tableExists($pdo, 'enrollments') && columnExists($pdo, 'enrollments', $column);
}

function usersHasColumn(PDO $pdo, string $column): bool
{
    return tableExists($pdo, 'users') && columnExists($pdo, 'users', $column);
}

/** @return list<string> */
function sectionRowSelectParts(PDO $pdo): array
{
    $parts = ['id', 'name', 'strand'];
    $parts[] = columnExists($pdo, 'sections', 'shift')
        ? 'shift'
        : ("'" . SECTION_DEFAULT_SHIFT . "' AS shift");
    $parts[] = columnExists($pdo, 'sections', 'grade_level')
        ? 'grade_level'
        : ("'" . SECTION_DEFAULT_GRADE . "' AS grade_level");
    $parts[] = columnExists($pdo, 'sections', 'max_boys')
        ? 'max_boys'
        : (SECTION_DEFAULT_BOYS . ' AS max_boys');
    $parts[] = columnExists($pdo, 'sections', 'max_girls')
        ? 'max_girls'
        : (SECTION_DEFAULT_GIRLS . ' AS max_girls');
    $parts[] = columnExists($pdo, 'sections', 'boys_first')
        ? 'boys_first'
        : '0 AS boys_first';
    $parts[] = columnExists($pdo, 'sections', 'created_at')
        ? 'created_at'
        : 'NULL AS created_at';

    return $parts;
}

function sqlEnrollmentGradeKeyOrDefault(PDO $pdo, string $defaultGrade = SECTION_DEFAULT_GRADE): string
{
    if (enrollmentsHasColumn($pdo, 'grade_level')) {
        return sqlEnrollmentGradeKey('e.grade_level');
    }

    return "'" . normaliseGradeLevel($defaultGrade) . "'";
}

/**
 * Canonical strand keys + their default per-section capacities.
 * Mirrors the strand values used in StudentEnrollment.tsx.
 */
const SECTION_STRANDS = [
    'STEM',
    'HUMSS',
    'ABM',
    'TVL - ICT',
    'TVL - EIM',
    'TVL - BPP/FBS',
];

/** Strands that default to "boys first" rosters (girls may still apply). */
const SECTION_BOYS_FIRST_STRANDS = ['TVL - EIM'];

const SECTION_DEFAULT_BOYS = 23;
const SECTION_DEFAULT_GIRLS = 22;
/** For boys-first strands the entire 45-seat roster is reserved for boys, but the section is still flagged so girls may apply. */
const SECTION_BOYS_FIRST_BOYS = 45;
const SECTION_BOYS_FIRST_GIRLS = 0;

/**
 * Canonical section shift keys. Mirrors the values in StudentEnrollment.tsx
 * `preferredSchedule` ("Morning Shift" / "Afternoon Shift") — normalised to
 * "morning" / "afternoon" so the DB and API can use a stable enum.
 */
const SECTION_SHIFTS = ['morning', 'afternoon'];
const SECTION_DEFAULT_SHIFT = 'morning';

function ensureSectionsSchema(PDO $pdo): void
{
    if (!tableExists($pdo, 'sections')) {
        $pdo->exec(
            "CREATE TABLE sections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                strand VARCHAR(40) NOT NULL,
                shift ENUM('morning','afternoon') NOT NULL DEFAULT '" . SECTION_DEFAULT_SHIFT . "',
                max_boys INT NOT NULL DEFAULT " . SECTION_DEFAULT_BOYS . ",
                max_girls INT NOT NULL DEFAULT " . SECTION_DEFAULT_GIRLS . ",
                boys_first TINYINT(1) NOT NULL DEFAULT 0,
                grade_level VARCHAR(2) NOT NULL DEFAULT '" . SECTION_DEFAULT_GRADE . "',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_section_strand_grade_shift_name (strand, grade_level, shift, name)
            )"
        );
        return;
    }

    $required = [
        'name'       => 'VARCHAR(50) NOT NULL',
        'strand'     => 'VARCHAR(40) NOT NULL',
        'grade_level' => "VARCHAR(2) NOT NULL DEFAULT '" . SECTION_DEFAULT_GRADE . "'",
        'shift'      => "ENUM('morning','afternoon') NOT NULL DEFAULT '" . SECTION_DEFAULT_SHIFT . "'",
        'max_boys'   => 'INT NOT NULL DEFAULT ' . SECTION_DEFAULT_BOYS,
        'max_girls'  => 'INT NOT NULL DEFAULT ' . SECTION_DEFAULT_GIRLS,
        'boys_first' => 'TINYINT(1) NOT NULL DEFAULT 0',
        'created_at' => 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    ];
    foreach ($required as $col => $ddl) {
        if (!columnExists($pdo, 'sections', $col)) {
            try {
                $pdo->exec("ALTER TABLE sections ADD COLUMN {$col} {$ddl}");
            } catch (Throwable $e) {
                // ignore — UI will fall back to defaults if any column is missing
            }
        }
    }

    // The original schema enforced UNIQUE(strand, name). Now that the same
    // name (e.g. "A") can legitimately appear in both shifts, swap the
    // constraint to (strand, name, shift). Safe to run repeatedly — we
    // ignore errors when either the old key is missing or the new one
    // already exists.
    try {
        $pdo->exec('ALTER TABLE sections DROP INDEX uniq_section_strand_name');
    } catch (Throwable $e) {
        // index didn't exist; nothing to drop.
    }
    sectionGradeMigrateSchema($pdo, 'tableExists', 'columnExists');
}

/** Normalise the various shift spellings the frontend may send. */
function normaliseShift(string $raw): string
{
    $g = strtolower(trim($raw));
    // Strip a trailing "shift" so "Morning Shift" → "morning".
    $g = trim(preg_replace('/\s*shift\s*$/i', '', $g) ?? $g);
    if (in_array($g, ['morning', 'am', 'morn', 'm'], true)) {
        return 'morning';
    }
    if (in_array($g, ['afternoon', 'pm', 'noon', 'a'], true)) {
        return 'afternoon';
    }
    return '';
}

function isBoysFirstStrand(string $strand): bool
{
    return in_array($strand, SECTION_BOYS_FIRST_STRANDS, true);
}

function normaliseStrand(string $raw): string
{
    $trim = trim($raw);
    // Match case-insensitively against the canonical list so the registrar
    // can type "stem" or "Tvl - eim" and still hit the canonical bucket.
    foreach (SECTION_STRANDS as $canon) {
        if (strcasecmp($trim, $canon) === 0) {
            return $canon;
        }
    }
    return $trim;
}

/**
 * Resolve which enrollment school year drives roster joins and live counts.
 * Mirrors the registrar Students tab (`school_year=current|all|YYYY-YYYY`).
 */
function resolveSectionsRosterSchoolYear(PDO $pdo, ?string $raw): string
{
    $param = strtolower(trim((string)($raw ?? '')));
    if ($param === 'ongoing') {
        $ongoingSy = getOngoingSchoolYear($pdo);
        if ($ongoingSy !== null && trim($ongoingSy) !== '') {
            return trim($ongoingSy);
        }
        $param = 'current';
    }
    if ($param === '' || $param === 'current') {
        $enrollmentSy = getEnrollmentSchoolYear($pdo);
        if ($enrollmentSy !== null && trim($enrollmentSy) !== '') {
            return trim($enrollmentSy);
        }
        $ongoingSy = getOngoingSchoolYear($pdo);
        if ($ongoingSy !== null && trim($ongoingSy) !== '') {
            return trim($ongoingSy);
        }
        $ctx = rosterEnrollmentContext($pdo);

        return trim((string)($ctx['school_year'] ?? ''));
    }
    if ($param === 'all') {
        return '';
    }

    $normalized = normalizeSchoolYearValue(trim((string)$raw));

    return $normalized ?? trim((string)$raw);
}

require_once __DIR__ . '/api_auth.php';
$actor = apiRequireActor($pdo, 'registrar/sections');
$actorId = $actor['id'];
$role = $actor['role'];
if (!in_array($role, ['registrar', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

require_once __DIR__ . '/permission_guard.php';
requireActorPermission($pdo, $actor, 'viewApplications');

try {
    ensureSectionsSchema($pdo);
} catch (Throwable $e) {
    error_log('registrar_sections schema ensure failed: ' . $e->getMessage());
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

/**
 * SQL expression for a student's class shift (morning / afternoon).
 */
function studentShiftSqlExpr(PDO $pdo): string
{
    $hasEnrollmentSteps = enrollmentsHasColumn($pdo, 'enrollment_steps');
    $afternoonFromSteps = $hasEnrollmentSteps
        ? "e.enrollment_steps LIKE '%\"Afternoon Shift\"%'"
        : '0';
    $hasShiftCol = tableExists($pdo, 'students') && columnExists($pdo, 'students', 'section_shift');
    if ($hasShiftCol) {
        return "CASE
                   WHEN LOWER(TRIM(COALESCE(s.section_shift, ''))) = 'afternoon' THEN 'afternoon'
                   WHEN LOWER(TRIM(COALESCE(s.section_shift, ''))) = 'morning'   THEN 'morning'
                   WHEN {$afternoonFromSteps} THEN 'afternoon'
                   ELSE 'morning'
               END";
    }

    return "CASE
               WHEN {$afternoonFromSteps} THEN 'afternoon'
               ELSE 'morning'
           END";
}

// ---------------------------------------------------------------------------
// GET ?section_id=N — roster (class list) for one section.
// ---------------------------------------------------------------------------
if ($method === 'GET' && (int)($_GET['section_id'] ?? $_GET['id'] ?? 0) > 0) {
    $sectionId = (int)($_GET['section_id'] ?? $_GET['id'] ?? 0);
    $hasEnrollments = tableExists($pdo, 'enrollments');
    try {
        $sectionSql = 'SELECT ' . implode(', ', sectionRowSelectParts($pdo)) . ' FROM sections WHERE id = :id LIMIT 1';
        $secStmt = $pdo->prepare($sectionSql);
        $secStmt->execute([':id' => $sectionId]);
        $sec = $secStmt->fetch(PDO::FETCH_ASSOC);
        if (!$sec) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Section not found']);
            exit;
        }

        $strand = (string)$sec['strand'];
        $name = (string)$sec['name'];
        $shift = strtolower((string)($sec['shift'] ?? SECTION_DEFAULT_SHIFT));
        if (!in_array($shift, SECTION_SHIFTS, true)) {
            $shift = SECTION_DEFAULT_SHIFT;
        }
        $sectionGrade = normaliseGradeLevel((string)($sec['grade_level'] ?? SECTION_DEFAULT_GRADE));
        $gradeKeyExpr = sqlEnrollmentGradeKeyOrDefault($pdo, $sectionGrade);
        $rosterSy = resolveSectionsRosterSchoolYear($pdo, (string)($_GET['school_year'] ?? 'current'));
        $enrollmentJoin = $hasEnrollments
            ? sqlEnrolledEnrollmentJoin('s.user_id', $sectionGrade)
            : 'LEFT JOIN enrollments e ON 1=0';

        $endedSchoolYears = getEndedSchoolYears($pdo);
        $enrollmentSy = getEnrollmentSchoolYear($pdo);
        $students = [];
        if (tableExists($pdo, 'students') && columnExists($pdo, 'students', 'section')) {
            $shiftExpr = studentShiftSqlExpr($pdo);
            $hasLrn = enrollmentsHasColumn($pdo, 'lrn');
            $lrnSelect = $hasLrn ? 'e.lrn' : "''";
            $stepsSelect = enrollmentsHasColumn($pdo, 'enrollment_steps')
                ? 'e.enrollment_steps'
                : "''";
            $gradeLevelSelect = enrollmentsHasColumn($pdo, 'grade_level')
                ? 'e.grade_level'
                : "'' AS grade_level";
            $schoolYearSelect = enrollmentsHasColumn($pdo, 'school_year')
                ? 'e.school_year'
                : "'' AS school_year";
            $selFirstName = usersHasColumn($pdo, 'first_name')
                ? 'u.first_name' : "'' AS first_name";
            $selMiddleName = usersHasColumn($pdo, 'middle_name')
                ? 'u.middle_name' : "'' AS middle_name";
            $selLastName = usersHasColumn($pdo, 'last_name')
                ? 'u.last_name' : "'' AS last_name";
            $selExtensionName = usersHasColumn($pdo, 'extension_name')
                ? 'u.extension_name' : "'' AS extension_name";
            $selSchoolUsername = usersHasColumn($pdo, 'school_username')
                ? 'u.school_username' : "'' AS school_username";
            $strandClause = enrollmentsHasColumn($pdo, 'strand')
                ? "(
                       LOWER(TRIM(COALESCE(e.strand, ''))) = LOWER(TRIM(:strand))
                       OR TRIM(COALESCE(e.strand, '')) = ''
                   )"
                : '1=1';
            $sql = "
                SELECT u.id AS user_id,
                       u.full_name,
                       {$selFirstName},
                       {$selMiddleName},
                       {$selLastName},
                       {$selExtensionName},
                       u.email,
                       u.gender,
                       {$selSchoolUsername},
                       {$gradeLevelSelect},
                       {$schoolYearSelect},
                       {$stepsSelect} AS enrollment_steps,
                       {$lrnSelect} AS lrn,
                       {$shiftExpr} AS resolved_shift
                  FROM students s
            INNER JOIN users u ON u.id = s.user_id
                {$enrollmentJoin}
                 WHERE LOWER(TRIM(s.section)) = LOWER(TRIM(:name))
                   AND {$strandClause}
                   AND {$gradeKeyExpr} = :section_grade
                   " . ($rosterSy !== '' && enrollmentsHasColumn($pdo, 'school_year')
                ? " AND TRIM(COALESCE(e.school_year, '')) = :roster_sy_match"
                : '') . "
              ORDER BY u.id ASC
            ";
            $rosterParams = [
                ':name' => $name,
                ':section_grade' => $sectionGrade,
            ];
            if (enrollmentsHasColumn($pdo, 'strand')) {
                $rosterParams[':strand'] = $strand;
            }
            if ($hasEnrollments) {
                $rosterParams = array_merge(
                    $rosterParams,
                    rosterEnrollmentJoinParams($rosterSy, true, $sectionGrade)
                );
            }
            if ($rosterSy !== '') {
                $rosterParams[':roster_sy_match'] = $rosterSy;
            }
            $rows = pdoFetchAllWithEmulatedPrepares($pdo, $sql, $rosterParams);
            foreach ($rows as $row) {
                $rowShift = strtolower(trim((string)($row['resolved_shift'] ?? 'morning')));
                if ($rowShift !== $shift) {
                    continue;
                }
                $formData = enrollmentStepsFormData((string)($row['enrollment_steps'] ?? ''));
                $userNameRow = [
                    'first_name'      => (string)($row['first_name'] ?? ''),
                    'middle_name'     => (string)($row['middle_name'] ?? ''),
                    'last_name'       => (string)($row['last_name'] ?? ''),
                    'extension_name'  => (string)($row['extension_name'] ?? ''),
                    'full_name'       => (string)($row['full_name'] ?? ''),
                ];
                $nameParts = resolveStudentEnrollmentNameParts($formData, $userNameRow);
                $displayName = studentEnrollmentFormRosterName($formData, $userNameRow);
                $studentSy = trim((string)($row['school_year'] ?? ''));
                $students[] = [
                    'userId'          => (int)($row['user_id'] ?? 0),
                    'fullName'        => $displayName,
                    'sortKey'         => rosterNameSortKey($nameParts),
                    'archived'        => false,
                    'email'           => (string)($row['email'] ?? ''),
                    'gender'          => (string)($row['gender'] ?? ''),
                    'schoolUsername'  => (string)($row['school_username'] ?? ''),
                    'gradeLevel'      => (string)($row['grade_level'] ?? ''),
                    'schoolYear'      => $studentSy,
                    'lrn'             => (string)($row['lrn'] ?? ''),
                ];
            }
            usort(
                $students,
                static function (array $a, array $b): int {
                    return strcmp((string)($a['sortKey'] ?? ''), (string)($b['sortKey'] ?? ''));
                }
            );

            if ($sectionGrade === '11' && $enrollmentSy !== null && $students !== []) {
                try {
                    $userIds = array_map(
                        static fn (array $st): int => (int)($st['userId'] ?? 0),
                        $students
                    );
                    $declinedSet = grade12DeclinedUserIdSet($pdo, $userIds, $enrollmentSy);
                    foreach ($students as &$st) {
                        $uid = (int)($st['userId'] ?? 0);
                        $st['declinedGrade12Continuation'] = isset($declinedSet[$uid]);
                    }
                    unset($st);
                } catch (Throwable $e) {
                    error_log('registrar_sections grade12 decline lookup failed: ' . $e->getMessage());
                }
            }
        }

        $maxBoys = (int)($sec['max_boys'] ?? SECTION_DEFAULT_BOYS);
        $maxGirls = (int)($sec['max_girls'] ?? SECTION_DEFAULT_GIRLS);
        $boys = 0;
        $girls = 0;
        foreach ($students as $st) {
            $g = strtolower(trim((string)($st['gender'] ?? '')));
            if (in_array($g, ['male', 'm', 'boy'], true)) {
                $boys++;
            } elseif (in_array($g, ['female', 'f', 'girl'], true)) {
                $girls++;
            }
        }

        $rosterFlags = applyRosterArchivedFlags($pdo, $students);
        $students = $rosterFlags['students'];
        $rosterSchoolYear = $rosterSy !== ''
            ? $rosterSy
            : (string)$rosterFlags['rosterSchoolYear'];
        $rosterSchoolYearEnded = $rosterSy !== ''
            ? isSchoolYearEnded($pdo, $rosterSy)
            : (bool)$rosterFlags['rosterSchoolYearEnded'];
        $rosterHasArchived = (bool)$rosterFlags['rosterArchived'];

        echo json_encode([
            'success'  => true,
            'section'  => [
                'id'            => (int)$sec['id'],
                'name'          => $name,
                'strand'        => $strand,
                'shift'         => $shift,
                'gradeLevel'    => $sectionGrade,
                'maxBoys'       => $maxBoys,
                'maxGirls'      => $maxGirls,
                'capacity'      => $maxBoys + $maxGirls,
                'boysFirst'     => (int)($sec['boys_first'] ?? 0) === 1,
                'enrolledBoys'  => $boys,
                'enrolledGirls' => $girls,
                'enrolledTotal' => count($students),
                'rosterArchived' => $rosterHasArchived,
                'rosterSchoolYear' => $rosterSchoolYear,
                'rosterSchoolYearEnded' => $rosterSchoolYearEnded,
            ],
            'students' => $students,
            'grade12DeclineSchoolYear' => ($sectionGrade === '11' && $enrollmentSy !== null)
                ? $enrollmentSy
                : null,
            'rosterSchoolYear' => $rosterSchoolYear,
            'rosterSchoolYearEnded' => $rosterSchoolYearEnded,
            'endedSchoolYears' => $endedSchoolYears,
        ]);
        exit;
    } catch (Throwable $e) {
        error_log(
            'registrar_sections class list failed: '
            . $e->getMessage()
            . ' @ '
            . $e->getFile()
            . ':'
            . $e->getLine()
        );
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to load class list']);
        exit;
    }
}

// ---------------------------------------------------------------------------
// GET — return all sections, grouped by strand, with live boy/girl counts.
// ---------------------------------------------------------------------------
if ($method === 'GET') {
    try {
        $listSql = 'SELECT ' . implode(', ', sectionRowSelectParts($pdo)) . '
               FROM sections
              ORDER BY strand ASC,
                       grade_level ASC,
                       CASE WHEN shift = \'morning\' THEN 0 ELSE 1 END ASC,
                       name ASC';
        $sections = $pdo->query($listSql)->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Live counts per (strand, shift, name) from the students table.
        // Joined to users for gender and to enrollments for the strand. The
        // shift comes from `students.section_shift` when present (set by
        // auto-assignment / manual reassignment); otherwise we fall back
        // to a heuristic match against the JSON-encoded
        // enrollment_steps.form_data.preferredSchedule for legacy rows.
        $shiftExpr = studentShiftSqlExpr($pdo);
        $countsByKey = [];
        $gradeKeyExpr = sqlEnrollmentGradeKeyOrDefault($pdo);
        $rosterSy = resolveSectionsRosterSchoolYear($pdo, (string)($_GET['school_year'] ?? 'current'));
        if (tableExists($pdo, 'students') && columnExists($pdo, 'students', 'section')) {
            $enrollmentJoinCounts = tableExists($pdo, 'enrollments')
                ? sqlEnrolledEnrollmentJoin('s.user_id')
                : '';
            $strandKeyExpr = enrollmentsHasColumn($pdo, 'strand')
                ? "LOWER(TRIM(COALESCE(e.strand, '')))"
                : "''";
            $sql = "
                SELECT LOWER(TRIM(s.section)) AS sec_key,
                       {$strandKeyExpr} AS strand_key,
                       {$shiftExpr} AS shift_key,
                       {$gradeKeyExpr} AS grade_key,
                       SUM(CASE WHEN LOWER(TRIM(COALESCE(u.gender, ''))) IN ('male','m','boy') THEN 1 ELSE 0 END) AS boys,
                       SUM(CASE WHEN LOWER(TRIM(COALESCE(u.gender, ''))) IN ('female','f','girl') THEN 1 ELSE 0 END) AS girls,
                       COUNT(*) AS total
                  FROM students s
            INNER JOIN users u       ON u.id = s.user_id
                {$enrollmentJoinCounts}
                 WHERE s.section IS NOT NULL AND TRIM(s.section) <> ''
                   " . ($rosterSy !== '' && enrollmentsHasColumn($pdo, 'school_year')
                ? " AND TRIM(COALESCE(e.school_year, '')) = :roster_sy_match"
                : '') . "
              GROUP BY sec_key, strand_key, shift_key, grade_key
            ";
            try {
                $countParams = [
                    ':roster_sy' => $rosterSy,
                    ':roster_sy_filter' => $rosterSy,
                    ':roster_sy_filter_val' => $rosterSy,
                ];
                if ($rosterSy !== '') {
                    $countParams[':roster_sy_match'] = $rosterSy;
                }
                $countRows = pdoFetchAllWithEmulatedPrepares($pdo, $sql, $countParams);
                foreach ($countRows as $row) {
                    $key = ($row['strand_key'] ?? '') . '|' . ($row['shift_key'] ?? 'morning') . '|'
                        . ($row['grade_key'] ?? SECTION_DEFAULT_GRADE) . '|' . ($row['sec_key'] ?? '');
                    $countsByKey[$key] = [
                        'boys'  => (int)$row['boys'],
                        'girls' => (int)$row['girls'],
                        'total' => (int)$row['total'],
                    ];
                }
            } catch (Throwable $err) {
                // Counts are best-effort; the list still renders without them.
            }
        }

        $payload = [];
        foreach ($sections as $sec) {
            $strand = (string)$sec['strand'];
            $name   = (string)$sec['name'];
            $shift  = strtolower((string)($sec['shift'] ?? SECTION_DEFAULT_SHIFT));
            if (!in_array($shift, SECTION_SHIFTS, true)) {
                $shift = SECTION_DEFAULT_SHIFT;
            }
            $gradeLevel = normaliseGradeLevel((string)($sec['grade_level'] ?? SECTION_DEFAULT_GRADE));
            $key    = strtolower(trim($strand)) . '|' . $shift . '|' . $gradeLevel . '|' . strtolower(trim($name));
            $counts = $countsByKey[$key] ?? ['boys' => 0, 'girls' => 0, 'total' => 0];
            $maxBoys  = (int)($sec['max_boys']  ?? SECTION_DEFAULT_BOYS);
            $maxGirls = (int)($sec['max_girls'] ?? SECTION_DEFAULT_GIRLS);
            $payload[] = [
                'id'         => (int)$sec['id'],
                'name'       => $name,
                'strand'     => $strand,
                'shift'      => $shift,
                'gradeLevel' => $gradeLevel,
                'maxBoys'    => $maxBoys,
                'maxGirls'   => $maxGirls,
                'capacity'   => $maxBoys + $maxGirls,
                'boysFirst'  => (int)($sec['boys_first'] ?? 0) === 1,
                'createdAt'  => (string)($sec['created_at'] ?? ''),
                'enrolledBoys'  => $counts['boys'],
                'enrolledGirls' => $counts['girls'],
                'enrolledTotal' => $counts['total'],
            ];
        }

        echo json_encode([
            'success'   => true,
            'sections'  => $payload,
            'strands'   => SECTION_STRANDS,
            'shifts'    => SECTION_SHIFTS,
            'gradeLevels' => SECTION_GRADE_LEVELS,
            'rosterSchoolYear' => $rosterSy !== '' ? $rosterSy : null,
            'school_year_options' => schoolYearFilterOptions($pdo),
            'enrollment_school_year_current' => getEnrollmentSchoolYear($pdo),
            'ongoing_school_year_current' => getOngoingSchoolYear($pdo),
            'ended_school_years' => getEndedSchoolYears($pdo),
            'defaults'  => [
                'maxBoys'        => SECTION_DEFAULT_BOYS,
                'maxGirls'       => SECTION_DEFAULT_GIRLS,
                'capacity'       => SECTION_DEFAULT_BOYS + SECTION_DEFAULT_GIRLS,
                'boysFirstBoys'  => SECTION_BOYS_FIRST_BOYS,
                'boysFirstGirls' => SECTION_BOYS_FIRST_GIRLS,
                'boysFirstStrands' => SECTION_BOYS_FIRST_STRANDS,
                'shift'          => SECTION_DEFAULT_SHIFT,
            ],
        ]);
        exit;
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to load sections']);
        exit;
    }
}

// ---------------------------------------------------------------------------
// POST — create a section.
// ---------------------------------------------------------------------------
if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $name   = trim((string)($payload['name'] ?? ''));
    $strand = normaliseStrand((string)($payload['strand'] ?? ''));
    $shift  = normaliseShift((string)($payload['shift'] ?? SECTION_DEFAULT_SHIFT));
    if ($shift === '') {
        $shift = SECTION_DEFAULT_SHIFT;
    }

    if ($name === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Section name is required']);
        exit;
    }
    if ($strand === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Strand is required']);
        exit;
    }
    if (mb_strlen($name) > 50) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Section name is too long (max 50 chars)']);
        exit;
    }
    if (!in_array($shift, SECTION_SHIFTS, true)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Shift must be "morning" or "afternoon"']);
        exit;
    }

    $gradeLevel = normaliseGradeLevel((string)($payload['gradeLevel'] ?? $payload['grade_level'] ?? SECTION_DEFAULT_GRADE));
    if (!in_array($gradeLevel, SECTION_GRADE_LEVELS, true)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Grade level must be 11 or 12']);
        exit;
    }

    // Defaults depend on whether this is a "boys-first" strand (EIM today).
    $isBoysFirst = isBoysFirstStrand($strand);
    $maxBoys  = $isBoysFirst ? SECTION_BOYS_FIRST_BOYS  : SECTION_DEFAULT_BOYS;
    $maxGirls = $isBoysFirst ? SECTION_BOYS_FIRST_GIRLS : SECTION_DEFAULT_GIRLS;

    // Allow the registrar to override capacities explicitly when needed.
    if (array_key_exists('maxBoys', $payload) && is_numeric($payload['maxBoys'])) {
        $maxBoys = max(0, (int)$payload['maxBoys']);
    }
    if (array_key_exists('maxGirls', $payload) && is_numeric($payload['maxGirls'])) {
        $maxGirls = max(0, (int)$payload['maxGirls']);
    }
    if ($maxBoys + $maxGirls <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Capacity must be greater than zero']);
        exit;
    }

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO sections (name, strand, shift, grade_level, max_boys, max_girls, boys_first)
             VALUES (:name, :strand, :shift, :grade_level, :max_boys, :max_girls, :boys_first)'
        );
        $stmt->execute([
            ':name'       => $name,
            ':strand'     => $strand,
            ':shift'      => $shift,
            ':grade_level' => $gradeLevel,
            ':max_boys'   => $maxBoys,
            ':max_girls'  => $maxGirls,
            ':boys_first' => $isBoysFirst ? 1 : 0,
        ]);

        $id = (int)$pdo->lastInsertId();
        appLogEvent($pdo, 'section_create', 'registrar', 'success', $actorId, 'section', (string)$id, [
            'name'      => $name,
            'strand'    => $strand,
            'shift'     => $shift,
            'grade_level' => $gradeLevel,
            'max_boys'  => $maxBoys,
            'max_girls' => $maxGirls,
        ]);

        echo json_encode([
            'success' => true,
            'section' => [
                'id'        => $id,
                'name'      => $name,
                'strand'    => $strand,
                'shift'     => $shift,
                'gradeLevel' => $gradeLevel,
                'maxBoys'   => $maxBoys,
                'maxGirls'  => $maxGirls,
                'capacity'  => $maxBoys + $maxGirls,
                'boysFirst' => $isBoysFirst,
                'enrolledBoys'  => 0,
                'enrolledGirls' => 0,
                'enrolledTotal' => 0,
            ],
        ]);
        exit;
    } catch (PDOException $e) {
        // Duplicate (strand, name, shift) — MariaDB error code 23000 / 1062.
        if ($e->getCode() === '23000' || (int)($e->errorInfo[1] ?? 0) === 1062) {
            $shiftLabel = $shift === 'afternoon' ? 'afternoon' : 'morning';
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error'   => "Section \"{$name}\" (Grade {$gradeLevel}, {$shiftLabel}) already exists for {$strand}.",
            ]);
            exit;
        }
        appLogEvent($pdo, 'section_create', 'registrar', 'failed', $actorId, 'section', '0', ['reason' => 'db_error', 'message' => $e->getMessage()]);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to create section']);
        exit;
    }
}

// ---------------------------------------------------------------------------
// DELETE — remove a section, but only if no students are currently assigned.
// ---------------------------------------------------------------------------
if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Invalid section id']);
        exit;
    }

    try {
        $stmt = $pdo->prepare('SELECT id, name, strand, shift FROM sections WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $section = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$section) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Section not found']);
            exit;
        }
        $sectionShift = strtolower((string)($section['shift'] ?? SECTION_DEFAULT_SHIFT));
        if (!in_array($sectionShift, SECTION_SHIFTS, true)) {
            $sectionShift = SECTION_DEFAULT_SHIFT;
        }

        // Refuse to delete a section that still has students assigned to it
        // — the registrar needs to reassign them first. Scope the lookup
        // by shift so a STEM A (morning) can be deleted independently of
        // a STEM A (afternoon) that happens to share the same letter.
        if (tableExists($pdo, 'students') && columnExists($pdo, 'students', 'section')) {
            $shiftMatch = $sectionShift === 'afternoon'
                ? "e.enrollment_steps LIKE '%\"Afternoon Shift\"%'"
                : "(e.enrollment_steps IS NULL OR e.enrollment_steps NOT LIKE '%\"Afternoon Shift\"%')";
            $occ = $pdo->prepare(
                'SELECT COUNT(*) FROM students s
                 LEFT JOIN enrollments e ON e.user_id = s.user_id
                 WHERE LOWER(TRIM(s.section)) = LOWER(TRIM(:name))
                   AND LOWER(TRIM(COALESCE(e.strand, ""))) = LOWER(TRIM(:strand))
                   AND ' . $shiftMatch
            );
            $occ->execute([':name' => $section['name'], ':strand' => $section['strand']]);
            if ((int)$occ->fetchColumn() > 0) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'error'   => 'This section still has students assigned. Reassign them first.',
                ]);
                exit;
            }
        }

        $del = $pdo->prepare('DELETE FROM sections WHERE id = :id LIMIT 1');
        $del->execute([':id' => $id]);
        appLogEvent($pdo, 'section_delete', 'registrar', 'success', $actorId, 'section', (string)$id, [
            'name'   => $section['name'],
            'strand' => $section['strand'],
        ]);
        echo json_encode(['success' => true, 'id' => $id]);
        exit;
    } catch (Throwable $e) {
        appLogEvent($pdo, 'section_delete', 'registrar', 'failed', $actorId, 'section', (string)$id, ['reason' => 'server_error', 'message' => $e->getMessage()]);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to delete section']);
        exit;
    }
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
