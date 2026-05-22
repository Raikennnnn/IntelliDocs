<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}
require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';

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
    if ($s === 'approved') return 'Approved';
    if ($s === 'rejected') return 'Rejected';
    if (in_array($s, ['under_review', 'under review', 'review'], true)) return 'Under Review';
    if ($s === 'draft') return 'Draft';
    return 'Pending';
}

function requireRegistrarOrAdmin(PDO $pdo): int
{
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
    return $actorId;
}

function parseEnrollmentIdFromAppId(string $appId): int
{
    if (preg_match('/(\d+)\s*$/', $appId, $m)) {
        return (int)$m[1];
    }
    return 0;
}

$actorId = requireRegistrarOrAdmin($pdo);
$hasRegistrarRemarks = columnExists($pdo, 'enrollments', 'registrar_remarks');
$hasUpdatedAt = columnExists($pdo, 'enrollments', 'updated_at');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
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
        if (tableExists($pdo, 'documents')) {
            $hasType = columnExists($pdo, 'documents', 'type');
            $hasOriginalName = columnExists($pdo, 'documents', 'original_name');
            $hasAiStatus = columnExists($pdo, 'documents', 'ai_status');
            $hasUploadedAt = columnExists($pdo, 'documents', 'uploaded_at');
            $hasMime = columnExists($pdo, 'documents', 'mime_type');

            $selectType = $hasType ? 'type' : 'NULL AS type';
            $selectOriginalName = $hasOriginalName ? 'original_name' : 'NULL AS original_name';
            $selectAiStatus = $hasAiStatus ? 'ai_status' : '\'pending\' AS ai_status';
            $selectUploadedAt = $hasUploadedAt ? 'uploaded_at' : 'NULL AS uploaded_at';
            $selectMime = $hasMime ? 'mime_type' : 'NULL AS mime_type';

            if (columnExists($pdo, 'documents', 'enrollment_id')) {
                $d = $pdo->prepare("SELECT id, {$selectType}, {$selectOriginalName}, {$selectAiStatus}, {$selectUploadedAt}, {$selectMime} FROM documents WHERE enrollment_id = :eid ORDER BY id DESC");
                $d->execute([':eid' => $enrollmentId]);
                $docs = $d->fetchAll() ?: [];
            } elseif (tableExists($pdo, 'students') && columnExists($pdo, 'documents', 'student_id')) {
                $d = $pdo->prepare('
                    SELECT d.id, ' . $selectType . ', ' . $selectOriginalName . ', ' . $selectAiStatus . ', ' . $selectUploadedAt . ', ' . $selectMime . '
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

            foreach ($docs as $doc) {
                $st = strtolower((string)($doc['ai_status'] ?? 'pending'));
                $ui = $st === 'verified' ? 'Verified' : ($st === 'rejected' || $st === 'tampered' ? 'Flagged' : 'Under Review');
                $typeLabel = trim((string)($doc['type'] ?? ''));
                if ($typeLabel === '') {
                    $typeLabel = 'Document';
                }
                $originalName = trim((string)($doc['original_name'] ?? ''));
                $fileDisplay = $originalName !== '' ? $originalName : $typeLabel;
                $mimeRaw = trim((string)($doc['mime_type'] ?? ''));
                $documents[] = [
                    'id' => (int)$doc['id'],
                    'requirementLabel' => $typeLabel,
                    'fileName' => $fileDisplay,
                    'name' => $fileDisplay,
                    'mimeType' => $mimeRaw,
                    'status' => $ui,
                    'aiConfidence' => $ui === 'Verified' ? 95 : ($ui === 'Flagged' ? 60 : 80),
                    'uploadedDate' => (string)($doc['uploaded_at'] ?? ''),
                    'issues' => $ui === 'Flagged' ? ['Requires manual verification'] : [],
                ];
            }
        }

        // Form JSON can contain keys that collide with server fields (e.g. "documents").
        // Merge with form first, then overlay server fields so DB-backed documents and IDs always win.
        $serverFields = [
            'id' => 'APP-' . date('Y') . '-' . str_pad((string)$enrollmentId, 3, '0', STR_PAD_LEFT),
            'enrollmentId' => $enrollmentId,
            'status' => toUiStatus((string)($row['status'] ?? 'pending')),
            'studentName' => (string)($row['full_name'] ?? ''),
            'submittedDate' => (string)($row['applied_at'] ?? ''),
            'email' => (string)($row['email'] ?? ''),
            'gradeLevel' => (string)($row['grade_level'] ?? ''),
            'strand' => (string)($row['strand'] ?? ''),
            'registrarRemarks' => $hasRegistrarRemarks ? (string)($row['registrar_remarks'] ?? '') : '',
            'documents' => $documents,
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
            if (!$hasRegistrarRemarks) {
                $pdo->exec('ALTER TABLE enrollments ADD COLUMN registrar_remarks TEXT NULL');
                $hasRegistrarRemarks = true;
            }
            $status = $action === 'approve' ? 'approved' : 'rejected';
            $sql = $hasUpdatedAt
                ? 'UPDATE enrollments SET status = :status, registrar_remarks = :remarks, updated_at = NOW() WHERE id = :id'
                : 'UPDATE enrollments SET status = :status, registrar_remarks = :remarks WHERE id = :id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':status' => $status, ':remarks' => $remarks, ':id' => $enrollmentId]);
            appLogEvent($pdo, 'registrar_decision', 'registrar', 'success', $actorId, 'enrollment', (string)$enrollmentId, ['decision' => $status]);
            echo json_encode(['success' => true, 'message' => $action === 'approve' ? 'Application approved' : 'Application rejected']);
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
