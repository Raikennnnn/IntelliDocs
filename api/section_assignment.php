<?php
declare(strict_types=1);

/**
 * Auto-assignment of an approved student into a section.
 *
 * Rules (per registrar request):
 *   1. When the registrar approves a student, place them into the first
 *      non-full section for their strand and gender (sections sorted by
 *      name ascending — A, B, C, …).
 *   2. When every existing section for that strand is full, automatically
 *      create the next section using the next free letter (A → B → C → …).
 *   3. Special case for the "TECHPRO - IT" strand: it is boys-first. A male
 *      student is auto-assigned as usual; a female student is NOT
 *      auto-assigned — instead we return a warning so the registrar can
 *      manually place her (so the registrar consciously decides whether to
 *      open the boys-first section or create a separate roster).
 *
 * The function does not touch the credentials transaction; it runs after
 * the approve transaction has committed and a failure here is non-fatal —
 * the caller surfaces a warning instead of rolling back approval.
 */

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

/** Strands where the entire roster is reserved for boys by default. */
const SECTION_BOYS_FIRST_STRAND_LIST = ['TECHPRO - IT', 'TVL - EIM'];
const SECTION_AUTO_DEFAULT_BOYS = 23;
const SECTION_AUTO_DEFAULT_GIRLS = 22;
const SECTION_AUTO_BOYS_FIRST_BOYS = 45;
const SECTION_AUTO_BOYS_FIRST_GIRLS = 0;
/** Mirrors registrar_sections.php SECTION_SHIFTS. Kept duplicated so this
 *  file is self-contained when included by registrar_application_detail.php
 *  (registrar_sections.php is loaded only by the sections endpoint). */
const SECTION_ASSIGN_SHIFTS = ['morning', 'afternoon'];
const SECTION_ASSIGN_DEFAULT_SHIFT = 'morning';

/**
 * Make sure the `sections` table exists and `students.section` is wide
 * enough for friendly section names ("Rose", "Mahogany", …). Idempotent.
 */
function ensureSectionAssignmentSchema(PDO $pdo): void
{
    if (!tableExists($pdo, 'sections')) {
        $pdo->exec(
            "CREATE TABLE sections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                strand VARCHAR(40) NOT NULL,
                shift ENUM('morning','afternoon') NOT NULL DEFAULT '" . SECTION_ASSIGN_DEFAULT_SHIFT . "',
                max_boys INT NOT NULL DEFAULT " . SECTION_AUTO_DEFAULT_BOYS . ",
                max_girls INT NOT NULL DEFAULT " . SECTION_AUTO_DEFAULT_GIRLS . ",
                boys_first TINYINT(1) NOT NULL DEFAULT 0,
                grade_level VARCHAR(2) NOT NULL DEFAULT '11',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_section_strand_grade_shift_name (strand, grade_level, shift, name)
            )"
        );
    }

    if (!function_exists('sectionGradeMigrateSchema')) {
        require_once __DIR__ . '/section_grade_helpers.php';
    }
    sectionGradeMigrateSchema($pdo, 'tableExists', 'columnExists');

    // Add the shift column on pre-existing tables so this helper works even
    // when the schema migration hasn't been triggered by the sections page
    // yet. Idempotent.
    if (!columnExists($pdo, 'sections', 'shift')) {
        try {
            $pdo->exec("ALTER TABLE sections ADD COLUMN shift ENUM('morning','afternoon') NOT NULL DEFAULT '" . SECTION_ASSIGN_DEFAULT_SHIFT . "'");
        } catch (Throwable $e) {
            // Non-fatal — autoAssign will treat missing shifts as the default.
        }
    }

    // Create the `students` roster table on the fly when missing. Some
    // databases were bootstrapped before this table existed, so the
    // auto-assignment helper would otherwise crash on the first INSERT.
    // The shape mirrors database_setup.sql (with the wider `section`
    // column and the new `section_shift` field already in place).
    if (!tableExists($pdo, 'students')) {
        try {
            $pdo->exec(
                "CREATE TABLE students (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT,
                    student_number VARCHAR(20) UNIQUE,
                    grade_level VARCHAR(10),
                    section VARCHAR(50) NULL,
                    section_shift ENUM('morning','afternoon') NULL,
                    status ENUM('active','pending','inactive') DEFAULT 'pending',
                    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_students_user (user_id)
                )"
            );
        } catch (Throwable $e) {
            // Non-fatal: callers that need the table will surface a clear error.
        }
    } else {
        // Widen `students.section` if it was created with the old VARCHAR(10).
        // Safe to run repeatedly — MariaDB no-ops the MODIFY when the column
        // is already this shape.
        if (columnExists($pdo, 'students', 'section')) {
            try {
                $pdo->exec('ALTER TABLE students MODIFY COLUMN section VARCHAR(50) NULL');
            } catch (Throwable $e) {
                // Non-fatal: any failure just means we keep the existing column shape.
            }
        } else {
            try {
                $pdo->exec('ALTER TABLE students ADD COLUMN section VARCHAR(50) NULL');
            } catch (Throwable $e) {
                // Non-fatal.
            }
        }

        // Persist the chosen shift directly on the student row so a
        // registrar reassignment can put them in a different shift WITHOUT
        // us having to rewrite their original `preferredSchedule` form data.
        if (!columnExists($pdo, 'students', 'section_shift')) {
            try {
                $pdo->exec("ALTER TABLE students ADD COLUMN section_shift ENUM('morning','afternoon') NULL");
            } catch (Throwable $e) {
                // Non-fatal: counts will fall back to the form_data heuristic.
            }
        }
    }
}

