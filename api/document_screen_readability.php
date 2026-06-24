<?php
declare(strict_types=1);

/**
 * Deferred level-2 readability check after a fast quality-only upload.
 */
if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

header('Content-Type: application/json');

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/permission_guard.php';

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$actor = apiRequireActor($pdo, 'documents/screen-readability');
$userId = (int)$actor['id'];
$role = (string)($actor['role'] ?? '');
if ($role === 'student') {
    requireActorPermission($pdo, ['role' => 'student', 'id' => $userId], 'uploadDocuments', false);
}

$raw = file_get_contents('php://input');
$payload = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
if (!is_array($payload)) {
    $payload = $_POST;
}

$docId = (int)($payload['document_id'] ?? $payload['id'] ?? 0);
if ($docId <= 0) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid document id']);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT d.id, d.type, d.file_path, d.original_name, d.mime_type, d.ai_status, d.enrollment_id,
            e.user_id AS enrollment_user_id
     FROM documents d
     LEFT JOIN enrollments e ON e.id = d.enrollment_id
     WHERE d.id = :id
     LIMIT 1'
);
$stmt->execute([':id' => $docId]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$row) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Document not found']);
    exit;
}

$ownerId = (int)($row['enrollment_user_id'] ?? 0);
if ($role === 'student' && $ownerId !== $userId) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

$aiStatus = strtolower(trim((string)($row['ai_status'] ?? '')));
if ($aiStatus !== 'screening') {
    echo json_encode([
        'success' => true,
        'already_checked' => true,
        'ai_status' => $aiStatus !== '' ? $aiStatus : 'pending',
        'pass' => $aiStatus !== 'readability_failed',
    ]);
    exit;
}

$relative = trim(str_replace('\\', '/', (string)($row['file_path'] ?? '')));
if ($relative === '' || strpos($relative, '..') !== false) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Document file not found']);
    exit;
}

$projectRoot = dirname(__DIR__);
$absolutePath = $projectRoot . DIRECTORY_SEPARATOR . str_replace(['\\', '/'], DIRECTORY_SEPARATOR, $relative);
if (!is_file($absolutePath)) {
    $del = $pdo->prepare('DELETE FROM documents WHERE id = :id');
    $del->execute([':id' => $docId]);
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Document file missing. Please upload again.']);
    exit;
}

require_once __DIR__ . '/ai_http.php';
$documentType = trim((string)($row['type'] ?? ''));
$docTypeKey = mapDocumentTypeForAi($documentType);
$originalName = trim((string)($row['original_name'] ?? basename($absolutePath)));
$mimeType = trim((string)($row['mime_type'] ?? ''));
if ($mimeType === '') {
    $mimeType = 'image/jpeg';
}

$screen = aiScreenUploadReadability($absolutePath, $originalName, $mimeType, $docTypeKey);
if (!$screen['ok']) {
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'error' => $screen['message'],
        'retryable' => true,
        'level' => 2,
    ]);
    exit;
}

if (!$screen['pass']) {
    @unlink($absolutePath);
    $del = $pdo->prepare('DELETE FROM documents WHERE id = :id');
    $del->execute([':id' => $docId]);
    appLogEvent($pdo, 'document_readability', 'student', 'failed', $userId, 'document', (string)$docId, [
        'document_type' => $documentType,
        'level' => 2,
    ]);
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'error' => $screen['message'],
        'level' => 2,
        'readability_failed' => true,
    ]);
    exit;
}

$upd = $pdo->prepare('UPDATE documents SET ai_status = :status WHERE id = :id');
$upd->execute([':status' => 'pending', ':id' => $docId]);

appLogEvent($pdo, 'document_readability', 'student', 'success', $userId, 'document', (string)$docId, [
    'document_type' => $documentType,
]);

echo json_encode([
    'success' => true,
    'pass' => true,
    'ai_status' => 'pending',
    'document_id' => $docId,
]);
