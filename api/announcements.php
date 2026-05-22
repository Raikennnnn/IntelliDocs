<?php

declare(strict_types=1);



/**

 * Public announcements endpoint (landing page & portal).

 *

 * GET /api/announcements?scope=landing|portal

 */



if (!isset($pdo) || !($pdo instanceof PDO)) {

    http_response_code(500);

    header('Content-Type: application/json');

    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);

    exit;

}



require_once __DIR__ . '/logging.php';

require_once __DIR__ . '/announcements_common.php';



if ($_SERVER['REQUEST_METHOD'] !== 'GET') {

    http_response_code(405);

    echo json_encode(['success' => false, 'error' => 'Method not allowed']);

    exit;

}



try {

    ensureAnnouncementsSchema($pdo);



    $scope = strtolower(trim((string)($_GET['scope'] ?? 'landing')));

    $landingOnly = $scope === 'landing';



    $where = 'WHERE is_active = 1';

    if ($landingOnly) {

        $where .= ' AND show_on_landing = 1';

    }



    $rows = $pdo->query("

        SELECT id, title, body, image_path, badge, target, show_on_landing, event_date, created_at

        FROM announcements

        {$where}

        ORDER BY

            CASE WHEN event_date IS NULL THEN 1 ELSE 0 END,

            event_date DESC,

            created_at DESC,

            id DESC

        LIMIT 20

    ")->fetchAll() ?: [];



    $items = [];

    foreach ($rows as $r) {

        $items[] = mapAnnouncementRow($r, false);

    }



    echo json_encode(['success' => true, 'announcements' => $items]);

    appLogEvent($pdo, 'announcements_public', 'public', 'success', null, 'endpoint', 'announcements', ['count' => count($items), 'scope' => $scope]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode(['success' => false, 'error' => 'Failed to load announcements']);

    appLogEvent($pdo, 'announcements_public', 'public', 'failed', null, 'endpoint', 'announcements', ['reason' => 'server_error']);

}


