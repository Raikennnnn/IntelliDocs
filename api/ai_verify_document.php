<?php
declare(strict_types=1);

/**
 * Server-side proxy for AI verification.
 * Avoids browser CORS/mixed-content issues by calling the local AI service from PHP.
 *
 * GET /api/ai/verify-document?id=123&doc_type=form137
 *
 * Auth: X-User-Id must be registrar or admin.
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/user_role.php';

header('Content-Type: application/json');

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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$docId = (int)($_GET['id'] ?? 0);
$docType = strtolower(trim((string)($_GET['doc_type'] ?? 'other')));
$expectedName = trim((string)($_GET['expected_name'] ?? ''));
$expectedLrn = preg_replace('/\D+/', '', (string)($_GET['expected_lrn'] ?? ''));
$expectedSex = trim((string)($_GET['expected_sex'] ?? ''));
$expectedSchoolYear = trim((string)($_GET['expected_school_year'] ?? ''));
$expectedPrevSchool = trim((string)($_GET['expected_prev_school'] ?? ''));
if ($docId <= 0) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid document id']);
    exit;
}

// Load file_path + original_name (+ mime if available)
$stmt = $pdo->prepare('
    SELECT id,
           file_path,
           COALESCE(NULLIF(original_name, \'\'), NULLIF(filename, \'\'), CONCAT(\'document_\', id)) AS download_name,
           COALESCE(NULLIF(mime_type, \'\'), \'\') AS mime_type
    FROM documents
    WHERE id = :id
    LIMIT 1
');
$stmt->execute([':id' => $docId]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$row) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Document not found']);
    exit;
}

$relative = trim(str_replace('\\', '/', (string)($row['file_path'] ?? '')));
if ($relative === '' || strpos($relative, '..') !== false) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'File path not recorded for this document']);
    exit;
}

$projectRoot = realpath(dirname(__DIR__));
if ($projectRoot === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server path error']);
    exit;
}

$fullPath = realpath($projectRoot . '/' . $relative);
$allowedBase = realpath($projectRoot . '/uploads/documents');
$normFull = $fullPath !== false ? strtolower(str_replace('\\', '/', $fullPath)) : '';
$normAllowed = $allowedBase !== false ? strtolower(str_replace('\\', '/', $allowedBase)) : '';
$underUploads = $normFull !== '' && $normAllowed !== '' && strpos($normFull, rtrim($normAllowed, '/') . '/') === 0;
if (!$underUploads && $normFull !== '') {
    $prefix = strtolower(str_replace('\\', '/', $projectRoot . '/uploads/documents/'));
    $underUploads = strpos($normFull, $prefix) === 0;
}

if ($fullPath === false || !$underUploads || !is_file($fullPath)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'File not found on server']);
    exit;
}

if (!function_exists('curl_init')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'PHP cURL extension is required for AI verification']);
    exit;
}

$aiBase = getenv('AI_BASE_URL');
if (!$aiBase) {
    $aiBase = 'http://127.0.0.1:5000';
}
$aiUrl = rtrim($aiBase, '/') . '/verify';

$downloadName = (string)($row['download_name'] ?? ('document_' . $docId));
$mimeType = trim((string)($row['mime_type'] ?? ''));
if ($mimeType === '') {
    $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
    $mimeType = match ($ext) {
        'png' => 'image/png',
        'jpg', 'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        default => 'application/octet-stream',
    };
}

$postFields = [
    'doc_type' => $docType !== '' ? $docType : 'other',
    'image' => new CURLFile($fullPath, $mimeType, $downloadName),
];

// Optional: cross-check student-provided fields against OCR.
// These are hints (best-effort) and should not block verification by themselves.
if ($expectedName !== '') $postFields['expected_name'] = $expectedName;
if ($expectedLrn !== '') $postFields['expected_lrn'] = $expectedLrn;
if ($expectedSex !== '') $postFields['expected_sex'] = $expectedSex;
if ($expectedSchoolYear !== '') $postFields['expected_school_year'] = $expectedSchoolYear;
if ($expectedPrevSchool !== '') $postFields['expected_prev_school'] = $expectedPrevSchool;

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $aiUrl,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $postFields,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 3,
    CURLOPT_TIMEOUT => 30,
]);

$body = curl_exec($ch);
$curlErr = curl_error($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($body === false) {
    http_response_code(502);
    echo json_encode(['success' => false, 'error' => 'Failed to reach AI service', 'detail' => $curlErr]);
    exit;
}

$decoded = json_decode((string)$body, true);
if (!is_array($decoded)) {
    http_response_code(502);
    echo json_encode(['success' => false, 'error' => 'AI service returned invalid JSON', 'detail' => (string)$body]);
    exit;
}

if ($status < 200 || $status >= 300) {
    http_response_code(502);
    echo json_encode([
        'success' => false,
        'error' => $decoded['error'] ?? ('AI verify failed (' . $status . ')'),
        'detail' => $decoded,
    ]);
    exit;
}

echo json_encode(['success' => true, 'result' => $decoded]);
exit;

