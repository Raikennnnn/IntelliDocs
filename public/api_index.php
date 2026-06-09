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
header('Access-Control-Allow-Headers: Content-Type, X-User-Id, Authorization');

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

if ($route === 'announcement-image' || $route === 'announcement-image/') {
    require_once __DIR__ . '/../config/database.php';
    require_once __DIR__ . '/../api/announcement_image.php';
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
    case 'role-permissions':
    case 'role-permissions/':
        require_once __DIR__ . '/../api/role_permissions.php';
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
    case 'student/physical-docs':
    case 'student/physical-docs/':
        require_once __DIR__ . '/../api/student_physical_docs.php';
        break;
    case 'student/notifications':
    case 'student/notifications/':
        require_once __DIR__ . '/../api/student_notifications.php';
        break;
    case 'registrar/applications':
    case 'registrar/applications/':
        require_once __DIR__ . '/../api/registrar_applications.php';
        break;
    case 'registrar/students':
    case 'registrar/students/':
        require_once __DIR__ . '/../api/registrar_students.php';
        break;
    case 'registrar/cohorts':
    case 'registrar/cohorts/':
        require_once __DIR__ . '/../api/registrar_cohorts.php';
        break;
    case 'registrar/physical-docs':
    case 'registrar/physical-docs/':
        require_once __DIR__ . '/../api/registrar_physical_docs.php';
        break;
    case 'registrar/overview':
    case 'registrar/overview/':
        require_once __DIR__ . '/../api/registrar_overview.php';
        break;
    case 'registrar/reports':
    case 'registrar/reports/':
        require_once __DIR__ . '/../api/registrar_reports.php';
        break;
    case 'registrar/application':
    case 'registrar/application/':
        require_once __DIR__ . '/../api/registrar_application_detail.php';
        break;
    case 'registrar/document-review':
    case 'registrar/document-review/':
        require_once __DIR__ . '/../api/registrar_document_review.php';
        break;
    case 'registrar/document-decision':
    case 'registrar/document-decision/':
        require_once __DIR__ . '/../api/registrar_document_decision.php';
        break;
    case 'registrar/sections':
    case 'registrar/sections/':
        require_once __DIR__ . '/../api/registrar_sections.php';
        break;
    case 'registrar/student-section':
    case 'registrar/student-section/':
        require_once __DIR__ . '/../api/registrar_student_section.php';
        break;
    case 'ai/verify-document':
    case 'ai/verify-document/':
        require_once __DIR__ . '/../api/ai_verify_document.php';
        break;
    case 'announcements':
    case 'announcements/':
        require_once __DIR__ . '/../api/announcements.php';
        break;
    case 'registrar/announcements':
    case 'registrar/announcements/':
        require_once __DIR__ . '/../api/registrar_announcements.php';
        break;
    case 'registrar/announcements/image':
    case 'registrar/announcements/image/':
        require_once __DIR__ . '/../api/registrar_announcement_image.php';
        break;
    case 'admin/overview':
    case 'admin/overview/':
        require_once __DIR__ . '/../api/admin_overview.php';
        break;
    case 'admin/users':
    case 'admin/users/':
        require_once __DIR__ . '/../api/admin_users.php';
        break;
    case 'admin/students':
    case 'admin/students/':
        require_once __DIR__ . '/../api/admin_students.php';
        break;
    case 'admin/reports':
    case 'admin/reports/':
        require_once __DIR__ . '/../api/admin_reports.php';
        break;
    case 'admin/settings':
    case 'admin/settings/':
        require_once __DIR__ . '/../api/admin_settings.php';
        break;
    case 'admin/security-logs':
    case 'admin/security-logs/':
        require_once __DIR__ . '/../api/admin_security_logs.php';
        break;
    case 'admin/activity-logs':
    case 'admin/activity-logs/':
    case 'registrar/activity-logs':
    case 'registrar/activity-logs/':
        require_once __DIR__ . '/../api/activity_logs.php';
        break;
    case 'school-year':
    case 'school-year/':
        require_once __DIR__ . '/../api/school_year.php';
        break;
    case 'mail-health':
    case 'mail-health/':
        require_once __DIR__ . '/../api/mail_health.php';
        break;
    default:
        http_response_code(404);
        echo json_encode(['error' => 'API not found']);
}
