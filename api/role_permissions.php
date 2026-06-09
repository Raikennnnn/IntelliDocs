<?php
declare(strict_types=1);

/**
 * GET /api/role-permissions
 *
 * Returns the effective permission map for the authenticated user's role.
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/permission_guard.php';

header('Content-Type: application/json');

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$actor = apiRequireActor($pdo, 'role-permissions');
$role = normalizePermissionRole((string)($actor['role'] ?? ''));

echo json_encode([
    'success' => true,
    'role' => $role,
    'permissions' => getPermissionsForRole($pdo, $role),
], JSON_UNESCAPED_UNICODE);
