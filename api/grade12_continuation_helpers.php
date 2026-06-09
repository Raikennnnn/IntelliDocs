<?php
declare(strict_types=1);

/**
 * Grade 12 continuation decisions (student declined re-enrollment for open SY).
 */

require_once __DIR__ . '/school_year_helpers.php';
require_once __DIR__ . '/enrollment_status_helpers.php';

function grade12DeclineTableExists(PDO $pdo): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute([':t' => 'student_grade12_declines']);

    return (bool)$stmt->fetchColumn();
}

function grade12DeclineMigrateSchema(PDO $pdo): void
{
    if (grade12DeclineTableExists($pdo)) {
        return;
    }

    $pdo->exec(
        "CREATE TABLE student_grade12_declines (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            from_school_year VARCHAR(20) NOT NULL DEFAULT '',
            target_school_year VARCHAR(20) NOT NULL,
            declined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_grade12_decline_user_target (user_id, target_school_year),
            INDEX idx_grade12_decline_target (target_school_year),
            CONSTRAINT fk_grade12_decline_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function studentDeclinedGrade12ForTargetSy(PDO $pdo, int $userId, string $targetSchoolYear): bool
{
    grade12DeclineMigrateSchema($pdo);
    if ($userId <= 0 || trim($targetSchoolYear) === '' || !grade12DeclineTableExists($pdo)) {
        return false;
    }

    $stmt = $pdo->prepare(
        'SELECT 1 FROM student_grade12_declines
          WHERE user_id = :uid AND TRIM(target_school_year) = :sy LIMIT 1'
    );
    $stmt->execute([':uid' => $userId, ':sy' => trim($targetSchoolYear)]);

    return (bool)$stmt->fetchColumn();
}

/**
 * @param list<int> $userIds
 * @return array<int, true> user_id => true
 */
function grade12DeclinedUserIdSet(PDO $pdo, array $userIds, string $targetSchoolYear): array
{
    grade12DeclineMigrateSchema($pdo);
    $ids = array_values(array_unique(array_filter(array_map('intval', $userIds), static fn (int $id): bool => $id > 0)));
    if ($ids === [] || trim($targetSchoolYear) === '' || !grade12DeclineTableExists($pdo)) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare(
        "SELECT user_id FROM student_grade12_declines
          WHERE TRIM(target_school_year) = ?
            AND user_id IN ({$placeholders})"
    );
    $params = [trim($targetSchoolYear)];
    foreach ($ids as $id) {
        $params[] = $id;
    }
    $stmt->execute($params);

    $set = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $uid = (int)($row['user_id'] ?? 0);
        if ($uid > 0) {
            $set[$uid] = true;
        }
    }

    return $set;
}

function recordStudentGrade12Decline(PDO $pdo, int $userId, string $fromSchoolYear, string $targetSchoolYear): void
{
    grade12DeclineMigrateSchema($pdo);
    if ($userId <= 0 || trim($targetSchoolYear) === '' || !grade12DeclineTableExists($pdo)) {
        return;
    }

    $upsert = $pdo->prepare(
        'INSERT INTO student_grade12_declines (user_id, from_school_year, target_school_year)
         VALUES (:uid, :from_sy, :target_sy)
         ON DUPLICATE KEY UPDATE
            from_school_year = VALUES(from_school_year),
            declined_at = CURRENT_TIMESTAMP'
    );
    $upsert->execute([
        ':uid' => $userId,
        ':from_sy' => trim($fromSchoolYear),
        ':target_sy' => trim($targetSchoolYear),
    ]);
}

function clearStudentGrade12Decline(PDO $pdo, int $userId, string $targetSchoolYear): void
{
    grade12DeclineMigrateSchema($pdo);
    if ($userId <= 0 || trim($targetSchoolYear) === '' || !grade12DeclineTableExists($pdo)) {
        return;
    }

    $pdo->prepare(
        'DELETE FROM student_grade12_declines
          WHERE user_id = :uid AND TRIM(target_school_year) = :sy'
    )->execute([':uid' => $userId, ':sy' => trim($targetSchoolYear)]);
}

/** Latest enrolled Grade 11 row from a school year other than the open enrollment SY. */
function priorEnrolledGrade11Row(PDO $pdo, int $userId, ?string $enrollmentSchoolYear): ?array
{
    if ($userId <= 0 || !enrollmentTableExists($pdo, 'enrollments') || $enrollmentSchoolYear === null) {
        return null;
    }

    $stmt = $pdo->prepare(
        "SELECT id, school_year, grade_level, status
           FROM enrollments
          WHERE user_id = :uid
            AND LOWER(TRIM(COALESCE(status, ''))) IN ('approved', 'enrolled')
            AND TRIM(COALESCE(school_year, '')) <> ''
            AND TRIM(school_year) <> :sy
          ORDER BY id DESC"
    );
    $stmt->execute([':uid' => $userId, ':sy' => trim($enrollmentSchoolYear)]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $grade = normaliseGradeLevel((string)($row['grade_level'] ?? ''));
        if ($grade === '11') {
            return $row;
        }
    }

    return null;
}
