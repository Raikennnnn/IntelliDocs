<?php
declare(strict_types=1);

/**
 * Registrar per-document decision (reject => require resubmission).
 *
 * POST /api/registrar/document-decision
 *   body: { document_id: int, action: "reject" | "clear", remarks?: string }
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
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table LIMIT 1');
        $stmt->execute([':table' => $table]);
        return (bool)$stmt->fetchColumn();
    }
}
if (!function_exists('columnExists')) {
    function columnExists(PDO $pdo, string $table, string $column): bool
    {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1');
        $stmt->execute([':table' => $table, ':column' => $column]);
        return (bool)$stmt->fetchColumn();
    }
}

function ensureDocumentDecisionSchema(PDO $pdo): void
{
    if (!tableExists($pdo, 'documents')) return;
    $required = [
        'registrar_doc_decision' => 'VARCHAR(20) NULL',
        'registrar_doc_remarks' => 'TEXT NULL',
        'doc_decided_at' => 'TIMESTAMP NULL',
        'doc_decided_by' => 'INT NULL',
        // keep consistent with /registrar/document-review endpoint
        'registrar_reviewed' => 'TINYINT(1) NOT NULL DEFAULT 0',
        'reviewed_at'        => 'TIMESTAMP NULL',
        'reviewed_by'        => 'INT NULL',
    ];
    foreach ($required as $col => $ddl) {
        if (!columnExists($pdo, 'documents', $col)) {
            try {
                $pdo->exec("ALTER TABLE documents ADD COLUMN {$col} {$ddl}");
            } catch (Throwable $e) {
                // handled below via missing check
            }
        }
    }
}

require_once __DIR__ . '/api_auth.php';
$actor = apiRequireActor($pdo, 'registrar/document-decision');
$actorId = $actor['id'];
$role = $actor['role'];
if (!in_array($role, ['registrar', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

require_once __DIR__ . '/permission_guard.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

ensureDocumentDecisionSchema($pdo);
$missing = [];
foreach ([
    'registrar_doc_decision',
    'registrar_doc_remarks',
    'doc_decided_at',
    'doc_decided_by',
    'registrar_reviewed',
    'reviewed_at',
    'reviewed_by',
    'ai_status',
] as $col) {
    if (!columnExists($pdo, 'documents', $col)) $missing[] = "documents.$col";
}
if (!empty($missing)) {
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'schema_not_migrated', 'details' => ['missing' => $missing]]);
    exit;
}

$payload = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
    exit;
}

$documentId = (int)($payload['document_id'] ?? 0);
$action = strtolower(trim((string)($payload['action'] ?? '')));
$remarks = trim((string)($payload['remarks'] ?? ''));

if ($documentId <= 0) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid document id']);
    exit;
}
if (!in_array($action, ['reject', 'clear'], true)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid action']);
    exit;
}
if ($action === 'reject' && $remarks === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'remarks_required']);
    exit;
}

requireActorPermission($pdo, $actor, $action === 'reject' ? 'rejectApplications' : 'viewApplications');

try {
    // Pull the document + the student it belongs to so we can email them
    // after the rejection. We need the requirement type, the current upload
    // count (when the column exists), the enrollment owner, and the
    // owner's email address.
    $hasUploadCountCol = columnExists($pdo, 'documents', 'upload_count');
    $selectUpload = $hasUploadCountCol ? 'd.upload_count' : '0 AS upload_count';
    $infoStmt = $pdo->prepare(
        'SELECT d.id, d.type, d.enrollment_id, ' . $selectUpload . ',
                u.id AS user_id, u.full_name, u.email
           FROM documents d
      LEFT JOIN enrollments e ON e.id = d.enrollment_id
      LEFT JOIN users u ON u.id = e.user_id
          WHERE d.id = :id
          LIMIT 1'
    );
    $infoStmt->execute([':id' => $documentId]);
    $docInfo = $infoStmt->fetch(PDO::FETCH_ASSOC);
    if (!$docInfo) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Document not found']);
        exit;
    }

    if ($action === 'reject') {
        $upd = $pdo->prepare('
            UPDATE documents
               SET registrar_doc_decision = "rejected",
                   registrar_doc_remarks = :remarks,
                   doc_decided_at = CURRENT_TIMESTAMP,
                   doc_decided_by = :actor,
                   ai_status = "rejected",
                   registrar_reviewed = 0,
                   reviewed_at = NULL,
                   reviewed_by = NULL
             WHERE id = :id
        ');
        $upd->execute([':remarks' => $remarks, ':actor' => $actorId, ':id' => $documentId]);

        // Notify the student so they know to log in and re-upload. The
        // email includes the registrar's remarks (so they know what to fix)
        // and how many upload attempts remain. Email failures are
        // intentionally non-fatal: the rejection itself stays committed.
        require_once __DIR__ . '/document_resubmission_email.php';
        $UPLOAD_LIMIT = 5;
        $studentEmail = trim((string)($docInfo['email'] ?? ''));
        $studentName = trim((string)($docInfo['full_name'] ?? ''));
        $requirementLabel = inPersonRequirementLabel((string)($docInfo['type'] ?? ''));
        $attemptsUsed = max(0, (int)($docInfo['upload_count'] ?? 0));
        $emailSent = false;
        if ($studentEmail !== '') {
            $emailSent = sendDocumentResubmissionEmail($pdo, $studentEmail, [
                'student_name'  => $studentName,
                'requirement'   => $requirementLabel,
                'remarks'       => $remarks,
                'attempts_used' => $attemptsUsed,
                'attempt_limit' => $UPLOAD_LIMIT,
            ]);
        }

        appLogEvent(
            $pdo,
            'document_decision',
            'registrar',
            'success',
            $actorId,
            'document',
            (string)$documentId,
            [
                'action'         => 'reject',
                'document_type'  => (string)($docInfo['type'] ?? ''),
                'remarks'        => $remarks,
                'attempts_used'  => $attemptsUsed,
                'attempt_limit'  => $UPLOAD_LIMIT,
                'email_sent'     => $emailSent,
                'email_attempted' => $studentEmail !== '',
            ]
        );
        echo json_encode([
            'success'      => true,
            'document_id'  => $documentId,
            'decision'     => 'rejected',
            'remarks'      => $remarks,
            'email_sent'   => $emailSent,
        ]);
        exit;
    }

    // clear decision (student re-uploaded; registrar can remove the resubmission requirement)
    $upd = $pdo->prepare('
        UPDATE documents
           SET registrar_doc_decision = NULL,
               registrar_doc_remarks = NULL,
               doc_decided_at = NULL,
               doc_decided_by = NULL,
               ai_status = "pending"
         WHERE id = :id
    ');
    $upd->execute([':id' => $documentId]);
    appLogEvent($pdo, 'document_decision', 'registrar', 'success', $actorId, 'document', (string)$documentId, ['action' => 'clear']);
    echo json_encode(['success' => true, 'document_id' => $documentId, 'decision' => null, 'remarks' => '']);
} catch (Throwable $e) {
    appLogEvent($pdo, 'document_decision', 'registrar', 'failed', $actorId, 'document', (string)$documentId, ['reason' => 'server_error', 'message' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to update document decision']);
}

