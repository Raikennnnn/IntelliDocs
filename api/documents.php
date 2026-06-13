<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';

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

function describeUploadError(int $code): string
{
    return match ($code) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'File is too large. Maximum size is 5MB — try compressing the image or saving as JPG.',
        UPLOAD_ERR_PARTIAL => 'Upload was interrupted. Please try again.',
        UPLOAD_ERR_NO_FILE => 'No file was received. Please choose a file and try again.',
        UPLOAD_ERR_NO_TMP_DIR => 'Server upload folder is misconfigured. Contact the registrar.',
        UPLOAD_ERR_CANT_WRITE => 'Server could not save the upload. Contact the registrar.',
        UPLOAD_ERR_EXTENSION => 'This file type is blocked by the server.',
        default => 'Invalid file upload',
    };
}

/** @return array{id: int, role: string} */
function requireDocumentActor(): array
{
    global $pdo;
    require_once __DIR__ . '/api_auth.php';
    $actor = apiRequireActor($pdo, 'documents');

    return [
        'id' => (int)$actor['id'],
        'role' => (string)($actor['role'] ?? ''),
    ];
}

function ensureDocumentsSchema(PDO $pdo): void
{
    if (!tableExists($pdo, 'documents')) {
        $pdo->exec(
            'CREATE TABLE documents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NULL,
                enrollment_id INT NULL,
                type VARCHAR(120) NULL,
                filename VARCHAR(255) NULL,
                original_name VARCHAR(255) NULL,
                mime_type VARCHAR(120) NULL,
                file_size BIGINT NULL,
                file_path VARCHAR(500) NULL,
                ai_status VARCHAR(40) DEFAULT "pending",
                ai_score DECIMAL(5,2) NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )'
        );
    }

    $columns = [
        'student_id' => 'INT NULL',
        'enrollment_id' => 'INT NULL',
        'type' => 'VARCHAR(120) NULL',
        'filename' => 'VARCHAR(255) NULL',
        'original_name' => 'VARCHAR(255) NULL',
        'mime_type' => 'VARCHAR(120) NULL',
        'file_size' => 'BIGINT NULL',
        'file_path' => 'VARCHAR(500) NULL',
        'ai_status' => 'VARCHAR(40) DEFAULT "pending"',
        'ai_score' => 'DECIMAL(5,2) NULL',
        'ai_security_json' => 'TEXT NULL',
        // Registrar per-document decision (e.g., require resubmission) and reason shown to students.
        'registrar_doc_decision' => 'VARCHAR(20) NULL',
        'registrar_doc_remarks' => 'TEXT NULL',
        'doc_decided_at' => 'TIMESTAMP NULL',
        'doc_decided_by' => 'INT NULL',
        // Counts how many uploads the student has made of this requirement
        // (including the initial upload). The student is allowed up to 5
        // attempts; the 6th is blocked and the student is emailed to bring
        // the document in person for face-to-face verification.
        'upload_count' => 'INT NOT NULL DEFAULT 0',
        'uploaded_at' => 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        // 1 when copied from a prior school-year enrollment (Grade 12 rollover).
        'carried_forward' => 'TINYINT(1) NOT NULL DEFAULT 0',
    ];

    foreach ($columns as $name => $ddl) {
        if (!columnExists($pdo, 'documents', $name)) {
            $pdo->exec("ALTER TABLE documents ADD COLUMN {$name} {$ddl}");
        }
    }
}