/** True for strands that default to boys-first rosters (EIM today). */
function isBoysFirstStrandFor(string $strand): bool
{
    if (!function_exists('isBoysFirstStrandCode')) {
        require_once __DIR__ . '/strand_helpers.php';
    }

    return isBoysFirstStrandCode($strand);
}

/** Normalise gender strings to "male", "female", or "" for unknown. */
function normaliseGender(string $raw): string
{
    $g = strtolower(trim($raw));
    if (in_array($g, ['male', 'm', 'boy'], true)) {
        return 'male';
    }
    if (in_array($g, ['female', 'f', 'girl'], true)) {
        return 'female';
    }
    return '';
}

/**
 * Normalise the various spellings the enrollment form sends for shift
 * preference ("Morning Shift", "morning", "AM", …) to the canonical
 * "morning" / "afternoon" enum, or "" when unknown.
 */
function normaliseAssignmentShift(string $raw): string
{
    $g = strtolower(trim($raw));
    $g = trim(preg_replace('/\s*shift\s*$/i', '', $g) ?? $g);
    if (in_array($g, ['morning', 'am', 'morn', 'm'], true)) {
        return 'morning';
    }
    if (in_array($g, ['afternoon', 'pm', 'noon', 'a'], true)) {
        return 'afternoon';
    }
    return '';
}

/**
 * Pick the next single-letter section name (A, B, …, Z) for a strand+shift
 * combination that isn't already in use. Scoping by shift lets us have a
 * "STEM A (morning)" and a "STEM A (afternoon)" living side-by-side.
 *
 * Falls back to the next sequential letter even when existing sections use
 * words ("Rose", "Mahogany") so auto-create never collides with manual
 * names within the same shift.
 */
function nextSectionLetterFor(
    PDO $pdo,
    string $strand,
    string $shift = SECTION_ASSIGN_DEFAULT_SHIFT,
    string $gradeLevel = SECTION_DEFAULT_GRADE
): string {
    $hasShiftColumn = columnExists($pdo, 'sections', 'shift');
    $hasGradeColumn = columnExists($pdo, 'sections', 'grade_level');
    if ($hasShiftColumn && $hasGradeColumn) {
        $stmt = $pdo->prepare(
            'SELECT name FROM sections WHERE strand = :strand AND shift = :shift AND grade_level = :grade'
        );
        $stmt->execute([':strand' => $strand, ':shift' => $shift, ':grade' => $gradeLevel]);
    } elseif ($hasShiftColumn) {
        $stmt = $pdo->prepare('SELECT name FROM sections WHERE strand = :strand AND shift = :shift');
        $stmt->execute([':strand' => $strand, ':shift' => $shift]);
    } else {
        $stmt = $pdo->prepare('SELECT name FROM sections WHERE strand = :strand');
        $stmt->execute([':strand' => $strand]);
    }
    $names = array_column($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [], 'name');

    $used = [];
    foreach ($names as $n) {
        $up = strtoupper(trim((string)$n));
        if (preg_match('/^[A-Z]$/', $up)) {
            $used[$up] = true;
        }
    }

    for ($i = 0; $i < 26; $i++) {
        $letter = chr(65 + $i); // A..Z
        if (!isset($used[$letter])) {
            return $letter;
        }
    }
    // Exhausted A..Z. Fall back to AA, AB, … so we never collide.
    for ($i = 0; $i < 26; $i++) {
        for ($j = 0; $j < 26; $j++) {
            $cand = chr(65 + $i) . chr(65 + $j);
            if (!isset($used[$cand])) {
                return $cand;
            }
        }
    }
    return 'AA-' . time();
}

/**
 * Upsert the user's section assignment on the students table. Creates the
 * row when missing so the auto-assignment doesn't silently no-op for users
 * who never had a students record before. Also persists the chosen shift
 * when the `section_shift` column is present.
 */
