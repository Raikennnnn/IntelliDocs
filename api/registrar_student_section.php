<?php
declare(strict_types=1);

/**
 * Registrar manual reassignment of a student's section and class shift.
 *
 *   GET  /api/registrar/student-section?user_id=123
 *        Returns current placement plus the list of sections in the
 *        student's strand (both shifts) with live seat counts so the UI
 *        can disable rows that have no remaining seat for the student's
 *        gender.
 *
 *   POST /api/registrar/student-section
 *        { user_id, section, shift, force? }
 *        Updates students.section and students.section_shift. The chosen
 *        (strand, name, shift) must exist in the sections table. Refuses
 *        the move when the target section has no seat for this student's
 *        gender unless `force=true` is supplied (registrar override).
 *
 * Auth: X-User-Id must be registrar or admin.
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/section_assignment.php';
require_once __DIR__ . '/section_grade_helpers.php';

header('Content-Type: application/json');

require_once __DIR__ . '/api_auth.php';
$actor = apiRequireActor($pdo, 'registrar/student-section');
$actorId = $actor['id'];
$role = $actor['role'];
if (!in_array($role, ['registrar', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

require_once __DIR__ . '/permission_guard.php';
requireActorPermission($pdo, $actor, 'viewApplications');

ensureSectionAssignmentSchema($pdo);

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

/** Load the snapshot needed by both GET and POST handlers. */
function loadStudentPlacement(PDO $pdo, int $userId): ?array
{
    // Only join to `students` when the table (and the relevant columns) are
    // actually present. Some databases were bootstrapped before the roster
    // table existed; in that case the auto-migration in
    // ensureSectionAssignmentSchema() created it, but if that failed for
    // permission reasons we still want the panel to load instead of
    // crashing with a 1146 "table not found" error.
    $hasStudents       = tableExists($pdo, 'students');
    $hasStudentSection = $hasStudents && columnExists($pdo, 'students', 'section');
    $hasStudentShift   = $hasStudents && columnExists($pdo, 'students', 'section_shift');

    $sectionSubquery = $hasStudentSection
        ? '(SELECT s.section FROM students s WHERE s.user_id = u.id ORDER BY s.id DESC LIMIT 1)'
        : 'NULL';
    $shiftSubquery = $hasStudentShift
        ? '(SELECT s.section_shift FROM students s WHERE s.user_id = u.id ORDER BY s.id DESC LIMIT 1)'
        : 'NULL';

    $sql = "
        SELECT
            u.id AS user_id,
            u.full_name,
            COALESCE(u.gender, '') AS gender,
            COALESCE(e.strand, '') AS strand,
            COALESCE(e.grade_level, '') AS enrollment_grade_level,
            e.enrollment_steps,
            {$sectionSubquery} AS current_section,
            {$shiftSubquery}   AS current_shift
          FROM users u
     LEFT JOIN enrollments e ON e.user_id = u.id
         WHERE u.id = :uid
      ORDER BY e.id DESC
         LIMIT 1
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':uid' => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return null;
    }

    // Pull the original preferred shift out of enrollment_steps.form_data
    // so the UI can show "Preferred: Morning Shift" beside the current
    // assignment.
    $preferred = null;
    $steps = json_decode((string)($row['enrollment_steps'] ?? '{}'), true);
    if (is_array($steps) && isset($steps['form_data']) && is_array($steps['form_data'])) {
        $pref = strtolower(trim((string)($steps['form_data']['preferredSchedule'] ?? '')));
        if (strpos($pref, 'afternoon') !== false) {
            $preferred = 'afternoon';
        } elseif (strpos($pref, 'morning') !== false) {
            $preferred = 'morning';
        }
    }

    $current = strtolower(trim((string)($row['current_shift'] ?? '')));
    if (!in_array($current, ['morning', 'afternoon'], true)) {
        $current = $preferred; // legacy: fall back to preference
    }

    return [
        'user_id'         => (int)$row['user_id'],
        'full_name'       => (string)$row['full_name'],
        'gender'          => normaliseGender((string)$row['gender']),
        'strand'          => trim((string)$row['strand']),
        'grade_level'     => normaliseGradeLevel((string)($row['enrollment_grade_level'] ?? '')),
        'current_section' => (string)($row['current_section'] ?? '') ?: null,
        'current_shift'   => $current,
        'preferred_shift' => $preferred,
    ];
}

