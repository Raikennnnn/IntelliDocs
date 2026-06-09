<?php
declare(strict_types=1);

/**
 * Stream a stored document for registrar/admin preview/download.
 * Auth: X-User-Id must be registrar or admin (same as registrar application API).
 */
if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';

function columnExistsDoc(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1');
    $stmt->execute([':table' => $table, ':column' => $column]);
    return (bool)$stmt->fetchColumn();
}

require_once __DIR__ . '/api_auth.php';
$actor = apiRequireActor($pdo, 'document-file');
$actorId = $actor['id'];
$role = $actor['role'];
if (!in_array($role, ['registrar', 'admin'], true)) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

$docId = (int)($_GET['id'] ?? 0);
$disposition = strtolower(trim((string)($_GET['disposition'] ?? 'inline')));
if ($docId <= 0) {
    http_response_code(422);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Invalid document id']);
    exit;
}

$hasPath = columnExistsDoc($pdo, 'documents', 'file_path');
$hasMime = columnExistsDoc($pdo, 'documents', 'mime_type');
$hasOrig = columnExistsDoc($pdo, 'documents', 'original_name');

$cols = 'd.id';
$cols .= $hasPath ? ', d.file_path' : ', NULL AS file_path';
$cols .= $hasMime ? ', d.mime_type' : ', NULL AS mime_type';
$cols .= $hasOrig ? ', d.original_name' : ', NULL AS original_name';

$sql = "SELECT {$cols} FROM documents d WHERE d.id = :id LIMIT 1";
$q = $pdo->prepare($sql);
$q->execute([':id' => $docId]);
$row = $q->fetch(PDO::FETCH_ASSOC);
if (!$row) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Document not found']);
    exit;
}

$relative = trim(str_replace('\\', '/', (string)($row['file_path'] ?? '')));
if ($relative === '') {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'File path not recorded for this document']);
    exit;
}

if (strpos($relative, '..') !== false) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Invalid path']);
    exit;
}

$projectRoot = realpath(dirname(__DIR__));
if ($projectRoot === false) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Server path error']);
    exit;
}

$fullPath = realpath($projectRoot . '/' . $relative);
$allowedBase = realpath($projectRoot . '/uploads/documents');
$normFull = $fullPath !== false ? strtolower(str_replace('\\', '/', $fullPath)) : '';
$normAllowed = $allowedBase !== false ? strtolower(str_replace('\\', '/', $allowedBase)) : '';
$underUploads = $normFull !== '' && $normAllowed !== '' && strpos($normFull, rtrim($normAllowed, '/') . '/') === 0;
// Fallback if uploads/documents exists but realpath failed (some Windows/XAMPP setups)
if (!$underUploads && $normFull !== '') {
    $prefix = strtolower(str_replace('\\', '/', $projectRoot . '/uploads/documents/'));
    $underUploads = strpos($normFull, $prefix) === 0;
}
if ($fullPath === false || !$underUploads || !is_file($fullPath)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'File not found on server']);
    exit;
}

$mime = trim((string)($row['mime_type'] ?? ''));
if ($mime === '') {
    $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
    $mime = match ($ext) {
        'pdf' => 'application/pdf',
        'png' => 'image/png',
        'jpg', 'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        default => 'application/octet-stream',
    };
}

$downloadName = trim((string)($row['original_name'] ?? ''));
if ($downloadName === '') {
    $downloadName = 'document_' . $docId;
}

$disp = $disposition === 'attachment' ? 'attachment' : 'inline';
$safeName = preg_replace('/[^\x20-\x7E]/', '_', $downloadName);

appLogEvent($pdo, 'document_file_view', $role, 'success', $actorId, 'document', (string)$docId, ['disposition' => $disp]);

header('Content-Type: ' . $mime);
header('Content-Length: ' . (string)filesize($fullPath));
header('Content-Disposition: ' . $disp . '; filename="' . addslashes($safeName) . '"');
header('Cache-Control: private, max-age=0, must-revalidate');
readfile($fullPath);
exit;
