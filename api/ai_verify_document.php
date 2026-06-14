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
require_once __DIR__ . '/ai_persist.php';
require_once __DIR__ . '/enrollment_status_helpers.php';
require_once __DIR__ . '/ai_http.php';

header('Content-Type: application/json');

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

// Load file_path + enrollment context for expected-field cross-checks.
$stmt = $pdo->prepare('
    SELECT d.id,
           d.file_path,
           d.enrollment_id,
           d.type AS document_type,
           COALESCE(NULLIF(d.original_name, \'\'), NULLIF(d.filename, \'\'), CONCAT(\'document_\', d.id)) AS download_name,
           COALESCE(NULLIF(d.mime_type, \'\'), \'\') AS mime_type,
           e.enrollment_steps,
           e.grade_level,
           e.strand,
           u.id AS user_id,
           u.full_name,
           u.first_name,
           u.middle_name,
           u.last_name,
           u.extension_name
    FROM documents d
    LEFT JOIN enrollments e ON e.id = d.enrollment_id
    LEFT JOIN users u ON u.id = e.user_id
    WHERE d.id = :id
    LIMIT 1
');
$stmt->execute([':id' => $docId]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$row) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Document not found']);
    exit;
}

$formData = [];
$steps = json_decode((string)($row['enrollment_steps'] ?? '{}'), true);
if (is_array($steps) && is_array($steps['form_data'] ?? null)) {
    $formData = $steps['form_data'];
}
if ($docType === '' || $docType === 'other') {
    $docType = mapDocumentTypeForAi((string)($row['document_type'] ?? ''));
}

$userContext = [
    'full_name' => (string)($row['full_name'] ?? ''),
    'first_name' => (string)($row['first_name'] ?? ''),
    'middle_name' => (string)($row['middle_name'] ?? ''),
    'last_name' => (string)($row['last_name'] ?? ''),
    'extension_name' => (string)($row['extension_name'] ?? ''),
];
$enrollmentContext = [
    'grade_level' => (string)($row['grade_level'] ?? ''),
    'strand' => (string)($row['strand'] ?? ''),
];

$autoExpected = buildAiExpectedVerifyFieldsForDocument($formData, $docType, $userContext, $enrollmentContext);

// Always include PSA identity fields when present — content detection may resolve
// a birth certificate even if the upload slot label is SF10 / Form 137.
$identityExpected = buildAiExpectedVerifyFieldsForDocument(
    $formData,
    'birth_certificate',
    $userContext,
    $enrollmentContext
);
foreach (['expected_name', 'expected_sex', 'expected_dob', 'expected_birth_place'] as $identityKey) {
    $identityVal = trim((string)($identityExpected[$identityKey] ?? ''));
    if ($identityVal !== '') {
        $autoExpected[$identityKey] = $identityVal;
    }
}

$pickExpected = static function (string $getKey, string $autoKey) use ($autoExpected): string {
    $fromGet = trim((string)($_GET[$getKey] ?? ''));
    if ($fromGet !== '') {
        return $fromGet;
    }
    return trim((string)($autoExpected[$autoKey] ?? ''));
};

$expectedName = $pickExpected('expected_name', 'expected_name');
$expectedLrn = preg_replace('/\D+/', '', $pickExpected('expected_lrn', 'expected_lrn'));
$expectedSex = $pickExpected('expected_sex', 'expected_sex');
$expectedSchoolYear = $pickExpected('expected_school_year', 'expected_school_year');
$expectedPrevSchool = $pickExpected('expected_prev_school', 'expected_prev_school');
$expectedDob = $pickExpected('expected_dob', 'expected_dob');
$expectedBirthPlace = $pickExpected('expected_birth_place', 'expected_birth_place');
$expectedGradeLevel = $pickExpected('expected_grade_level', 'expected_grade_level');
$expectedStrand = $pickExpected('expected_strand', 'expected_strand');

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
];

// Optional: cross-check student-provided fields against OCR.
if ($expectedName !== '') $postFields['expected_name'] = $expectedName;
if ($expectedLrn !== '') $postFields['expected_lrn'] = $expectedLrn;
if ($expectedSex !== '') $postFields['expected_sex'] = $expectedSex;
if ($expectedSchoolYear !== '') $postFields['expected_school_year'] = $expectedSchoolYear;
if ($expectedPrevSchool !== '') $postFields['expected_prev_school'] = $expectedPrevSchool;
if ($expectedDob !== '') $postFields['expected_dob'] = $expectedDob;
if ($expectedBirthPlace !== '') $postFields['expected_birth_place'] = $expectedBirthPlace;
$skipGradeStrandForMoral = in_array(strtolower($docType), ['good_moral', 'goodmoral'], true);
if ($expectedGradeLevel !== '' && !$skipGradeStrandForMoral) {
    $postFields['expected_grade_level'] = $expectedGradeLevel;
}
if ($expectedStrand !== '' && !$skipGradeStrandForMoral) {
    $postFields['expected_strand'] = $expectedStrand;
}

// OCR + seal/signature scans can exceed 60s on a small droplet — align with nginx/PHP (300s).
@set_time_limit(320);
@ini_set('max_execution_time', '320');

$aiRes = aiPostMultipart('/verify', $fullPath, $downloadName, $mimeType, $postFields, 290);

if (!$aiRes['ok'] || !is_array($aiRes['body'])) {
    $decoded = is_array($aiRes['body']) ? $aiRes['body'] : null;
    $error = $aiRes['error'] ?? 'Failed to reach AI service';
    if ($decoded && isset($decoded['error']) && is_string($decoded['error']) && $decoded['error'] !== '') {
        $error = $decoded['error'];
    }
    if ($decoded && empty($decoded['error']) && isset($decoded['hint']) && is_string($decoded['hint'])) {
        $error = $decoded['hint'];
    }
    http_response_code(502);
    echo json_encode([
        'success' => false,
        'error' => $error,
        'detail' => $decoded ?? ($aiRes['base_url'] ?? null),
        'ai_base_url' => $aiRes['base_url'] ?? aiServiceBaseUrl(),
    ]);
    exit;
}

$decoded = $aiRes['body'];

try {
    persistDocumentAiResult($pdo, $docId, $decoded);
} catch (Throwable $e) {
    // Return AI result even if DB persist fails.
}

echo json_encode(['success' => true, 'result' => $decoded]);
exit;

