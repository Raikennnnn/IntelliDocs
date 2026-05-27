<?php
declare(strict_types=1);

/**
 * Toggle the registrar's manual "reviewed" flag on a document.
 * Independent of AI verification status.
 *
 * POST /api/registrar/document-review
 *   body: { document_id: int, reviewed: bool }
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

/**
 * Lazy migration: add the registrar review columns if missing.
 * Mirrors the ensureEnrollmentSchema() / ensureCredentialsSchema() pattern used elsewhere.
 */
function ensureDocumentReviewSchema(PDO $pdo): void
{
    if (!tableExists($pdo, 'documents')) {
        return;
    }
    $required = [
        'registrar_reviewed' => 'TINYINT(1) NOT NULL DEFAULT 0',
        'reviewed_at'        => 'TIMESTAMP NULL',
        'reviewed_by'        => 'INT NULL',
    ];
    foreach ($required as $col => $ddl) {
        if (!columnExists($pdo, 'documents', $col)) {
            try {
                $pdo->exec("ALTER TABLE documents ADD COLUMN {$col} {$ddl}");
            } catch (Throwable $e) {
                // If ALTER privileges are denied, surface a clear error to the caller below.
            }
        }
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

ensureDocumentReviewSchema($pdo);

$missing = [];
foreach (['registrar_reviewed', 'reviewed_at', 'reviewed_by'] as $col) {
    if (!columnExists($pdo, 'documents', $col)) {
        $missing[] = "documents.$col";
    }
}
if (!empty($missing)) {
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'error' => 'schema_not_migrated',
        'details' => ['missing' => $missing],
    ]);
    exit;
}

$payload = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
    exit;
}

$documentId = (int)($payload['document_id'] ?? 0);
$reviewed = !empty($payload['reviewed']);
if ($documentId <= 0) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid document id']);
    exit;
}

try {
    $exists = $pdo->prepare('SELECT id FROM documents WHERE id = :id LIMIT 1');
    $exists->execute([':id' => $documentId]);
    if (!$exists->fetchColumn()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Document not found']);
        exit;
    }

    if ($reviewed) {
        $upd = $pdo->prepare('
            UPDATE documents
               SET registrar_reviewed = 1,
                   reviewed_at = CURRENT_TIMESTAMP,
                   reviewed_by = :actor
             WHERE id = :id
        ');
        $upd->execute([':actor' => $actorId, ':id' => $documentId]);
    } else {
        $upd = $pdo->prepare('
            UPDATE documents
               SET registrar_reviewed = 0,
                   reviewed_at = NULL,
                   reviewed_by = NULL
             WHERE id = :id
        ');
        $upd->execute([':id' => $documentId]);
    }

    $row = $pdo->prepare('SELECT registrar_reviewed, reviewed_at, reviewed_by FROM documents WHERE id = :id LIMIT 1');
    $row->execute([':id' => $documentId]);
    $r = $row->fetch(PDO::FETCH_ASSOC) ?: [];

    appLogEvent(
        $pdo,
        'document_review',
        'registrar',
        'success',
        $actorId,
        'document',
        (string)$documentId,
        ['reviewed' => $reviewed]
    );

    echo json_encode([
        'success' => true,
        'document_id' => $documentId,
        'reviewed' => (bool)((int)($r['registrar_reviewed'] ?? 0) === 1),
        'reviewed_at' => $r['reviewed_at'] ?? null,
        'reviewed_by' => isset($r['reviewed_by']) ? (int)$r['reviewed_by'] : null,
    ]);
} catch (Throwable $e) {
    appLogEvent(
        $pdo,
        'document_review',
        'registrar',
        'failed',
        $actorId,
        'document',
        (string)$documentId,
        ['reason' => 'server_error', 'message' => $e->getMessage()]
    );
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to update document review status']);
}
