<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/school_year_helpers.php';

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
    $uid = (int)($_SERVER['HTTP_X_USER_ID'] ?? 0);
    if ($uid <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Missing user context']);
        exit;
    }
    return $uid;
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
}

function isLockedStatus(string $status): bool
{
    $s = strtolower(trim($status));
    return in_array($s, ['pending', 'under_review', 'under review', 'review', 'approved'], true);
}

/** Senior High: block impossible DOBs (e.g. newborn) when a value is present. */
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
    $minAgeYears = 15;
    $latestAllowedBirth = $today->sub(new DateInterval('P' . $minAgeYears . 'Y'));
    $earliestAllowedBirth = $today->sub(new DateInterval('P120Y'));
    if ($d > $latestAllowedBirth) {
        return 'Birth date must show the learner is at least 15 years old (Senior High eligibility).';
    }
    if ($d < $earliestAllowedBirth) {
        return 'Birth date is not valid.';
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
        $stmt = $pdo->prepare('SELECT id, status, grade_level, strand, school_year, enrollment_steps, updated_at FROM enrollments WHERE user_id = :user_id ORDER BY id DESC LIMIT 1');
        $stmt->execute([':user_id' => $userId]);
        $row = $stmt->fetch();

        $syCurrent = getEnrollmentSchoolYear($pdo);

        // Helper: parse "11", "Grade 11", "G11" into the integer 11. Returns
        // 0 when the value is not a recognizable Senior High grade level.
        $parseGradeLevel = static function (?string $raw): int {
            if ($raw === null) return 0;
            if (preg_match('/(\d{1,2})/', $raw, $m)) {
                $n = (int)$m[1];
                return ($n >= 7 && $n <= 12) ? $n : 0;
            }
            return 0;
        };

        // Look up the most recent APPROVED enrollment for this student. Used
        // to expose `prior_approved` and to enforce the graduate block: a
        // student whose last approved enrollment was Grade 12 cannot enroll
        // again (they have completed Senior High).
        $priorStmt = $pdo->prepare(
            "SELECT id, status, grade_level, strand, school_year, updated_at
             FROM enrollments
             WHERE user_id = :user_id
               AND LOWER(status) = 'approved'
             ORDER BY id DESC
             LIMIT 1"
        );
        $priorStmt->execute([':user_id' => $userId]);
        $priorApprovedRow = $priorStmt->fetch() ?: null;

        $priorApproved = null;
        $isGraduate = false;
        if ($priorApprovedRow) {
            $priorGrade = $parseGradeLevel((string)($priorApprovedRow['grade_level'] ?? ''));
            $priorApproved = [
                'id' => (int)$priorApprovedRow['id'],
                'grade_level' => (string)($priorApprovedRow['grade_level'] ?? ''),
                'grade_level_number' => $priorGrade,
                'strand' => (string)($priorApprovedRow['strand'] ?? ''),
                'school_year' => (string)($priorApprovedRow['school_year'] ?? ''),
                'updated_at' => (string)($priorApprovedRow['updated_at'] ?? ''),
            ];
            // Senior High terminates at Grade 12. Once a student has been
            // approved for Grade 12 they have completed the SHS program and
            // cannot submit another enrollment from the student portal.
            if ($priorGrade >= 12) {
                $isGraduate = true;
            }
        }

        if (!$row) {
            echo json_encode([
                'success' => true,
                'enrollment' => null,
                'school_year_current' => $syCurrent,
                'prior_approved' => $priorApproved,
                'is_graduate' => $isGraduate,
                // No row at all means the student has never enrolled. They are
                // eligible to enroll iff an enrollment SY is open and they are
                // not a graduate (the latter cannot happen here since there is
                // no prior row, but we keep the flag explicit for the client).
                're_enrollment_eligible' => $syCurrent !== null && !$isGraduate,
            ]);
            appLogEvent($pdo, 'student_enrollment_load', 'student', 'success', $userId, 'enrollment', null, ['found' => false]);
            exit;
        }

        $steps = json_decode((string)($row['enrollment_steps'] ?? '{}'), true);
        if (!is_array($steps)) {
            $steps = [];
        }

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
            ],
            'school_year_current' => $syCurrent,
            'prior_approved' => $priorApproved,
            'is_graduate' => $isGraduate,
            're_enrollment_eligible' => $reEnrollmentEligible,
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
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $action = strtolower(trim((string)($payload['action'] ?? 'save_draft')));

    /** After registrar approval, students may add/update voucher number only (enrollment otherwise locked). */
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
            if ($st !== 'approved') {
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
    if (!is_array($formData)) {
        $formData = [];
    }

    $gradeLevel = (string)($formData['gradeLevel'] ?? '');
    $strand = (string)($formData['strand'] ?? '');
    $schoolYear = getEnrollmentSchoolYear($pdo);
    if ($schoolYear === null) {
        http_response_code(503);
        echo json_encode(['success' => false, 'error' => 'Enrollment is closed. No active school year is configured.']);
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
             WHERE user_id = :user_id AND LOWER(status) = 'approved'
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

        // Find the latest row for this user. We only edit it in place when
        // it belongs to the *current* enrollment school year — otherwise the
        // SY has rolled (e.g. previous-year approved enrollment) and we must
        // INSERT a fresh row so the historical record is preserved.
        $existingStmt = $pdo->prepare('SELECT id, status, school_year FROM enrollments WHERE user_id = :user_id ORDER BY id DESC LIMIT 1');
        $existingStmt->execute([':user_id' => $userId]);
        $existingRowFull = $existingStmt->fetch();
        $existing = null;
        if ($existingRowFull) {
            $existingRowSy = (string)($existingRowFull['school_year'] ?? '');
            // The row is editable only when it is for the current SY. When
            // it is for a previous SY (regardless of approved/rejected/draft),
            // we treat it as historical and INSERT a new row instead.
            if ($existingRowSy === $schoolYear || $existingRowSy === '') {
                $existing = ['id' => (int)$existingRowFull['id']];
            }
        }
        if ($existing) {
            $lockStmt = $pdo->prepare('SELECT status, school_year FROM enrollments WHERE id = :id LIMIT 1');
            $lockStmt->execute([':id' => (int)$existing['id']]);
            $lockRow = $lockStmt->fetch() ?: [];
            $existingStatus = (string)($lockRow['status'] ?? '');
            $existingSchoolYear = (string)($lockRow['school_year'] ?? '');
            if (isLockedStatus($existingStatus) && $existingSchoolYear === $schoolYear) {
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
        }

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

        appLogEvent($pdo, $action === 'submit' ? 'student_enrollment_submit' : 'student_enrollment_save', 'student', 'success', $userId, 'enrollment', (string)$enrollmentId, ['step' => $currentStep]);
        echo json_encode([
            'success' => true,
            'enrollment_id' => $enrollmentId,
            'status' => $status,
            'message' => $action === 'submit' ? 'Enrollment submitted successfully' : 'Enrollment draft saved',
        ]);
        exit;
    } catch (Throwable $e) {
        appLogEvent($pdo, $action === 'submit' ? 'student_enrollment_submit' : 'student_enrollment_save', 'student', 'failed', $userId, 'enrollment', null, ['reason' => 'server_error']);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to save enrollment']);
        exit;
    }
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
