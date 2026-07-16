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

require_once __DIR__ . '/ai_verify_runner.php';

header('Content-Type: application/json');

ensureDocumentAiPersistenceSchema($pdo);

require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/permission_guard.php';
$actor = apiRequireActor($pdo, 'ai/verify-document');
$actorId = $actor['id'];
$role = $actor['role'];
if (!in_array($role, ['registrar', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

requireActorPermission($pdo, $actor, 'viewAIResults');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$docId = (int)($_GET['id'] ?? 0);
$docType = strtolower(trim((string)($_GET['doc_type'] ?? '')));
if ($docType === 'sf10') {
    $docType = 'form137';
}
if ($docId <= 0) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid document id']);
    exit;
}

$rerunRaw = strtolower(trim((string)($_GET['rerun'] ?? $_GET['force'] ?? '')));
$forceRerun = in_array($rerunRaw, ['1', 'true', 'yes'], true);

$pickGet = static function (string $key): string {
    return trim((string)($_GET[$key] ?? ''));
};

$result = runDocumentAiVerification($pdo, $docId, [
    'force_rerun' => $forceRerun,
    'doc_type' => $docType,
    'expected' => [
        'expected_name' => $pickGet('expected_name'),
        'expected_lrn' => preg_replace('/\D+/', '', $pickGet('expected_lrn')) ?? '',
        'expected_sex' => $pickGet('expected_sex'),
        'expected_school_year' => $pickGet('expected_school_year'),
        'expected_prev_school' => $pickGet('expected_prev_school'),
        'expected_dob' => $pickGet('expected_dob'),
        'expected_birth_place' => $pickGet('expected_birth_place'),
        'expected_grade_level' => $pickGet('expected_grade_level'),
        'expected_strand' => $pickGet('expected_strand'),
    ],
]);

if (($result['ok'] ?? false) !== true) {
    $status = (int)($result['http_status'] ?? 502);
    if ($status < 400) {
        $status = 502;
    }
    http_response_code($status);
    echo json_encode([
        'success' => false,
        'error' => (string)($result['error'] ?? 'Document check could not be completed.'),
        'detail' => $result['detail'] ?? null,
        'ai_base_url' => $result['ai_base_url'] ?? null,
    ]);
    exit;
}

if (!empty($result['processing'])) {
    echo json_encode([
        'success' => true,
        'processing' => true,
        'cached' => !empty($result['cached']),
        'result' => $result['result'] ?? [
            'status' => 'verified',
            'confidence' => 0,
            '_processing' => true,
        ],
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'result' => $result['result'] ?? [],
    'cached' => !empty($result['cached']),
]);
exit;
