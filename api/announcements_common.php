<?php
declare(strict_types=1);

/**
 * Shared helpers for announcements (schema, images).
 */

function ensureAnnouncementsSchema(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS announcements (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            body TEXT NOT NULL,
            image_path VARCHAR(255) NULL,
            badge VARCHAR(40) NOT NULL DEFAULT 'Announcement',
            target VARCHAR(40) NOT NULL DEFAULT 'Whole School',
            show_on_landing TINYINT(1) NOT NULL DEFAULT 1,
            event_date DATE NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT NULL,
            INDEX idx_announce_active (is_active),
            INDEX idx_announce_landing (show_on_landing),
            INDEX idx_announce_event_date (event_date),
            INDEX idx_announce_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $stmt = $pdo->query("
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'announcements'
          AND COLUMN_NAME = 'image_path'
        LIMIT 1
    ");
    if (!$stmt || !$stmt->fetchColumn()) {
        $pdo->exec('ALTER TABLE announcements ADD COLUMN image_path VARCHAR(255) NULL AFTER body');
    }
}

/** Web path prefix for static files under public/ (XAMPP subfolder). */
function announcementPublicBasePath(): string
{
    return '/IntelliDocs/public';
}

function announcementImageUrl(?string $id, ?string $imagePath): ?string
{
    unset($id);
    if ($imagePath === null || trim($imagePath) === '') {
        return null;
    }
    $relative = announcementNormalizeImageRelativePath($imagePath);
    if ($relative === null) {
        return null;
    }
    return announcementPublicBasePath() . '/' . $relative;
}

function announcementNormalizeImageRelativePath(string $imagePath): ?string
{
    $path = str_replace('\\', '/', trim($imagePath));
    if ($path === '' || strpos($path, '..') !== false) {
        return null;
    }
    if (preg_match('#(^|/)uploads/announcements/([^/]+)$#', $path, $m)) {
        return 'uploads/announcements/' . $m[2];
    }
    return null;
}

function announcementUploadsDir(): string
{
    return dirname(__DIR__) . '/public/uploads/announcements';
}

function announcementImageAbsolutePath(string $relativePath): ?string
{
    $relative = announcementNormalizeImageRelativePath($relativePath);
    if ($relative === null) {
        return null;
    }
    $publicFile = dirname(__DIR__) . '/public/' . $relative;
    if (is_file($publicFile)) {
        return $publicFile;
    }
    $legacyFile = dirname(__DIR__) . '/' . $relative;
    if (is_file($legacyFile)) {
        return $legacyFile;
    }
    return null;
}

function deleteAnnouncementImageFile(?string $relativePath): void
{
    if ($relativePath === null || trim($relativePath) === '') {
        return;
    }
    $absolute = announcementImageAbsolutePath($relativePath);
    if ($absolute !== null && is_file($absolute)) {
        @unlink($absolute);
    }
}

/**
 * @return array{path: string}|array{error: string}
 */
function storeAnnouncementImage(array $file): array
{
    if (!is_array($file) || (int)($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return ['error' => 'Invalid file upload'];
    }

    $size = (int)($file['size'] ?? 0);
    if ($size <= 0 || $size > 5 * 1024 * 1024) {
        return ['error' => 'Image must be between 1 byte and 5MB'];
    }

    $originalName = (string)($file['name'] ?? 'image.jpg');
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'webp'];
    if (!in_array($ext, $allowed, true)) {
        return ['error' => 'Only JPG, PNG, and WEBP images are allowed'];
    }

    $dir = announcementUploadsDir();
    if (!is_dir($dir) && !mkdir($dir, 0777, true) && !is_dir($dir)) {
        return ['error' => 'Failed to create upload directory'];
    }

    $safeBase = preg_replace('/[^A-Za-z0-9._-]/', '_', pathinfo($originalName, PATHINFO_FILENAME)) ?: 'announcement';
    $finalName = date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '_' . $safeBase . '.' . $ext;
    $absolutePath = $dir . '/' . $finalName;
    $tmpPath = (string)($file['tmp_name'] ?? '');

    if (!move_uploaded_file($tmpPath, $absolutePath)) {
        return ['error' => 'Failed to store uploaded image'];
    }

    return ['path' => 'uploads/announcements/' . $finalName];
}

function mapAnnouncementRow(array $r, bool $includeAdminFields = false): array
{
    $date = (string)($r['event_date'] ?? '');
    if ($date === '') {
        $date = substr((string)($r['created_at'] ?? ''), 0, 10);
    }
    $id = (string)($r['id'] ?? '');
    $imagePath = (string)($r['image_path'] ?? '');

    $item = [
        'id' => $id,
        'title' => (string)($r['title'] ?? ''),
        'body' => (string)($r['body'] ?? ''),
        'badge' => (string)($r['badge'] ?? 'Announcement'),
        'target' => (string)($r['target'] ?? 'Whole School'),
        'date' => $date,
        'showOnLanding' => (bool)($r['show_on_landing'] ?? 1),
        'imageUrl' => announcementImageUrl($id, $imagePath),
    ];

    if ($includeAdminFields) {
        $item['eventDate'] = (string)($r['event_date'] ?? '');
        $item['isActive'] = (bool)($r['is_active'] ?? 1);
        $item['createdAt'] = (string)($r['created_at'] ?? '');
        $item['updatedAt'] = (string)($r['updated_at'] ?? '');
        $item['imagePath'] = $imagePath !== '' ? $imagePath : null;
    }

    return $item;
}
