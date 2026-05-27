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

$actorId = (int)($_SERVER['HTTP_X_USER_ID'] ?? 0);
if ($actorId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Missing user context']);
    exit;
}
$role = getUserRole($pdo, $actorId);
if (!in_array($role, ['registrar', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

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

    // Build a plain-text reminder. We do NOT have the temporary password (only the hash);
    // this email tells the student the school username and the password format.
    $firstName = trim((string)($user['first_name'] ?? '')) ?: trim((string)($user['full_name'] ?? '')) ?: 'there';
    $appUrl = trim((string)(getenv('APP_PUBLIC_URL') ?: getenv('APP_BASE_URL') ?: 'http://localhost'));
    $body = "Hi {$firstName},\n\n"
        . "This is a reminder of your Nuestra Señora De Guia Academy student account.\n\n"
        . "  School username: {$schoolUsername}\n"
        . "  Temporary password: your date of birth in mm-dd-yyyy format\n\n"
        . "You can sign in at {$appUrl} using either your personal email or your school username. "
        . "If you have already changed your password, use the new one. "
        . "If you've forgotten it, contact the registrar's office for a reset.\n\n"
        . "— Nuestra Señora De Guia Academy\n";

    $sent = false;
    $deliveryError = null;
    if (file_exists(__DIR__ . '/mailer.php')) {
        require_once __DIR__ . '/mailer.php';
        try {
            if (function_exists('queueEmail')) {
                $queued = queueEmail($pdo, (string)$user['email'], 'Nuestra Señora De Guia Academy — your school account reminder', $body);
                if ($queued && function_exists('processSingleQueuedEmail')) {
                    $sent = (bool)processSingleQueuedEmail($pdo, (int)$queued);
                } else {
                    $sent = (bool)$queued;
                }
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

try {
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
            {$selectReligion}
        FROM enrollments e
        INNER JOIN users u ON u.id = e.user_id
        WHERE LOWER(e.status) IN ('approved', 'enrolled')
    ";
    $params = [];
    if ($singleUserId > 0) {
        $sql .= ' AND u.id = :uid';
        $params[':uid'] = $singleUserId;
    }
    $sql .= ' ORDER BY u.full_name ASC, e.id DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // For single mode, also fetch documents.
    $shapeRow = function (array $row) use ($pdo): array {
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
            // Raw status from `enrollments.status` so the UI can render the
            // right badge: "approved" = pending physical-doc collection,
            // "enrolled" = registrar received every required physical doc.
            'enrollmentStatus' => strtolower(trim((string)($row['enrollment_status'] ?? 'approved'))),
            'status' => strtolower(trim((string)($row['enrollment_status'] ?? 'approved'))) === 'enrolled' ? 'Enrolled' : 'Pending physical docs',
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
            foreach ($docs as $doc) {
                $st = strtolower((string)($doc['ai_status'] ?? 'pending'));
                $ui = $st === 'verified' ? 'Verified' : ($st === 'rejected' || $st === 'tampered' ? 'Flagged' : 'Under Review');
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
    echo json_encode([
        'success' => true,
        'students' => $students,
        'features' => ['credentials' => $hasSchoolUsername],
    ]);
} catch (Throwable $e) {
    appLogEvent($pdo, 'registrar_students', 'registrar', 'failed', $actorId, 'endpoint', 'students', ['reason' => 'server_error', 'message' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to load students']);
}
