<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/system_settings_helpers.php';
require_once __DIR__ . '/mailer.php';

header('Content-Type: application/json');

require_once __DIR__ . '/api_auth.php';
$actor = apiRequireActor($pdo, 'admin/settings');
$actorId = $actor['id'];
if ($actor['role'] !== 'admin') {
    appLogEvent($pdo, 'admin_settings', 'admin', 'failed', $actorId > 0 ? $actorId : null, 'endpoint', 'admin/settings', ['reason' => 'access_denied']);
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

require_once __DIR__ . '/permission_guard.php';

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

try {
    if ($method === 'GET') {
        requireActorAnyPermission($pdo, $actor, ['configureSystem', 'manageRoles'], false);
        applySystemMailEnvOverrides($pdo);
        $mailReport = checkMailerReadiness();

        echo json_encode([
            'success' => true,
            'email' => getSystemEmailConfig($pdo),
            'permissions' => getRolePermissions($pdo),
            'mailHealth' => [
                'ready' => (bool)($mailReport['ready'] ?? false),
                'provider' => (string)($mailReport['provider'] ?? ''),
                'from' => (string)($mailReport['from'] ?? ''),
                'issues' => array_values(array_map('strval', $mailReport['issues'] ?? [])),
            ],
        ]);
        appLogEvent($pdo, 'admin_settings', 'admin', 'success', $actorId, 'endpoint', 'admin/settings', ['action' => 'read']);
        exit;
    }

    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        exit;
    }

    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $action = strtolower(trim((string)($payload['action'] ?? 'save')));

    if ($action === 'test_email') {
        requireActorPermission($pdo, $actor, 'configureSystem', false);
        applySystemMailEnvOverrides($pdo);
        $recipient = trim((string)($payload['recipient'] ?? ''));
        if ($recipient === '' || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            $userStmt = $pdo->prepare('SELECT email FROM users WHERE id = :id LIMIT 1');
            $userStmt->execute([':id' => $actorId]);
            $recipient = trim((string)($userStmt->fetchColumn() ?: ''));
        }
        if ($recipient === '' || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'A valid recipient email is required']);
            exit;
        }

        $readiness = checkMailerReadiness();
        if (!($readiness['ready'] ?? false)) {
            http_response_code(422);
            echo json_encode([
                'success' => false,
                'error' => 'Mail transport is not ready',
                'issues' => $readiness['issues'] ?? [],
            ]);
            exit;
        }

        $body = "NSDGA test email\n\n"
            . "If you received this message, the configured mail transport is working.\n"
            . 'Sent at ' . date('Y-m-d H:i:s') . ".\n";
        $queueId = queueEmail(
            $pdo,
            $recipient,
            'NSDGA — Test Email',
            $body
        );
        $sent = processSingleQueuedEmail($pdo, $queueId);
        $mailError = $sent ? null : getEmailQueueLastError($pdo, $queueId);

        appLogEvent($pdo, 'admin_settings', 'admin', $sent ? 'success' : 'failed', $actorId, 'email', $recipient, [
            'action' => 'test_email',
        ]);

        if (!$sent) {
            http_response_code(502);
            echo json_encode([
                'success' => false,
                'error' => $mailError ?: 'Failed to send test email',
            ]);
            exit;
        }

        echo json_encode([
            'success' => true,
            'message' => "Test email sent to {$recipient}",
            'recipient' => $recipient,
        ]);
        exit;
    }

    $section = strtolower(trim((string)($payload['section'] ?? 'all')));

    if ($section === 'email' || $section === 'all') {
        requireActorPermission($pdo, $actor, 'configureSystem', false);
        saveSystemEmailConfig($pdo, $payload);
        applySystemMailEnvOverrides($pdo);
    }

    if ($section === 'permissions' || $section === 'all') {
        requireActorPermission($pdo, $actor, 'manageRoles', false);
        $perms = $payload['permissions'] ?? null;
        if (is_array($perms)) {
            saveRolePermissions($pdo, $perms);
        }
    }

    appLogEvent($pdo, 'admin_settings', 'admin', 'success', $actorId, 'endpoint', 'admin/settings', [
        'action' => 'save',
        'section' => $section,
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Settings saved',
        'email' => getSystemEmailConfig($pdo),
        'permissions' => getRolePermissions($pdo),
    ]);
} catch (Throwable $e) {
    appLogEvent($pdo, 'admin_settings', 'admin', 'failed', $actorId, 'endpoint', 'admin/settings', ['reason' => 'server_error']);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to process settings request']);
}
