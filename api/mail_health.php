<?php
declare(strict_types=1);

/**
 * Mail readiness probe.
 *
 *   GET  /api/mail-health
 *        Returns the configured provider, sender, and any deployment
 *        issues (revoked Brevo key, unverified sender, missing cURL,
 *        etc.) without sending real mail. Safe to hit before going live.
 *
 *   POST /api/mail-health
 *        body: { recipient: "you@example.com" }
 *        Sends a one-off "NSDGA mail health check" message to the
 *        supplied recipient. Admin-only. Use this to confirm a real
 *        round-trip after the GET probe is green.
 *
 * Auth:
 *   - GET is open (no PII returned, useful for unauthenticated smoke
 *     tests during deployment). Issues array deliberately avoids leaking
 *     the API key.
 *   - POST requires X-User-Id resolving to an admin so it cannot be used
 *     as a free email-sending oracle.
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/system_settings_helpers.php';

header('Content-Type: application/json');

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET') {
    applySystemMailEnvOverrides($pdo);
    $report = checkMailerReadiness();
    echo json_encode([
        'success' => $report['ready'],
        'report'  => $report,
    ]);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Admin-only beyond this point.
require_once __DIR__ . '/api_auth.php';
$actor = apiRequireActor($pdo, 'mail-health');
$actorId = $actor['id'];
$role = $actor['role'];
if ($role !== 'admin') {
    appLogEvent($pdo, 'mail_health_probe', 'admin', 'failed', $actorId, 'endpoint', 'mail-health', ['reason' => 'forbidden']);
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Admin access required']);
    exit;
}

$payload = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
    exit;
}

applySystemMailEnvOverrides($pdo);

$recipient = strtolower(trim((string)($payload['recipient'] ?? '')));
if ($recipient === '' || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'recipient must be a valid email']);
    exit;
}

$subject = 'NSDGA mail health check';
$body = "This is a delivery test from the NSDGA enrollment portal.\n\n"
    . "If you can read this, the configured mail provider is working.\n"
    . "Issued by admin user id: " . $actorId . "\n"
    . "Server time: " . date('c') . "\n";

$queueId = queueEmail($pdo, $recipient, $subject, $body);
$sent = processSingleQueuedEmail($pdo, (int)$queueId);

// Pull the row back so the admin can see the exact error if delivery failed.
$lastError = null;
try {
    $stmt = $pdo->prepare('SELECT last_error FROM email_queue WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => (int)$queueId]);
    $lastError = (string)($stmt->fetchColumn() ?: '');
} catch (Throwable $e) {
    $lastError = null;
}

appLogEvent(
    $pdo,
    'mail_health_probe',
    'admin',
    $sent ? 'success' : 'failed',
    $actorId,
    'email',
    (string)$queueId,
    [
        'recipient' => $recipient,
        'delivery'  => $sent ? 'sent' : 'failed',
        'last_error' => $sent ? null : $lastError,
    ]
);

http_response_code($sent ? 200 : 502);
echo json_encode([
    'success'   => $sent,
    'queue_id'  => (int)$queueId,
    'delivery'  => $sent ? 'sent' : 'failed',
    'last_error' => $sent ? null : $lastError,
]);
