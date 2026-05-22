<?php

declare(strict_types=1);



/**

 * Registrar/Admin announcements CRUD.

 *

 * GET  /api/registrar/announcements

 * POST /api/registrar/announcements { action: create|update|delete, ... }

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



$actorId = (int)($_SERVER['HTTP_X_USER_ID'] ?? 0);

if ($actorId <= 0) {

    http_response_code(401);

    echo json_encode(['success' => false, 'error' => 'Missing user context']);

    exit;

}

$role = getUserRole($pdo, $actorId);

if (!in_array($role, ['registrar', 'admin'], true)) {

    http_response_code(403);

    echo json_encode(['success' => false, 'error' => 'Access denied']);

    exit;

}



ensureAnnouncementsSchema($pdo);



$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));



if ($method === 'GET') {

    try {

        $rows = $pdo->query("

            SELECT id, title, body, image_path, badge, target, show_on_landing, event_date, is_active, created_at, updated_at

            FROM announcements

            ORDER BY

                CASE WHEN event_date IS NULL THEN 1 ELSE 0 END,

                event_date DESC,

                created_at DESC,

                id DESC

            LIMIT 200

        ")->fetchAll() ?: [];



        $items = [];

        foreach ($rows as $r) {

            $items[] = mapAnnouncementRow($r, true);

        }



        echo json_encode(['success' => true, 'announcements' => $items]);

        appLogEvent($pdo, 'registrar_announcements_list', $role, 'success', $actorId, 'endpoint', 'registrar/announcements', ['count' => count($items)]);

    } catch (Throwable $e) {

        http_response_code(500);

        echo json_encode(['success' => false, 'error' => 'Failed to load announcements']);

        appLogEvent($pdo, 'registrar_announcements_list', $role, 'failed', $actorId, 'endpoint', 'registrar/announcements', ['reason' => 'server_error']);

    }

    exit;

}



if ($method === 'POST') {

    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);

    if (!is_array($payload)) {

        http_response_code(400);

        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);

        exit;

    }

    $action = strtolower(trim((string)($payload['action'] ?? '')));



    try {

        if ($action === 'create') {

            $title = trim((string)($payload['title'] ?? ''));

            $body = trim((string)($payload['body'] ?? ''));

            $badge = trim((string)($payload['badge'] ?? 'Announcement')) ?: 'Announcement';

            $target = trim((string)($payload['target'] ?? 'Whole School')) ?: 'Whole School';

            $showOnLanding = (int)($payload['showOnLanding'] ?? 1) ? 1 : 0;

            $eventDate = trim((string)($payload['eventDate'] ?? ''));

            $isActive = (int)($payload['isActive'] ?? 1) ? 1 : 0;

            if ($title === '' || $body === '') {

                http_response_code(422);

                echo json_encode(['success' => false, 'error' => 'Title and body are required']);

                exit;

            }



            $stmt = $pdo->prepare("

                INSERT INTO announcements (title, body, badge, target, show_on_landing, event_date, is_active, created_by, updated_at)

                VALUES (:title, :body, :badge, :target, :show_on_landing, :event_date, :is_active, :created_by, NOW())

            ");

            $stmt->execute([

                ':title' => $title,

                ':body' => $body,

                ':badge' => $badge,

                ':target' => $target,

                ':show_on_landing' => $showOnLanding,

                ':event_date' => $eventDate !== '' ? $eventDate : null,

                ':is_active' => $isActive,

                ':created_by' => $actorId,

            ]);

            $id = (string)$pdo->lastInsertId();

            echo json_encode(['success' => true, 'id' => $id]);

            appLogEvent($pdo, 'registrar_announcement_create', $role, 'success', $actorId, 'announcement', $id);

            exit;

        }



        if ($action === 'update') {

            $id = (int)($payload['id'] ?? 0);

            if ($id <= 0) {

                http_response_code(422);

                echo json_encode(['success' => false, 'error' => 'Invalid id']);

                exit;

            }

            $title = trim((string)($payload['title'] ?? ''));

            $body = trim((string)($payload['body'] ?? ''));

            $badge = trim((string)($payload['badge'] ?? 'Announcement')) ?: 'Announcement';

            $target = trim((string)($payload['target'] ?? 'Whole School')) ?: 'Whole School';

            $showOnLanding = (int)($payload['showOnLanding'] ?? 1) ? 1 : 0;

            $eventDate = trim((string)($payload['eventDate'] ?? ''));

            $isActive = (int)($payload['isActive'] ?? 1) ? 1 : 0;

            if ($title === '' || $body === '') {

                http_response_code(422);

                echo json_encode(['success' => false, 'error' => 'Title and body are required']);

                exit;

            }



            $stmt = $pdo->prepare("

                UPDATE announcements

                SET title = :title,

                    body = :body,

                    badge = :badge,

                    target = :target,

                    show_on_landing = :show_on_landing,

                    event_date = :event_date,

                    is_active = :is_active,

                    updated_at = NOW()

                WHERE id = :id

                LIMIT 1

            ");

            $stmt->execute([

                ':title' => $title,

                ':body' => $body,

                ':badge' => $badge,

                ':target' => $target,

                ':show_on_landing' => $showOnLanding,

                ':event_date' => $eventDate !== '' ? $eventDate : null,

                ':is_active' => $isActive,

                ':id' => $id,

            ]);



            echo json_encode(['success' => true]);

            appLogEvent($pdo, 'registrar_announcement_update', $role, 'success', $actorId, 'announcement', (string)$id);

            exit;

        }



        if ($action === 'delete') {

            $id = (int)($payload['id'] ?? 0);

            if ($id <= 0) {

                http_response_code(422);

                echo json_encode(['success' => false, 'error' => 'Invalid id']);

                exit;

            }



            $stmt = $pdo->prepare('SELECT image_path FROM announcements WHERE id = :id LIMIT 1');

            $stmt->execute([':id' => $id]);

            $row = $stmt->fetch(PDO::FETCH_ASSOC);



            $del = $pdo->prepare('DELETE FROM announcements WHERE id = :id LIMIT 1');

            $del->execute([':id' => $id]);



            if ($row) {

                deleteAnnouncementImageFile((string)($row['image_path'] ?? ''));

            }



            echo json_encode(['success' => true]);

            appLogEvent($pdo, 'registrar_announcement_delete', $role, 'success', $actorId, 'announcement', (string)$id);

            exit;

        }



        if ($action === 'remove_image') {

            $id = (int)($payload['id'] ?? 0);

            if ($id <= 0) {

                http_response_code(422);

                echo json_encode(['success' => false, 'error' => 'Invalid id']);

                exit;

            }

            $stmt = $pdo->prepare('SELECT image_path FROM announcements WHERE id = :id LIMIT 1');

            $stmt->execute([':id' => $id]);

            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$row) {

                http_response_code(404);

                echo json_encode(['success' => false, 'error' => 'Announcement not found']);

                exit;

            }

            $pdo->prepare('UPDATE announcements SET image_path = NULL, updated_at = NOW() WHERE id = :id LIMIT 1')

                ->execute([':id' => $id]);

            deleteAnnouncementImageFile((string)($row['image_path'] ?? ''));

            echo json_encode(['success' => true]);

            appLogEvent($pdo, 'registrar_announcement_remove_image', $role, 'success', $actorId, 'announcement', (string)$id);

            exit;

        }



        http_response_code(400);

        echo json_encode(['success' => false, 'error' => 'Unsupported action']);

        exit;

    } catch (Throwable $e) {

        http_response_code(500);

        echo json_encode(['success' => false, 'error' => 'Failed to update announcements']);

        appLogEvent($pdo, 'registrar_announcements_write', $role, 'failed', $actorId, 'endpoint', 'registrar/announcements', ['reason' => 'server_error']);

        exit;

    }

}



http_response_code(405);

echo json_encode(['success' => false, 'error' => 'Method not allowed']);