function resolveEnrollmentId(PDO $pdo, int $userId, ?int $providedId): int
{
    if ($providedId !== null && $providedId > 0) {
        $own = $pdo->prepare('SELECT id FROM enrollments WHERE id = :id AND user_id = :uid LIMIT 1');
        $own->execute([':id' => $providedId, ':uid' => $userId]);
        if ($own->fetchColumn()) {
            return $providedId;
        }
    }
    if (!tableExists($pdo, 'enrollments')) {
        return 0;
    }

    require_once __DIR__ . '/school_year_helpers.php';
    $syCurrent = getEnrollmentSchoolYear($pdo);
    if ($syCurrent !== null) {
        $openStmt = $pdo->prepare(
            "SELECT id FROM enrollments
             WHERE user_id = :uid AND school_year = :sy
               AND LOWER(TRIM(status)) IN ('draft', 'pending', 'under_review', 'under review', 'review')
             ORDER BY id DESC
             LIMIT 1"
        );
        $openStmt->execute([':uid' => $userId, ':sy' => $syCurrent]);
        $openId = (int)($openStmt->fetchColumn() ?: 0);
        if ($openId > 0) {
            return $openId;
        }
    }

    $stmt = $pdo->prepare('SELECT id FROM enrollments WHERE user_id = :user_id ORDER BY id DESC LIMIT 1');
    $stmt->execute([':user_id' => $userId]);
    $row = $stmt->fetch();

    return (int)($row['id'] ?? 0);
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$documentActor = requireDocumentActor();
$userId = $documentActor['id'];

ensureDocumentsSchema($pdo);

if ($method === 'GET') {
    try {
        $enrollmentId = isset($_GET['enrollment_id']) ? (int)$_GET['enrollment_id'] : null;
        $enrollmentId = resolveEnrollmentId($pdo, $userId, $enrollmentId);

        if ($enrollmentId > 0 && tableExists($pdo, 'enrollments')) {
            require_once __DIR__ . '/enrollment_status_helpers.php';
            $enrStmt = $pdo->prepare(
                'SELECT id, school_year, status, grade_level, enrollment_steps FROM enrollments WHERE id = :id AND user_id = :uid LIMIT 1'
            );
            $enrStmt->execute([':id' => $enrollmentId, ':uid' => $userId]);
            $enrollmentRow = $enrStmt->fetch(PDO::FETCH_ASSOC) ?: null;
            if (is_array($enrollmentRow)) {
                stripNonGrade12CarriedDocuments($pdo, $userId, $enrollmentRow);
                healGrade12CarriedDocuments($pdo, $userId, $enrollmentRow);
                healClearedDocumentUploadCounts($pdo, $enrollmentId);
            }
        }

        if ($enrollmentId > 0 && columnExists($pdo, 'documents', 'enrollment_id')) {
            $hasDecision = columnExists($pdo, 'documents', 'registrar_doc_decision');
            $hasDocRemarks = columnExists($pdo, 'documents', 'registrar_doc_remarks');
            $hasReviewedFlag = columnExists($pdo, 'documents', 'registrar_reviewed');
            $hasUploadCount = columnExists($pdo, 'documents', 'upload_count');
            $hasCarriedForward = columnExists($pdo, 'documents', 'carried_forward');
            $selectDecision = $hasDecision ? 'registrar_doc_decision' : "'' AS registrar_doc_decision";
            $selectRemarks = $hasDocRemarks ? 'registrar_doc_remarks' : "'' AS registrar_doc_remarks";
            // The "registrar marked this document as reviewed" flag is what
            // lets the student's upload step show "Approved" instead of
            // "Uploaded — awaiting review" when the registrar has manually
            // gone through the document, even if the AI hasn't auto-verified
            // it. Falls back to 0 on schemas where the column doesn't exist.
            $selectReviewed = $hasReviewedFlag ? 'registrar_reviewed' : '0 AS registrar_reviewed';
            // Resubmit attempt counter (0 while filling the enrollment form).
            $selectUploadCount = $hasUploadCount ? 'upload_count' : '0 AS upload_count';
            $selectCarriedForward = $hasCarriedForward ? 'carried_forward' : '0 AS carried_forward';

            $stmt = $pdo->prepare(
                'SELECT id, type, original_name, filename, ai_status, uploaded_at, file_path, file_size, mime_type, '
                . $selectDecision . ', ' . $selectRemarks . ', ' . $selectReviewed . ', ' . $selectUploadCount . ', '
                . $selectCarriedForward . '
                FROM documents
                WHERE enrollment_id = :enrollment_id
                ORDER BY id DESC'
            );
            $stmt->execute([':enrollment_id' => $enrollmentId]);
            $rows = $stmt->fetchAll() ?: [];
        } else {
            // Fallback path if enrollment_id is unavailable on this schema.
            $rows = [];
        }

        echo json_encode(['success' => true, 'documents' => $rows]);
        exit;
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to load documents']);
        exit;
    }
}

if ($method === 'POST') {
    if ($documentActor['role'] === 'student') {
        require_once __DIR__ . '/permission_guard.php';
        requireActorPermission($pdo, ['role' => 'student', 'id' => $userId], 'uploadDocuments', false);
    }

    if (!isset($_FILES['file'])) {
        $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($contentLength > 0 && empty($_POST) && empty($_FILES)) {
            http_response_code(413);
            echo json_encode([
                'success' => false,
                'error' => 'File is too large for the server. Maximum size is 5MB — try compressing the image or saving as JPG.',
            ]);
            exit;
        }
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No file uploaded']);
        exit;
    }

    $documentType = trim((string)($_POST['document_type'] ?? 'Document'));
    $providedEnrollmentId = isset($_POST['enrollment_id']) ? (int)$_POST['enrollment_id'] : null;
    $enrollmentId = resolveEnrollmentId($pdo, $userId, $providedEnrollmentId);

    if ($enrollmentId > 0) {
        require_once __DIR__ . '/enrollment_status_helpers.php';
        $blockedMsg = studentDocumentReuploadBlocked($pdo, $userId, $enrollmentId, $documentType);
        if ($blockedMsg !== null) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => $blockedMsg, 'upload_locked' => true]);
            exit;
        }
    }

    $file = $_FILES['file'];
    $uploadErr = is_array($file) ? (int)($file['error'] ?? UPLOAD_ERR_NO_FILE) : UPLOAD_ERR_NO_FILE;
    if (!is_array($file) || $uploadErr !== UPLOAD_ERR_OK) {
        http_response_code($uploadErr === UPLOAD_ERR_INI_SIZE || $uploadErr === UPLOAD_ERR_FORM_SIZE ? 413 : 400);
        echo json_encode(['success' => false, 'error' => describeUploadError($uploadErr)]);
        exit;
    }

    $tmpPath = (string)$file['tmp_name'];
    $originalName = (string)($file['name'] ?? 'document');
    $size = (int)($file['size'] ?? 0);
    if ($size <= 0 || $size > 5 * 1024 * 1024) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'File size must be between 1 byte and 5MB']);
        exit;
    }

    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $allowed = ['pdf', 'jpg', 'jpeg', 'png'];
    if (!in_array($ext, $allowed, true)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Only PDF, JPG, JPEG, PNG are allowed']);
        exit;
    }

    $safeBase = preg_replace('/[^A-Za-z0-9._-]/', '_', pathinfo($originalName, PATHINFO_FILENAME));
    $finalName = date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '_' . $safeBase . '.' . $ext;
    $relativeDir = 'uploads/documents/' . $userId;
    $absoluteDir = dirname(__DIR__) . '/' . $relativeDir;
    if (!is_dir($absoluteDir) && !mkdir($absoluteDir, 0777, true) && !is_dir($absoluteDir)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to create upload directory']);
        exit;
    }
    $absolutePath = $absoluteDir . '/' . $finalName;
    if (!move_uploaded_file($tmpPath, $absolutePath)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to store uploaded file']);
        exit;
    }

    $mimeType = (string)($file['type'] ?? '');
    if ($mimeType === '') {
        $mimeType = match ($ext) {
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'pdf' => 'application/pdf',
            default => 'image/jpeg',
        };
    }

    // PDFs cannot be OCR-screened at upload — require a readable photo instead.
    if ($ext === 'pdf') {
        @unlink($absolutePath);
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'error' => 'We cannot verify PDF uploads automatically. Take a clear photo (JPG or PNG) of the document and upload that instead.',
            'level' => 2,
        ]);
        exit;
    }

    // Level 1 — image quality + readability (blur / lighting / OCR text). PDFs rejected above.
    if (in_array($ext, ['jpg', 'jpeg', 'png'], true)) {
        require_once __DIR__ . '/ai_http.php';
        $docTypeKey = mapDocumentTypeForAi($documentType);
        $screen = aiScreenUploadQuality($absolutePath, $originalName, $mimeType, $docTypeKey);
        if (!$screen['ok']) {
            @unlink($absolutePath);
            http_response_code(503);
            echo json_encode([
                'success' => false,
                'error' => $screen['message'],
                'level' => (int)($screen['level'] ?? 1),
            ]);
            exit;
        }
        if (!$screen['pass']) {
            @unlink($absolutePath);
            http_response_code(422);
            echo json_encode([
                'success' => false,
                'error' => $screen['message'],
                'level' => (int)($screen['level'] ?? 1),
                'security_levels' => $screen['body']['security_levels'] ?? null,
            ]);
            exit;
        }
    }

    $relativeFilePath = $relativeDir . '/' . $finalName;

    // Resubmit attempt cap applies only after the registrar rejected a document.
    // While the student is still filling the enrollment form they may replace
    // uploads freely without consuming resubmit attempts.
    $UPLOAD_LIMIT = 5;
    $previousResubmitAttempts = 0;
    $inResubmitPhase = false;
    $existingDocRow = null;
    if ($enrollmentId > 0) {
        try {
            require_once __DIR__ . '/enrollment_status_helpers.php';
            $existingDocRow = findLatestDocumentRowForRequirement($pdo, $enrollmentId, $documentType);
            if (is_array($existingDocRow)) {
                $inResubmitPhase = documentRegistrarRejectedForResubmit($existingDocRow);
                if ($inResubmitPhase) {
                    $previousResubmitAttempts = max(0, (int)($existingDocRow['upload_count'] ?? 0));
                }
            }
        } catch (Throwable $countErr) {
            $previousResubmitAttempts = 0;
            $inResubmitPhase = false;
        }
    }

    $newUploadCount = $inResubmitPhase ? ($previousResubmitAttempts + 1) : 0;

    if ($inResubmitPhase && $newUploadCount > $UPLOAD_LIMIT) {
        // Roll back the file we just stored — the upload is rejected.
        if (is_file($absolutePath)) {
            @unlink($absolutePath);
        }

        // Best-effort lookup of the student's name + email so we can
        // address the message properly. Failures are non-fatal: we still
        // return the 429 so the frontend can lock the row.
        $studentEmail = '';
        $studentName = '';
        try {
            $userStmt = $pdo->prepare('SELECT full_name, email FROM users WHERE id = :uid LIMIT 1');
            $userStmt->execute([':uid' => $userId]);
            if ($u = $userStmt->fetch()) {
                $studentEmail = (string)($u['email'] ?? '');
                $studentName = (string)($u['full_name'] ?? '');
            }
        } catch (Throwable $userErr) {
            // Ignore — best effort.
        }

        require_once __DIR__ . '/in_person_verification_email.php';
        $requirementLabel = inPersonRequirementLabel($documentType);
        $emailSent = false;
        if ($studentEmail !== '') {
            $emailSent = sendInPersonVerificationEmail(
                $pdo,
                $studentEmail,
                $studentName,
                $requirementLabel,
                $UPLOAD_LIMIT
            );
        }

        appLogEvent(
            $pdo,
            'document_upload_blocked',
            'student',
            'blocked',
            $userId,
            'document',
            (string)($enrollmentId ?: 0),
            [
                'reason' => 'attempt_limit_reached',
                'document_type' => $documentType,
                'attempts_used' => $previousResubmitAttempts,
                'limit' => $UPLOAD_LIMIT,
                'email_sent' => $emailSent,
            ]
        );

        http_response_code(429);
        echo json_encode([
            'success' => false,
            'limit_reached' => true,
            'attempts_used' => $previousResubmitAttempts,
            'attempt_limit' => $UPLOAD_LIMIT,
            'requirement_label' => $requirementLabel,
            'email_sent' => $emailSent,
            'error' => sprintf(
                'You have used all %d upload attempts for "%s". Please bring the original document to the registrar for face-to-face verification.',
                $UPLOAD_LIMIT,
                $requirementLabel
            ),
        ]);
        exit;
    }

    try {
        // Replace previous uploads of the same requirement type for this enrollment.
        // The student is intentionally re-uploading this requirement, so any earlier
        // file (rejected or pending) must be removed so the registrar only sees the
        // current version. Files are deleted from disk; DB rows are removed.
        if ($enrollmentId > 0 && columnExists($pdo, 'documents', 'enrollment_id')) {
            try {
                $oldStmt = $pdo->prepare('SELECT id, file_path FROM documents WHERE enrollment_id = :eid AND type = :type');
                $oldStmt->execute([':eid' => $enrollmentId, ':type' => $documentType]);
                $oldRows = $oldStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $projectRoot = dirname(__DIR__);
                foreach ($oldRows as $old) {
                    $rel = trim((string)($old['file_path'] ?? ''));
                    if ($rel !== '') {
                        $abs = $projectRoot . DIRECTORY_SEPARATOR . str_replace(['\\', '/'], DIRECTORY_SEPARATOR, $rel);
                        if (is_file($abs)) {
                            @unlink($abs);
                        }
                    }
                }
                $del = $pdo->prepare('DELETE FROM documents WHERE enrollment_id = :eid AND type = :type');
                $del->execute([':eid' => $enrollmentId, ':type' => $documentType]);
            } catch (Throwable $repErr) {
                // Replacement failure is non-fatal: the new upload still goes through.
                // The registrar will then see two rows and can manually clean up.
                appLogEvent(
                    $pdo,
                    'document_replace',
                    'student',
                    'failed',
                    $userId,
                    'document',
                    (string)($enrollmentId ?: 0),
                    ['reason' => 'replace_failed', 'message' => $repErr->getMessage(), 'type' => $documentType]
                );
            }
        }

        // The schema-ensure helper above adds upload_count; on older schemas
        // where the column is somehow missing we fall back to an insert
        // without it so the upload still succeeds.
        $hasUploadCountCol = columnExists($pdo, 'documents', 'upload_count');
        $hasCarriedForwardCol = columnExists($pdo, 'documents', 'carried_forward');
        if ($hasUploadCountCol && $hasCarriedForwardCol) {
            $sql = '
                INSERT INTO documents (enrollment_id, type, filename, original_name, mime_type, file_size, file_path, ai_status, upload_count, carried_forward)
                VALUES (:enrollment_id, :type, :filename, :original_name, :mime_type, :file_size, :file_path, :ai_status, :upload_count, 0)
            ';
        } elseif ($hasUploadCountCol) {
            $sql = '
                INSERT INTO documents (enrollment_id, type, filename, original_name, mime_type, file_size, file_path, ai_status, upload_count)
                VALUES (:enrollment_id, :type, :filename, :original_name, :mime_type, :file_size, :file_path, :ai_status, :upload_count)
            ';
        } else {
            $sql = '
                INSERT INTO documents (enrollment_id, type, filename, original_name, mime_type, file_size, file_path, ai_status)
                VALUES (:enrollment_id, :type, :filename, :original_name, :mime_type, :file_size, :file_path, :ai_status)
            ';
        }
        $stmt = $pdo->prepare($sql);
        $params = [
            ':enrollment_id' => $enrollmentId > 0 ? $enrollmentId : null,
            ':type' => $documentType,
            ':filename' => $finalName,
            ':original_name' => $originalName,
            ':mime_type' => $mimeType,
            ':file_size' => $size,
            ':file_path' => $relativeFilePath,
            ':ai_status' => 'pending',
        ];
        if ($hasUploadCountCol) {
            $params[':upload_count'] = $newUploadCount;
        }
        $stmt->execute($params);

        $docId = (int)$pdo->lastInsertId();
        appLogEvent($pdo, 'document_upload', 'student', 'success', $userId, 'document', (string)$docId, [
            'document_type' => $documentType,
            'enrollment_id' => $enrollmentId,
            'replaced_previous' => true,
            'attempt_number' => $newUploadCount,
            'attempt_limit' => $UPLOAD_LIMIT,
        ]);

        echo json_encode([
            'success' => true,
            'document' => [
                'id' => $docId,
                'type' => $documentType,
                'original_name' => $originalName,
                'filename' => $finalName,
                'file_path' => $relativeFilePath,
                'uploaded_at' => date('Y-m-d H:i:s'),
                'ai_status' => 'pending',
                'upload_count' => $newUploadCount,
                'attempt_limit' => $UPLOAD_LIMIT,
                'resubmit_attempt' => $inResubmitPhase,
                'attempts_remaining' => $inResubmitPhase
                    ? max(0, $UPLOAD_LIMIT - $newUploadCount)
                    : null,
            ],
        ]);
        exit;
    } catch (Throwable $e) {
        if (is_file($absolutePath)) {
            @unlink($absolutePath);
        }
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to save document record']);
        exit;
    }
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
