<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../api/mailer.php';

$limit = 50;
$sentIds = processPendingEmailQueue($pdo, $limit);
echo 'Processed queue. Sent: ' . count($sentIds) . PHP_EOL;
