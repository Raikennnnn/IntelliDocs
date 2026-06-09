<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/env_loader.php';
require_once __DIR__ . '/../api/user_consents.php';

$host = getenv('DB_HOST') ?: '127.0.0.1';
$name = getenv('DB_NAME') ?: 'intellidocs_db';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') ?: '';

$pdo = new PDO(
    "mysql:host={$host};dbname={$name};charset=utf8mb4",
    $user,
    $pass,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

ensureUserRegistrationConsentsTable($pdo);
migrateLegacyConsentStorage($pdo);

$count = (int)$pdo->query('SELECT COUNT(*) FROM user_registration_consents')->fetchColumn();
echo "user_registration_consents rows: {$count}\n";
