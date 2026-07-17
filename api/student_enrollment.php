<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/school_year_helpers.php';
require_once __DIR__ . '/enrollment_status_helpers.php';
require_once __DIR__ . '/cohort_helpers.php';
require_once __DIR__ . '/grade12_continuation_helpers.php';
require_once __DIR__ . '/strand_helpers.php';
require_once __DIR__ . '/user_consents.php';
require_once __DIR__ . '/document_authenticity_consent.php';
require_once __DIR__ . '/section_assignment.php';

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

function requireUserId(): int
{
    global $pdo;
    require_once __DIR__ . '/api_auth.php';
    $actor = apiRequireActor($pdo, 'student/enrollment');
    if ($actor['role'] !== 'student') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Access denied']);
        exit;
    }
    return $actor['id'];
}

function ensureEnrollmentSchema(PDO $pdo): void
{
    if (!tableExists($pdo, 'enrollments')) {
        return;
    }
    $requiredColumns = [
        'grade_level' => 'VARCHAR(30) NULL',
        'strand' => 'VARCHAR(50) NULL',
        'school_year' => 'VARCHAR(30) NULL',
        'status' => "VARCHAR(40) DEFAULT 'pending'",
        // LONGTEXT for broader MySQL/MariaDB compatibility across XAMPP builds.
        'enrollment_steps' => 'LONGTEXT NULL',
        'updated_at' => 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    ];
    foreach ($requiredColumns as $col => $ddl) {
        if (!columnExists($pdo, 'enrollments', $col)) {
            $pdo->exec("ALTER TABLE enrollments ADD COLUMN {$col} {$ddl}");
        }
    }

    // Older XAMPP schemas used an ENUM without `draft`. Saving a draft then
    // stored '' (invalid enum), which hid the application from the registrar.
    try {
        $typeStmt = $pdo->query("SHOW COLUMNS FROM enrollments LIKE 'status'");
        $typeRow = $typeStmt ? $typeStmt->fetch(PDO::FETCH_ASSOC) : false;
        $colType = strtolower((string)($typeRow['Type'] ?? ''));
        if (str_starts_with($colType, 'enum(') && !str_contains($colType, "'draft'")) {
            $pdo->exec(
                "ALTER TABLE enrollments
                 MODIFY COLUMN status ENUM('draft','pending','under_review','approved','enrolled','rejected')
                 NOT NULL DEFAULT 'pending'"
            );
        }
        $pdo->exec(
            "UPDATE enrollments
             SET status = 'draft'
             WHERE TRIM(COALESCE(status, '')) = ''"
        );
    } catch (Throwable $e) {
        // Non-fatal — upload/save can still proceed.
    }
}

function isLockedStatus(string $status): bool
{
    $s = strtolower(trim($status));
    // `enrolled` must be locked — otherwise an already-enrolled student can
    // submit again and overwrite status back to `pending`, which puts them
    // back in the registrar Applications queue and breaks approve.
    return in_array($s, ['pending', 'under_review', 'under review', 'review', 'approved', 'enrolled'], true);
}

/** Statuses a student may cancel from the portal (before final approval). */
function isCancellableStatus(string $status): bool
{
    $s = strtolower(trim($status));
    return in_array($s, ['draft', 'pending', 'under_review', 'under review', 'review', 'rejected'], true);
}

/** Senior High: block impossible DOBs (e.g. newborn) when a value is present. */
/** @return array<string, mixed> */
function parseEnrollmentFormDataFromSteps(?string $enrollmentStepsJson): array
{
    if ($enrollmentStepsJson === null || trim($enrollmentStepsJson) === '') {
        return [];
    }
    $steps = json_decode($enrollmentStepsJson, true);
    if (!is_array($steps)) {
        return [];
    }
    $formData = $steps['form_data'] ?? null;

    return is_array($formData) ? $formData : [];
}

/** Strip fields that must be re-confirmed for a new school year. */
function sanitizePriorFormDataForClient(array $formData): array
{
    $formData['confirmInformation'] = false;

    return $formData;
}

/**
 * When a student continues at NSDGA for a new SY, enrollment history should
 * reflect the grade/section/SY they just completed — not their first SHS
 * application (e.g. Grade 10 + 2019-2020 from before they joined).
 */
function formatPriorEnrollmentSectionLabel(int $gradeNumber, string $sectionName): string
{
    $sectionName = trim($sectionName);
    if ($sectionName === '') {
        return '';
    }
    if (preg_match('/^(\d+)\-(.+)$/i', $sectionName, $m)) {
        return $gradeNumber . '-' . strtoupper(trim((string)$m[2]));
    }

    return $gradeNumber . '-' . strtoupper($sectionName);
}

/**
 * @param array<string, mixed> $formData
 * @param array<string, mixed> $priorApproved
 * @param array{section?: string|null, shift?: string|null}|null $studentSection
 * @return array<string, mixed>
 */
function syncEnrollmentHistoryForContinuingStudent(
    array $formData,
    array $priorApproved,
    ?array $studentSection
): array {
    $priorGrade = (int)($priorApproved['grade_level_number'] ?? 0);
    $priorSy = trim((string)($priorApproved['school_year'] ?? ''));
    if ($priorGrade < 10 || $priorSy === '') {
        return $formData;
    }

    $formData['gradeLevelAtPreviousSchool'] = 'Grade ' . $priorGrade;
    $formData['lastSchoolYearAttended'] = $priorSy;

    $sectionRaw = trim((string)($studentSection['section'] ?? ''));
    if ($sectionRaw !== '') {
        $formData['sectionAtPreviousSchool'] = formatPriorEnrollmentSectionLabel($priorGrade, $sectionRaw);
    }

    $prevSchool = trim((string)($formData['previousSchoolAttended'] ?? ''));
    $looksLikeNsdga = $prevSchool === ''
        || stripos($prevSchool, 'NUESTRA') !== false
        || stripos($prevSchool, 'NSDGA') !== false
        || stripos($prevSchool, 'GUIA') !== false
        || stripos($prevSchool, 'MARIKINA') !== false;
    if ($looksLikeNsdga) {
        $formData['previousSchoolAttended'] = 'NUESTRA SEÑORA DE GUIA ACADEMY OF MARIKINA';
    }

    return $formData;
}