function upsertStudentSectionForUser(PDO $pdo, int $userId, string $section, ?string $shift = null): void
{
    $hasShiftCol = columnExists($pdo, 'students', 'section_shift');
    $normShift = $shift !== null ? normaliseAssignmentShift($shift) : '';
    if ($normShift === '') {
        $normShift = null;
    }

    $sel = $pdo->prepare('SELECT id FROM students WHERE user_id = :uid LIMIT 1');
    $sel->execute([':uid' => $userId]);
    $row = $sel->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        if ($hasShiftCol && $normShift !== null) {
            $upd = $pdo->prepare('UPDATE students SET section = :sec, section_shift = :sh WHERE id = :id LIMIT 1');
            $upd->execute([':sec' => $section, ':sh' => $normShift, ':id' => (int)$row['id']]);
        } else {
            $upd = $pdo->prepare('UPDATE students SET section = :sec WHERE id = :id LIMIT 1');
            $upd->execute([':sec' => $section, ':id' => (int)$row['id']]);
        }
        return;
    }
    // Insert minimum viable row (status="active") so existing list views
    // that count from students.* pick up the new row immediately.
    if ($hasShiftCol && $normShift !== null) {
        $ins = $pdo->prepare(
            'INSERT INTO students (user_id, section, section_shift, status)
             VALUES (:uid, :sec, :sh, "active")'
        );
        $ins->execute([':uid' => $userId, ':sec' => $section, ':sh' => $normShift]);
    } else {
        $ins = $pdo->prepare(
            'INSERT INTO students (user_id, section, status)
             VALUES (:uid, :sec, "active")'
        );
        $ins->execute([':uid' => $userId, ':sec' => $section]);
    }
}

/**
 * Auto-assign a freshly-approved student to the first non-full section for
 * their strand+gender, preferring the student's requested shift (morning
 * or afternoon, taken from the enrollment form's `preferredSchedule`).
 *
 * If no section in the preferred shift has a seat, we fall back to the
 * other shift so an approval is never silently blocked — but the response
 * flags `shift_fallback` so the registrar knows the student didn't get
 * their first choice. Creates a new section if every section in both
 * shifts is full.
 *
 * Always returns a result array — callers should NOT throw on failure;
 * instead surface the warning to the registrar.
 *
 * Return shape:
 *   [
 *     'assigned'         => bool,
 *     'section'          => string|null,    // chosen section name (e.g. "A")
 *     'strand'           => string,
 *     'shift'            => string|null,    // 'morning' | 'afternoon' | null
 *     'preferred_shift'  => string|null,    // shift the student asked for
 *     'shift_fallback'   => bool,           // true when we placed them outside their preference
 *     'auto_created'     => bool,           // true when we had to make a new section
 *     'warning'          => string|null,    // e.g. "eim_female_manual_placement"
 *     'reason'           => string|null,    // short machine-readable status
 *   ]
 */
