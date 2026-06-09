<?php
declare(strict_types=1);

require __DIR__ . '/../config/database.php';
require __DIR__ . '/../api/enrollment_status_helpers.php';
require __DIR__ . '/../api/cohort_helpers.php';
require __DIR__ . '/../api/physical_docs_helpers.php';

if (!function_exists('tableExists')) {
    function tableExists(PDO $pdo, string $table): bool
    {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1');
        $stmt->execute([':t' => $table]);
        return (bool)$stmt->fetchColumn();
    }
}
if (!function_exists('columnExists')) {
    function columnExists(PDO $pdo, string $table, string $column): bool
    {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c LIMIT 1');
        $stmt->execute([':t' => $table, ':c' => $column]);
        return (bool)$stmt->fetchColumn();
    }
}

$enrollmentId = (int)($argv[1] ?? 0);
if ($enrollmentId <= 0) {
    fwrite(STDERR, "Usage: php auto_enroll_grade12_rollover_once.php <enrollment_id>\n");
    exit(1);
}

$stmt = $pdo->prepare('SELECT * FROM enrollments WHERE id = :id LIMIT 1');
$stmt->execute([':id' => $enrollmentId]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$row) {
    fwrite(STDERR, "Enrollment not found\n");
    exit(1);
}

$userId = (int)($row['user_id'] ?? 0);
autoEnrollReturningGrade12Rollover($pdo, $userId, $row);

$stmt->execute([':id' => $enrollmentId]);
echo json_encode($stmt->fetch(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT) . PHP_EOL;
