<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/user_role.php';

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if (!in_array($method, ['GET', 'PATCH', 'PUT'], true)) {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

function tableExists(PDO $pdo, string $table): bool
{
    try {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table LIMIT 1');
        $stmt->execute([':table' => $table]);
        return (bool)$stmt->fetchColumn();
    } catch (Throwable $e) {
        return false;
    }
}

function columnExists(PDO $pdo, string $table, string $column): bool
{
    try {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1');
        $stmt->execute([':table' => $table, ':column' => $column]);
        return (bool)$stmt->fetchColumn();
    } catch (Throwable $e) {
        return false;
    }
}

/**
 * Human-readable status for the student portal.
 *
 * Once the registrar approves the enrollment form the student is enrolled.
 * Legacy rows may still carry `approved` in the database — show those as
 * Enrolled too. Physical-document collection is tracked separately.
 */
function studentEnrollmentDisplayStatus(string $normalized): string
{
    $n = strtolower(trim($normalized));
    return match ($n) {
        'approved', 'enrolled' => 'Enrolled',
        'rejected' => 'Rejected',
        'cancelled' => 'Cancelled',
        'pending' => 'Pending review',
        'under_review', 'under review', 'review' => 'Under review',
        'draft' => 'Draft',
        default => $n !== ''
            ? ucwords(str_replace(['_', '-'], ' ', $n))
            : 'Not submitted',
    };
}

/**
 * Parent/guardian line items for the dashboard from enrollment form_data when users.guardian_* was never synced.
 *
 * @param array<string, mixed> $fd
 * @return array{name: string, relationship: string, contact: string, email: string, occupation: string}
 */
function guardianDisplayFromEnrollmentForm(array $fd): array
{
    $join = static function (string ...$parts): string {
        $s = trim(implode(' ', array_map(static function ($p) {
            return trim((string)$p);
        }, $parts)));

        return trim(preg_replace('/\s+/', ' ', $s));
    };

    $gGiven = trim((string)($fd['guardianGivenName'] ?? ''));
    if ($gGiven !== '') {
        return [
            'name' => $join(
                (string)($fd['guardianGivenName'] ?? ''),
                (string)($fd['guardianMiddleName'] ?? ''),
                (string)($fd['guardianLastName'] ?? '')
            ),
            'relationship' => trim((string)($fd['relationshipToGuardian'] ?? '')),
            'contact' => trim((string)($fd['guardianContactNumber'] ?? '')),
            'email' => '',
            'occupation' => '',
        ];
    }

    $ec = strtolower(trim((string)($fd['emergencyContact'] ?? '')));
    if ($ec === 'mother') {
        return [
            'name' => $join(
                (string)($fd['motherGivenName'] ?? ''),
                (string)($fd['motherMaidenMiddleName'] ?? ''),
                (string)($fd['motherMaidenLastName'] ?? '')
            ),
            'relationship' => 'Mother',
            'contact' => trim((string)($fd['motherContactNumber'] ?? '')),
            'email' => '',
            'occupation' => trim((string)($fd['motherOccupation'] ?? '')),
        ];
    }
    if ($ec === 'father') {
        return [
            'name' => $join(
                (string)($fd['fatherGivenName'] ?? ''),
                (string)($fd['fatherMiddleName'] ?? ''),
                (string)($fd['fatherLastName'] ?? '')
            ),
            'relationship' => 'Father',
            'contact' => trim((string)($fd['fatherContactNumber'] ?? '')),
            'email' => '',
            'occupation' => trim((string)($fd['fatherOccupation'] ?? '')),
        ];
    }

    $motherName = $join(
        (string)($fd['motherGivenName'] ?? ''),
        (string)($fd['motherMaidenMiddleName'] ?? ''),
        (string)($fd['motherMaidenLastName'] ?? '')
    );
    if ($motherName !== '') {
        return [
            'name' => $motherName,
            'relationship' => 'Mother',
            'contact' => trim((string)($fd['motherContactNumber'] ?? '')),
            'email' => '',
            'occupation' => trim((string)($fd['motherOccupation'] ?? '')),
        ];
    }

    $fatherName = $join(
        (string)($fd['fatherGivenName'] ?? ''),
        (string)($fd['fatherMiddleName'] ?? ''),
        (string)($fd['fatherLastName'] ?? '')
    );
    if ($fatherName !== '') {
        return [
            'name' => $fatherName,
            'relationship' => 'Father',
            'contact' => trim((string)($fd['fatherContactNumber'] ?? '')),
            'email' => '',
            'occupation' => trim((string)($fd['fatherOccupation'] ?? '')),
        ];
    }

    return [
        'name' => '',
        'relationship' => '',
        'contact' => '',
        'email' => '',
        'occupation' => '',
    ];
}

/**
 * True when enrollment form_data has the required personal + parent/guardian fields
 * (mirrors StudentEnrollment validateStep1 + validateStep2 minimum).
 *
 * @param array<string, mixed> $fd
 */
function enrollmentProfileComplete(array $fd): bool
{
    if ($fd === []) {
        return false;
    }

    $required = [
        'enrollmentStatus',
        'givenName',
        'lastName',
        'gender',
        'contactNumber',
        'email',
        'lrn',
        'gradeLevel',
        'strand',
        'preferredSchedule',
        'birthDate',
        'birthPlace',
        'religion',
        'municipality',
        'barangay',
        'street',
    ];
    foreach ($required as $field) {
        if (trim((string)($fd[$field] ?? '')) === '') {
            return false;
        }
    }

    $mother = trim((string)($fd['motherGivenName'] ?? ''));
    $father = trim((string)($fd['fatherGivenName'] ?? ''));
    $hasGuardian = !empty($fd['hasGuardian']);
    $guardian = trim((string)($fd['guardianGivenName'] ?? ''));
    $hasGuardianFilled = $hasGuardian && $guardian !== '';

    if ($mother === '' && $father === '' && !$hasGuardianFilled) {
        return false;
    }

    if (trim((string)($fd['emergencyContact'] ?? '')) === '') {
        return false;
    }

    return true;
}

/**
 * @param array<string, string> $fromUser
 * @param array<string, string> $fromForm
 *
 * @return array<string, string>
 */
function mergeGuardianForPortal(array $fromUser, array $fromForm): array
{
    $out = $fromUser;
    foreach (['name', 'relationship', 'contact', 'email', 'occupation'] as $k) {
        $u = trim((string)($fromUser[$k] ?? ''));
        $f = trim((string)($fromForm[$k] ?? ''));
        if ($u === '' && $f !== '') {
            $out[$k] = $f;
        }
    }

    return $out;
}

/**
 * Keep enrollment draft form_data in sync when the student updates contact info on the dashboard.
 *
 * @param array<string, string> $updates keys: phone, email, address
 */
function syncEnrollmentFormContact(PDO $pdo, int $userId, array $updates): void
{
    if (!tableExists($pdo, 'enrollments')) {
        return;
    }
    $stmt = $pdo->prepare('SELECT id, enrollment_steps FROM enrollments WHERE user_id = :user_id ORDER BY id DESC LIMIT 1');
    $stmt->execute([':user_id' => $userId]);
    $row = $stmt->fetch();
    if (!$row || empty($row['enrollment_steps'])) {
        return;
    }
    $decoded = json_decode((string)$row['enrollment_steps'], true);
    if (!is_array($decoded)) {
        return;
    }
    if (!isset($decoded['form_data']) || !is_array($decoded['form_data'])) {
        $decoded['form_data'] = [];
    }
    $fd = &$decoded['form_data'];
    if (isset($updates['phone'])) {
        $fd['contactNumber'] = $updates['phone'];
    }
    if (isset($updates['email'])) {
        $fd['email'] = $updates['email'];
    }
    if (isset($updates['address']) && $updates['address'] !== '') {
        $fd['blockLotHouseNo'] = $updates['address'];
    }
    $upd = $pdo->prepare('UPDATE enrollments SET enrollment_steps = :steps, updated_at = NOW() WHERE id = :id LIMIT 1');
    $upd->execute([
        ':steps' => json_encode($decoded, JSON_UNESCAPED_UNICODE),
        ':id' => (int)$row['id'],
    ]);
}

require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/permission_guard.php';
$actor = apiRequireActor($pdo, 'student/me');
$userId = $actor['id'];
if ($actor['role'] !== 'student') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

if (!tableExists($pdo, 'users')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Users table not found']);
    exit;
}

try {
    $userStmt = $pdo->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
    $userStmt->execute([':id' => $userId]);
    $user = $userStmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found']);
        exit;
    }

    if ($method === 'PATCH' || $method === 'PUT') {
        requireActorPermission($pdo, $actor, 'editProfile', false);
        $rawBody = file_get_contents('php://input') ?: '';
        $payload = json_decode($rawBody !== '' ? $rawBody : '{}', true);
        if (!is_array($payload)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid request payload']);
            exit;
        }

        $phone = array_key_exists('phone', $payload) ? trim((string)$payload['phone']) : null;
        $email = array_key_exists('email', $payload) ? strtolower(trim((string)$payload['email'])) : null;
        $address = array_key_exists('address', $payload) ? trim((string)$payload['address']) : null;

        if ($phone === null && $email === null && $address === null) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Nothing to update']);
            exit;
        }

        if ($email !== null) {
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(422);
                echo json_encode(['success' => false, 'error' => 'Invalid email address']);
                exit;
            }
            $dup = $pdo->prepare('SELECT id FROM users WHERE email = :email AND id <> :id LIMIT 1');
            $dup->execute([':email' => $email, ':id' => $userId]);
            if ($dup->fetch()) {
                http_response_code(409);
                echo json_encode(['success' => false, 'error' => 'Email is already in use']);
                exit;
            }
        }

        if ($phone !== null && $phone === '') {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Contact number is required']);
            exit;
        }

        $setParts = [];
        $params = [':id' => $userId];
        $formSync = [];

        if ($phone !== null && columnExists($pdo, 'users', 'phone')) {
            $setParts[] = 'phone = :phone';
            $params[':phone'] = $phone;
            $formSync['phone'] = $phone;
        }
        if ($email !== null) {
            $setParts[] = 'email = :email';
            $params[':email'] = $email;
            $formSync['email'] = $email;
        }
        if ($address !== null && columnExists($pdo, 'users', 'address')) {
            $setParts[] = 'address = :address';
            $params[':address'] = $address;
            $formSync['address'] = $address;
        }

        if ($setParts === []) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Could not update profile fields']);
            exit;
        }

        $sql = 'UPDATE users SET ' . implode(', ', $setParts) . ' WHERE id = :id LIMIT 1';
        $pdo->prepare($sql)->execute($params);

        if ($formSync !== []) {
            syncEnrollmentFormContact($pdo, $userId, $formSync);
        }

        $userStmt->execute([':id' => $userId]);
        $user = $userStmt->fetch() ?: $user;

        echo json_encode([
            'success' => true,
            'message' => 'Profile updated successfully',
            'profile' => [
                'phone' => (string)($user['phone'] ?? ''),
                'email' => (string)($user['email'] ?? ''),
                'address' => (string)($user['address'] ?? ''),
            ],
        ]);
        exit;
    }

    $enrollment = null;
    if (tableExists($pdo, 'enrollments')) {
        require_once __DIR__ . '/enrollment_status_helpers.php';
        require_once __DIR__ . '/school_year_helpers.php';
        $enrollment = pickPrimaryEnrollmentRow($pdo, $userId, getEnrollmentSchoolYear($pdo));
        if (is_array($enrollment)) {
            revertAutoEnrolledNewSyApplication($pdo, $userId, $enrollment);
            stripNonGrade12CarriedDocuments($pdo, $userId, $enrollment);
            autoEnrollReturningGrade12Rollover($pdo, $userId, $enrollment);
            repairEnrollmentStatusIfCredentialsIssued($pdo, $userId, $enrollment);
            healGrade12CarriedDocuments($pdo, $userId, $enrollment);
            $enrollmentIdForHeal = (int)($enrollment['id'] ?? 0);
            if ($enrollmentIdForHeal > 0) {
                healClearedDocumentUploadCounts($pdo, $enrollmentIdForHeal);
            }
        }
    }

    $documentRows = [];
    if (tableExists($pdo, 'documents')) {
        $eid = (is_array($enrollment) && !empty($enrollment['id'])) ? (int)$enrollment['id'] : 0;
        $hasDocRemarks = columnExists($pdo, 'documents', 'registrar_doc_remarks');
        $selectDocRemarks = $hasDocRemarks ? 'registrar_doc_remarks' : "'' AS registrar_doc_remarks";
        // Include the registrar-side review flag so the student page can show
        // "Reviewed" once the registrar has manually checked a document, even
        // before the application as a whole has been approved.
        $hasReviewedFlag = columnExists($pdo, 'documents', 'registrar_reviewed');
        $selectReviewed = $hasReviewedFlag ? 'registrar_reviewed' : '0 AS registrar_reviewed';
        $hasDocDecision = columnExists($pdo, 'documents', 'registrar_doc_decision');
        $selectDocDecision = $hasDocDecision ? 'registrar_doc_decision' : "'' AS registrar_doc_decision";
        $hasCarriedForward = columnExists($pdo, 'documents', 'carried_forward');
        $selectCarriedForward = $hasCarriedForward ? 'carried_forward' : '0 AS carried_forward';
        if ($eid > 0 && columnExists($pdo, 'documents', 'enrollment_id')) {
            $docEnr = $pdo->prepare(
                'SELECT id, type, original_name, ai_status, ' . $selectReviewed . ', ' . $selectDocDecision . ', '
                . $selectDocRemarks . ', ' . $selectCarriedForward . ' FROM documents WHERE enrollment_id = :eid ORDER BY id DESC'
            );
            $docEnr->execute([':eid' => $eid]);
            $documentRows = array_merge($documentRows, $docEnr->fetchAll() ?: []);
        }
        if (columnExists($pdo, 'documents', 'student_id') && tableExists($pdo, 'students')) {
            $studentIdStmt = $pdo->prepare('SELECT id FROM students WHERE user_id = :user_id LIMIT 1');
            $studentIdStmt->execute([':user_id' => $userId]);
            $studentId = (int)($studentIdStmt->fetchColumn() ?: 0);
            if ($studentId > 0) {
                $docStmt = $pdo->prepare(
                    'SELECT id, type, original_name, ai_status, ' . $selectReviewed . ', ' . $selectDocDecision . ', '
                    . $selectDocRemarks . ', ' . $selectCarriedForward . ' FROM documents WHERE student_id = :student_id ORDER BY id DESC'
                );
                $docStmt->execute([':student_id' => $studentId]);
                $documentRows = array_merge($documentRows, $docStmt->fetchAll() ?: []);
            }
        }
    }

    $hasEnrollment = is_array($enrollment) && !empty($enrollment);

    /** Normalize DB values (e.g. "Approved", whitespace) for comparisons. */
    $enrollmentStatusNorm = $hasEnrollment
        ? strtolower(trim((string)($enrollment['status'] ?? '')))
        : '';
    $isApproved = in_array($enrollmentStatusNorm, ['approved', 'enrolled'], true);
    $isRejected = $enrollmentStatusNorm === 'rejected';
    $submittedForReview = $hasEnrollment
        && $enrollmentStatusNorm !== ''
        && !in_array($enrollmentStatusNorm, ['draft', 'cancelled'], true);

    $enrollmentFormData = [];
    if ($hasEnrollment && !empty($enrollment['enrollment_steps'])) {
        $decodedSteps = json_decode((string)$enrollment['enrollment_steps'], true);
        if (is_array($decodedSteps) && isset($decodedSteps['form_data']) && is_array($decodedSteps['form_data'])) {
            $enrollmentFormData = $decodedSteps['form_data'];
        }
    }

    $applicationStatusDisplay = $hasEnrollment
        ? studentEnrollmentDisplayStatus($enrollmentStatusNorm)
        : 'Not submitted';

    /**
     * Prefer the structured `users.first_name|middle_name|last_name|extension_name`
     * columns when they are populated (added by the credentials migration and
     * backfilled at enrollment-submission time). Fall back to whatever the
     * student typed in the latest enrollment form when the columns are NULL or
     * missing entirely (older schemas pre-migration).
     */
    $hasFirstNameCol = columnExists($pdo, 'users', 'first_name');
    $hasMiddleNameCol = columnExists($pdo, 'users', 'middle_name');
    $hasLastNameCol = columnExists($pdo, 'users', 'last_name');
    $hasExtensionNameCol = columnExists($pdo, 'users', 'extension_name');

    $userFirstName = $hasFirstNameCol ? trim((string)($user['first_name'] ?? '')) : '';
    $userMiddleName = $hasMiddleNameCol ? trim((string)($user['middle_name'] ?? '')) : '';
    $userLastName = $hasLastNameCol ? trim((string)($user['last_name'] ?? '')) : '';
    $userExtensionName = $hasExtensionNameCol ? trim((string)($user['extension_name'] ?? '')) : '';

    $formFirstName = trim((string)($enrollmentFormData['givenName'] ?? ''));
    $formMiddleName = trim((string)($enrollmentFormData['middleName'] ?? ''));
    $formLastName = trim((string)($enrollmentFormData['lastName'] ?? ''));
    $formExtensionName = trim((string)($enrollmentFormData['extensionName'] ?? ''));

    $firstName = $userFirstName !== '' ? $userFirstName : $formFirstName;
    $middleName = $userMiddleName !== '' ? $userMiddleName : $formMiddleName;
    $lastName = $userLastName !== '' ? $userLastName : $formLastName;
    $extensionName = $userExtensionName !== '' ? $userExtensionName : $formExtensionName;

    $usersFullName = trim((string)($user['full_name'] ?? ''));
    $hasEnrollmentName = $firstName !== '' || $middleName !== '' || $lastName !== '';
    if ($hasEnrollmentName) {
        // Compose a display string from the parts. Skip blanks gracefully.
        $composed = trim(preg_replace('/\s+/', ' ', sprintf(
            '%s %s %s %s',
            $firstName,
            $middleName,
            $lastName,
            $extensionName
        )));
        $displayFullName = $composed !== '' ? $composed : $usersFullName;
    } else {
        $displayFullName = $usersFullName;
    }

    $hasSchoolUsernameCol = columnExists($pdo, 'users', 'school_username');
    $hasMustChangePasswordCol = columnExists($pdo, 'users', 'must_change_password');

    $schoolUsername = null;
    if ($hasSchoolUsernameCol) {
        $rawSchoolUsername = $user['school_username'] ?? null;
        if ($rawSchoolUsername !== null && trim((string)$rawSchoolUsername) !== '') {
            $schoolUsername = (string)$rawSchoolUsername;
        }
    }

    $mustChangePassword = false;
    if ($hasMustChangePasswordCol) {
        $mustChangePassword = (bool)((int)($user['must_change_password'] ?? 0));
    }

    $profile = [
        'full_name' => $displayFullName,
        // Components for UIs that prefer to show first/middle/last separately.
        // Empty strings until the enrollment form is filled in.
        'first_name' => $firstName,
        'middle_name' => $middleName,
        'last_name' => $lastName,
        'extension_name' => $extensionName,
        'date_of_birth' => (string)($user['date_of_birth'] ?? ''),
        'gender' => (string)($user['gender'] ?? ''),
        'phone' => (string)($user['phone'] ?? ''),
        'email' => (string)($user['email'] ?? ''),
        'address' => (string)($user['address'] ?? ''),
        'strand' => $hasEnrollment ? (string)($enrollment['strand'] ?? '') : '',
        'grade_level' => $hasEnrollment ? (string)($enrollment['grade_level'] ?? '') : '',
        'school_year' => $hasEnrollment ? (string)($enrollment['school_year'] ?? '') : '',
        // IMPORTANT: brand-new users must NOT be treated as "pending" (which locks enrollment).
        // Only set a real status when an enrollment row exists.
        'application_status' => $applicationStatusDisplay,
        'school_username' => $schoolUsername,
        'must_change_password' => $mustChangePassword,
    ];

    $guardian = [
        'name' => (string)($user['guardian_name'] ?? ''),
        'relationship' => (string)($user['guardian_relationship'] ?? ''),
        'contact' => (string)($user['guardian_phone'] ?? ''),
        'email' => (string)($user['guardian_email'] ?? ''),
        'occupation' => (string)($user['guardian_occupation'] ?? ''),
    ];
    if (!empty($enrollmentFormData)) {
        $guardian = mergeGuardianForPortal($guardian, guardianDisplayFromEnrollmentForm($enrollmentFormData));
    }

    // Keep only the latest upload per document type (documents are returned newest-first).
    $latestDocsByType = [];
    foreach ($documentRows as $r) {
        $t = strtolower(trim((string)($r['type'] ?? '')));
        if ($t === '') $t = 'document';
        if (!array_key_exists($t, $latestDocsByType)) {
            $latestDocsByType[$t] = $r;
        }
    }
    $latestDocs = array_values($latestDocsByType);

    $hasDocUploads = count($latestDocs) > 0;
    $hasRejectedDocs = false;
    foreach ($latestDocs as $r) {
        if (documentNeedsStudentResubmit($r)) {
            $hasRejectedDocs = true;
            break;
        }
    }
    // "Completed" only when latest docs are not rejected (student must re-upload to clear rejections).
    $documentsDone = $hasDocUploads && !$hasRejectedDocs;

    $profileComplete = $submittedForReview
        || $isApproved
        || enrollmentProfileComplete($enrollmentFormData);

    $profileStepStatus = 'pending';
    if ($profileComplete) {
        $profileStepStatus = 'completed';
    } elseif ($hasEnrollment) {
        $profileStepStatus = 'current';
    }

    $documentsStepStatus = 'pending';
    if ($documentsDone) {
        $documentsStepStatus = 'completed';
    } elseif ($profileComplete && $hasEnrollment) {
        $documentsStepStatus = 'current';
    }

    $reviewStepStatus = 'pending';
    if ($isApproved) {
        $reviewStepStatus = 'completed';
    } elseif ($submittedForReview && !$isRejected) {
        $reviewStepStatus = 'current';
    }

    $finalTitle = 'Enrollment complete';
    $finalStepStatus = 'pending';
    if ($isApproved) {
        $finalStepStatus = 'completed';
    }

    $steps = [
        ['key' => 'profile', 'title' => 'Profile Information', 'status' => $profileStepStatus],
        ['key' => 'documents', 'title' => 'Document Submission', 'status' => $documentsStepStatus],
        ['key' => 'review', 'title' => 'Registrar Review', 'status' => $reviewStepStatus],
        ['key' => 'final', 'title' => $finalTitle, 'status' => $finalStepStatus],
    ];

    $completedCount = 0;
    foreach ($steps as $step) {
        if ($step['status'] === 'completed') {
            $completedCount++;
        }
    }
    $totalSteps = count($steps);
    $percent = (int)floor(($completedCount / max($totalSteps, 1)) * 100);

    // Human-readable label for each requirement type, so the student portal can
    // show "PSA Birth Certificate" instead of the technical key or a raw filename
    // like "psa tamper 1.jpg".
    $requirementLabelFor = static function (string $type): string {
        $t = strtolower(trim($type));
        switch ($t) {
            case 'birth_certificate':
            case 'birthcert':
            case 'psa':
                return 'PSA Birth Certificate';
            case 'good_moral':
            case 'goodmoral':
                return 'Good Moral Certificate';
            case 'sf9':
            case 'report_card':
                return 'SF9 / Report Card';
            case 'form137':
            case 'sf10':
                return 'SF10 / Form 137';
            case 'photo_2x2':
            case 'id_picture':
            case 'picture_2x2':
                return '2x2 Picture (White Background)';
            case '':
            case 'document':
                return 'Document';
            default:
                // Fallback: turn "snake_case" / "kebab-case" into Title Case.
                $pretty = preg_replace('/[_\-]+/', ' ', $t) ?? $t;
                return ucwords(trim($pretty));
        }
    };

    $documents = array_map(static function (array $row) use ($requirementLabelFor): array {
        $type = (string)($row['type'] ?? '');
        $registrarReviewed = (int)($row['registrar_reviewed'] ?? 0) === 1;
        $decision = strtolower(trim((string)($row['registrar_doc_decision'] ?? '')));
        return [
            // Filename of the uploaded file (kept for backwards-compat with the
            // existing UI; shown as a small subtitle on the student portal).
            'name' => (string)($row['original_name'] ?? $type ?? 'Document'),
            // Machine key (e.g. "birth_certificate") for any future UI logic.
            'type' => $type,
            // Human-readable requirement label, e.g. "PSA Birth Certificate".
            'requirementLabel' => $requirementLabelFor($type),
            'status' => (string)($row['ai_status'] ?? 'pending'),
            // True once the registrar has manually marked the document as
            // reviewed. Lets the student portal show "Reviewed" instead of
            // "Pending" even before the whole application is approved.
            'registrarReviewed' => $registrarReviewed,
            'registrarDecision' => $decision,
            'remarks' => (string)($row['registrar_doc_remarks'] ?? ''),
            'carriedForward' => (int)($row['carried_forward'] ?? 0) === 1,
        ];
    }, $latestDocs);

    $modeOfPayment = (string)($enrollmentFormData['modeOfPayment'] ?? '');
    $voucherNo = (string)($enrollmentFormData['voucherNo'] ?? '');

    $application = [
        'id' => $hasEnrollment ? (string)($enrollment['id'] ?? '') : '',
        'display_id' => $hasEnrollment
            ? 'APP-' . date('Y') . '-' . str_pad((string)($enrollment['id'] ?? ''), 3, '0', STR_PAD_LEFT)
            : '',
        'status' => $applicationStatusDisplay,
        /** Lowercase normalized DB status for UI logic (e.g. approved, pending). */
        'status_code' => $hasEnrollment ? $enrollmentStatusNorm : '',
        'submittedDate' => $hasEnrollment ? (string)($enrollment['applied_at'] ?? ($user['created_at'] ?? '')) : (string)($user['created_at'] ?? ''),
        'lastUpdated' => $hasEnrollment ? (string)($enrollment['updated_at'] ?? ($user['updated_at'] ?? '')) : (string)($user['updated_at'] ?? ''),
        'documents' => $documents,
        'registrarRemarks' => $hasEnrollment ? (string)($enrollment['registrar_remarks'] ?? '') : '',
        'mode_of_payment' => $modeOfPayment,
        'voucher_no' => $voucherNo,
    ];

    echo json_encode([
        'success' => true,
        'profile' => $profile,
        'guardian' => $guardian,
        'enrollment_progress' => [
            'completed_count' => $completedCount,
            'total_steps' => $totalSteps,
            'percent' => $percent,
            'steps' => $steps,
        ],
        'application' => $application,
        'school_username' => $schoolUsername,
        'must_change_password' => $mustChangePassword,
        // Suppress resubmission prompts once the registrar has approved or
        // fully enrolled the student — per-document rejections are stale.
        'needs_resubmission' => $hasRejectedDocs
            && $enrollmentStatusNorm !== 'approved'
            && $enrollmentStatusNorm !== 'enrolled',
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to load student portal data',
    ]);
}
