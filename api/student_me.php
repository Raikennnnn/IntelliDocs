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

/** Human-readable status for the student portal (e.g. approved → Enrolled). */
function studentEnrollmentDisplayStatus(string $normalized): string
{
    $n = strtolower(trim($normalized));
    return match ($n) {
        'approved' => 'Enrolled',
        'rejected' => 'Rejected',
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

$userId = (int)($_SERVER['HTTP_X_USER_ID'] ?? 0);
if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Missing user context']);
    exit;
}

if (getUserRole($pdo, $userId) !== 'student') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

require_once __DIR__ . '/security_guard.php';
runAuthenticatedSecurityGuards($pdo, $userId, 'student/me');

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
        $enrollmentStmt = $pdo->prepare('SELECT * FROM enrollments WHERE user_id = :user_id ORDER BY id DESC LIMIT 1');
        $enrollmentStmt->execute([':user_id' => $userId]);
        $enrollment = $enrollmentStmt->fetch() ?: null;
    }

    $documentRows = [];
    if (tableExists($pdo, 'documents')) {
        $eid = (is_array($enrollment) && !empty($enrollment['id'])) ? (int)$enrollment['id'] : 0;
        if ($eid > 0 && columnExists($pdo, 'documents', 'enrollment_id')) {
            $docEnr = $pdo->prepare('SELECT type, original_name, ai_status FROM documents WHERE enrollment_id = :eid ORDER BY id DESC');
            $docEnr->execute([':eid' => $eid]);
            $documentRows = array_merge($documentRows, $docEnr->fetchAll() ?: []);
        }
        if (columnExists($pdo, 'documents', 'student_id') && tableExists($pdo, 'students')) {
            $studentIdStmt = $pdo->prepare('SELECT id FROM students WHERE user_id = :user_id LIMIT 1');
            $studentIdStmt->execute([':user_id' => $userId]);
            $studentId = (int)($studentIdStmt->fetchColumn() ?: 0);
            if ($studentId > 0) {
                $docStmt = $pdo->prepare('SELECT type, original_name, ai_status FROM documents WHERE student_id = :student_id ORDER BY id DESC');
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
    $isApproved = $enrollmentStatusNorm === 'approved';
    $isRejected = $enrollmentStatusNorm === 'rejected';
    $submittedForReview = $hasEnrollment
        && $enrollmentStatusNorm !== ''
        && $enrollmentStatusNorm !== 'draft';

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

    $hasDocUploads = count($documentRows) > 0;
    // Requirements satisfied if files exist on enrollment, or application already submitted to registrar.
    $documentsDone = $hasDocUploads || $submittedForReview;

    $documentsStepStatus = 'pending';
    if ($documentsDone) {
        $documentsStepStatus = 'completed';
    } elseif ($hasEnrollment) {
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
        ['key' => 'profile', 'title' => 'Profile Information', 'status' => 'completed'],
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

    $documents = array_map(static function (array $row): array {
        return [
            'name' => (string)($row['original_name'] ?? $row['type'] ?? 'Document'),
            'status' => (string)($row['ai_status'] ?? 'pending'),
            'remarks' => '',
        ];
    }, $documentRows);

    $modeOfPayment = (string)($enrollmentFormData['modeOfPayment'] ?? '');
    $voucherNo = (string)($enrollmentFormData['voucherNo'] ?? '');

    $application = [
        'id' => $hasEnrollment ? (string)($enrollment['id'] ?? '') : '',
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
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to load student portal data',
    ]);
}
