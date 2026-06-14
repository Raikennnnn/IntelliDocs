<?php
declare(strict_types=1);

/**
 * Server-side proxy for the AI service health check.
 *
 * Lets the registrar UI show whether the OCR service is reachable and which
 * engine it loaded, without the browser having to reach the Python service
 * directly (which fails on the droplet / over HTTPS).
 *
 * GET /api/ai/health
 *
 * Auth: X-User-Id must be registrar or admin.
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'online' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/user_role.php';

header('Content-Type: application/json');

$actorId = (int)($_SERVER['HTTP_X_USER_ID'] ?? 0);
if ($actorId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'online' => false, 'error' => 'Missing user context']);
    exit;
}

$role = getUserRole($pdo, $actorId);
if (!in_array($role, ['registrar', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'online' => false, 'error' => 'Access denied']);
    exit;
}

if (!function_exists('curl_init')) {
    http_response_code(200);
    echo json_encode(['success' => false, 'online' => false, 'error' => 'PHP cURL extension is required']);
    exit;
}

$aiBase = getenv('AI_BASE_URL');
if (!$aiBase) {
    $aiBase = 'http://127.0.0.1:5000';
}
$aiUrl = rtrim($aiBase, '/') . '/health';

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $aiUrl,
    CURLOPT_HTTPGET => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 3,
    CURLOPT_TIMEOUT => 6,
]);

$body = curl_exec($ch);
$curlErr = curl_error($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Always return HTTP 200 so the UI can render an "offline" state instead of
// throwing; the real status lives in the JSON "online" flag.
if ($body === false || $status < 200 || $status >= 300) {
    echo json_encode([
        'success' => false,
        'online' => false,
        'error' => $curlErr !== '' ? $curlErr : ('AI service returned HTTP ' . $status),
    ]);
    exit;
}

$decoded = json_decode((string)$body, true);
if (!is_array($decoded)) {
    echo json_encode(['success' => false, 'online' => false, 'error' => 'AI service returned invalid JSON']);
    exit;
}

$ocrEngine = (string)($decoded['ocr_engine'] ?? 'none');
echo json_encode([
    'success' => true,
    'online' => true,
    'ocr_engine' => $ocrEngine,
    'ocr_ready' => $ocrEngine !== 'none',
    'hint' => $decoded['hint'] ?? null,
]);
exit;
