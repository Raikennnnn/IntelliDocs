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

$apiPos = strpos($requestPath, '/api/');
$route = '';
if ($apiPos !== false) {
    $route = trim(substr($requestPath, $apiPos + 5), '/');
} elseif (preg_match('#/api$#', $requestPath)) {
    $route = '';
}

if ($route === 'document-file' || $route === 'document-file/') {
    require_once __DIR__ . '/../config/database.php';
    require_once __DIR__ . '/../api/document_file.php';
    exit;
}

header('Content-Type: application/json');

require_once __DIR__ . '/../config/database.php';

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
    case 'student/enrollment':
    case 'student/enrollment/':
        require_once __DIR__ . '/../api/student_enrollment.php';
        break;
    case 'registrar/applications':
    case 'registrar/applications/':
        require_once __DIR__ . '/../api/registrar_applications.php';
        break;
    case 'registrar/overview':
    case 'registrar/overview/':
        require_once __DIR__ . '/../api/registrar_overview.php';
        break;
    case 'registrar/application':
    case 'registrar/application/':
        require_once __DIR__ . '/../api/registrar_application_detail.php';
        break;
    case 'admin/overview':
    case 'admin/overview/':
        require_once __DIR__ . '/../api/admin_overview.php';
        break;
    case 'admin/users':
    case 'admin/users/':
        require_once __DIR__ . '/../api/admin_users.php';
        break;
    case 'admin/reports':
    case 'admin/reports/':
        require_once __DIR__ . '/../api/admin_reports.php';
        break;
    case 'school-year':
    case 'school-year/':
        require_once __DIR__ . '/../api/school_year.php';
        break;
    default:
        http_response_code(404);
        echo json_encode(['error' => 'API not found']);
}