/** @return array<string, mixed>|null */
function buildNewSchoolYearPrefillFormData(?array $priorApproved, ?array $studentSection = null): ?array
{
    if ($priorApproved === null) {
        return null;
    }
    $raw = $priorApproved['form_data'] ?? null;
    if (!is_array($raw) || $raw === []) {
        return null;
    }

    $formData = sanitizePriorFormDataForClient($raw);
    $formData['enrollmentStatus'] = 'old';

    $priorGrade = (int)($priorApproved['grade_level_number'] ?? 0);
    if ($priorGrade === 11) {
        $formData['gradeLevel'] = '12';
    } elseif ($priorGrade >= 12) {
        $formData['gradeLevel'] = '12';
    }

    $strand = trim((string)($priorApproved['strand'] ?? ''));
    if ($strand !== '') {
        $formData['strand'] = $strand;
    }

    $shift = trim((string)($studentSection['shift'] ?? ''));
    if ($shift !== '') {
        $formData['preferredSchedule'] = assignmentShiftToFormLabel($shift);
    }

    return syncEnrollmentHistoryForContinuingStudent($formData, $priorApproved, $studentSection);
}

/**
 * When a student starts a new SY enrollment row, copy their latest document
 * uploads from the most recent enrolled record so they do not re-upload.
 */
function copyDocumentsFromPriorEnrollment(PDO $pdo, int $userId, int $newEnrollmentId, string $newGradeLevel = ''): int
{
    if ($newEnrollmentId <= 0 || enrollmentGradeNumber($newGradeLevel) !== 12) {
        return 0;
    }

    if (!tableExists($pdo, 'documents') || !columnExists($pdo, 'documents', 'enrollment_id')) {
        return 0;
    }

    $priorStmt = $pdo->prepare(
        "SELECT id FROM enrollments
         WHERE user_id = :user_id
           AND id <> :new_id
           AND LOWER(status) IN ('approved', 'enrolled')
         ORDER BY id DESC
         LIMIT 1"
    );
    $priorStmt->execute([':user_id' => $userId, ':new_id' => $newEnrollmentId]);
    $fromId = (int)($priorStmt->fetchColumn() ?: 0);
    if ($fromId <= 0) {
        return 0;
    }

    $srcCols = ['id', 'type', 'filename', 'original_name', 'mime_type', 'file_size', 'file_path', 'ai_status'];
    if (columnExists($pdo, 'documents', 'registrar_reviewed')) {
        $srcCols[] = 'registrar_reviewed';
    }
    if (columnExists($pdo, 'documents', 'registrar_doc_decision')) {
        $srcCols[] = 'registrar_doc_decision';
    }
    if (columnExists($pdo, 'documents', 'registrar_doc_remarks')) {
        $srcCols[] = 'registrar_doc_remarks';
    }
    $srcStmt = $pdo->prepare(
        'SELECT ' . implode(', ', $srcCols) . ' FROM documents WHERE enrollment_id = :eid ORDER BY id DESC'
    );
    $srcStmt->execute([':eid' => $fromId]);
    $rows = $srcStmt->fetchAll() ?: [];
    if ($rows === []) {
        return 0;
    }

    $seenTypes = [];
    $copied = 0;
    $hasUploadCount = columnExists($pdo, 'documents', 'upload_count');

    foreach ($rows as $row) {
        $type = trim((string)($row['type'] ?? ''));
        if ($type === '') {
            continue;
        }
        $key = normalizeDocumentRequirementKey($type);
        if ($key === '' || isset($seenTypes[$key])) {
            continue;
        }
        $seenTypes[$key] = true;

        $existingRows = $pdo->prepare('SELECT type FROM documents WHERE enrollment_id = :eid');
        $existingRows->execute([':eid' => $newEnrollmentId]);
        $alreadyHas = false;
        foreach ($existingRows->fetchAll(PDO::FETCH_ASSOC) ?: [] as $existing) {
            if (normalizeDocumentRequirementKey((string)($existing['type'] ?? '')) === $key) {
                $alreadyHas = true;
                break;
            }
        }
        if ($alreadyHas) {
            continue;
        }

        $wasVerified = documentRowCountsAsVerified($row);
        $aiStatus = $wasVerified ? trim((string)($row['ai_status'] ?? '')) : '';
        if ($aiStatus === '') {
            $aiStatus = $wasVerified ? 'verified' : 'pending';
        }

        $hasCarriedForward = columnExists($pdo, 'documents', 'carried_forward');
        $hasReviewed = columnExists($pdo, 'documents', 'registrar_reviewed');
        $hasDecision = columnExists($pdo, 'documents', 'registrar_doc_decision');
        $hasRemarks = columnExists($pdo, 'documents', 'registrar_doc_remarks');

        $insertCols = [
            'enrollment_id',
            'type',
            'filename',
            'original_name',
            'mime_type',
            'file_size',
            'file_path',
            'ai_status',
        ];
        $insertVals = [
            ':enrollment_id',
            ':type',
            ':filename',
            ':original_name',
            ':mime_type',
            ':file_size',
            ':file_path',
            ':ai_status',
        ];
        $params = [
            ':enrollment_id' => $newEnrollmentId,
            ':type' => $type,
            ':filename' => (string)($row['filename'] ?? ''),
            ':original_name' => (string)($row['original_name'] ?? ''),
            ':mime_type' => (string)($row['mime_type'] ?? ''),
            ':file_size' => (int)($row['file_size'] ?? 0),
            ':file_path' => (string)($row['file_path'] ?? ''),
            ':ai_status' => $aiStatus,
        ];

        if ($hasUploadCount) {
            $insertCols[] = 'upload_count';
            $insertVals[] = '0';
        }
        if ($hasCarriedForward) {
            $insertCols[] = 'carried_forward';
            $insertVals[] = '1';
        }
        if ($hasReviewed) {
            $insertCols[] = 'registrar_reviewed';
            $insertVals[] = ':registrar_reviewed';
            $params[':registrar_reviewed'] = $wasVerified ? (int)($row['registrar_reviewed'] ?? 0) : 0;
        }
        if ($hasDecision) {
            $insertCols[] = 'registrar_doc_decision';
            $insertVals[] = ':registrar_doc_decision';
            $params[':registrar_doc_decision'] = $wasVerified ? ($row['registrar_doc_decision'] ?? null) : null;
        }
        if ($hasRemarks) {
            $insertCols[] = 'registrar_doc_remarks';
            $insertVals[] = ':registrar_doc_remarks';
            $params[':registrar_doc_remarks'] = $wasVerified ? ($row['registrar_doc_remarks'] ?? null) : null;
        }

        $ins = $pdo->prepare(
            'INSERT INTO documents (' . implode(', ', $insertCols) . ') VALUES (' . implode(', ', $insertVals) . ')'
        );
        $ins->execute($params);
        $copied++;
    }

    return $copied;
}

