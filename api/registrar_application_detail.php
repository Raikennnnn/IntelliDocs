<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}
require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/username_generator.php';
require_once __DIR__ . '/welcome_email.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/section_assignment.php';
require_once __DIR__ . '/enrollment_status_helpers.php';
require_once __DIR__ . '/cohort_helpers.php';
require_once __DIR__ . '/physical_docs_helpers.php';
require_once __DIR__ . '/ai_persist.php';
require_once __DIR__ . '/ai_http.php';
require_once __DIR__ . '/ai_verify_refine.php';

ensureDocumentAiPersistenceSchema($pdo);

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

function toUiStatus(string $status): string
{
    $s = strtolower(trim($status));
    // Once the registrar approves in the Applications tab the student is
    // enrolled. Legacy rows may still carry `approved` in the database.
    if ($s === 'enrolled' || $s === 'approved') return 'Enrolled';
    if ($s === 'rejected') return 'Rejected';
    if (in_array($s, ['under_review', 'under review', 'review'], true)) return 'Under Review';
    if ($s === 'draft') return 'Draft';
    return 'Pending';
}

function ensureCredentialsSchema(PDO $pdo): void
{
    if (!tableExists($pdo, 'users')) {
        // Base schema not present; nothing this helper can do. Skip silently.
        return;
    }
    $requiredColumns = [
        'first_name'           => 'VARCHAR(100) NULL',
        'middle_name'          => 'VARCHAR(100) NULL',
        'last_name'            => 'VARCHAR(100) NULL',
        'extension_name'       => 'VARCHAR(20) NULL',
        'school_username'      => 'VARCHAR(32) NULL',
        'must_change_password' => 'TINYINT(1) NOT NULL DEFAULT 0',
    ];
    foreach ($requiredColumns as $col => $ddl) {
        if (!columnExists($pdo, 'users', $col)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN {$col} {$ddl}");
        }
    }
    // Unique index on school_username, guarded by information_schema lookup so
    // a second invocation is a no-op rather than a duplicate-index error.
    $idxStmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.statistics
         WHERE table_schema = DATABASE()
           AND table_name = :table
           AND index_name = :index
         LIMIT 1'
    );
    $idxStmt->execute([
        ':table' => 'users',
        ':index' => 'uniq_users_school_username',
    ]);
    $hasIndex = (bool)$idxStmt->fetchColumn();
    if (!$hasIndex && columnExists($pdo, 'users', 'school_username')) {
        $pdo->exec('ALTER TABLE users ADD UNIQUE INDEX uniq_users_school_username (school_username)');
    }
}

