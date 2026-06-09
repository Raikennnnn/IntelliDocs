<?php
declare(strict_types=1);

/**
 * POST /api/registrar/announcements/image
 * multipart: id, image (file)
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/announcements_common.php';

header('Content-Type: application/json');

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/api_auth.php';
$actor = apiRequireActor($pdo, 'registrar/announcement-image');
$actorId = $actor['id'];
$role = $actor['role'];
if (!in_array($role, ['registrar', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

$id = (int)($_POST['id'] ?? 0);
if ($id <= 0) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid announcement id']);
    exit;
}

if (!isset($_FILES['image'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No image uploaded']);
    exit;
}

try {
    ensureAnnouncementsSchema($pdo);

    $stmt = $pdo->prepare('SELECT image_path FROM announcements WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$existing) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Announcement not found']);
        exit;
    }

    $stored = storeAnnouncementImage($_FILES['image']);
    if (isset($stored['error'])) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => (string)$stored['error']]);
        exit;
    }

    $oldPath = (string)($existing['image_path'] ?? '');
    $newPath = (string)$stored['path'];

    $upd = $pdo->prepare('UPDATE announcements SET image_path = :path, updated_at = NOW() WHERE id = :id LIMIT 1');
    $upd->execute([':path' => $newPath, ':id' => $id]);

    deleteAnnouncementImageFile($oldPath !== '' ? $oldPath : null);

    echo json_encode([
        'success' => true,
        'imageUrl' => announcementImageUrl((string)$id, $newPath),
    ]);
    appLogEvent($pdo, 'registrar_announcement_image', $role, 'success', $actorId, 'announcement', (string)$id);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to upload image']);
    appLogEvent($pdo, 'registrar_announcement_image', $role, 'failed', $actorId, 'announcement', (string)$id, ['reason' => 'server_error']);
}