// ---------------------------------------------------------------------------
// GET — return current placement + candidate sections for this strand.
// ---------------------------------------------------------------------------
if ($method === 'GET') {
    $userId = (int)($_GET['user_id'] ?? 0);
    if ($userId <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Invalid user id']);
        exit;
    }

    $snap = loadStudentPlacement($pdo, $userId);
    if (!$snap) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Student not found']);
        exit;
    }

    $gender = $snap['gender'];
    $strand = $snap['strand'];
    $gradeLevel = (string)($snap['grade_level'] ?? SECTION_DEFAULT_GRADE);

    $available = [];
    if ($strand !== '' && tableExists($pdo, 'sections')) {
        try {
            $hasShiftCol  = columnExists($pdo, 'sections', 'shift');
            $hasGradeCol  = columnExists($pdo, 'sections', 'grade_level');
            $gradeKeyExpr = sqlEnrollmentGradeKey('e2.grade_level');
            $hasStudents  = tableExists($pdo, 'students');
            $hasStudShift = $hasStudents && columnExists($pdo, 'students', 'section_shift');

            // Build the counts sub-select only when we actually have a
            // students table to join from. Without it, all sections start
            // at zero — still useful so the registrar can pick one.
            if ($hasStudents) {
                $shiftExpr = $hasStudShift
                    ? "CASE
                           WHEN LOWER(TRIM(COALESCE(s2.section_shift, ''))) = 'afternoon' THEN 'afternoon'
                           WHEN LOWER(TRIM(COALESCE(s2.section_shift, ''))) = 'morning'   THEN 'morning'
                           WHEN e2.enrollment_steps LIKE '%\"Afternoon Shift\"%' THEN 'afternoon'
                           ELSE 'morning'
                       END"
                    : "CASE
                           WHEN e2.enrollment_steps LIKE '%\"Afternoon Shift\"%' THEN 'afternoon'
                           ELSE 'morning'
                       END";
                $gradeJoin = $hasGradeCol
                    ? 'AND sec.grade_level = c.grade_key'
                    : '';
                $countsCte = "
                    LEFT JOIN (
                        SELECT LOWER(TRIM(s2.section)) AS sec_key,
                               LOWER(TRIM(COALESCE(e2.strand, ''))) AS strand_key,
                               {$shiftExpr} AS shift_key,
                               {$gradeKeyExpr} AS grade_key,
                               SUM(CASE WHEN LOWER(TRIM(COALESCE(u2.gender, ''))) IN ('male','m','boy') THEN 1 ELSE 0 END) AS boys,
                               SUM(CASE WHEN LOWER(TRIM(COALESCE(u2.gender, ''))) IN ('female','f','girl') THEN 1 ELSE 0 END) AS girls
                          FROM students s2
                    INNER JOIN users u2       ON u2.id = s2.user_id
                     LEFT JOIN enrollments e2 ON e2.user_id = u2.id
                         WHERE s2.section IS NOT NULL AND TRIM(s2.section) <> ''
                      GROUP BY sec_key, strand_key, shift_key, grade_key
                    ) c
                        ON LOWER(TRIM(sec.name))   = c.sec_key
                       AND LOWER(TRIM(sec.strand)) = c.strand_key
                       " . ($hasShiftCol ? "AND LOWER(TRIM(sec.shift)) = c.shift_key" : "") . "
                       {$gradeJoin}
                ";
                $countsCols = "COALESCE(c.boys, 0)  AS enrolled_boys,
                               COALESCE(c.girls, 0) AS enrolled_girls";
            } else {
                $countsCte  = '';
                $countsCols = '0 AS enrolled_boys, 0 AS enrolled_girls';
            }

            $sql = "
                SELECT sec.id, sec.name, sec.strand,
                       " . ($hasShiftCol ? 'sec.shift' : "'morning' AS shift") . ",
                       sec.max_boys, sec.max_girls, sec.boys_first,
                       {$countsCols}
                  FROM sections sec
                  {$countsCte}
                 WHERE sec.strand = :strand
                   " . ($hasGradeCol ? 'AND sec.grade_level = :grade' : '') . "
              ORDER BY " . ($hasShiftCol ? "CASE WHEN sec.shift = 'morning' THEN 0 ELSE 1 END," : "") . " sec.name ASC
            ";
            $stmt = $pdo->prepare($sql);
            $params = [':strand' => $strand];
            if ($hasGradeCol) {
                $params[':grade'] = $gradeLevel;
            }
            $stmt->execute($params);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $sec) {
                $secShift = strtolower((string)($sec['shift'] ?? 'morning'));
                if (!in_array($secShift, ['morning', 'afternoon'], true)) {
                    $secShift = 'morning';
                }
                $maxBoys   = (int)$sec['max_boys'];
                $maxGirls  = (int)$sec['max_girls'];
                $enrBoys   = (int)$sec['enrolled_boys'];
                $enrGirls  = (int)$sec['enrolled_girls'];
                $boysSeats  = max(0, $maxBoys  - $enrBoys);
                $girlsSeats = max(0, $maxGirls - $enrGirls);
                $isCurrent = strcasecmp((string)$sec['name'], (string)($snap['current_section'] ?? '')) === 0
                             && $secShift === (string)$snap['current_shift'];

                $hasSeatForGender = match ($gender) {
                    'male'   => $boysSeats > 0,
                    'female' => $girlsSeats > 0,
                    default  => ($boysSeats + $girlsSeats) > 0,
                };

                $available[] = [
                    'id'             => (int)$sec['id'],
                    'name'           => (string)$sec['name'],
                    'strand'         => (string)$sec['strand'],
                    'shift'          => $secShift,
                    'maxBoys'        => $maxBoys,
                    'maxGirls'       => $maxGirls,
                    'capacity'       => $maxBoys + $maxGirls,
                    'enrolledBoys'   => $enrBoys,
                    'enrolledGirls'  => $enrGirls,
                    'enrolledTotal'  => $enrBoys + $enrGirls,
                    'boysSeats'      => $boysSeats,
                    'girlsSeats'     => $girlsSeats,
                    'hasSeatForGender' => $hasSeatForGender,
                    'isCurrent'      => $isCurrent,
                ];
            }
        } catch (Throwable $e) {
            // Soft-fail — UI will show the placement panel with an empty list.
        }
    }

    echo json_encode([
        'success'   => true,
        'student'   => [
            'userId'        => $snap['user_id'],
            'fullName'      => $snap['full_name'],
            'gender'        => $snap['gender'],
            'strand'        => $strand,
            'gradeLevel'    => $gradeLevel,
            'currentSection'  => $snap['current_section'],
            'currentShift'    => $snap['current_shift'],
            'preferredShift'  => $snap['preferred_shift'],
        ],
        'sections'  => $available,
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// POST — apply a reassignment.
// ---------------------------------------------------------------------------
if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $userId      = (int)($payload['user_id'] ?? 0);
    $targetName  = trim((string)($payload['section'] ?? ''));
    $targetShift = normaliseAssignmentShift((string)($payload['shift'] ?? ''));
    $force       = !empty($payload['force']);

    if ($userId <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Invalid user id']);
        exit;
    }
    if ($targetName === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Section name is required']);
        exit;
    }
    if ($targetShift === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Shift is required (morning or afternoon)']);
        exit;
    }

    $snap = loadStudentPlacement($pdo, $userId);
    if (!$snap) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Student not found']);
        exit;
    }
    if ($snap['strand'] === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Student has no strand on file — cannot reassign.']);
        exit;
    }

    // Resolve the target section row so we can validate it actually
    // belongs to the student's strand AND check live seat counts.
    $hasShiftCol = columnExists($pdo, 'sections', 'shift');
    $hasGradeCol = columnExists($pdo, 'sections', 'grade_level');
    if ($hasShiftCol && $hasGradeCol) {
        $secStmt = $pdo->prepare(
            'SELECT id, name, strand, shift, grade_level, max_boys, max_girls
               FROM sections
              WHERE strand = :strand
                AND grade_level = :grade
                AND LOWER(TRIM(name))  = LOWER(TRIM(:name))
                AND LOWER(TRIM(shift)) = :shift
              LIMIT 1'
        );
        $secStmt->execute([
            ':strand' => $snap['strand'],
            ':grade' => $snap['grade_level'],
            ':name' => $targetName,
            ':shift' => $targetShift,
        ]);
    } elseif ($hasShiftCol) {
        $secStmt = $pdo->prepare(
            'SELECT id, name, strand, shift, max_boys, max_girls
               FROM sections
              WHERE strand = :strand
                AND LOWER(TRIM(name))  = LOWER(TRIM(:name))
                AND LOWER(TRIM(shift)) = :shift
              LIMIT 1'
        );
        $secStmt->execute([':strand' => $snap['strand'], ':name' => $targetName, ':shift' => $targetShift]);
    } else {
        $secStmt = $pdo->prepare(
            'SELECT id, name, strand, max_boys, max_girls
               FROM sections
              WHERE strand = :strand
                AND LOWER(TRIM(name)) = LOWER(TRIM(:name))
              LIMIT 1'
        );
        $secStmt->execute([':strand' => $snap['strand'], ':name' => $targetName]);
    }
    $section = $secStmt->fetch(PDO::FETCH_ASSOC);
    if (!$section) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => "Section \"{$targetName}\" ({$targetShift}) doesn't exist in {$snap['strand']}. Create it on the Sections page first.",
        ]);
        exit;
    }

    // Live count check — refuse to over-fill unless the registrar
    // explicitly overrides with force=true. Skip cleanly when the
    // `students` table isn't available (we can't count, so we don't
    // block).
    if (!$force && tableExists($pdo, 'students')) {
        $studentsHasShift = columnExists($pdo, 'students', 'section_shift');
        $shiftExpr = $studentsHasShift
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
        $countSql = "
            SELECT
                SUM(CASE WHEN LOWER(TRIM(COALESCE(u.gender, ''))) IN ('male','m','boy')   AND u.id <> :self_uid THEN 1 ELSE 0 END) AS boys,
                SUM(CASE WHEN LOWER(TRIM(COALESCE(u.gender, ''))) IN ('female','f','girl') AND u.id <> :self_uid THEN 1 ELSE 0 END) AS girls
              FROM students s
        INNER JOIN users u       ON u.id = s.user_id
         LEFT JOIN enrollments e ON e.user_id = u.id
             WHERE LOWER(TRIM(s.section)) = LOWER(TRIM(:name))
               AND LOWER(TRIM(COALESCE(e.strand, ''))) = LOWER(TRIM(:strand))
               AND {$shiftExpr} = :shift
        ";
        try {
            $cnt = $pdo->prepare($countSql);
            $cnt->execute([
                ':self_uid' => $userId,
                ':name'     => $targetName,
                ':strand'   => $snap['strand'],
                ':shift'    => $targetShift,
            ]);
            $cntRow = $cnt->fetch(PDO::FETCH_ASSOC) ?: ['boys' => 0, 'girls' => 0];
            $enrBoys  = (int)($cntRow['boys']  ?? 0);
            $enrGirls = (int)($cntRow['girls'] ?? 0);
            $boysSeats  = max(0, (int)$section['max_boys']  - $enrBoys);
            $girlsSeats = max(0, (int)$section['max_girls'] - $enrGirls);
            $gender = $snap['gender'];

            $hasSeat = match ($gender) {
                'male'   => $boysSeats > 0,
                'female' => $girlsSeats > 0,
                default  => ($boysSeats + $girlsSeats) > 0,
            };
            if (!$hasSeat) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'error'   => 'no_seat',
                    'message' => "Section {$snap['strand']} – {$targetName} ({$targetShift}) has no remaining " .
                                 ($gender === 'female' ? 'girl' : ($gender === 'male' ? 'boy' : '')) .
                                 ' seats. Pass force=true to override.',
                    'capacity' => [
                        'boysSeats'  => $boysSeats,
                        'girlsSeats' => $girlsSeats,
                    ],
                ]);
                exit;
            }
        } catch (Throwable $e) {
            // Soft-fail the capacity check — proceed with the update.
        }
    }

    try {
        upsertStudentSectionForUser($pdo, $userId, $targetName, $targetShift);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error'   => 'Failed to update placement',
            'detail'  => $e->getMessage(),
        ]);
        exit;
    }

    appLogEvent($pdo, 'section_reassign', 'registrar', 'success', $actorId, 'user', (string)$userId, [
        'strand'       => $snap['strand'],
        'from_section' => $snap['current_section'],
        'from_shift'   => $snap['current_shift'],
        'to_section'   => $targetName,
        'to_shift'     => $targetShift,
        'forced'       => $force,
    ]);

    echo json_encode([
        'success' => true,
        'student' => [
            'userId'         => $userId,
            'strand'         => $snap['strand'],
            'currentSection' => $targetName,
            'currentShift'   => $targetShift,
            'previousSection'=> $snap['current_section'],
            'previousShift'  => $snap['current_shift'],
        ],
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
