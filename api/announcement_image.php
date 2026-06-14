<?php
declare(strict_types=1);

/**
 * GET /api/announcement-image?id={announcementId}
 * Serves announcement banner images (public).
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Database unavailable';
    exit;
}

require_once __DIR__ . '/announcements_common.php';

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
    http_response_code(405);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Method not allowed';
    exit;
}

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Invalid id';
    exit;
}

try {
    ensureAnnouncementsSchema($pdo);
    $stmt = $pdo->prepare('SELECT image_path FROM announcements WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Not found';
        exit;
    }

    $relativePath = (string)($row['image_path'] ?? '');
    $resolved = announcementImageAbsolutePath($relativePath);

    if ($resolved === null || !is_file($resolved)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'File not found';
        exit;
    }

    $ext = strtolower(pathinfo($resolved, PATHINFO_EXTENSION));
    $mime = match ($ext) {
        'jpg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        default => 'application/octet-stream',
    };

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . (string)filesize($resolved));
    header('Cache-Control: public, max-age=86400');
    readfile($resolved);
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Failed to load image';
}
