<?php
// public/api_index.php - API entry point
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?? '';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (preg_match('#^http://(127\.0\.0\.1|localhost)(:\\d+)?$#', $origin)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-User-Id');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json');

require_once __DIR__ . '/../config/database.php';

$route = '';
$apiPos = strpos($requestPath, '/api/');
if ($apiPos !== false) {
    $route = trim(substr($requestPath, $apiPos + 5), '/');
} elseif (preg_match('#/api$#', $requestPath)) {
    $route = '';
}

switch ($route) {
    case '':
    case 'students':
        require_once __DIR__ . '/../api/students.php';
        break;
    case 'auth':
    case 'auth/':
        require_once __DIR__ . '/../api/auth.php';
        break;
    case 'documents':
    case 'documents/':
        require_once __DIR__ . '/../api/documents.php';
        break;
    case 'student/me':
    case 'student/me/':
        require_once __DIR__ . '/../api/student_me.php';
        break;
    default:
        http_response_code(404);
        echo json_encode(['error' => 'API not found']);
}