/** @return array{id: int, role: string} */
function requireRegistrarOrAdmin(PDO $pdo): array
{
    require_once __DIR__ . '/api_auth.php';
    $actor = apiRequireActor($pdo, 'registrar/application-detail');
    if (!in_array($actor['role'], ['registrar', 'admin'], true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Access denied']);
        exit;
    }

    return [
        'id' => (int)$actor['id'],
        'role' => (string)$actor['role'],
    ];
}

function parseEnrollmentIdFromAppId(string $appId): int
{
    if (preg_match('/(\d+)\s*$/', $appId, $m)) {
        return (int)$m[1];
    }
    return 0;
}

require_once __DIR__ . '/permission_guard.php';
$actor = requireRegistrarOrAdmin($pdo);
$actorId = $actor['id'];
ensureCredentialsSchema($pdo);
$hasRegistrarRemarks = columnExists($pdo, 'enrollments', 'registrar_remarks');
$hasUpdatedAt = columnExists($pdo, 'enrollments', 'updated_at');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    requireActorPermission($pdo, $actor, 'viewApplications');

    $appId = trim((string)($_GET['application_id'] ?? ''));
    $enrollmentId = (int)($_GET['enrollment_id'] ?? 0);
    if ($enrollmentId <= 0 && $appId !== '') {
        $enrollmentId = parseEnrollmentIdFromAppId($appId);
    }
    if ($enrollmentId <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Invalid application id']);
        exit;
    }

    try {
        $stmt = $pdo->prepare('
            SELECT e.*, u.id AS user_id, u.full_name, u.email
            FROM enrollments e
            INNER JOIN users u ON u.id = e.user_id
            WHERE e.id = :id
            LIMIT 1
        ');
        $stmt->execute([':id' => $enrollmentId]);
        $row = $stmt->fetch();
        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Application not found']);
            exit;
        }

        $steps = json_decode((string)($row['enrollment_steps'] ?? '{}'), true);
        if (!is_array($steps)) $steps = [];
        $form = is_array($steps['form_data'] ?? null) ? $steps['form_data'] : [];

        $documents = [];
        $documentsReviewed = 0;
        if (tableExists($pdo, 'documents')) {
            $hasType = columnExists($pdo, 'documents', 'type');
            $hasOriginalName = columnExists($pdo, 'documents', 'original_name');
            $hasAiStatus = columnExists($pdo, 'documents', 'ai_status');
            $hasAiScore = columnExists($pdo, 'documents', 'ai_score');
            $hasUploadedAt = columnExists($pdo, 'documents', 'uploaded_at');
            $hasMime = columnExists($pdo, 'documents', 'mime_type');
            $hasReviewed = columnExists($pdo, 'documents', 'registrar_reviewed');
            $hasReviewedAt = columnExists($pdo, 'documents', 'reviewed_at');
            $hasReviewedBy = columnExists($pdo, 'documents', 'reviewed_by');
            $hasDocDecision = columnExists($pdo, 'documents', 'registrar_doc_decision');
            $hasDocRemarks = columnExists($pdo, 'documents', 'registrar_doc_remarks');
            $hasAiSecurityJson = columnExists($pdo, 'documents', 'ai_security_json');
            $hasFilePath = columnExists($pdo, 'documents', 'file_path');

            $selectType = $hasType ? 'type' : 'NULL AS type';
            $selectOriginalName = $hasOriginalName ? 'original_name' : 'NULL AS original_name';
            $selectFilePath = $hasFilePath ? 'file_path' : 'NULL AS file_path';
            $selectAiStatus = $hasAiStatus ? 'ai_status' : '\'pending\' AS ai_status';
            $selectAiScore = $hasAiScore ? 'ai_score' : 'NULL AS ai_score';
            $selectUploadedAt = $hasUploadedAt ? 'uploaded_at' : 'NULL AS uploaded_at';
            $selectMime = $hasMime ? 'mime_type' : 'NULL AS mime_type';
            $selectReviewed = $hasReviewed ? 'registrar_reviewed' : '0 AS registrar_reviewed';
            $selectReviewedAt = $hasReviewedAt ? 'reviewed_at' : 'NULL AS reviewed_at';
            $selectReviewedBy = $hasReviewedBy ? 'reviewed_by' : 'NULL AS reviewed_by';
            $selectDecision = $hasDocDecision ? 'registrar_doc_decision' : 'NULL AS registrar_doc_decision';
            $selectDocRemarks = $hasDocRemarks ? 'registrar_doc_remarks' : 'NULL AS registrar_doc_remarks';
            $selectAiSecurityJson = $hasAiSecurityJson ? 'ai_security_json' : 'NULL AS ai_security_json';

            if (columnExists($pdo, 'documents', 'enrollment_id')) {
                $d = $pdo->prepare("SELECT id, {$selectType}, {$selectOriginalName}, {$selectFilePath}, {$selectAiStatus}, {$selectAiScore}, {$selectUploadedAt}, {$selectMime}, {$selectReviewed}, {$selectReviewedAt}, {$selectReviewedBy}, {$selectDecision}, {$selectDocRemarks}, {$selectAiSecurityJson} FROM documents WHERE enrollment_id = :eid ORDER BY id DESC");
                $d->execute([':eid' => $enrollmentId]);
                $docs = $d->fetchAll() ?: [];
            } elseif (tableExists($pdo, 'students') && columnExists($pdo, 'documents', 'student_id')) {
                $d = $pdo->prepare('
                    SELECT d.id, ' . $selectType . ', ' . $selectOriginalName . ', ' . $selectFilePath . ', ' . $selectAiStatus . ', ' . $selectAiScore . ', ' . $selectUploadedAt . ', ' . $selectMime . ', ' . $selectReviewed . ', ' . $selectReviewedAt . ', ' . $selectReviewedBy . ', ' . $selectDecision . ', ' . $selectDocRemarks . ', ' . $selectAiSecurityJson . '
                    FROM students s
                    INNER JOIN documents d ON d.student_id = s.id
                    WHERE s.user_id = :uid
                    ORDER BY d.id DESC
                ');
                $d->execute([':uid' => (int)$row['user_id']]);
                $docs = $d->fetchAll() ?: [];
            } else {
                $docs = [];
            }

            // Dedupe documents by requirement type, keeping only the newest row
            // (rows are ordered by id DESC, so the first occurrence of a type is the latest).
            $seenTypes = [];
            $dedupedDocs = [];
            foreach ($docs as $doc) {
                $typeKeyRaw = trim((string)($doc['type'] ?? ''));
                $typeKey = strtolower($typeKeyRaw);
                if ($typeKey === '') {
                    // Fall back to a per-row unique key so untyped rows still appear.
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
                $typeLabel = trim((string)($doc['type'] ?? ''));
                if ($typeLabel === '') {
                    $typeLabel = 'Document';
                }
                $originalName = trim((string)($doc['original_name'] ?? ''));
                $fileDisplay = $originalName !== '' ? $originalName : $typeLabel;
                $mimeRaw = trim((string)($doc['mime_type'] ?? ''));
                $isReviewed = (int)($doc['registrar_reviewed'] ?? 0) === 1;
                if ($isReviewed) {
                    $documentsReviewed++;
                }
                $aiScoreRaw = $doc['ai_score'] ?? null;
                $aiConfidence = null;
                if ($aiScoreRaw !== null && $aiScoreRaw !== '' && is_numeric($aiScoreRaw)) {
                    $aiConfidence = (int)round((float)$aiScoreRaw);
                    $aiConfidence = max(0, min(100, $aiConfidence));
                }

                $aiSecurityRaw = isset($doc['ai_security_json']) ? (string)$doc['ai_security_json'] : null;
                $aiStatusRaw = $hasAiStatus ? (string)($doc['ai_status'] ?? 'pending') : 'pending';
                if ($hasAiStatus) {
                    $aiStatusRaw = documentReconcileStaleAiProcessing(
                        $pdo,
                        (int)$doc['id'],
                        $aiStatusRaw,
                        $aiSecurityRaw,
                        $aiScoreRaw
                    );
                }

                $scoreFloat = ($aiScoreRaw !== null && $aiScoreRaw !== '' && is_numeric($aiScoreRaw))
                    ? (float)$aiScoreRaw
                    : null;
                $parsedEnvelope = parseStoredAiVerifyEnvelope($aiSecurityRaw);
                $aiVerify = null;
                if ($parsedEnvelope !== null && !aiPersistedEnvelopeIsStale($parsedEnvelope)) {
                    $aiVerify = reconstructAiVerifyApiResult($parsedEnvelope, $scoreFloat, $aiStatusRaw);
                    $docTypeForAi = mapDocumentTypeForAi($typeLabel);
                    $userContext = [
                        'full_name' => (string)($row['full_name'] ?? ''),
                        'first_name' => (string)($row['first_name'] ?? ''),
                        'middle_name' => (string)($row['middle_name'] ?? ''),
                        'last_name' => (string)($row['last_name'] ?? ''),
                        'extension_name' => (string)($row['extension_name'] ?? ''),
                    ];
                    $enrollmentContext = [
                        'grade_level' => (string)($row['grade_level'] ?? ''),
                        'strand' => (string)($row['strand'] ?? ''),
                    ];
                    $autoExpected = buildAiExpectedVerifyFieldsForDocument($form, $docTypeForAi, $userContext, $enrollmentContext);
                    $fullPath = aiRefineResolveDocumentPath((string)($doc['file_path'] ?? ''));
                    $aiVerify = refineAiVerifyResult(
                        $aiVerify,
                        $docTypeForAi,
                        $fullPath,
                        aiRefineExpectedContextFromAuto($autoExpected)
                    );
                } elseif ($scoreFloat !== null && ($parsedEnvelope === null || aiPersistedEnvelopeIsStale($parsedEnvelope))) {
                    // Legacy score-only rows or stale envelopes — UI will re-run AI.
                    $aiVerify = null;
                } elseif ($scoreFloat !== null) {
                    $aiVerify = reconstructAiVerifyFromScoreOnly($aiStatusRaw, $scoreFloat);
                } elseif (documentAiVerificationLocked($aiStatusRaw) && ($parsedEnvelope === null || !aiPersistedEnvelopeIsStale($parsedEnvelope))) {
                    $aiVerify = reconstructAiVerifyFromLockedRow($aiStatusRaw, null, null);
                }

                $documents[] = [
                    'id' => (int)$doc['id'],
                    'requirementLabel' => $typeLabel,
                    'fileName' => $fileDisplay,
                    'name' => $fileDisplay,
                    'mimeType' => $mimeRaw,
                    'status' => $ui,
                    'aiStatus' => strtolower(trim($aiStatusRaw)),
                    'aiConfidence' => $aiConfidence,
                    'uploadedDate' => (string)($doc['uploaded_at'] ?? ''),
                    'issues' => $ui === 'Flagged' && $aiConfidence === null ? ['Requires manual verification'] : [],
                    'registrarReviewed' => $isReviewed,
                    'reviewedAt' => $doc['reviewed_at'] ?? null,
                    'reviewedBy' => isset($doc['reviewed_by']) && $doc['reviewed_by'] !== null ? (int)$doc['reviewed_by'] : null,
                    'registrarDocDecision' => isset($doc['registrar_doc_decision']) ? (string)($doc['registrar_doc_decision'] ?? '') : '',
                    'registrarDocRemarks' => isset($doc['registrar_doc_remarks']) ? (string)($doc['registrar_doc_remarks'] ?? '') : '',
                    'aiVerify' => $aiVerify,
                ];
            }
        }

        // Form JSON can contain keys that collide with server fields (e.g. "documents").
        // Merge with form first, then overlay server fields so DB-backed documents and IDs always win.
        $statusRaw = strtolower(trim((string)($row['status'] ?? 'pending')));
        $alreadyEnrolled = in_array($statusRaw, ['enrolled', 'approved'], true);
        if (!$alreadyEnrolled && columnExists($pdo, 'users', 'school_username')) {
            $suStmt = $pdo->prepare('SELECT school_username FROM users WHERE id = :uid LIMIT 1');
            $suStmt->execute([':uid' => (int)$row['user_id']]);
            $su = trim((string)($suStmt->fetchColumn() ?: ''));
            $returningStudent = isReturningStudentReEnrollment($pdo, (int)$row['user_id'], $enrollmentId);
            if ($su !== '' && !$returningStudent) {
                $alreadyEnrolled = true;
                if (!in_array($statusRaw, ['rejected'], true) && $statusRaw !== 'enrolled') {
                    $repairSql = $hasUpdatedAt
                        ? "UPDATE enrollments SET status = 'enrolled', updated_at = NOW() WHERE id = :id"
                        : "UPDATE enrollments SET status = 'enrolled' WHERE id = :id";
                    $pdo->prepare($repairSql)->execute([':id' => $enrollmentId]);
                    $statusRaw = 'enrolled';
                }
            }
        }

        $serverFields = [
            'id' => 'APP-' . date('Y') . '-' . str_pad((string)$enrollmentId, 3, '0', STR_PAD_LEFT),
            'enrollmentId' => $enrollmentId,
            'status' => toUiStatus((string)($row['status'] ?? 'pending')),
            'enrollmentStatusRaw' => $statusRaw,
            'isAlreadyEnrolled' => $alreadyEnrolled,
            'studentName' => studentEnrollmentFormDisplayName(
                $form,
                [
                    'full_name' => (string)($row['full_name'] ?? ''),
                    'first_name' => columnExists($pdo, 'users', 'first_name') ? (string)($row['first_name'] ?? '') : '',
                    'middle_name' => columnExists($pdo, 'users', 'middle_name') ? (string)($row['middle_name'] ?? '') : '',
                    'last_name' => columnExists($pdo, 'users', 'last_name') ? (string)($row['last_name'] ?? '') : '',
                    'extension_name' => columnExists($pdo, 'users', 'extension_name') ? (string)($row['extension_name'] ?? '') : '',
                ]
            ),
            'submittedDate' => (string)($row['applied_at'] ?? ''),
            'email' => (string)($row['email'] ?? ''),
            'gradeLevel' => (string)($row['grade_level'] ?? ''),
            'strand' => (string)($row['strand'] ?? ''),
            'registrarRemarks' => $hasRegistrarRemarks ? (string)($row['registrar_remarks'] ?? '') : '',
            'documents' => $documents,
            'documentsReviewed' => $documentsReviewed,
            'totalDocuments' => count($documents),
        ];
        $payload = array_merge($form, $serverFields);

        appLogEvent($pdo, 'registrar_application_detail', 'registrar', 'success', $actorId, 'enrollment', (string)$enrollmentId);
        echo json_encode(['success' => true, 'application' => $payload]);
    } catch (Throwable $e) {
        appLogEvent($pdo, 'registrar_application_detail', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'server_error', 'message' => $e->getMessage()]);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to load application detail']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }
    $enrollmentId = (int)($payload['enrollment_id'] ?? 0);
    $action = strtolower(trim((string)($payload['action'] ?? '')));
    $remarks = trim((string)($payload['remarks'] ?? ''));
    if ($enrollmentId <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Invalid enrollment id']);
        exit;
    }

    try {
        if ($action === 'save_remarks') {
            requireActorPermission($pdo, $actor, 'addRemarks');
            if (!$hasRegistrarRemarks) {
                $pdo->exec('ALTER TABLE enrollments ADD COLUMN registrar_remarks TEXT NULL');
                $hasRegistrarRemarks = true;
            }
            $sql = $hasUpdatedAt
                ? 'UPDATE enrollments SET registrar_remarks = :remarks, updated_at = NOW() WHERE id = :id'
                : 'UPDATE enrollments SET registrar_remarks = :remarks WHERE id = :id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':remarks' => $remarks, ':id' => $enrollmentId]);
            appLogEvent($pdo, 'registrar_save_remarks', 'registrar', 'success', $actorId, 'enrollment', (string)$enrollmentId);
            echo json_encode(['success' => true, 'message' => 'Remarks saved']);
            exit;
        }
        if ($action === 'approve' || $action === 'reject') {
            requireActorPermission($pdo, $actor, $action === 'approve' ? 'approveApplications' : 'rejectApplications');
            if ($action === 'approve') {
                // Schema guard: fail-loud when the credentials migration has not run.
                // ensureCredentialsSchema() runs above, but if ALTER privileges are
                // denied the columns may still be absent here. Short-circuit with a
                // 503 listing exactly which columns are missing rather than letting
                // a downstream UPDATE raise a generic SQL error.
                $credentialColumns = [
                    'first_name',
                    'middle_name',
                    'last_name',
                    'extension_name',
                    'school_username',
                    'must_change_password',
                ];
                $missingColumns = [];
                foreach ($credentialColumns as $col) {
                    if (!columnExists($pdo, 'users', $col)) {
                        $missingColumns[] = 'users.' . $col;
                    }
                }
                if (!empty($missingColumns)) {
                    appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'schema_not_migrated', 'missing' => $missingColumns]);
                    http_response_code(503);
                    echo json_encode([
                        'success' => false,
                        'error' => 'schema_not_migrated',
                        'details' => ['missing' => $missingColumns],
                    ]);
                    exit;
                }

                // Conflict guard: refuse to re-issue credentials. Look up the
                // owning user via the enrollment row and check school_username.
                // Also pull enrollment_steps so we can extract personalInfo without
                // a second round-trip in task 4.2.
                $ownerStmt = $pdo->prepare(
                    'SELECT u.id AS user_id, u.school_username, u.email, u.full_name,
                            e.status AS enrollment_status, e.enrollment_steps
                     FROM enrollments e
                     INNER JOIN users u ON u.id = e.user_id
                     WHERE e.id = :id LIMIT 1'
                );
                $ownerStmt->execute([':id' => $enrollmentId]);
                $ownerRow = $ownerStmt->fetch();
                if (!$ownerRow) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'Application not found']);
                    exit;
                }
                if ($ownerRow['school_username'] !== null && $ownerRow['school_username'] !== '') {
                    $existingStatus = strtolower(trim((string)($ownerRow['enrollment_status'] ?? '')));
                    // Idempotent approve: credentials already exist (student is
                    // enrolled). Repair status if a bad re-submit reset it to
                    // pending so the row leaves the Applications queue again.
                    if ($existingStatus !== 'rejected') {
                        if ($existingStatus !== 'enrolled') {
                            $repairSql = $hasUpdatedAt
                                ? "UPDATE enrollments SET status = 'enrolled', updated_at = NOW() WHERE id = :id"
                                : "UPDATE enrollments SET status = 'enrolled' WHERE id = :id";
                            $pdo->prepare($repairSql)->execute([':id' => $enrollmentId]);
                        }
                        syncStudentCohortForEnrollment($pdo, $enrollmentId);
                        carryForwardPhysicalDocsForEnrollment($pdo, $enrollmentId);
                        appLogEvent($pdo, 'registrar_decision', 'registrar', 'success', $actorId, 'enrollment', (string)$enrollmentId, [
                            'decision' => 'enrolled',
                            'idempotent' => true,
                        ]);
                        echo json_encode([
                            'success' => true,
                            'message' => 'Student is already enrolled',
                            'already_enrolled' => true,
                            'school_username' => (string)$ownerRow['school_username'],
                            'email_delivery' => 'skipped',
                            'section_assignment' => [
                                'assigned' => false,
                                'section' => null,
                                'shift' => null,
                                'preferred_shift' => null,
                                'shift_fallback' => false,
                                'auto_created' => false,
                                'warning' => null,
                            ],
                        ]);
                        exit;
                    }
                    appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'credentials_already_issued']);
                    http_response_code(409);
                    echo json_encode(['success' => false, 'error' => 'credentials_already_issued']);
                    exit;
                }

                // Task 4.2: Parse name parts and date of birth from
                // enrollment_steps.form_data. These variables are kept in
                // scope for downstream tasks (4.3 username generation,
                // 4.4 credential issuance, 5.1 welcome email rendering).
                $stepsRaw = (string)($ownerRow['enrollment_steps'] ?? '{}');
                $stepsDecoded = json_decode($stepsRaw, true);
                if (!is_array($stepsDecoded)) {
                    $stepsDecoded = [];
                }
                $formData = is_array($stepsDecoded['form_data'] ?? null) ? $stepsDecoded['form_data'] : [];

                $givenName     = trim((string)($formData['givenName'] ?? ''));
                $middleName    = trim((string)($formData['middleName'] ?? ''));
                $lastName      = trim((string)($formData['lastName'] ?? ''));
                $extensionName = trim((string)($formData['extensionName'] ?? ''));
                // The React enrollment form writes the DOB to `birthDate`
                // (see api/student_enrollment.php $formData['birthDate']
                // sync). Older drafts may carry a stray `dateOfBirth` key,
                // so we accept it as a fallback to keep legacy rows working.
                $dateOfBirth   = trim((string)($formData['birthDate'] ?? $formData['dateOfBirth'] ?? ''));

                // Validate dateOfBirth: must match YYYY-MM-DD AND be a real
                // calendar date (round-trip via DateTime::createFromFormat).
                $dobValid = false;
                $dobYear = 0;
                $dobMonth = 0;
                $dobDay = 0;
                if ($dateOfBirth !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateOfBirth) === 1) {
                    $dt = DateTime::createFromFormat('Y-m-d', $dateOfBirth);
                    if ($dt instanceof DateTime && $dt->format('Y-m-d') === $dateOfBirth) {
                        $dobValid = true;
                        $dobYear  = (int)$dt->format('Y');
                        $dobMonth = (int)$dt->format('n');
                        $dobDay   = (int)$dt->format('j');
                    }
                }
                if (!$dobValid) {
                    appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'missing_birth_date']);
                    http_response_code(422);
                    echo json_encode(['success' => false, 'error' => 'missing_birth_date']);
                    exit;
                }

                // Format temporary password as mm-dd-yyyy with zero-padded
                // month/day. Example: 2004-09-11 -> "09-11-2004". This value
                // is consumed by tasks 4.4 (hash + persist) and 5.1 (welcome
                // email body). It MUST NOT be written to logs or response
                // payloads other than the welcome email itself.
                $temporaryPassword = sprintf('%02d-%02d-%04d', $dobMonth, $dobDay, $dobYear);

                // Task 4.3: Derive the school_username candidate from the
                // parsed name parts using the pure Username_Generator. No DB
                // write happens on the invalid_name failure path.
                [$candidate, $usernameErr] = generateSchoolUsername($givenName, $middleName, $lastName);
                if ($usernameErr === 'invalid_name') {
                    appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'invalid_name']);
                    http_response_code(422);
                    echo json_encode(['success' => false, 'error' => 'invalid_name']);
                    exit;
                }

                // Resolve uniqueness against users.school_username. The result
                // is the value task 4.4 will persist on the user row.
                $schoolUsername = resolveSchoolUsernameCollision($pdo, (string)$candidate);
            }
            if (!$hasRegistrarRemarks) {
                $pdo->exec('ALTER TABLE enrollments ADD COLUMN registrar_remarks TEXT NULL');
                $hasRegistrarRemarks = true;
            }
            // Approving the enrollment form means the student is enrolled.
            // Physical-document collection is tracked separately on the
            // registrar's checklist (enrollment_physical_docs).
            $status = $action === 'approve' ? 'enrolled' : 'rejected';

            if ($action === 'approve') {
                // Task 4.4: Issue credentials inside a single DB transaction.
                // The transaction covers the credential writes on `users`
                // (name backfill + school_username + password hash +
                // must_change_password). The downstream `enrollments` status
                // transition is best-effort: if it fails, credential writes
                // are kept and a `status_transition: "failed"` warning is
                // surfaced (task 4.5 will assemble the response payload).
                $statusTransition = 'updated';
                $warnings = [];
                $targetUserId = (int)$ownerRow['user_id'];

                $pdo->beginTransaction();
                try {
                    // Backfill structured name columns from the parsed form
                    // data. Skip extension_name when empty so we do not
                    // overwrite a previously stored suffix with an empty
                    // string for students whose form omitted it.
                    if ($extensionName !== '') {
                        $nameStmt = $pdo->prepare('UPDATE users SET first_name = :fn, middle_name = :mn, last_name = :ln, extension_name = :ex WHERE id = :id');
                        $nameStmt->execute([
                            ':fn' => $givenName,
                            ':mn' => $middleName !== '' ? $middleName : null,
                            ':ln' => $lastName,
                            ':ex' => $extensionName,
                            ':id' => $targetUserId,
                        ]);
                    } else {
                        $nameStmt = $pdo->prepare('UPDATE users SET first_name = :fn, middle_name = :mn, last_name = :ln WHERE id = :id');
                        $nameStmt->execute([
                            ':fn' => $givenName,
                            ':mn' => $middleName !== '' ? $middleName : null,
                            ':ln' => $lastName,
                            ':id' => $targetUserId,
                        ]);
                    }

                    // Hash and persist credentials. The cleartext temporary
                    // password lives only in $temporaryPassword for the
                    // remainder of this request (consumed by task 5.1).
                    $passwordHash = password_hash($temporaryPassword, PASSWORD_DEFAULT);
                    $credStmt = $pdo->prepare('UPDATE users SET school_username = :su, password = :pw, must_change_password = 1 WHERE id = :id');
                    $credStmt->execute([
                        ':su' => $schoolUsername,
                        ':pw' => $passwordHash,
                        ':id' => $targetUserId,
                    ]);

                    // Best-effort enrollments status transition. A failure
                    // here MUST NOT roll back the credential writes; we
                    // surface a warning instead per Requirement 4.4a.
                    try {
                        $sqlStatus = $hasUpdatedAt
                            ? 'UPDATE enrollments SET status = :status, registrar_remarks = :remarks, updated_at = NOW() WHERE id = :id'
                            : 'UPDATE enrollments SET status = :status, registrar_remarks = :remarks WHERE id = :id';
                        $statusStmt = $pdo->prepare($sqlStatus);
                        $statusStmt->execute([':status' => $status, ':remarks' => $remarks, ':id' => $enrollmentId]);
                    } catch (Throwable $statusErr) {
                        $statusTransition = 'failed';
                        $warnings[] = 'status_transition_failed';
                        appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'status_transition_failed']);
                    }

                    $pdo->commit();
                } catch (Throwable $credErr) {
                    if ($pdo->inTransaction()) {
                        $pdo->rollBack();
                    }
                    appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'credential_write_failed']);
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => 'Failed to issue credentials']);
                    exit;
                }

                // Task 4.5: Assemble the approve response payload. The shape
                // is fixed at success/message/school_username/email_delivery/
                // status_transition with optional warnings. Per Requirement
                // 5.5, the cleartext $temporaryPassword is intentionally never
                // included anywhere in this payload.
                //
                // Task 5.2: Queue and dispatch the Welcome_Email after the
                // credential transaction has committed. Email delivery is
                // best-effort: a failure here MUST NOT roll back the
                // credential writes (which are already committed). On
                // failure we log via appLogEvent, set email_delivery to
                // "failed", and append `welcome_email_not_sent` to warnings.
                $emailDelivery = 'failed';
                $ownerEmail = trim((string)($ownerRow['email'] ?? ''));
                try {
                    if ($ownerEmail === '') {
                        throw new RuntimeException('owner_email_missing');
                    }
                    $rendered = renderWelcomeEmail([
                        'first_name'         => $givenName,
                        'school_username'    => $schoolUsername,
                        'temporary_password' => $temporaryPassword,
                    ]);
                    $queueId = queueEmail($pdo, $ownerEmail, $rendered['subject'], $rendered['body']);
                    $sent = processSingleQueuedEmail($pdo, $queueId);
                    if ($sent) {
                        $emailDelivery = 'sent';
                    } else {
                        $warnings[] = 'welcome_email_not_sent';
                        appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'welcome_email_send_failed']);
                    }
                } catch (Throwable $emailErr) {
                    $emailDelivery = 'failed';
                    $warnings[] = 'welcome_email_not_sent';
                    appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'welcome_email_send_failed']);
                }

                appLogEvent($pdo, 'registrar_decision', 'registrar', 'success', $actorId, 'enrollment', (string)$enrollmentId, ['decision' => $status]);
                syncStudentCohortForEnrollment($pdo, $enrollmentId);
                if ($action === 'approve') {
                    carryForwardPhysicalDocsForEnrollment($pdo, $enrollmentId);
                }

                // Section auto-assignment. Runs OUTSIDE the credential
                // transaction — a failure here MUST NOT roll back the
                // credentials write. Strand+gender come from the parsed
                // form_data. EIM girls are intentionally NOT auto-placed
                // (per registrar policy) so the registrar can decide where
                // to put them. If every existing section for the strand is
                // full, a new section letter (A → B → C …) is auto-created.
                $assignedSection = null;
                $assignedShift = null;
                $sectionAutoCreated = false;
                $sectionWarning = null;
                $sectionShiftFallback = false;
                $preferredShiftEcho = null;
                try {
                    $rawStrand = (string)($formData['strand'] ?? '');
                    $rawGender = (string)($formData['gender'] ?? '');
                    $rawPreferredShift = (string)($formData['preferredSchedule'] ?? '');
                    $assignResult = autoAssignSectionForApprovedStudent(
                        $pdo,
                        $targetUserId,
                        $rawStrand,
                        $rawGender,
                        $rawPreferredShift,
                        (string)($formData['gradeLevel'] ?? '')
                    );
                    $preferredShiftEcho = (string)($assignResult['preferred_shift'] ?? '');
                    if (!empty($assignResult['assigned'])) {
                        $assignedSection = (string)$assignResult['section'];
                        $assignedShift   = (string)($assignResult['shift'] ?? '');
                        $sectionAutoCreated = !empty($assignResult['auto_created']);
                        $sectionShiftFallback = !empty($assignResult['shift_fallback']);
                        if ($sectionShiftFallback) {
                            $warnings[] = 'section_shift_fallback';
                        }
                        appLogEvent($pdo, 'section_assignment', 'registrar', 'success', $actorId, 'user', (string)$targetUserId, [
                            'strand'          => $assignResult['strand'] ?? $rawStrand,
                            'section'         => $assignedSection,
                            'shift'           => $assignedShift,
                            'preferred_shift' => $preferredShiftEcho,
                            'shift_fallback'  => $sectionShiftFallback,
                            'auto_created'    => $sectionAutoCreated,
                        ]);
                    } else {
                        $sectionWarning = (string)($assignResult['warning'] ?? 'section_not_assigned');
                        $warnings[] = 'section_' . $sectionWarning;
                        appLogEvent($pdo, 'section_assignment', 'registrar', 'failed', $actorId, 'user', (string)$targetUserId, [
                            'strand'          => $rawStrand,
                            'gender'          => $rawGender,
                            'preferred_shift' => $preferredShiftEcho,
                            'reason'          => $sectionWarning,
                            'message'         => $assignResult['reason'] ?? null,
                        ]);
                    }
                } catch (Throwable $secErr) {
                    $sectionWarning = 'exception';
                    $warnings[] = 'section_assignment_failed';
                    appLogEvent($pdo, 'section_assignment', 'registrar', 'failed', $actorId, 'user', (string)$targetUserId, [
                        'reason'  => 'exception',
                        'message' => $secErr->getMessage(),
                    ]);
                }

                // Task 5.3: SUCCESS audit entry for the credential-issuance
                // event itself. target_type=user / target_id=$targetUserId so
                // the trail is keyed on the student whose account was issued.
                // Per Requirement 5.5, the cleartext temporary password is
                // intentionally NOT included anywhere in details_json.
                appLogEvent($pdo, 'issue_credentials', 'registrar', 'success', $actorId, 'user', (string)$targetUserId, [
                    'school_username' => $schoolUsername,
                    'email_delivery' => $emailDelivery,
                    'status_transition' => $statusTransition,
                    'warnings' => $warnings,
                ]);

                $response = [
                    'success' => true,
                    'message' => 'Application approved — student is now enrolled',
                    'school_username' => $schoolUsername,
                    'email_delivery' => $emailDelivery,
                    'status_transition' => $statusTransition,
                    'section_assignment' => [
                        'assigned'        => $assignedSection !== null,
                        'section'         => $assignedSection,
                        'shift'           => $assignedShift,
                        'preferred_shift' => $preferredShiftEcho,
                        'shift_fallback'  => $sectionShiftFallback,
                        'auto_created'    => $sectionAutoCreated,
                        'warning'         => $sectionWarning,
                    ],
                ];
                if (!empty($warnings)) {
                    $response['warnings'] = $warnings;
                }
                echo json_encode($response);
                exit;
            }

            // Reject path: unchanged single-statement update. (Issue-credentials
            // path lives in its own action below — see action === 'issue_credentials'.)
            $sql = $hasUpdatedAt
                ? 'UPDATE enrollments SET status = :status, registrar_remarks = :remarks, updated_at = NOW() WHERE id = :id'
                : 'UPDATE enrollments SET status = :status, registrar_remarks = :remarks WHERE id = :id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':status' => $status, ':remarks' => $remarks, ':id' => $enrollmentId]);
            syncStudentCohortForEnrollment($pdo, $enrollmentId);
            appLogEvent($pdo, 'registrar_decision', 'registrar', 'success', $actorId, 'enrollment', (string)$enrollmentId, ['decision' => $status]);
            echo json_encode(['success' => true, 'message' => 'Application rejected']);
            exit;
        }
        if ($action === 'issue_credentials') {
            // Manual credential release for an already-approved enrollment.
            // Use case: students approved before the credentials feature
            // shipped (school_username is NULL on their users row), or any
            // case where a registrar wants to (re)issue credentials and
            // resend the welcome email after the approve decision was made.
            //
            // Behavior mirrors the approve-branch credential block:
            //   - Schema guard (HTTP 503 schema_not_migrated)
            //   - Conflict guard (HTTP 409 credentials_already_issued)
            //   - Name + DOB parsing (HTTP 422 missing_birth_date / invalid_name)
            //   - Username generation + collision resolution
            //   - Single-transaction credential write (name backfill,
            //     school_username, password hash, must_change_password=1)
            //   - Welcome email queue + dispatch (best-effort)
            //   - Audit log entry
            //
            // Unlike the approve action, this one does NOT change
            // enrollments.status — the row is already approved.
            $credentialColumns = [
                'first_name',
                'middle_name',
                'last_name',
                'extension_name',
                'school_username',
                'must_change_password',
            ];
            $missingColumns = [];
            foreach ($credentialColumns as $col) {
                if (!columnExists($pdo, 'users', $col)) {
                    $missingColumns[] = 'users.' . $col;
                }
            }
            if (!empty($missingColumns)) {
                appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'schema_not_migrated', 'missing' => $missingColumns]);
                http_response_code(503);
                echo json_encode([
                    'success' => false,
                    'error' => 'schema_not_migrated',
                    'details' => ['missing' => $missingColumns],
                ]);
                exit;
            }

            $ownerStmt = $pdo->prepare('SELECT u.id AS user_id, u.school_username, u.email, u.full_name, e.status AS enrollment_status, e.enrollment_steps FROM enrollments e INNER JOIN users u ON u.id = e.user_id WHERE e.id = :id LIMIT 1');
            $ownerStmt->execute([':id' => $enrollmentId]);
            $ownerRow = $ownerStmt->fetch();
            if (!$ownerRow) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Application not found']);
                exit;
            }

            // Refuse to issue credentials before the application has been
            // approved (student must be enrolled / legacy approved).
            $enrollmentStatus = strtolower(trim((string)($ownerRow['enrollment_status'] ?? '')));
            if (!in_array($enrollmentStatus, ['approved', 'enrolled'], true)) {
                appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'enrollment_not_approved', 'status' => $enrollmentStatus]);
                http_response_code(409);
                echo json_encode(['success' => false, 'error' => 'enrollment_not_approved', 'details' => ['hint' => 'Approve the application first.']]);
                exit;
            }

            if ($ownerRow['school_username'] !== null && $ownerRow['school_username'] !== '') {
                appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'credentials_already_issued']);
                http_response_code(409);
                echo json_encode(['success' => false, 'error' => 'credentials_already_issued']);
                exit;
            }

            // Parse name parts and DOB from enrollment_steps.form_data.
            $stepsRaw = (string)($ownerRow['enrollment_steps'] ?? '{}');
            $stepsDecoded = json_decode($stepsRaw, true);
            if (!is_array($stepsDecoded)) {
                $stepsDecoded = [];
            }
            $formData = is_array($stepsDecoded['form_data'] ?? null) ? $stepsDecoded['form_data'] : [];

            $givenName     = trim((string)($formData['givenName'] ?? ''));
            $middleName    = trim((string)($formData['middleName'] ?? ''));
            $lastName      = trim((string)($formData['lastName'] ?? ''));
            $extensionName = trim((string)($formData['extensionName'] ?? ''));
            // Match the field name the React enrollment form writes
            // (`birthDate`); accept `dateOfBirth` only as a legacy fallback.
            $dateOfBirth   = trim((string)($formData['birthDate'] ?? $formData['dateOfBirth'] ?? ''));

            $dobValid = false;
            $dobYear = 0;
            $dobMonth = 0;
            $dobDay = 0;
            if ($dateOfBirth !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateOfBirth) === 1) {
                $dt = DateTime::createFromFormat('Y-m-d', $dateOfBirth);
                if ($dt instanceof DateTime && $dt->format('Y-m-d') === $dateOfBirth) {
                    $dobValid = true;
                    $dobYear  = (int)$dt->format('Y');
                    $dobMonth = (int)$dt->format('n');
                    $dobDay   = (int)$dt->format('j');
                }
            }
            if (!$dobValid) {
                appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'missing_birth_date']);
                http_response_code(422);
                echo json_encode(['success' => false, 'error' => 'missing_birth_date']);
                exit;
            }

            $temporaryPassword = sprintf('%02d-%02d-%04d', $dobMonth, $dobDay, $dobYear);

            [$candidate, $usernameErr] = generateSchoolUsername($givenName, $middleName, $lastName);
            if ($usernameErr === 'invalid_name') {
                appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'invalid_name']);
                http_response_code(422);
                echo json_encode(['success' => false, 'error' => 'invalid_name']);
                exit;
            }
            $schoolUsername = resolveSchoolUsernameCollision($pdo, (string)$candidate);

            $warnings = [];
            $targetUserId = (int)$ownerRow['user_id'];

            $pdo->beginTransaction();
            try {
                if ($extensionName !== '') {
                    $nameStmt = $pdo->prepare('UPDATE users SET first_name = :fn, middle_name = :mn, last_name = :ln, extension_name = :ex WHERE id = :id');
                    $nameStmt->execute([
                        ':fn' => $givenName,
                        ':mn' => $middleName !== '' ? $middleName : null,
                        ':ln' => $lastName,
                        ':ex' => $extensionName,
                        ':id' => $targetUserId,
                    ]);
                } else {
                    $nameStmt = $pdo->prepare('UPDATE users SET first_name = :fn, middle_name = :mn, last_name = :ln WHERE id = :id');
                    $nameStmt->execute([
                        ':fn' => $givenName,
                        ':mn' => $middleName !== '' ? $middleName : null,
                        ':ln' => $lastName,
                        ':id' => $targetUserId,
                    ]);
                }

                $passwordHash = password_hash($temporaryPassword, PASSWORD_DEFAULT);
                $credStmt = $pdo->prepare('UPDATE users SET school_username = :su, password = :pw, must_change_password = 1 WHERE id = :id');
                $credStmt->execute([
                    ':su' => $schoolUsername,
                    ':pw' => $passwordHash,
                    ':id' => $targetUserId,
                ]);

                $pdo->commit();
            } catch (Throwable $credErr) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'credential_write_failed']);
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to issue credentials']);
                exit;
            }

            // Welcome email — best-effort, never rolls back the credential
            // writes (which are already committed).
            $emailDelivery = 'failed';
            $ownerEmail = trim((string)($ownerRow['email'] ?? ''));
            try {
                if ($ownerEmail === '') {
                    throw new RuntimeException('owner_email_missing');
                }
                $rendered = renderWelcomeEmail([
                    'first_name'         => $givenName,
                    'school_username'    => $schoolUsername,
                    'temporary_password' => $temporaryPassword,
                ]);
                $queueId = queueEmail($pdo, $ownerEmail, $rendered['subject'], $rendered['body']);
                $sent = processSingleQueuedEmail($pdo, $queueId);
                if ($sent) {
                    $emailDelivery = 'sent';
                } else {
                    $warnings[] = 'welcome_email_not_sent';
                    appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'welcome_email_send_failed']);
                }
            } catch (Throwable $emailErr) {
                $emailDelivery = 'failed';
                $warnings[] = 'welcome_email_not_sent';
                appLogEvent($pdo, 'issue_credentials', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'welcome_email_send_failed']);
            }

            appLogEvent($pdo, 'issue_credentials', 'registrar', 'success', $actorId, 'user', (string)$targetUserId, [
                'school_username' => $schoolUsername,
                'email_delivery' => $emailDelivery,
                'trigger' => 'manual',
                'warnings' => $warnings,
            ]);

            $response = [
                'success' => true,
                'message' => 'Credentials issued',
                'school_username' => $schoolUsername,
                'email_delivery' => $emailDelivery,
            ];
            if (!empty($warnings)) {
                $response['warnings'] = $warnings;
            }
            echo json_encode($response);
            exit;
        }
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Unsupported action']);
    } catch (Throwable $e) {
        appLogEvent($pdo, 'registrar_decision', 'registrar', 'failed', $actorId, 'enrollment', (string)$enrollmentId, ['reason' => 'server_error']);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to update application']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
