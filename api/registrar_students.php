<?php
declare(strict_types=1);

/**
 * Registrar's roster of approved students, grouped by strand and grade level.
 *
 * GET  /api/registrar/students                       — list (grouped on the client side)
 * GET  /api/registrar/students?user_id=123           — single student detail
 * POST /api/registrar/students  { action: "resend_welcome", user_id }
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
require_once __DIR__ . '/enrollment_status_helpers.php';
require_once __DIR__ . '/school_year_helpers.php';
require_once __DIR__ . '/section_grade_helpers.php';
require_once __DIR__ . '/physical_docs_helpers.php';

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
$actor = apiRequireActor($pdo, 'registrar/students');
$actorId = $actor['id'];
$actorRole = $actor['role'];
if (!in_array($actorRole, ['registrar', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

requireActorPermission($pdo, $actor, 'viewApplications');

if (!tableExists($pdo, 'enrollments') || !tableExists($pdo, 'users')) {
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'schema_not_ready', 'details' => ['missing' => 'enrollments or users table']]);
    exit;
}

// Optional credential columns from the student-school-credentials spec.
$hasSchoolUsername = columnExists($pdo, 'users', 'school_username');
$hasMustChange = columnExists($pdo, 'users', 'must_change_password');
$hasFirstName = columnExists($pdo, 'users', 'first_name');
$hasLastLogin = columnExists($pdo, 'users', 'last_login_at');
$hasRegistrarRemarks = columnExists($pdo, 'enrollments', 'registrar_remarks');
$hasUpdatedAt = columnExists($pdo, 'enrollments', 'updated_at');

$selectSchoolUsername = $hasSchoolUsername ? 'u.school_username' : 'NULL AS school_username';
$selectMustChange = $hasMustChange ? 'u.must_change_password' : '0 AS must_change_password';
$selectFirstName = $hasFirstName ? 'u.first_name' : 'NULL AS first_name';
$selectMiddleName = columnExists($pdo, 'users', 'middle_name') ? 'u.middle_name' : 'NULL AS middle_name';
$selectLastName = columnExists($pdo, 'users', 'last_name') ? 'u.last_name' : 'NULL AS last_name';
$selectExtensionName = columnExists($pdo, 'users', 'extension_name') ? 'u.extension_name' : 'NULL AS extension_name';
$selectLastLogin = $hasLastLogin ? 'u.last_login_at' : 'NULL AS last_login_at';
$selectRegistrarRemarks = $hasRegistrarRemarks ? 'e.registrar_remarks' : "'' AS registrar_remarks";
$selectUpdatedAt = $hasUpdatedAt ? 'e.updated_at' : 'NULL AS updated_at';

// Personal/contact columns synced from enrollment_steps.form_data into the
// users row at submit time (see api/student_enrollment.php $syncMap). They
// are the authoritative source for the registrar's profile panel; we still
// fall back to form_data when a column is absent or NULL on older rows.
$selectDob = columnExists($pdo, 'users', 'date_of_birth') ? 'u.date_of_birth' : 'NULL AS date_of_birth';
$selectGender = columnExists($pdo, 'users', 'gender') ? 'u.gender' : 'NULL AS gender';
$selectPhone = columnExists($pdo, 'users', 'phone') ? 'u.phone' : 'NULL AS phone';
$selectAddress = columnExists($pdo, 'users', 'address') ? 'u.address' : 'NULL AS address';
$selectReligion = columnExists($pdo, 'users', 'religion') ? 'u.religion' : 'NULL AS religion';

$method = $_SERVER['REQUEST_METHOD'];

// ---------- POST: resend welcome email ----------
if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }
    $action = strtolower(trim((string)($payload['action'] ?? '')));
    $userId = (int)($payload['user_id'] ?? 0);
    if ($userId <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Invalid user id']);
        exit;
    }

    if ($action !== 'resend_welcome') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Unknown action']);
        exit;
    }

    if (!$hasSchoolUsername) {
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'error' => 'credentials_feature_not_enabled',
            'details' => ['hint' => 'Run database_migration_credentials.sql first.'],
        ]);
        exit;
    }

    // Look up user; require credentials to already be issued.
    $u = $pdo->prepare('
        SELECT u.id, u.email, u.full_name, ' . $selectSchoolUsername . ', ' . $selectFirstName . '
        FROM users u WHERE u.id = :id LIMIT 1
    ');
    $u->execute([':id' => $userId]);
    $user = $u->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found']);
        exit;
    }
    $schoolUsername = trim((string)($user['school_username'] ?? ''));
    if ($schoolUsername === '') {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'credentials_not_issued', 'details' => ['hint' => 'Approve the application first to issue credentials.']]);
        exit;
    }

    require_once __DIR__ . '/account_reminder_email.php';

    $firstName = trim((string)($user['first_name'] ?? '')) ?: trim((string)($user['full_name'] ?? '')) ?: 'there';

    $sent = false;
    $deliveryError = null;
    if (file_exists(__DIR__ . '/mailer.php')) {
        require_once __DIR__ . '/mailer.php';
        try {
            if (function_exists('sendAccountReminderEmail')) {
                $sent = sendAccountReminderEmail($pdo, (string)$user['email'], [
                    'first_name' => $firstName,
                    'school_username' => $schoolUsername,
                ]);
                if (!$sent) {
                    $deliveryError = 'send_failed';
                }
            } else {
                $deliveryError = 'mailer_unavailable';
            }
        } catch (Throwable $e) {
            $deliveryError = $e->getMessage();
        }
    } else {
        $deliveryError = 'mailer_not_available';
    }

    appLogEvent(
        $pdo, 'resend_welcome', 'registrar', $sent ? 'success' : 'failed', $actorId, 'user', (string)$userId,
        ['delivery' => $sent ? 'sent' : 'failed', 'error' => $deliveryError]
    );

    echo json_encode([
        'success' => $sent,
        'delivery' => $sent ? 'sent' : 'failed',
        'error' => $sent ? null : ($deliveryError ?: 'failed_to_send'),
    ]);
    exit;
}

// ---------- GET: list or single ----------
if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$singleUserId = (int)($_GET['user_id'] ?? 0);
$enrollmentIdFilter = (int)($_GET['enrollment_id'] ?? 0);

$viewSyRaw = trim((string)($_GET['school_year'] ?? ''));
if (strtolower($viewSyRaw) === 'all') {
    $viewSy = '';
} elseif ($viewSyRaw === '' || strtolower($viewSyRaw) === 'current') {
    $viewSy = rosterEnrollmentContext($pdo)['school_year'];
} elseif (preg_match('/^\d{4}-\d{4}$/', $viewSyRaw) === 1) {
    $viewSy = $viewSyRaw;
} else {
    $viewSy = '';
}

/**
 * @return list<string> YYYY-YYYY labels, newest first
 */