function autoAssignSectionForApprovedStudent(
    PDO $pdo,
    int $userId,
    string $rawStrand,
    string $rawGender,
    string $rawPreferredShift = '',
    string $rawGradeLevel = ''
): array {
    require_once __DIR__ . '/section_grade_helpers.php';
    $strand = trim($rawStrand);
    $gender = normaliseGender($rawGender);
    $preferredShift = normaliseAssignmentShift($rawPreferredShift);
    $gradeLevel = normaliseGradeLevel($rawGradeLevel);
    if ($preferredShift === '') {
        $preferredShift = SECTION_ASSIGN_DEFAULT_SHIFT;
    }

    $result = [
        'assigned'        => false,
        'section'         => null,
        'strand'          => $strand,
        'grade_level'     => $gradeLevel,
        'shift'           => null,
        'preferred_shift' => $preferredShift,
        'shift_fallback'  => false,
        'auto_created'    => false,
        'warning'         => null,
        'reason'          => null,
    ];

    if ($strand === '') {
        $result['warning'] = 'strand_missing';
        $result['reason']  = 'No strand on this enrollment — section assignment skipped.';
        return $result;
    }

    try {
        ensureSectionAssignmentSchema($pdo);
    } catch (Throwable $e) {
        $result['warning'] = 'schema_error';
        $result['reason']  = 'Could not prepare sections table.';
        return $result;
    }

    // EIM-girls exception per registrar policy: don't auto-place; warn instead.
    if (isBoysFirstStrandFor($strand) && $gender === 'female') {
        $result['warning'] = 'eim_female_manual_placement';
        $result['reason']  = 'Girls applying to EIM need manual section placement by the registrar.';
        return $result;
    }

    // Pull existing sections for this strand along with their current
    // boy/girl counts so we can pick the first one that still has a seat
    // for this student's gender. Pre-select the preferred shift first so
    // the loop scans those before falling back to the other shift.
    $hasShiftColumn = columnExists($pdo, 'sections', 'shift');
    $hasGradeColumn = columnExists($pdo, 'sections', 'grade_level');
    $gradeKeyExpr = sqlEnrollmentGradeKey('e2.grade_level');
    try {
        if ($hasShiftColumn && $hasGradeColumn) {
            $sql = "
                SELECT s.id, s.name, s.shift, s.grade_level, s.max_boys, s.max_girls, s.boys_first,
                       COALESCE(c.boys, 0)  AS boys_count,
                       COALESCE(c.girls, 0) AS girls_count
                  FROM sections s
             LEFT JOIN (
                    SELECT LOWER(TRIM(s2.section)) AS sec_key,
                           LOWER(TRIM(COALESCE(e2.strand, ''))) AS strand_key,
                           CASE
                               WHEN e2.enrollment_steps LIKE '%\"Afternoon Shift\"%' THEN 'afternoon'
                               ELSE 'morning'
                           END AS shift_key,
                           {$gradeKeyExpr} AS grade_key,
                           SUM(CASE WHEN LOWER(TRIM(COALESCE(u2.gender, ''))) IN ('male','m','boy') THEN 1 ELSE 0 END) AS boys,
                           SUM(CASE WHEN LOWER(TRIM(COALESCE(u2.gender, ''))) IN ('female','f','girl') THEN 1 ELSE 0 END) AS girls
                      FROM students s2
                INNER JOIN users u2       ON u2.id = s2.user_id
                 LEFT JOIN enrollments e2 ON e2.user_id = u2.id
                     WHERE s2.section IS NOT NULL AND TRIM(s2.section) <> ''
                  GROUP BY sec_key, strand_key, shift_key, grade_key
                ) c
                    ON LOWER(TRIM(s.name))   = c.sec_key
                   AND LOWER(TRIM(s.strand)) = c.strand_key
                   AND LOWER(TRIM(s.shift))  = c.shift_key
                   AND s.grade_level = c.grade_key
                 WHERE s.strand = :strand
                   AND s.grade_level = :grade
              ORDER BY CASE WHEN s.shift = :preferred THEN 0 ELSE 1 END ASC,
                       s.name ASC
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':strand' => $strand, ':preferred' => $preferredShift, ':grade' => $gradeLevel]);
        } else {
            // Legacy schema (no shift column). Fall back to gender-only matching.
            $sql = "
                SELECT s.id, s.name, s.max_boys, s.max_girls, s.boys_first,
                       COALESCE(c.boys, 0)  AS boys_count,
                       COALESCE(c.girls, 0) AS girls_count
                  FROM sections s
             LEFT JOIN (
                    SELECT LOWER(TRIM(s2.section)) AS sec_key,
                           LOWER(TRIM(COALESCE(e2.strand, ''))) AS strand_key,
                           SUM(CASE WHEN LOWER(TRIM(COALESCE(u2.gender, ''))) IN ('male','m','boy') THEN 1 ELSE 0 END) AS boys,
                           SUM(CASE WHEN LOWER(TRIM(COALESCE(u2.gender, ''))) IN ('female','f','girl') THEN 1 ELSE 0 END) AS girls
                      FROM students s2
                INNER JOIN users u2       ON u2.id = s2.user_id
                 LEFT JOIN enrollments e2 ON e2.user_id = u2.id
                     WHERE s2.section IS NOT NULL AND TRIM(s2.section) <> ''
                  GROUP BY sec_key, strand_key
                ) c
                    ON LOWER(TRIM(s.name))   = c.sec_key
                   AND LOWER(TRIM(s.strand)) = c.strand_key
                 WHERE s.strand = :strand
              ORDER BY s.name ASC
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':strand' => $strand]);
        }
        $sections = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    } catch (Throwable $e) {
        $result['warning'] = 'lookup_failed';
        $result['reason']  = 'Could not list sections for strand.';
        return $result;
    }

    // Helper closure to pick the first section in a candidate list with a
    // seat for this student's gender.
    $pickFromCandidates = static function (array $candidates, string $gender) {
        foreach ($candidates as $sec) {
            $boysSeats  = (int)$sec['max_boys']  - (int)$sec['boys_count'];
            $girlsSeats = (int)$sec['max_girls'] - (int)$sec['girls_count'];
            if ($gender === 'male' && $boysSeats > 0) {
                return $sec;
            }
            if ($gender === 'female' && $girlsSeats > 0) {
                return $sec;
            }
            if ($gender === '' && ($boysSeats + $girlsSeats) > 0) {
                return $sec;
            }
        }
        return null;
    };

    // First pass: only the preferred shift. Second pass: everything else
    // (used to detect when we had to fall back to the wrong shift).
    $preferredCandidates = [];
    $fallbackCandidates  = [];
    foreach ($sections as $sec) {
        $secShift = $hasShiftColumn
            ? strtolower((string)($sec['shift'] ?? SECTION_ASSIGN_DEFAULT_SHIFT))
            : SECTION_ASSIGN_DEFAULT_SHIFT;
        if ($secShift === $preferredShift) {
            $preferredCandidates[] = $sec;
        } else {
            $fallbackCandidates[] = $sec;
        }
    }

    $chosen = $pickFromCandidates($preferredCandidates, $gender);
    $chosenShift = $preferredShift;

    if (!$chosen && !empty($fallbackCandidates)) {
        $chosen = $pickFromCandidates($fallbackCandidates, $gender);
        if ($chosen) {
            // Picked a non-preferred section — surface this so the
            // registrar can offer to move the student later.
            $chosenShift = $hasShiftColumn
                ? strtolower((string)($chosen['shift'] ?? SECTION_ASSIGN_DEFAULT_SHIFT))
                : SECTION_ASSIGN_DEFAULT_SHIFT;
            $result['shift_fallback'] = true;
        }
    }

    // No room in any existing section → automatically create the next one
    // in the student's preferred shift so their request is honoured.
    if (!$chosen) {
        try {
            $newName   = nextSectionLetterFor($pdo, $strand, $preferredShift, $gradeLevel);
            $boysFirst = isBoysFirstStrandFor($strand);
            $maxBoys   = $boysFirst ? SECTION_AUTO_BOYS_FIRST_BOYS  : SECTION_AUTO_DEFAULT_BOYS;
            $maxGirls  = $boysFirst ? SECTION_AUTO_BOYS_FIRST_GIRLS : SECTION_AUTO_DEFAULT_GIRLS;

            if ($hasShiftColumn && $hasGradeColumn) {
                $ins = $pdo->prepare(
                    'INSERT INTO sections (name, strand, shift, grade_level, max_boys, max_girls, boys_first)
                     VALUES (:n, :st, :sh, :gr, :mb, :mg, :bf)'
                );
                $ins->execute([
                    ':n'  => $newName,
                    ':st' => $strand,
                    ':sh' => $preferredShift,
                    ':gr' => $gradeLevel,
                    ':mb' => $maxBoys,
                    ':mg' => $maxGirls,
                    ':bf' => $boysFirst ? 1 : 0,
                ]);
            } elseif ($hasShiftColumn) {
                $ins = $pdo->prepare(
                    'INSERT INTO sections (name, strand, shift, max_boys, max_girls, boys_first)
                     VALUES (:n, :st, :sh, :mb, :mg, :bf)'
                );
                $ins->execute([
                    ':n'  => $newName,
                    ':st' => $strand,
                    ':sh' => $preferredShift,
                    ':mb' => $maxBoys,
                    ':mg' => $maxGirls,
                    ':bf' => $boysFirst ? 1 : 0,
                ]);
            } else {
                $ins = $pdo->prepare(
                    'INSERT INTO sections (name, strand, max_boys, max_girls, boys_first)
                     VALUES (:n, :st, :mb, :mg, :bf)'
                );
                $ins->execute([
                    ':n'  => $newName,
                    ':st' => $strand,
                    ':mb' => $maxBoys,
                    ':mg' => $maxGirls,
                    ':bf' => $boysFirst ? 1 : 0,
                ]);
            }

            $chosen = [
                'id'          => (int)$pdo->lastInsertId(),
                'name'        => $newName,
                'shift'       => $preferredShift,
                'max_boys'    => $maxBoys,
                'max_girls'   => $maxGirls,
                'boys_first'  => $boysFirst ? 1 : 0,
                'boys_count'  => 0,
                'girls_count' => 0,
            ];
            $chosenShift = $preferredShift;
            $result['auto_created'] = true;
        } catch (Throwable $e) {
            $result['warning'] = 'auto_create_failed';
            $result['reason']  = 'Could not auto-create the next section.';
            return $result;
        }
    }

    // Persist the section assignment on the students row.
    try {
        upsertStudentSectionForUser($pdo, $userId, (string)$chosen['name'], $chosenShift);
        $result['assigned'] = true;
        $result['section']  = (string)$chosen['name'];
        $result['shift']    = $chosenShift;
        return $result;
    } catch (Throwable $e) {
        $result['warning'] = 'persist_failed';
        $result['reason']  = 'Could not save section on the students row.';
        return $result;
    }
}

