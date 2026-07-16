<?php
declare(strict_types=1);

/**
 * Admin students directory (enrolled roster by default).
 *
 * GET /api/admin/students
 *   ?q=<name fragment>            — match against first/last/full name
 *   &grade_level=11|12|all        — filter by enrollment grade level
 *   &strand=<value>|all           — filter by strand (case-insensitive exact)
 *   &school_year=YYYY-YYYY|current|all — restrict to one SY (default: all)
 *   &status=approved|pending|rejected|under_review|draft|all
 *        Default: approved (matches both approved + enrolled). Use all to
 *        include open applications; those normally live under Registrar.
 *
 * Auth: X-User-Id must resolve to an admin.
 *
 * Joins users with the user's *latest* enrollment row. Name uses the same
 * fallback chain as admin_users.php (users.full_name, structured columns,
 * enrollment form_data, username).
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/school_year_helpers.php';

header('Content-Type: application/json');

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

require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/permission_guard.php';
$actor = apiRequireActor($pdo, 'admin/students');
$actorId = $actor['id'];
$actorRole = $actor['role'];
if ($actorRole !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

requireActorPermission($pdo, $actor, 'manageUsers', false);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!tableExists($pdo, 'users')) {
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'schema_not_ready']);
    exit;
}
$hasEnrollments = tableExists($pdo, 'enrollments');

// ---------- query parameters ----------
$rawQ = trim((string)($_GET['q'] ?? ''));
$gradeFilter = strtolower(trim((string)($_GET['grade_level'] ?? 'all')));
$strandFilter = trim((string)($_GET['strand'] ?? 'all'));
$syRaw = trim((string)($_GET['school_year'] ?? 'all'));
$statusFilter = strtolower(trim((string)($_GET['status'] ?? 'approved')));

$syCurrent = getEnrollmentSchoolYear($pdo);
$syFilter = 'all';
if ($syRaw !== '' && $syRaw !== 'all') {
    if ($syRaw === 'current') {
        $syFilter = $syCurrent ?? 'all';
    } else {
        // Accept only the YYYY-YYYY shape; otherwise fall through to all.
        $syFilter = preg_match('/^\d{4}-\d{4}$/', $syRaw) === 1 ? $syRaw : 'all';
    }
}

// ---------- column guards ----------
$hasFirstName = columnExists($pdo, 'users', 'first_name');
$hasLastName = columnExists($pdo, 'users', 'last_name');
$hasMiddleName = columnExists($pdo, 'users', 'middle_name');
$hasExtensionName = columnExists($pdo, 'users', 'extension_name');
$hasUsername = columnExists($pdo, 'users', 'username');
$hasSchoolUsername = columnExists($pdo, 'users', 'school_username');

$selFirst = $hasFirstName ? 'u.first_name' : "'' AS first_name";
$selLast = $hasLastName ? 'u.last_name' : "'' AS last_name";
$selMiddle = $hasMiddleName ? 'u.middle_name' : "'' AS middle_name";
$selExt = $hasExtensionName ? 'u.extension_name' : "'' AS extension_name";
$selUsername = $hasUsername ? 'u.username' : "'' AS username";
$selSchoolUsername = $hasSchoolUsername ? 'u.school_username' : 'NULL AS school_username';

// ---------- subquery: latest enrollment per user, with optional SY filter ----------
$latestEnrollmentJoin = '';
$enrollmentSelect = "
    NULL AS enrollment_id,
    NULL AS enrollment_status,
    NULL AS grade_level,
    NULL AS strand,
    NULL AS school_year,
    NULL AS enrollment_form_json
";
if ($hasEnrollments) {
    // Pick the most recent enrollment row per user. When school_year is
    // filtered, restrict the inner subquery to that SY so the joined row is
    // necessarily for that SY. When SY is 'all', we pick the very latest
    // row regardless of SY.
    if ($syFilter !== 'all') {
        $latestEnrollmentJoin = "
            LEFT JOIN (
                SELECT e2.user_id, e2.id AS enrollment_id, e2.status AS enrollment_status,
                       e2.grade_level, e2.strand, e2.school_year, e2.enrollment_steps
                FROM enrollments e2
                INNER JOIN (
                    SELECT user_id, MAX(id) AS max_id
                    FROM enrollments
                    WHERE school_year = :latest_sy
                    GROUP BY user_id
                ) latest ON latest.user_id = e2.user_id AND latest.max_id = e2.id
            ) e ON e.user_id = u.id
        ";
    } else {
        // Prefer the active enrollment school year; fall back to latest row.
        $latestEnrollmentJoin = "
            LEFT JOIN (
                SELECT e2.user_id, e2.id AS enrollment_id, e2.status AS enrollment_status,
                       e2.grade_level, e2.strand, e2.school_year, e2.enrollment_steps
                FROM enrollments e2
                INNER JOIN (
                    SELECT e_pick.user_id, e_pick.id AS max_id
                      FROM enrollments e_pick
                     INNER JOIN (
                        SELECT e3.user_id,
                               (
                                 SELECT e4.id
                                   FROM enrollments e4
                                  WHERE e4.user_id = e3.user_id
                                  ORDER BY
                                    (TRIM(COALESCE(e4.school_year, '')) = :prefer_sy) DESC,
                                    e4.id DESC
                                  LIMIT 1
                               ) AS pick_id
                          FROM enrollments e3
                         GROUP BY e3.user_id
                     ) picked ON picked.user_id = e_pick.user_id AND picked.pick_id = e_pick.id
                ) latest ON latest.user_id = e2.user_id AND latest.max_id = e2.id
            ) e ON e.user_id = u.id
        ";
    }
    $enrollmentSelect = "
        e.enrollment_id,
        e.enrollment_status,
        e.grade_level,
        e.strand,
        e.school_year,
        e.enrollment_steps AS enrollment_form_json
    ";
}

// ---------- build WHERE filtering students only ----------
// A user is considered a student when student_users has the row OR (legacy)
// users.role = 'student'. We mirror admin_users.php's role resolution.
$roleCase = "CASE WHEN au_r.user_id IS NOT NULL THEN 'admin' WHEN ru_r.user_id IS NOT NULL THEN 'registrar' ELSE 'student' END";

$whereParts = ["({$roleCase}) = 'student'"];
$bindings = [];

if ($syFilter !== 'all') {
    $bindings[':latest_sy'] = $syFilter;
} elseif ($hasEnrollments) {
    $bindings[':prefer_sy'] = $syCurrent ?? '';
}

if ($gradeFilter !== '' && $gradeFilter !== 'all') {
    // Match either '11', 'Grade 11', 'G11' regardless of how it was stored.
    // Use a portable LIKE comparison rather than REGEXP_REPLACE so we work
    // on older MariaDB builds without that scalar function.
    $whereParts[] = "(COALESCE(e.grade_level, '') = :grade_lvl OR COALESCE(e.grade_level, '') LIKE :grade_like)";
    $bindings[':grade_lvl'] = preg_replace('/[^0-9]/', '', $gradeFilter);
    $bindings[':grade_like'] = '%' . preg_replace('/[^0-9]/', '', $gradeFilter) . '%';
}

if ($strandFilter !== '' && strtolower($strandFilter) !== 'all') {
    $whereParts[] = 'LOWER(COALESCE(e.strand, \'\')) = LOWER(:strand)';
    $bindings[':strand'] = $strandFilter;
}

if ($statusFilter !== '' && $statusFilter !== 'all') {
    // 'approved' / 'enrolled' both mean Enrolled in the UI.
    if ($statusFilter === 'approved' || $statusFilter === 'enrolled') {
        $whereParts[] = "LOWER(COALESCE(e.enrollment_status, '')) IN ('approved', 'enrolled')";
    } else {
        $allowed = ['pending', 'rejected', 'under_review', 'draft'];
        if (in_array($statusFilter, $allowed, true)) {
            $whereParts[] = 'LOWER(COALESCE(e.enrollment_status, \'\')) = :status';
            $bindings[':status'] = $statusFilter;
        }
    }
}

// Name search runs against u.full_name + first_name + last_name AND, as a
// safety net, the latest enrollment form_data (givenName/lastName) so a
// student whose users.* columns aren't populated yet still matches.
if ($rawQ !== '') {
    $needle = '%' . $rawQ . '%';
    $whereParts[] = "(
        u.full_name LIKE :q1
        OR " . ($hasFirstName ? 'u.first_name LIKE :q2' : "'' LIKE :q2") . "
        OR " . ($hasLastName ? 'u.last_name LIKE :q3' : "'' LIKE :q3") . "
        OR u.email LIKE :q4
        OR " . ($hasSchoolUsername ? 'u.school_username LIKE :q5' : "'' LIKE :q5") . "
        OR COALESCE(e.enrollment_steps, '') LIKE :q6
    )";
    $bindings[':q1'] = $needle;
    $bindings[':q2'] = $needle;
    $bindings[':q3'] = $needle;
    $bindings[':q4'] = $needle;
    $bindings[':q5'] = $needle;
    $bindings[':q6'] = $needle;
}

$whereSql = implode(' AND ', $whereParts);

$sql = "
    SELECT
        u.id,
        u.full_name,
        u.email,
        {$selFirst},
        {$selMiddle},
        {$selLast},
        {$selExt},
        {$selUsername},
        {$selSchoolUsername},
        {$enrollmentSelect}
    FROM users u
    LEFT JOIN admin_users au_r ON au_r.user_id = u.id
    LEFT JOIN registrar_users ru_r ON ru_r.user_id = u.id
    LEFT JOIN student_users su_r ON su_r.user_id = u.id
    {$latestEnrollmentJoin}
    WHERE {$whereSql}
    ORDER BY
        CASE WHEN COALESCE(u.last_name, '') = '' THEN 1 ELSE 0 END,
        u.last_name ASC,
        u.first_name ASC,
        u.id ASC
    LIMIT 500
";

try {
    $stmt = $pdo->prepare($sql);
    foreach ($bindings as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $resolveName = static function (array $row): array {
        $first = trim((string)($row['first_name'] ?? ''));
        $last = trim((string)($row['last_name'] ?? ''));
        $full = trim((string)($row['full_name'] ?? ''));

        // First-pass: structured columns, then full_name.
        if ($first === '' && $last === '' && $full !== '') {
            // Best-effort split of full_name into first/last for display.
            $parts = preg_split('/\s+/', $full) ?: [];
            if (count($parts) === 1) {
                $first = $parts[0];
            } elseif (count($parts) >= 2) {
                $first = $parts[0];
                $last = end($parts);
            }
        }

        // Fallback: pull from latest enrollment form_data when both blank.
        if ($first === '' && $last === '' && !empty($row['enrollment_form_json'])) {
            $decoded = json_decode((string)$row['enrollment_form_json'], true);
            if (is_array($decoded) && isset($decoded['form_data']) && is_array($decoded['form_data'])) {
                $fd = $decoded['form_data'];
                $first = trim((string)($fd['givenName'] ?? ''));
                $last = trim((string)($fd['lastName'] ?? ''));
            }
        }

        $display = trim($first . ' ' . $last);
        if ($display === '') {
            $display = $full !== '' ? $full : trim((string)($row['username'] ?? ''));
        }
        return [
            'first_name' => $first,
            'last_name' => $last,
            'name' => $display,
        ];
    };

    $students = array_map(static function (array $row) use ($resolveName): array {
        $name = $resolveName($row);
        $gradeRaw = (string)($row['grade_level'] ?? '');
        $gradeNum = 0;
        if (preg_match('/(\d{1,2})/', $gradeRaw, $m)) {
            $gradeNum = (int)$m[1];
        }
        // Keep legacy `approved` and `enrolled` as Enrolled in admin views.
        $statusRaw = strtolower(trim((string)($row['enrollment_status'] ?? '')));
        $displayStatus = match ($statusRaw) {
            'approved', 'enrolled' => 'Enrolled',
            'rejected' => 'Rejected',
            'pending' => 'Pending review',
            'under_review', 'under review', 'review' => 'Under review',
            'draft' => 'Draft',
            default => $statusRaw === '' ? 'Not submitted' : ucfirst($statusRaw),
        };
        return [
            'userId' => (int)($row['id'] ?? 0),
            'name' => $name['name'],
            'firstName' => $name['first_name'],
            'lastName' => $name['last_name'],
            'email' => (string)($row['email'] ?? ''),
            'schoolUsername' => isset($row['school_username']) && $row['school_username'] !== null
                ? (string)$row['school_username'] : null,
            'gradeLevel' => $gradeRaw,
            'gradeLevelNumber' => $gradeNum,
            'strand' => (string)($row['strand'] ?? ''),
            'schoolYear' => (string)($row['school_year'] ?? ''),
            'enrollmentStatusRaw' => $statusRaw,
            'enrollmentStatus' => $displayStatus,
            'enrollmentId' => isset($row['enrollment_id']) && $row['enrollment_id'] !== null
                ? (int)$row['enrollment_id'] : null,
        ];
    }, $rows);

    // Build distinct strand list off the unfiltered student set so the UI
    // can render a stable filter dropdown. Keep it cheap (separate small
    // query) so we don't ship the whole student set just for the strand
    // names.
    $strandOptions = [];
    if ($hasEnrollments) {
        try {
            $strandRows = $pdo->query(
                "SELECT DISTINCT strand FROM enrollments WHERE strand IS NOT NULL AND strand <> '' ORDER BY strand ASC LIMIT 50"
            )->fetchAll(PDO::FETCH_COLUMN) ?: [];
            $strandOptions = array_values(array_filter(array_map('strval', $strandRows), static fn ($s) => $s !== ''));
        } catch (Throwable $e) {
            $strandOptions = [];
        }
    }

    appLogEvent($pdo, 'admin_students_list', 'admin', 'success', $actorId, 'endpoint', 'admin/students', [
        'count' => count($students),
        'q' => $rawQ !== '' ? $rawQ : null,
        'grade_level' => $gradeFilter,
        'strand' => $strandFilter,
        'school_year' => $syFilter,
        'status' => $statusFilter,
    ]);

    echo json_encode([
        'success' => true,
        'students' => $students,
        'filters' => [
            'school_year_current' => $syCurrent,
            'strand_options' => $strandOptions,
        ],
    ]);
} catch (Throwable $e) {
    appLogEvent($pdo, 'admin_students_list', 'admin', 'failed', $actorId, 'endpoint', 'admin/students', [
        'reason' => 'server_error',
        'message' => $e->getMessage(),
    ]);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to load students']);
}