function registrarStudentSchoolYearOptions(PDO $pdo): array
{
    return schoolYearFilterOptions($pdo);
}

// Per-student section + shift come from the `students` table that gets
// populated by the section auto-assignment helper. The columns are
// optional so the SELECT degrades gracefully when the schema migration
// hasn't run yet on this database.
$hasStudentsTable = tableExists($pdo, 'students');
$selectCurrentSection = $hasStudentsTable && columnExists($pdo, 'students', 'section')
    ? '(SELECT s.section FROM students s WHERE s.user_id = u.id ORDER BY s.id DESC LIMIT 1) AS current_section'
    : "NULL AS current_section";
$selectCurrentShift = $hasStudentsTable && columnExists($pdo, 'students', 'section_shift')
    ? '(SELECT s.section_shift FROM students s WHERE s.user_id = u.id ORDER BY s.id DESC LIMIT 1) AS current_shift'
    : "NULL AS current_shift";

$selectPhysicalDocsComplete = columnExists($pdo, 'enrollments', 'physical_docs_completed_at')
    ? 'e.physical_docs_completed_at'
    : 'NULL AS physical_docs_completed_at';

try {
    // One :view_sy placeholder only — PDO rejects duplicate named params in native prepares.
    $enrollmentPick = "
        SELECT e2.id FROM enrollments e2
         WHERE e2.user_id = u.id
           AND LOWER(TRIM(COALESCE(e2.status, ''))) IN ('approved', 'enrolled')
         ORDER BY
           (TRIM(COALESCE(e2.school_year, '')) = :view_sy) DESC,
           e2.id DESC
         LIMIT 1
    ";

    $useSpecificEnrollment = false;
    if ($singleUserId > 0 && $enrollmentIdFilter > 0) {
        $enrollmentOwnerStmt = $pdo->prepare(
            'SELECT 1 FROM enrollments WHERE id = :eid AND user_id = :uid LIMIT 1'
        );
        $enrollmentOwnerStmt->execute([
            ':eid' => $enrollmentIdFilter,
            ':uid' => $singleUserId,
        ]);
        $useSpecificEnrollment = (bool)$enrollmentOwnerStmt->fetchColumn();
    }

    $enrollmentJoin = $useSpecificEnrollment
        ? 'e.id = :enrollment_id'
        : "e.id = ({$enrollmentPick})";

    $sql = "
        SELECT
            e.id AS enrollment_id,
            e.status AS enrollment_status,
            e.grade_level,
            e.strand,
            e.school_year,
            e.applied_at,
            {$selectUpdatedAt},
            e.enrollment_steps,
            {$selectRegistrarRemarks},
            {$selectPhysicalDocsComplete},
            u.id AS user_id,
            u.email,
            u.full_name,
            {$selectFirstName},
            {$selectMiddleName},
            {$selectLastName},
            {$selectExtensionName},
            {$selectSchoolUsername},
            {$selectMustChange},
            {$selectLastLogin},
            {$selectDob},
            {$selectGender},
            {$selectPhone},
            {$selectAddress},
            {$selectReligion},
            {$selectCurrentSection},
            {$selectCurrentShift}
        FROM users u
        INNER JOIN enrollments e ON e.user_id = u.id
           AND {$enrollmentJoin}
        WHERE 1=1
    ";
    $params = [];
    if (!$useSpecificEnrollment) {
        $params[':view_sy'] = $viewSy;
    }
    if ($useSpecificEnrollment) {
        $params[':enrollment_id'] = $enrollmentIdFilter;
    }
    if ($viewSy !== '' && ($singleUserId <= 0 || !$useSpecificEnrollment)) {
        $sql .= " AND TRIM(COALESCE(e.school_year, '')) = :view_sy_match";
        $params[':view_sy_match'] = $viewSy;
    }
    if ($singleUserId > 0) {
        $sql .= ' AND u.id = :uid';
        $params[':uid'] = $singleUserId;
    }
    $sql .= ' ORDER BY u.full_name ASC, e.id DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $physicalDocsCompleteByEnrollment = batchEnrollmentPhysicalDocsComplete($pdo, $rows);
    if (
        columnExists($pdo, 'enrollments', 'physical_docs_completed_at')
        && tableExists($pdo, 'enrollment_physical_docs')
    ) {
        foreach ($rows as &$row) {
            $enrollmentId = (int)($row['enrollment_id'] ?? 0);
            if ($enrollmentId <= 0) {
                continue;
            }
            if (empty($physicalDocsCompleteByEnrollment[$enrollmentId])) {
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
            $stampStmt = $pdo->prepare(
                'SELECT physical_docs_completed_at FROM enrollments WHERE id = :id LIMIT 1'
            );
            $stampStmt->execute([':id' => $enrollmentId]);
            $row['physical_docs_completed_at'] = $stampStmt->fetchColumn() ?: null;
        }
        unset($row);
    }

    // For single mode, also fetch documents.
    $shapeRow = function (array $row) use ($pdo, $physicalDocsCompleteByEnrollment): array {
        $form = [];
        $steps = json_decode((string)($row['enrollment_steps'] ?? '{}'), true);
        if (is_array($steps) && isset($steps['form_data']) && is_array($steps['form_data'])) {
            $form = $steps['form_data'];
        }
        $strand = trim((string)($row['strand'] ?? '')) ?: 'Unassigned';
        $grade = trim((string)($row['grade_level'] ?? '')) ?: 'Unassigned';
        return [
            'userId' => (int)$row['user_id'],
            'enrollmentId' => (int)$row['enrollment_id'],
            'applicationId' => 'APP-' . date('Y') . '-' . str_pad((string)$row['enrollment_id'], 3, '0', STR_PAD_LEFT),
            'fullName' => (string)($row['full_name'] ?? ''),
            'firstName' => (string)($row['first_name'] ?? '') ?: (string)($form['givenName'] ?? ''),
            'middleName' => (string)($row['middle_name'] ?? '') ?: (string)($form['middleName'] ?? ''),
            'lastName' => (string)($row['last_name'] ?? '') ?: (string)($form['lastName'] ?? ''),
            'extensionName' => (string)($row['extension_name'] ?? '') ?: (string)($form['extensionName'] ?? ''),
            'email' => (string)($row['email'] ?? ''),
            'schoolUsername' => isset($row['school_username']) && $row['school_username'] !== null ? (string)$row['school_username'] : null,
            'mustChangePassword' => (int)($row['must_change_password'] ?? 0) === 1,
            'lastLoginAt' => $row['last_login_at'] ?? null,
            // Student is enrolled once the registrar approves the application.
            // Physical-document collection is tracked separately.
            'enrollmentStatus' => strtolower(trim((string)($row['enrollment_status'] ?? 'enrolled'))),
            'status' => 'Enrolled',
            'physicalDocsComplete' => !empty($physicalDocsCompleteByEnrollment[(int)$row['enrollment_id']]),
            'physicalDocsCompletedAt' => $row['physical_docs_completed_at'] ?? null,
            'strand' => $strand,
            'gradeLevel' => $grade,
            'schoolYear' => (string)($row['school_year'] ?? ''),
            'submittedDate' => (string)($row['applied_at'] ?? ''),
            'approvedDate' => (string)($row['updated_at'] ?? ''),
            'registrarRemarks' => (string)($row['registrar_remarks'] ?? ''),
            // Personal/academic fields. Prefer the users.* columns synced
            // by api/student_enrollment.php at submit time; fall back to
            // form_data using the field names the React form actually
            // writes (`birthDate`, `contactNumber`, address parts).
            'gender' => (string)($row['gender'] ?? '') ?: (string)($form['gender'] ?? ''),
            'dateOfBirth' => (string)($row['date_of_birth'] ?? '') ?: (string)($form['birthDate'] ?? ''),
            'phone' => (string)($row['phone'] ?? '') ?: (string)($form['contactNumber'] ?? ''),
            'address' => (string)($row['address'] ?? '') ?: trim(implode(', ', array_filter([
                trim((string)($form['blockLotHouseNo'] ?? '')),
                trim((string)($form['street'] ?? '')),
                trim((string)($form['barangay'] ?? '')),
                trim((string)($form['municipality'] ?? '')),
            ], static fn ($v) => $v !== ''))),
            'religion' => (string)($row['religion'] ?? '') ?: (string)($form['religion'] ?? ''),
            'previousSchool' => (string)($form['previousSchoolAttended'] ?? $form['previousSchool'] ?? ''),
            'lastSchoolYearAttended' => (string)($form['lastSchoolYearAttended'] ?? ''),
            // Current class placement. `currentShift` falls back to the
            // student's enrollment-form preference when the registrar
            // hasn't explicitly set it yet (legacy rows pre-migration).
            'currentSection' => (string)($row['current_section'] ?? '') ?: null,
            'currentShift'   => (function () use ($row, $form) {
                $stored = strtolower(trim((string)($row['current_shift'] ?? '')));
                if (in_array($stored, ['morning', 'afternoon'], true)) {
                    return $stored;
                }
                $pref = strtolower(trim((string)($form['preferredSchedule'] ?? '')));
                if (strpos($pref, 'afternoon') !== false) return 'afternoon';
                if (strpos($pref, 'morning') !== false)   return 'morning';
                return null;
            })(),
            'preferredShift' => (function () use ($form) {
                $pref = strtolower(trim((string)($form['preferredSchedule'] ?? '')));
                if (strpos($pref, 'afternoon') !== false) return 'afternoon';
                if (strpos($pref, 'morning') !== false)   return 'morning';
                return null;
            })(),
        ];
    };

    if ($singleUserId > 0) {
        if (empty($rows)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Student not found']);
            exit;
        }
        $student = $shapeRow($rows[0]);
        $documents = [];
        if (tableExists($pdo, 'documents')) {
            $hasType = columnExists($pdo, 'documents', 'type');
            $hasOriginalName = columnExists($pdo, 'documents', 'original_name');
            $hasAiStatus = columnExists($pdo, 'documents', 'ai_status');
            $hasUploadedAt = columnExists($pdo, 'documents', 'uploaded_at');
            $hasMime = columnExists($pdo, 'documents', 'mime_type');
            $hasReviewed = columnExists($pdo, 'documents', 'registrar_reviewed');
            $selectType = $hasType ? 'type' : "'' AS type";
            $selectOriginal = $hasOriginalName ? 'original_name' : "'' AS original_name";
            $selectAi = $hasAiStatus ? 'ai_status' : "'pending' AS ai_status";
            $selectUploaded = $hasUploadedAt ? 'uploaded_at' : 'NULL AS uploaded_at';
            $selectMimeCol = $hasMime ? 'mime_type' : "'' AS mime_type";
            $selectReviewed = $hasReviewed ? 'registrar_reviewed' : '0 AS registrar_reviewed';
            if (columnExists($pdo, 'documents', 'enrollment_id')) {
                $d = $pdo->prepare("SELECT id, {$selectType}, {$selectOriginal}, {$selectAi}, {$selectUploaded}, {$selectMimeCol}, {$selectReviewed} FROM documents WHERE enrollment_id = :eid ORDER BY id DESC");
                $d->execute([':eid' => $student['enrollmentId']]);
                $docs = $d->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } else {
                $docs = [];
            }

            // Dedupe documents by requirement type so legacy duplicate uploads
            // (created before the "replace on re-upload" fix landed) don't
            // double-count requirements on the approved-student detail view.
            // Rows are ordered by id DESC, so the first occurrence of each
            // type is the latest version of that document.
            $seenTypes = [];
            $dedupedDocs = [];
            foreach ($docs as $doc) {
                $typeKey = strtolower(trim((string)($doc['type'] ?? '')));
                if ($typeKey === '') {
                    $typeKey = '__id_' . (string)($doc['id'] ?? uniqid('', true));
                }
                if (isset($seenTypes[$typeKey])) {
                    continue;
                }
                $seenTypes[$typeKey] = true;
                $dedupedDocs[] = $doc;
            }
            $docs = $dedupedDocs;

            foreach ($docs as $doc) {
                $ui = documentRegistrarUiStatus($doc);
                $documents[] = [
                    'id' => (int)$doc['id'],
                    'type' => (string)($doc['type'] ?? ''),
                    'fileName' => (string)($doc['original_name'] ?? '') ?: 'Document',
                    'mimeType' => (string)($doc['mime_type'] ?? ''),
                    'aiStatus' => $ui,
                    'registrarReviewed' => (int)($doc['registrar_reviewed'] ?? 0) === 1,
                    'uploadedAt' => $doc['uploaded_at'] ?? null,
                ];
            }
        }
        $student['documents'] = $documents;
        appLogEvent($pdo, 'registrar_students', 'registrar', 'success', $actorId, 'user', (string)$singleUserId);
        echo json_encode(['success' => true, 'student' => $student, 'features' => [
            'credentials' => $hasSchoolUsername,
        ]]);
        exit;
    }

    // List mode
    $students = [];
    foreach ($rows as $row) {
        $students[] = $shapeRow($row);
    }
    appLogEvent($pdo, 'registrar_students', 'registrar', 'success', $actorId, 'endpoint', 'students', ['count' => count($students)]);
    $activeEnrollmentSy = getEnrollmentSchoolYear($pdo);
    echo json_encode([
        'success' => true,
        'students' => $students,
        'features' => ['credentials' => $hasSchoolUsername],
        'filters' => [
            'school_year_options' => registrarStudentSchoolYearOptions($pdo),
            'enrollment_school_year_current' => $activeEnrollmentSy,
            'school_year_applied' => $viewSy !== '' ? $viewSy : null,
            'school_year_mode' => strtolower($viewSyRaw) === 'all' ? 'all' : ($viewSy !== '' ? 'year' : 'all'),
        ],
    ]);
} catch (Throwable $e) {
    appLogEvent($pdo, 'registrar_students', 'registrar', 'failed', $actorId, 'endpoint', 'students', ['reason' => 'server_error', 'message' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to load students']);
}