/** Human label used on the enrollment form from a canonical shift enum. */
function assignmentShiftToFormLabel(string $shift): string
{
    return normaliseAssignmentShift($shift) === 'afternoon' ? 'Afternoon Shift' : 'Morning Shift';
}

/**
 * @return array{section: string|null, shift: string|null}
 */
function fetchStudentSectionAssignment(PDO $pdo, int $userId): array
{
    if ($userId <= 0 || !tableExists($pdo, 'students')) {
        return ['section' => null, 'shift' => null];
    }

    ensureSectionAssignmentSchema($pdo);
    $hasShiftCol = columnExists($pdo, 'students', 'section_shift');
    $cols = $hasShiftCol ? 'section, section_shift' : 'section';
    $stmt = $pdo->prepare("SELECT {$cols} FROM students WHERE user_id = :uid LIMIT 1");
    $stmt->execute([':uid' => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || !is_array($row)) {
        return ['section' => null, 'shift' => null];
    }

    $section = trim((string)($row['section'] ?? ''));
    $shift = $hasShiftCol
        ? normaliseAssignmentShift((string)($row['section_shift'] ?? ''))
        : '';

    return [
        'section' => $section !== '' ? $section : null,
        'shift' => $shift !== '' ? $shift : null,
    ];
}

/**
 * @return array<int, array<string, mixed>>
 */
function listSectionsWithGenderCounts(
    PDO $pdo,
    string $strand,
    string $gradeLevel,
    ?string $shiftFilter = null
): array {
    require_once __DIR__ . '/section_grade_helpers.php';
    $gradeLevel = normaliseGradeLevel($gradeLevel);
    $hasShiftColumn = columnExists($pdo, 'sections', 'shift');
    $hasGradeColumn = columnExists($pdo, 'sections', 'grade_level');
    $gradeKeyExpr = sqlEnrollmentGradeKey('e2.grade_level');

    if ($hasShiftColumn && $hasGradeColumn) {
        $sql = "
            SELECT s.id, s.name, s.shift, s.grade_level, s.max_boys, s.max_girls, s.boys_first,
                   COALESCE(c.boys, 0)  AS boys_count,
                   COALESCE(c.girls, 0) AS girls_count
              FROM sections s
         LEFT JOIN (
                SELECT LOWER(TRIM(s2.section)) AS sec_key,
                       LOWER(TRIM(COALESCE(e2.strand, ''))) AS strand_key,
                       CASE
                           WHEN LOWER(TRIM(COALESCE(s2.section_shift, ''))) = 'afternoon' THEN 'afternoon'
                           WHEN LOWER(TRIM(COALESCE(s2.section_shift, ''))) = 'morning'   THEN 'morning'
                           WHEN e2.enrollment_steps LIKE '%\"Afternoon Shift\"%' THEN 'afternoon'
                           ELSE 'morning'
                       END AS shift_key,
                       {$gradeKeyExpr} AS grade_key,
                       SUM(CASE WHEN LOWER(TRIM(COALESCE(u2.gender, ''))) IN ('male','m','boy') THEN 1 ELSE 0 END) AS boys,
                       SUM(CASE WHEN LOWER(TRIM(COALESCE(u2.gender, ''))) IN ('female','f','girl') THEN 1 ELSE 0 END) AS girls
                  FROM students s2
            INNER JOIN users u2       ON u2.id = s2.user_id
             LEFT JOIN enrollments e2 ON e2.user_id = u2.id
                 WHERE s2.section IS NOT NULL AND TRIM(s2.section) <> ''
              GROUP BY sec_key, strand_key, shift_key, grade_key
            ) c
                ON LOWER(TRIM(s.name))   = c.sec_key
               AND LOWER(TRIM(s.strand)) = c.strand_key
               AND LOWER(TRIM(s.shift))  = c.shift_key
               AND s.grade_level = c.grade_key
             WHERE s.strand = :strand
               AND s.grade_level = :grade
        ";
        if ($shiftFilter !== null && $shiftFilter !== '') {
            $sql .= ' AND s.shift = :shift';
        }
        $sql .= ' ORDER BY s.name ASC';
        $stmt = $pdo->prepare($sql);
        $params = [':strand' => $strand, ':grade' => $gradeLevel];
        if ($shiftFilter !== null && $shiftFilter !== '') {
            $params[':shift'] = $shiftFilter;
        }
        $stmt->execute($params);
    } else {
        $stmt = $pdo->prepare(
            'SELECT s.id, s.name, s.max_boys, s.max_girls, s.boys_first,
                    0 AS boys_count, 0 AS girls_count
               FROM sections s
              WHERE s.strand = :strand
              ORDER BY s.name ASC'
        );
        $stmt->execute([':strand' => $strand]);
    }

    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

/** @param array<string, mixed> $sec */
function sectionFreeSeatsForGender(array $sec, string $gender): int
{
    $boysSeats  = (int)($sec['max_boys'] ?? 0) - (int)($sec['boys_count'] ?? 0);
    $girlsSeats = (int)($sec['max_girls'] ?? 0) - (int)($sec['girls_count'] ?? 0);
    if ($gender === 'male') {
        return $boysSeats;
    }
    if ($gender === 'female') {
        return $girlsSeats;
    }

    return $boysSeats + $girlsSeats;
}

/**
 * Ensure a Grade 12 section row exists, copying caps from the Grade 11 twin
 * when available.
 *
 * @return array<string, mixed>|null
 */
function ensureGrade12SectionRow(
    PDO $pdo,
    string $sectionName,
    string $strand,
    string $shift
): ?array {
    require_once __DIR__ . '/section_grade_helpers.php';
    ensureSectionAssignmentSchema($pdo);

    $shift = normaliseAssignmentShift($shift);
    if ($shift === '') {
        $shift = SECTION_ASSIGN_DEFAULT_SHIFT;
    }
    $name = trim($sectionName);
    if ($name === '' || trim($strand) === '') {
        return null;
    }

    $hasShiftColumn = columnExists($pdo, 'sections', 'shift');
    $hasGradeColumn = columnExists($pdo, 'sections', 'grade_level');

    if ($hasShiftColumn && $hasGradeColumn) {
        $find = $pdo->prepare(
            'SELECT id, name, shift, grade_level, max_boys, max_girls, boys_first
               FROM sections
              WHERE strand = :strand AND grade_level = :grade AND shift = :shift AND name = :name
              LIMIT 1'
        );
        $find->execute([
            ':strand' => $strand,
            ':grade' => '12',
            ':shift' => $shift,
            ':name' => $name,
        ]);
        $existing = $find->fetch(PDO::FETCH_ASSOC);
        if ($existing && is_array($existing)) {
            return $existing;
        }

        $template = $pdo->prepare(
            'SELECT max_boys, max_girls, boys_first
               FROM sections
              WHERE strand = :strand AND grade_level = :grade AND shift = :shift AND name = :name
              LIMIT 1'
        );
        $template->execute([
            ':strand' => $strand,
            ':grade' => '11',
            ':shift' => $shift,
            ':name' => $name,
        ]);
        $tpl = $template->fetch(PDO::FETCH_ASSOC);
        $boysFirst = isBoysFirstStrandFor($strand);
        $maxBoys = (int)($tpl['max_boys'] ?? ($boysFirst ? SECTION_AUTO_BOYS_FIRST_BOYS : SECTION_AUTO_DEFAULT_BOYS));
        $maxGirls = (int)($tpl['max_girls'] ?? ($boysFirst ? SECTION_AUTO_BOYS_FIRST_GIRLS : SECTION_AUTO_DEFAULT_GIRLS));

        $ins = $pdo->prepare(
            'INSERT INTO sections (name, strand, shift, grade_level, max_boys, max_girls, boys_first)
             VALUES (:n, :st, :sh, :gr, :mb, :mg, :bf)'
        );
        $ins->execute([
            ':n' => $name,
            ':st' => $strand,
            ':sh' => $shift,
            ':gr' => '12',
            ':mb' => $maxBoys,
            ':mg' => $maxGirls,
            ':bf' => $boysFirst ? 1 : 0,
        ]);

        return [
            'id' => (int)$pdo->lastInsertId(),
            'name' => $name,
            'shift' => $shift,
            'grade_level' => '12',
            'max_boys' => $maxBoys,
            'max_girls' => $maxGirls,
            'boys_first' => $boysFirst ? 1 : 0,
            'boys_count' => 0,
            'girls_count' => 0,
        ];
    }

    return null;
}

/**
 * Pick the section with the most open seats for this gender in a shift.
 *
 * @param array<int, array<string, mixed>> $sections
 * @return array<string, mixed>|null
 */
function pickSectionWithMostFreeSeats(array $sections, string $gender): ?array
{
    $best = null;
    $bestFree = -1;
    $bestName = '';
    foreach ($sections as $sec) {
        if (!is_array($sec)) {
            continue;
        }
        $free = sectionFreeSeatsForGender($sec, $gender);
        if ($free <= 0) {
            continue;
        }
        $name = (string)($sec['name'] ?? '');
        if ($free > $bestFree || ($free === $bestFree && ($best === null || strcmp($name, $bestName) < 0))) {
            $best = $sec;
            $bestFree = $free;
            $bestName = $name;
        }
    }

    return $best;
}

/**
 * Grade 12 rollover placement:
 *   - Same shift as before (or no shift change requested): keep the same
 *     section name and promote to the Grade 12 roster for that shift.
 *   - Different shift requested: place in the section with the most free
 *     seats for the student's gender in that shift (create one if needed).
 *
 * @return array<string, mixed>
 */
function autoAssignSectionForGrade12Rollover(
    PDO $pdo,
    int $userId,
    string $rawStrand,
    string $rawGender,
    string $rawPreferredShift = ''
): array {
    require_once __DIR__ . '/section_grade_helpers.php';

    $strand = trim($rawStrand);
    $gender = normaliseGender($rawGender);
    $preferredShift = normaliseAssignmentShift($rawPreferredShift);
    $current = fetchStudentSectionAssignment($pdo, $userId);
    $currentSection = $current['section'];
    $currentShift = $current['shift'] ?? SECTION_ASSIGN_DEFAULT_SHIFT;
    if ($preferredShift === '') {
        $preferredShift = $currentShift;
    }

    $result = [
        'assigned'        => false,
        'section'         => null,
        'strand'          => $strand,
        'grade_level'     => '12',
        'shift'           => null,
        'preferred_shift' => $preferredShift,
        'previous_section'=> $currentSection,
        'previous_shift'  => $currentShift,
        'kept_section'    => false,
        'shift_changed'   => false,
        'shift_fallback'  => false,
        'auto_created'    => false,
        'warning'         => null,
        'reason'          => null,
    ];

    if ($strand === '') {
        $result['warning'] = 'strand_missing';
        $result['reason']  = 'No strand on this enrollment — section assignment skipped.';
        return $result;
    }

    try {
        ensureSectionAssignmentSchema($pdo);
    } catch (Throwable $e) {
        $result['warning'] = 'schema_error';
        $result['reason']  = 'Could not prepare sections table.';
        return $result;
    }

    if ($currentSection === null || $currentSection === '') {
        return autoAssignSectionForApprovedStudent($pdo, $userId, $rawStrand, $rawGender, $rawPreferredShift, '12');
    }

    $shiftChanged = $preferredShift !== $currentShift;

    if (!$shiftChanged) {
        $row = ensureGrade12SectionRow($pdo, $currentSection, $strand, $preferredShift);
        if ($row === null) {
            $result['warning'] = 'section_row_missing';
            $result['reason']  = 'Could not prepare the Grade 12 section roster.';
            return $result;
        }

        try {
            upsertStudentSectionForUser($pdo, $userId, $currentSection, $preferredShift);
            if (columnExists($pdo, 'students', 'grade_level')) {
                $pdo->prepare('UPDATE students SET grade_level = :g WHERE user_id = :uid LIMIT 1')
                    ->execute([':g' => '12', ':uid' => $userId]);
            }
            $result['assigned'] = true;
            $result['section'] = $currentSection;
            $result['shift'] = $preferredShift;
            $result['kept_section'] = true;
            return $result;
        } catch (Throwable $e) {
            $result['warning'] = 'persist_failed';
            $result['reason']  = 'Could not save section on the students row.';
            return $result;
        }
    }

    if (isBoysFirstStrandFor($strand) && $gender === 'female') {
        $result['warning'] = 'eim_female_manual_placement';
        $result['reason']  = 'Girls applying to EIM need manual section placement by the registrar.';
        return $result;
    }

    $candidates = listSectionsWithGenderCounts($pdo, $strand, '12', $preferredShift);
    $chosen = pickSectionWithMostFreeSeats($candidates, $gender);
    $chosenShift = $preferredShift;

    if (!$chosen) {
        try {
            $newName = nextSectionLetterFor($pdo, $strand, $preferredShift, '12');
            $boysFirst = isBoysFirstStrandFor($strand);
            $maxBoys = $boysFirst ? SECTION_AUTO_BOYS_FIRST_BOYS : SECTION_AUTO_DEFAULT_BOYS;
            $maxGirls = $boysFirst ? SECTION_AUTO_BOYS_FIRST_GIRLS : SECTION_AUTO_DEFAULT_GIRLS;
            $hasShiftColumn = columnExists($pdo, 'sections', 'shift');
            $hasGradeColumn = columnExists($pdo, 'sections', 'grade_level');
            if ($hasShiftColumn && $hasGradeColumn) {
                $ins = $pdo->prepare(
                    'INSERT INTO sections (name, strand, shift, grade_level, max_boys, max_girls, boys_first)
                     VALUES (:n, :st, :sh, :gr, :mb, :mg, :bf)'
                );
                $ins->execute([
                    ':n' => $newName,
                    ':st' => $strand,
                    ':sh' => $preferredShift,
                    ':gr' => '12',
                    ':mb' => $maxBoys,
                    ':mg' => $maxGirls,
                    ':bf' => $boysFirst ? 1 : 0,
                ]);
            }
            $chosen = [
                'name' => $newName,
                'shift' => $preferredShift,
            ];
            $result['auto_created'] = true;
        } catch (Throwable $e) {
            $result['warning'] = 'auto_create_failed';
            $result['reason']  = 'Could not auto-create a section for the requested shift.';
            return $result;
        }
    }

    try {
        upsertStudentSectionForUser($pdo, $userId, (string)$chosen['name'], $chosenShift);
        if (columnExists($pdo, 'students', 'grade_level')) {
            $pdo->prepare('UPDATE students SET grade_level = :g WHERE user_id = :uid LIMIT 1')
                ->execute([':g' => '12', ':uid' => $userId]);
        }
        $result['assigned'] = true;
        $result['section'] = (string)$chosen['name'];
        $result['shift'] = $chosenShift;
        $result['shift_changed'] = true;
        return $result;
    } catch (Throwable $e) {
        $result['warning'] = 'persist_failed';
        $result['reason']  = 'Could not save section on the students row.';
        return $result;
    }
}
