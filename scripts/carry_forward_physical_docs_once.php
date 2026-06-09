<?php
declare(strict_types=1);

require __DIR__ . '/../config/database.php';

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

require __DIR__ . '/../api/physical_docs_helpers.php';

$enrollmentId = (int)($argv[1] ?? 17);
carryForwardPhysicalDocsForEnrollment($pdo, $enrollmentId);

$status = $pdo->prepare('SELECT id, user_id, grade_level, school_year, status, physical_docs_completed_at FROM enrollments WHERE id = :id');
$status->execute([':id' => $enrollmentId]);
echo json_encode($status->fetch(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT) . PHP_EOL . PHP_EOL;

$stmt = $pdo->prepare(
    'SELECT enrollment_id, requirement_key, received, received_at
       FROM enrollment_physical_docs
      WHERE enrollment_id IN (
            SELECT id FROM enrollments WHERE user_id = (
                SELECT user_id FROM enrollments WHERE id = :id LIMIT 1
            )
      )
      ORDER BY enrollment_id, requirement_key'
);
$stmt->execute([':id' => $enrollmentId]);
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT) . PHP_EOL;
