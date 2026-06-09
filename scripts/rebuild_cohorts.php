<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/env_loader.php';
require_once __DIR__ . '/../api/cohort_helpers.php';

$host = getenv('DB_HOST') ?: '127.0.0.1';
$port = getenv('DB_PORT') ?: '3306';
$name = getenv('DB_NAME') ?: 'intellidocs_db';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') ?: '';

$pdo = new PDO(
    "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
    $user,
    $pass,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$n = rebuildAllStudentCohorts($pdo);
echo json_encode(['rebuilt' => $n, 'counts' => cohortCounts($pdo)], JSON_PRETTY_PRINT) . PHP_EOL;
