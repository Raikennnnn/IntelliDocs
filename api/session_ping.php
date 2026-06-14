<?php
declare(strict_types=1);

/**
 * Lightweight session/account check for dashboard keepalive.
 * Rejects revoked tokens, expired sessions, and deactivated accounts.
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/api_auth.php';
$actor = apiRequireActor($pdo, 'session/ping');

echo json_encode([
    'success' => true,
    'user_id' => $actor['id'],
    'role' => $actor['role'],
]);
