<?php
declare(strict_types=1);

/**
 * Server-side proxy for AI verification of a directly-uploaded image.
 *
 * Unlike ai_verify_document.php (which loads a stored document by id), this
 * endpoint accepts a multipart file upload straight from the browser and
 * forwards it to the local AI service. Going through PHP keeps the request
 * same-origin, which avoids browser CORS and HTTPS mixed-content failures that
 * happen when the frontend tries to reach http://127.0.0.1:5000 directly.
 *
 * POST /api/ai/verify-upload   (multipart/form-data)
 *   image     : file (required)
 *   doc_type  : string (optional, e.g. form137)
 *   expected_*: optional cross-check hints
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'No image uploaded']);
    exit;
}

$upload = $_FILES['image'];
if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Image upload failed (code ' . (int)($upload['error'] ?? -1) . ')']);
    exit;
}

$tmpPath = (string)($upload['tmp_name'] ?? '');
if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid upload']);
    exit;
}

// Reject oversized uploads (mirror the AI service's 16MB limit).
$maxBytes = 16 * 1024 * 1024;
if ((int)($upload['size'] ?? 0) > $maxBytes) {
    http_response_code(413);
    echo json_encode(['success' => false, 'error' => 'Image too large (max 16MB)']);
    exit;
}

if (!function_exists('curl_init')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'PHP cURL extension is required for AI verification']);
    exit;
}

$docType = strtolower(trim((string)($_POST['doc_type'] ?? 'other')));
$originalName = (string)($upload['name'] ?? 'upload');
$safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $originalName);
if ($safeName === '' || $safeName === null) {
    $safeName = 'upload';
}

// Determine MIME type from the uploaded file.
$mimeType = (string)($upload['type'] ?? '');
if ($mimeType === '' && function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo !== false) {
        $detected = finfo_file($finfo, $tmpPath);
        finfo_close($finfo);
        if (is_string($detected) && $detected !== '') {
            $mimeType = $detected;
        }
    }
}
if (strpos($mimeType, 'image/') !== 0) {
    http_response_code(415);
    echo json_encode(['success' => false, 'error' => 'Only image files are supported']);
    exit;
}

$aiBase = getenv('AI_BASE_URL');
if (!$aiBase) {
    $aiBase = 'http://127.0.0.1:5000';
}
$aiUrl = rtrim($aiBase, '/') . '/verify';

$postFields = [
    'doc_type' => $docType !== '' ? $docType : 'other',
    'image' => new CURLFile($tmpPath, $mimeType, $safeName),
];

foreach (['expected_name', 'expected_lrn', 'expected_sex', 'expected_school_year', 'expected_prev_school'] as $hint) {
    $val = trim((string)($_POST[$hint] ?? ''));
    if ($val !== '') {
        $postFields[$hint] = $val;
    }
}

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $aiUrl,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $postFields,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 3,
    CURLOPT_TIMEOUT => 45,
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