function validateShsBirthDateNonEmpty(string $ymd): ?string
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $ymd)) {
        return 'Invalid birth date format.';
    }
    $d = DateTimeImmutable::createFromFormat('Y-m-d', $ymd);
    if ($d === false || $d->format('Y-m-d') !== $ymd) {
        return 'Invalid birth date.';
    }
    $today = new DateTimeImmutable('today');
    $latestBirthYear = (int)$today->format('Y') - 15;
    $birthYear = (int)$d->format('Y');
    if ($birthYear > $latestBirthYear) {
        return 'Invalid birth date for enrollment.';
    }

    return null;
}

if (!tableExists($pdo, 'enrollments')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Enrollments table is missing. Run student portal migration first.']);
    exit;
}
ensureEnrollmentSchema($pdo);

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$userId = requireUserId();

if ($method === 'GET') {
    try {
        $syCurrent = getEnrollmentSchoolYear($pdo);
        $studentSection = fetchStudentSectionAssignment($pdo, $userId);
        $row = pickPrimaryEnrollmentRow($pdo, $userId, $syCurrent);

        // Prior completed enrollment from an earlier school year (not the open enrollment SY).
        $priorApproved = fetchPriorApprovedEnrollmentMeta($pdo, $userId, $syCurrent);
        $isGraduate = false;
        if ($priorApproved !== null) {
            $priorGrade = (int)($priorApproved['grade_level_number'] ?? 0);
            if ($priorGrade >= 12) {
                $isGraduate = true;
            }
        }

        require_once __DIR__ . '/physical_docs_helpers.php';
        $grade12PhysicalDocs = grade12PriorPhysicalDocsGate($pdo, $userId, $priorApproved, $syCurrent);
        $grade12BlockedPhysicalDocs = !empty($grade12PhysicalDocs['applies']) && empty($grade12PhysicalDocs['complete']);

        if (!$row) {
            $newSchoolYearReenrollment = $syCurrent !== null && !$isGraduate && $priorApproved !== null;
            $hasCredentials = false;
            if (columnExists($pdo, 'users', 'school_username')) {
                $cu = $pdo->prepare('SELECT school_username FROM users WHERE id = :id LIMIT 1');
                $cu->execute([':id' => $userId]);
                $hasCredentials = trim((string)($cu->fetchColumn() ?: '')) !== '';
            }
            $needsGrade12Confirmation = studentNeedsGrade12EnrollmentConfirmation(
                $syCurrent,
                $isGraduate,
                $priorApproved,
                null,
                $hasCredentials,
                $pdo,
                $userId
            );
            $grade12PromotionActive = isGrade12PromotionActive($syCurrent, $priorApproved, null);
            $grade12Declined = $syCurrent !== null
                && studentDeclinedGrade12ForTargetSy($pdo, $userId, $syCurrent);
            if ($grade12BlockedPhysicalDocs && !$isGraduate) {
                $needsGrade12Confirmation = false;
            }
            echo json_encode([
                'success' => true,
                'enrollment' => null,
                'school_year_current' => $syCurrent,
                'prior_approved' => $priorApproved,
                'is_graduate' => $isGraduate,
                'grade12_declined' => $grade12Declined,
                // No row at all means the student has never enrolled. They are
                // eligible to enroll iff an enrollment SY is open and they are
                // not a graduate (the latter cannot happen here since there is
                // no prior row, but we keep the flag explicit for the client).
                're_enrollment_eligible' => $syCurrent !== null && !$isGraduate && !$grade12BlockedPhysicalDocs,
                'new_school_year_reenrollment' => $newSchoolYearReenrollment && !$grade12BlockedPhysicalDocs,
                'needs_grade12_confirmation' => $needsGrade12Confirmation,
                'grade12_promotion_active' => $grade12PromotionActive,
                'grade12_blocked_physical_docs' => $grade12BlockedPhysicalDocs,
                'grade12_physical_docs' => $grade12PhysicalDocs,
                'prefill_form_data' => $newSchoolYearReenrollment
                    ? buildNewSchoolYearPrefillFormData($priorApproved, $studentSection)
                    : null,
                'student_section' => [
                    'section' => $studentSection['section'],
                    'shift' => $studentSection['shift'],
                ],
            ]);
            appLogEvent($pdo, 'student_enrollment_load', 'student', 'success', $userId, 'enrollment', null, ['found' => false]);
            exit;
        }

        $steps = json_decode((string)($row['enrollment_steps'] ?? '{}'), true);
        if (!is_array($steps)) {
            $steps = [];
        }

        revertAutoEnrolledNewSyApplication($pdo, $userId, $row);
        stripNonGrade12CarriedDocuments($pdo, $userId, $row);
        autoEnrollReturningGrade12Rollover($pdo, $userId, $row);
        repairEnrollmentStatusIfCredentialsIssued($pdo, $userId, $row);
        healGrade12CarriedDocuments($pdo, $userId, $row);

        $rowSchoolYear = (string)($row['school_year'] ?? '');
        $rowStatus = (string)($row['status'] ?? 'pending');

        // The student's latest row may still belong to a previous SY (e.g.
        // they were approved for 2026-2027 and the admin has now opened
        // 2027-2028 for enrollment). In that case we expose `re_enrollment_eligible`
        // so the client renders the new-SY enrollment CTA on top of the
        // existing "you are enrolled in <prior SY>" summary.
        $latestIsPriorSy = $syCurrent !== null && $rowSchoolYear !== '' && $rowSchoolYear !== $syCurrent;
        $reEnrollmentEligible = $syCurrent !== null
            && !$isGraduate
            && (
                $latestIsPriorSy
                || strtolower(trim($rowStatus)) === 'rejected'
            );
        $newSchoolYearReenrollment = $latestIsPriorSy && $reEnrollmentEligible;
        $hasCredentials = false;
        if (columnExists($pdo, 'users', 'school_username')) {
            $cu = $pdo->prepare('SELECT school_username FROM users WHERE id = :id LIMIT 1');
            $cu->execute([':id' => $userId]);
            $hasCredentials = trim((string)($cu->fetchColumn() ?: '')) !== '';
        }
        $needsGrade12Confirmation = studentNeedsGrade12EnrollmentConfirmation(
            $syCurrent,
            $isGraduate,
            $priorApproved,
            $row,
            $hasCredentials,
            $pdo,
            $userId
        );
        $grade12PromotionActive = isGrade12PromotionActive($syCurrent, $priorApproved, $row);
        $prefillFormData = ($newSchoolYearReenrollment || $needsGrade12Confirmation)
            ? buildNewSchoolYearPrefillFormData($priorApproved, $studentSection)
            : null;

        $grade12Declined = $syCurrent !== null
            && studentDeclinedGrade12ForTargetSy($pdo, $userId, $syCurrent);
        if ($grade12BlockedPhysicalDocs && !$isGraduate) {
            $needsGrade12Confirmation = false;
            $reEnrollmentEligible = false;
            $newSchoolYearReenrollment = false;
        }
        $docAuthConsent = getDocumentAuthenticityConsent($pdo, (int)$row['id']);
        echo json_encode([
            'success' => true,
            'enrollment' => [
                'id' => (int)$row['id'],
                'status' => $rowStatus,
                'grade_level' => (string)($row['grade_level'] ?? ''),
                'strand' => (string)($row['strand'] ?? ''),
                'school_year' => $rowSchoolYear,
                'updated_at' => (string)($row['updated_at'] ?? ''),
                'current_step' => (int)($steps['current_step'] ?? 1),
                'form_data' => $steps['form_data'] ?? new stdClass(),
                'school_year_current' => $syCurrent,
                'can_edit' => !(
                    isLockedStatus($rowStatus) &&
                    $syCurrent !== null &&
                    $rowSchoolYear === $syCurrent
                ),
                'document_authenticity_confirmed' => $docAuthConsent !== null
                    && (int)($docAuthConsent['authenticity_confirmed'] ?? 0) === 1,
                'document_authenticity_confirmed_at' => $docAuthConsent['confirmed_at'] ?? null,
            ],
            'school_year_current' => $syCurrent,
            'prior_approved' => $priorApproved,
            'is_graduate' => $isGraduate,
            're_enrollment_eligible' => $reEnrollmentEligible,
            'new_school_year_reenrollment' => $newSchoolYearReenrollment,
            'needs_grade12_confirmation' => $needsGrade12Confirmation,
            'grade12_promotion_active' => $grade12PromotionActive,
            'prefill_form_data' => $prefillFormData,
            'grade12_declined' => $grade12Declined,
            'grade12_blocked_physical_docs' => $grade12BlockedPhysicalDocs,
            'grade12_physical_docs' => $grade12PhysicalDocs,
            'student_section' => [
                'section' => $studentSection['section'],
                'shift' => $studentSection['shift'],
            ],
        ]);
        appLogEvent($pdo, 'student_enrollment_load', 'student', 'success', $userId, 'enrollment', (string)$row['id'], ['found' => true]);
        exit;
    } catch (Throwable $e) {
        appLogEvent($pdo, 'student_enrollment_load', 'student', 'failed', $userId, 'enrollment', null, ['reason' => 'server_error']);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to load enrollment']);
        exit;
    }
}

if ($method === 'POST') {
    require_once __DIR__ . '/permission_guard.php';
    requireActorPermission($pdo, ['role' => 'student', 'id' => $userId], 'uploadDocuments', false);

    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $action = strtolower(trim((string)($payload['action'] ?? 'save_draft')));

    if ($action === 'decline_grade12_continuation') {
        grade12DeclineMigrateSchema($pdo);
        $syCurrent = getEnrollmentSchoolYear($pdo);
        if ($syCurrent === null) {
            http_response_code(503);
            echo json_encode(['success' => false, 'error' => 'Enrollment is closed. No active school year is configured.']);
            exit;
        }

        $priorRow = priorEnrolledGrade11Row($pdo, $userId, $syCurrent);
        if ($priorRow === null) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Grade 12 continuation is not available for your record.']);
            exit;
        }

        $fromSy = trim((string)($priorRow['school_year'] ?? ''));
        recordStudentGrade12Decline($pdo, $userId, $fromSy, $syCurrent);
        appLogEvent($pdo, 'grade12_decline', 'student', 'success', $userId, 'enrollment', (string)($priorRow['id'] ?? ''), [
            'from_school_year' => $fromSy,
            'target_school_year' => $syCurrent,
        ]);
        echo json_encode([
            'success' => true,
            'message' => 'Your decision has been recorded. Contact the registrar if you change your mind.',
            'target_school_year' => $syCurrent,
        ]);
        exit;
    }

    if ($action === 'resume_grade12_continuation') {
        $syCurrent = getEnrollmentSchoolYear($pdo);
        if ($syCurrent === null) {
            http_response_code(503);
            echo json_encode(['success' => false, 'error' => 'Enrollment is closed. No active school year is configured.']);
            exit;
        }
        clearStudentGrade12Decline($pdo, $userId, $syCurrent);
        appLogEvent($pdo, 'grade12_decline_cleared', 'student', 'success', $userId, 'enrollment', null, [
            'target_school_year' => $syCurrent,
        ]);
        echo json_encode(['success' => true, 'message' => 'You can proceed with Grade 12 enrollment again.']);
        exit;
    }

    if ($action === 'cancel_application') {
        $syCurrent = getEnrollmentSchoolYear($pdo);
        try {
            $pdo->beginTransaction();
            $rowStmt = $pdo->prepare(
                'SELECT id, status, school_year FROM enrollments
                  WHERE user_id = :user_id
                  ORDER BY id DESC LIMIT 1
                  FOR UPDATE'
            );
            $rowStmt->execute([':user_id' => $userId]);
            $row = $rowStmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'No enrollment application found.']);
                exit;
            }
            $st = strtolower(trim((string)($row['status'] ?? '')));
            $rowSy = trim((string)($row['school_year'] ?? ''));
            if (!isCancellableStatus($st)) {
                $pdo->rollBack();
                http_response_code(409);
                echo json_encode(['success' => false, 'error' => 'This application can no longer be cancelled.']);
                exit;
            }
            if ($syCurrent !== null && $rowSy !== '' && $rowSy !== $syCurrent) {
                $pdo->rollBack();
                http_response_code(409);
                echo json_encode(['success' => false, 'error' => 'Only the current school year application can be cancelled.']);
                exit;
            }
            $eid = (int)$row['id'];
            $upd = $pdo->prepare("UPDATE enrollments SET status = 'cancelled', updated_at = NOW() WHERE id = :id AND user_id = :user_id");
            $upd->execute([':id' => $eid, ':user_id' => $userId]);
            $pdo->commit();
            appLogEvent($pdo, 'student_enrollment_cancel', 'student', 'success', $userId, 'enrollment', (string)$eid, [
                'previous_status' => $st,
                'school_year' => $rowSy,
            ]);
            echo json_encode([
                'success' => true,
                'message' => 'Your enrollment application has been cancelled. You may start a new application when ready.',
                'enrollment_id' => $eid,
                'status' => 'cancelled',
            ]);
            exit;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            appLogEvent($pdo, 'student_enrollment_cancel', 'student', 'failed', $userId, 'enrollment', null, ['reason' => 'server_error']);
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Could not cancel application.']);
            exit;
        }
    }

    if ($action === 'update_voucher') {
        $voucherNo = trim((string)($payload['voucher_no'] ?? ''));
        if (strlen($voucherNo) > 160) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Voucher number is too long.']);
            exit;
        }
        if ($voucherNo === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Please enter your voucher number.']);
            exit;
        }
        try {
            $rowStmt = $pdo->prepare('SELECT id, status, enrollment_steps FROM enrollments WHERE user_id = :user_id ORDER BY id DESC LIMIT 1');
            $rowStmt->execute([':user_id' => $userId]);
            $row = $rowStmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'No enrollment found.']);
                exit;
            }
            $st = strtolower(trim((string)($row['status'] ?? '')));
            if (!in_array($st, ['approved', 'enrolled'], true)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'You can enter your voucher number after your enrollment is approved.']);
                exit;
            }
            $steps = json_decode((string)($row['enrollment_steps'] ?? '{}'), true);
            if (!is_array($steps)) {
                $steps = [];
            }
            if (!isset($steps['form_data']) || !is_array($steps['form_data'])) {
                $steps['form_data'] = [];
            }
            $mode = strtolower(trim((string)($steps['form_data']['modeOfPayment'] ?? '')));
            if ($mode === 'cash' || $mode === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Voucher numbers apply to voucher-assisted modes (QVR, ESC, QVA, ALS). Cash payments do not use a voucher.']);
                exit;
            }
            $steps['form_data']['voucherNo'] = $voucherNo;
            $upd = $pdo->prepare('UPDATE enrollments SET enrollment_steps = :steps, updated_at = NOW() WHERE id = :id AND user_id = :user_id');
            $upd->execute([
                ':steps' => json_encode($steps, JSON_UNESCAPED_UNICODE),
                ':id' => (int)$row['id'],
                ':user_id' => $userId,
            ]);
            appLogEvent($pdo, 'student_voucher_update', 'student', 'success', $userId, 'enrollment', (string)$row['id'], []);
            echo json_encode(['success' => true, 'message' => 'Voucher number saved.']);
            exit;
        } catch (Throwable $e) {
            appLogEvent($pdo, 'student_voucher_update', 'student', 'failed', $userId, 'enrollment', null, ['reason' => 'server_error']);
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Could not save voucher number.']);
            exit;
        }
    }
    $formData = $payload['form_data'] ?? [];
    $currentStep = (int)($payload['current_step'] ?? 1);
    $documentsAuthenticityConfirmed = parseConsentFlag($payload['documents_authenticity_confirmed'] ?? false);
    if (!is_array($formData)) {
        $formData = [];
    }
    if (isset($formData['strand'])) {
        $formData['strand'] = normalizeStrandCode((string)$formData['strand']);
    }

    // Enrollment email always comes from the authenticated account.
    try {
        $acctEmailStmt = $pdo->prepare('SELECT email FROM users WHERE id = :id LIMIT 1');
        $acctEmailStmt->execute([':id' => $userId]);
        $accountEmail = strtolower(trim((string)($acctEmailStmt->fetchColumn() ?: '')));
        if ($accountEmail !== '') {
            $formData['email'] = $accountEmail;
        }
    } catch (Throwable $e) {
        // Keep client-provided email only if account lookup fails.
    }

    $gradeLevel = (string)($formData['gradeLevel'] ?? '');
    $strand = (string)($formData['strand'] ?? '');
    $schoolYear = getEnrollmentSchoolYear($pdo);
    if ($schoolYear === null) {
        http_response_code(503);
        echo json_encode(['success' => false, 'error' => 'Enrollment is closed. No active school year is configured.']);
        exit;
    }

    $gradeNum = enrollmentGradeNumber($gradeLevel);
    if ($gradeNum !== 11 && $gradeNum !== 12) {
        if ($action === 'submit' || trim($gradeLevel) !== '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Please select Grade 11 or Grade 12.']);
            exit;
        }
    }

    $paymentArrangement = strtolower(trim((string)($formData['paymentArrangement'] ?? '')));
    $allowedPaymentArrangements = ['full_payment', 'installment'];
    if ($action === 'submit') {
        if (!in_array($paymentArrangement, $allowedPaymentArrangements, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Please select Full Payment or Installment.']);
            exit;
        }
    } elseif ($paymentArrangement !== '' && !in_array($paymentArrangement, $allowedPaymentArrangements, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid payment arrangement.']);
        exit;
    }
    $formData['paymentArrangement'] = in_array($paymentArrangement, $allowedPaymentArrangements, true)
        ? $paymentArrangement
        : '';

    // Referral fields live on step 5. Draft saves from Documents use current_step=5
    // (destination / resume step) before the student has filled referral — do not
    // block that. Validate when leaving referral (destination step >= 6) or on submit.
    if ($action === 'submit' || $currentStep >= 6) {
        require_once __DIR__ . '/referral_promo_helpers.php';
        $referralValidation = validateReferralPromoFormData($formData);
        if ($referralValidation['ok'] !== true) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => (string)($referralValidation['error'] ?? 'Invalid referral information.'),
                'code' => (string)($referralValidation['code'] ?? 'referral_invalid'),
            ]);
            exit;
        }
        $referralData = referralPromoDataFromForm($formData);
        if ($referralData['has_referral']) {
            $existingIdForReferral = 0;
            try {
                $earlyExistingStmt = $pdo->prepare(
                    'SELECT id FROM enrollments
                      WHERE user_id = :user_id AND TRIM(COALESCE(school_year, \'\')) = :sy
                      ORDER BY id DESC LIMIT 1'
                );
                $earlyExistingStmt->execute([':user_id' => $userId, ':sy' => $schoolYear]);
                $existingIdForReferral = (int)($earlyExistingStmt->fetchColumn() ?: 0);
            } catch (Throwable $e) {
                $existingIdForReferral = 0;
            }
            $controlAvailability = validateReferralControlAvailable(
                $pdo,
                $schoolYear,
                $referralData['control_number'],
                $existingIdForReferral
            );
            if ($controlAvailability['ok'] !== true) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'error' => (string)($controlAvailability['error'] ?? 'Referral card already used.'),
                    'code' => (string)($controlAvailability['code'] ?? 'referral_control_used'),
                ]);
                exit;
            }
            $formData['referralCardControlNumber'] = $referralData['control_number'];
            $formData['referrerContactNumber'] = $referralData['referrer_contact'];
            $formData['referrerEmail'] = $referralData['referrer_email'];
        }
    }

    $physicalBlock = enforceGrade12PhysicalDocsComplete($pdo, $userId, $gradeLevel, $schoolYear);
    if ($physicalBlock !== null) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => $physicalBlock,
            'grade12_blocked_physical_docs' => true,
        ]);
        exit;
    }

    $status = $action === 'submit' ? 'pending' : 'draft';

    $birthRaw = trim((string)($formData['birthDate'] ?? ''));
    if ($birthRaw === '') {
        if ($action === 'submit') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Birth date is required.']);
            exit;
        }
    } else {
        $birthErr = validateShsBirthDateNonEmpty($birthRaw);
        if ($birthErr !== null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $birthErr]);
            exit;
        }
    }

    try {
        // Graduate guard: a student whose last approved enrollment was at
        // Grade 12 has completed Senior High. Reject any new submission /
        // draft from the student portal so they can't re-enroll.
        $gradStmt = $pdo->prepare(
            "SELECT grade_level FROM enrollments
             WHERE user_id = :user_id AND LOWER(status) IN ('approved', 'enrolled')
             ORDER BY id DESC LIMIT 1"
        );
        $gradStmt->execute([':user_id' => $userId]);
        $gradRow = $gradStmt->fetch() ?: null;
        if ($gradRow) {
            $priorGradeRaw = (string)($gradRow['grade_level'] ?? '');
            $priorGrade = preg_match('/(\d{1,2})/', $priorGradeRaw, $m) ? (int)$m[1] : 0;
            if ($priorGrade >= 12) {
                appLogEvent($pdo, 'student_enrollment_blocked', 'student', 'failed', $userId, 'enrollment', null, [
                    'reason' => 'graduate',
                    'last_grade' => $priorGradeRaw,
                ]);
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'error' => 'You have already completed Grade 12. Re-enrollment is not available.',
                ]);
                exit;
            }
        }

        ensureDocumentAuthenticityConsentsTable($pdo);
        ensureLoggingTables($pdo);

        $pdo->beginTransaction();

        // Find the latest row for this user. We only edit it in place when
        // it belongs to the *current* enrollment school year — otherwise the
        // SY has rolled (e.g. previous-year approved enrollment) and we must
        // INSERT a fresh row so the historical record is preserved.
        $existingStmt = $pdo->prepare(
            'SELECT id, status, school_year FROM enrollments
              WHERE user_id = :user_id AND TRIM(COALESCE(school_year, \'\')) = :sy
              ORDER BY id DESC LIMIT 1
              FOR UPDATE'
        );
        $existingStmt->execute([':user_id' => $userId, ':sy' => $schoolYear]);
        $existingRowFull = $existingStmt->fetch();
        $existing = $existingRowFull ? ['id' => (int)$existingRowFull['id']] : null;
        $existingStatus = (string)($existingRowFull['status'] ?? '');
        $existingSchoolYear = (string)($existingRowFull['school_year'] ?? '');
        if (
            $existing
            && isLockedStatus($existingStatus)
            && $existingSchoolYear === $schoolYear
            && strtolower(trim($existingStatus)) !== 'cancelled'
        ) {
            $existingEnrollmentId = (int)$existing['id'];
            $existingNorm = strtolower(trim($existingStatus));
            if (
                $action === 'submit'
                && in_array($existingNorm, ['pending', 'under_review', 'under review', 'review'], true)
                && returningGrade12ShouldAutoEnroll($pdo, $userId, $existingEnrollmentId, $gradeLevel, $schoolYear)
            ) {
                $pdo->prepare(
                    "UPDATE enrollments SET status = 'enrolled', enrollment_steps = :steps, updated_at = NOW() WHERE id = :id"
                )->execute([
                    ':steps' => json_encode([
                        'current_step' => $currentStep,
                        'form_data' => $formData,
                    ], JSON_UNESCAPED_UNICODE),
                    ':id' => $existingEnrollmentId,
                ]);
                $pdo->commit();
                syncStudentCohortForEnrollment($pdo, $existingEnrollmentId);
                require_once __DIR__ . '/physical_docs_helpers.php';
                carryForwardPhysicalDocsForEnrollment($pdo, $existingEnrollmentId);
                $sectionAssignment = autoAssignSectionForGrade12Rollover(
                    $pdo,
                    $userId,
                    $strand,
                    (string)($formData['gender'] ?? ''),
                    (string)($formData['preferredSchedule'] ?? '')
                );
                appLogEvent($pdo, 'student_enrollment_submit', 'student', 'success', $userId, 'enrollment', (string)$existingEnrollmentId, [
                    'reason' => 'grade12_rollover_auto_enrolled',
                    'school_year' => $existingSchoolYear,
                    'section' => $sectionAssignment['section'] ?? null,
                    'shift' => $sectionAssignment['shift'] ?? null,
                ]);
                echo json_encode([
                    'success' => true,
                    'enrollment_id' => $existingEnrollmentId,
                    'status' => 'enrolled',
                    'message' => 'Grade 12 enrollment confirmed',
                    'already_submitted' => true,
                    'section_assignment' => $sectionAssignment,
                ]);
                exit;
            }
            $pdo->commit();
            if ($action === 'submit') {
                appLogEvent($pdo, 'student_enrollment_submit', 'student', 'success', $userId, 'enrollment', (string)$existing['id'], [
                    'reason' => 'already_submitted_current_school_year',
                    'status' => $existingStatus,
                    'school_year' => $existingSchoolYear,
                ]);
                echo json_encode([
                    'success' => true,
                    'enrollment_id' => (int)$existing['id'],
                    'status' => $existingStatus,
                    'message' => 'Enrollment already submitted',
                    'already_submitted' => true,
                ]);
                exit;
            }
            appLogEvent($pdo, 'student_enrollment_locked', 'student', 'failed', $userId, 'enrollment', (string)$existing['id'], [
                'reason' => 'already_submitted_current_school_year',
                'status' => $existingStatus,
                'school_year' => $existingSchoolYear,
            ]);
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error' => 'Enrollment is locked for this school year after submission.',
            ]);
            exit;
        }

        $existingIdForStatus = $existing ? (int)$existing['id'] : 0;
        if (
            $action === 'submit'
            && returningGrade12ShouldAutoEnroll($pdo, $userId, $existingIdForStatus, $gradeLevel, $schoolYear)
        ) {
            $status = 'enrolled';
        }

        $stepsPayload = json_encode([
            'current_step' => $currentStep,
            'form_data' => $formData,
        ], JSON_UNESCAPED_UNICODE);

        if ($existing) {
            $update = $pdo->prepare('
                UPDATE enrollments
                SET grade_level = :grade_level,
                    strand = :strand,
                    school_year = :school_year,
                    status = :status,
                    enrollment_steps = :enrollment_steps,
                    updated_at = NOW()
                WHERE id = :id
            ');
            $update->execute([
                ':grade_level' => $gradeLevel,
                ':strand' => $strand,
                ':school_year' => $schoolYear,
                ':status' => $status,
                ':enrollment_steps' => $stepsPayload,
                ':id' => (int)$existing['id'],
            ]);
            $enrollmentId = (int)$existing['id'];
        } else {
            $insert = $pdo->prepare('
                INSERT INTO enrollments (user_id, grade_level, strand, school_year, status, enrollment_steps)
                VALUES (:user_id, :grade_level, :strand, :school_year, :status, :enrollment_steps)
            ');
            $insert->execute([
                ':user_id' => $userId,
                ':grade_level' => $gradeLevel,
                ':strand' => $strand,
                ':school_year' => $schoolYear,
                ':status' => $status,
                ':enrollment_steps' => $stepsPayload,
            ]);
            $enrollmentId = (int)$pdo->lastInsertId();
            if (enrollmentGradeNumber($gradeLevel) === 12) {
                copyDocumentsFromPriorEnrollment($pdo, $userId, $enrollmentId, $gradeLevel);
                $healRow = ['id' => $enrollmentId, 'school_year' => $schoolYear, 'status' => $status, 'grade_level' => $gradeLevel];
                healGrade12CarriedDocuments($pdo, $userId, $healRow);
            }
        }

        clearStudentGrade12Decline($pdo, $userId, $schoolYear);

        // Best-effort sync of profile columns when present.
        $joinName = static function (string ...$parts): string {
            $s = trim(implode(' ', array_map(static function ($p) {
                return trim((string)$p);
            }, $parts)));

            return trim(preg_replace('/\s+/', ' ', $s));
        };

        $gFirst = trim((string)($formData['guardianGivenName'] ?? ''));
        $guardianName = $joinName(
            (string)($formData['guardianGivenName'] ?? ''),
            (string)($formData['guardianMiddleName'] ?? ''),
            (string)($formData['guardianLastName'] ?? '')
        );
        $guardianRel = (string)($formData['relationshipToGuardian'] ?? '');
        $guardianPhone = (string)($formData['guardianContactNumber'] ?? '');
        $guardianOcc = '';

        if ($gFirst === '') {
            $ec = strtolower(trim((string)($formData['emergencyContact'] ?? '')));
            if ($ec === 'mother') {
                $guardianName = $joinName(
                    (string)($formData['motherGivenName'] ?? ''),
                    (string)($formData['motherMaidenMiddleName'] ?? ''),
                    (string)($formData['motherMaidenLastName'] ?? '')
                );
                $guardianRel = 'Mother';
                $guardianPhone = (string)($formData['motherContactNumber'] ?? '');
                $guardianOcc = (string)($formData['motherOccupation'] ?? '');
            } elseif ($ec === 'father') {
                $guardianName = $joinName(
                    (string)($formData['fatherGivenName'] ?? ''),
                    (string)($formData['fatherMiddleName'] ?? ''),
                    (string)($formData['fatherLastName'] ?? '')
                );
                $guardianRel = 'Father';
                $guardianPhone = (string)($formData['fatherContactNumber'] ?? '');
                $guardianOcc = (string)($formData['fatherOccupation'] ?? '');
            } elseif ($guardianName === '') {
                $motherLine = $joinName(
                    (string)($formData['motherGivenName'] ?? ''),
                    (string)($formData['motherMaidenMiddleName'] ?? ''),
                    (string)($formData['motherMaidenLastName'] ?? '')
                );
                if ($motherLine !== '') {
                    $guardianName = $motherLine;
                    $guardianRel = 'Mother';
                    $guardianPhone = (string)($formData['motherContactNumber'] ?? '');
                    $guardianOcc = (string)($formData['motherOccupation'] ?? '');
                } else {
                    $fatherLine = $joinName(
                        (string)($formData['fatherGivenName'] ?? ''),
                        (string)($formData['fatherMiddleName'] ?? ''),
                        (string)($formData['fatherLastName'] ?? '')
                    );
                    if ($fatherLine !== '') {
                        $guardianName = $fatherLine;
                        $guardianRel = 'Father';
                        $guardianPhone = (string)($formData['fatherContactNumber'] ?? '');
                        $guardianOcc = (string)($formData['fatherOccupation'] ?? '');
                    }
                }
            }
        }

        $syncMap = [
            'first_name' => trim((string)($formData['givenName'] ?? '')),
            'middle_name' => trim((string)($formData['middleName'] ?? '')),
            'last_name' => trim((string)($formData['lastName'] ?? '')),
            'extension_name' => trim((string)($formData['extensionName'] ?? '')),
            'date_of_birth' => (string)($formData['birthDate'] ?? ''),
            'gender' => (string)($formData['gender'] ?? ''),
            'phone' => (string)($formData['contactNumber'] ?? ''),
            'address' => trim(implode(', ', array_filter([
                (string)($formData['blockLotHouseNo'] ?? ''),
                (string)($formData['street'] ?? ''),
                (string)($formData['barangay'] ?? ''),
                (string)($formData['municipality'] ?? ''),
            ]))),
            'guardian_name' => $guardianName,
            'guardian_relationship' => $guardianRel,
            'guardian_phone' => $guardianPhone,
        ];
        if ($guardianOcc !== '' && columnExists($pdo, 'users', 'guardian_occupation')) {
            $syncMap['guardian_occupation'] = $guardianOcc;
        }
        foreach ($syncMap as $col => $val) {
            if ($val !== '' && columnExists($pdo, 'users', $col)) {
                $u = $pdo->prepare("UPDATE users SET {$col} = :v WHERE id = :id");
                $u->execute([':v' => $val, ':id' => $userId]);
            }
        }
        if (columnExists($pdo, 'users', 'full_name')) {
            $composedName = studentEnrollmentFormDisplayName($formData, [
                'full_name' => '',
                'first_name' => $syncMap['first_name'] ?? '',
                'middle_name' => $syncMap['middle_name'] ?? '',
                'last_name' => $syncMap['last_name'] ?? '',
                'extension_name' => $syncMap['extension_name'] ?? '',
            ]);
            if ($composedName !== '') {
                $u = $pdo->prepare('UPDATE users SET full_name = :v WHERE id = :id');
                $u->execute([':v' => $composedName, ':id' => $userId]);
            }
        }

        syncStudentCohortForEnrollment($pdo, $enrollmentId);
        if ($status === 'enrolled') {
            require_once __DIR__ . '/physical_docs_helpers.php';
            carryForwardPhysicalDocsForEnrollment($pdo, $enrollmentId);
        }

        $documentAuthenticityConsentSaved = false;
        if ($currentStep >= 4 && $documentsAuthenticityConfirmed) {
            $documentAuthenticityConsentSaved = saveDocumentAuthenticityConsent(
                $pdo,
                $enrollmentId,
                $userId,
                $schoolYear,
                $action === 'submit' ? 'enrollment_submit' : 'enrollment_step_4'
            );
        }

        if ($action === 'submit' && !hasDocumentAuthenticityConsent($pdo, $enrollmentId)) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Please confirm on the Requirements Upload step that your documents are genuine and unaltered before submitting.',
            ]);
            exit;
        }

        if ($action === 'submit' && columnExists($pdo, 'documents', 'ai_status')) {
            // Submission never waits on AI. Any unfinished checks become
            // pending manual review so AI cannot halt business operations.
            $deferred = deferEnrollmentScreeningDocuments($pdo, $enrollmentId, 'enrollment_submission');
            if ($deferred > 0) {
                appLogEvent($pdo, 'ai_screening_deferred', 'student', 'success', $userId, 'enrollment', (string)$enrollmentId, [
                    'deferred_documents' => $deferred,
                    'reason' => 'enrollment_submission',
                ]);
            }
        }

        if ($pdo->inTransaction()) {
            $pdo->commit();
        }

        $aiQueueSummary = null;
        if ($action === 'submit') {
            require_once __DIR__ . '/ai_verification_queue.php';
            $aiQueueSummary = enqueueEnrollmentAiVerificationJobs($pdo, $enrollmentId);
            if (($aiQueueSummary['queued'] ?? 0) > 0) {
                appLogEvent($pdo, 'ai_verify_queue_enqueue', 'student', 'success', $userId, 'enrollment', (string)$enrollmentId, [
                    'queued' => (int)$aiQueueSummary['queued'],
                    'skipped' => (int)($aiQueueSummary['skipped'] ?? 0),
                    'document_ids' => $aiQueueSummary['document_ids'] ?? [],
                ]);
                spawnAiVerificationQueueWorker(dirname(__DIR__));
            }
        }

        if ($documentAuthenticityConsentSaved) {
            appLogEvent(
                $pdo,
                'document_authenticity_consent',
                'student',
                'success',
                $userId,
                'enrollment',
                (string)$enrollmentId,
                ['step' => $currentStep, 'action' => $action]
            );
        }

        if ($action === 'submit') {
            require_once __DIR__ . '/enrollment_submission_email.php';
            $emailStmt = $pdo->prepare('SELECT email, full_name, first_name FROM users WHERE id = :id LIMIT 1');
            $emailStmt->execute([':id' => $userId]);
            $userRow = $emailStmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $recipient = trim((string)($userRow['email'] ?? ''));
            if ($recipient !== '') {
                $studentName = trim((string)($userRow['full_name'] ?? ''));
                if ($studentName === '') {
                    $studentName = trim((string)($userRow['first_name'] ?? ''));
                }
                sendEnrollmentSubmissionEmail($pdo, $recipient, [
                    'student_name' => $studentName,
                    'application_id' => 'APP-' . date('Y') . '-' . str_pad((string)$enrollmentId, 3, '0', STR_PAD_LEFT),
                    'school_year' => $schoolYear,
                    'strand' => $strand,
                    'grade_level' => $gradeLevel !== '' ? 'Grade ' . $gradeLevel : '',
                ]);
            }
        }

        appLogEvent($pdo, $action === 'submit' ? 'student_enrollment_submit' : 'student_enrollment_save', 'student', 'success', $userId, 'enrollment', (string)$enrollmentId, ['step' => $currentStep]);

        $sectionAssignment = null;
        if (
            $action === 'submit'
            && $status === 'enrolled'
            && returningGrade12ShouldAutoEnroll($pdo, $userId, $enrollmentId, $gradeLevel, $schoolYear)
        ) {
            $sectionAssignment = autoAssignSectionForGrade12Rollover(
                $pdo,
                $userId,
                $strand,
                (string)($formData['gender'] ?? ''),
                (string)($formData['preferredSchedule'] ?? '')
            );
        }

        echo json_encode([
            'success' => true,
            'enrollment_id' => $enrollmentId,
            'status' => $status,
            'message' => $action === 'submit' ? 'Enrollment submitted successfully' : 'Enrollment draft saved',
            'section_assignment' => $sectionAssignment,
        ]);
        exit;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        appLogEvent($pdo, $action === 'submit' ? 'student_enrollment_submit' : 'student_enrollment_save', 'student', 'failed', $userId, 'enrollment', null, ['reason' => 'server_error']);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to save enrollment']);
        exit;
    }
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
