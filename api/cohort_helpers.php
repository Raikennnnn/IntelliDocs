<?php
declare(strict_types=1);

/**
 * Student cohort registry: applicants | enrolled_grade_11 | enrolled_grade_12.
 */

require_once __DIR__ . '/section_grade_helpers.php';
require_once __DIR__ . '/enrollment_status_helpers.php';

const COHORT_TYPES = ['applicant', 'enrolled_grade_11', 'enrolled_grade_12'];

function cohortTableExists(PDO $pdo): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute([':t' => 'student_cohorts']);

    return (bool)$stmt->fetchColumn();
}

function cohortDropLegacyViews(PDO $pdo): void
{
    foreach (
        ['v_student_applicants', 'v_student_enrolled_grade_11', 'v_student_enrolled_grade_12'] as $legacyView
    ) {
        try {
            $pdo->exec("DROP VIEW IF EXISTS {$legacyView}");
        } catch (Throwable $e) {
            // Ignore hosts that disallow DROP VIEW.
        }
    }
}

function cohortMigrateSchema(PDO $pdo): void
{
    cohortDropLegacyViews($pdo);

    if (cohortTableExists($pdo)) {
        return;
    }

    $pdo->exec(
        "CREATE TABLE student_cohorts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            enrollment_id INT NOT NULL,
            cohort_type ENUM('applicant', 'enrolled_grade_11', 'enrolled_grade_12') NOT NULL,
            school_year VARCHAR(20) NOT NULL DEFAULT '',
            grade_level VARCHAR(10) NOT NULL DEFAULT '',
            strand VARCHAR(50) NULL,
            enrollment_status VARCHAR(40) NOT NULL DEFAULT '',
            display_name VARCHAR(200) NULL,
            email VARCHAR(120) NULL,
            school_username VARCHAR(80) NULL,
            synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_student_cohorts_enrollment (enrollment_id),
            INDEX idx_student_cohorts_type_sy (cohort_type, school_year),
            INDEX idx_student_cohorts_user (user_id),
            CONSTRAINT fk_student_cohorts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_student_cohorts_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

/** @return 'applicant'|'enrolled_grade_11'|'enrolled_grade_12'|null */
function classifyEnrollmentCohort(string $status, string $gradeLevel): ?string
{
    $st = strtolower(trim($status));
    if ($st === '') {
        $st = 'draft';
    }

    if (in_array($st, ['pending', 'under_review', 'under review', 'review', 'draft', 'rejected'], true)) {
        return 'applicant';
    }

    if (in_array($st, ['approved', 'enrolled'], true)) {
        $grade = normaliseGradeLevel($gradeLevel);

        return $grade === '12' ? 'enrolled_grade_12' : 'enrolled_grade_11';
    }

    return null;
}

function cohortDisplayNameFromEnrollment(PDO $pdo, array $enrollmentRow, array $userRow): string
{
    $form = enrollmentStepsFormData((string)($enrollmentRow['enrollment_steps'] ?? ''));
    $userNameRow = [
        'first_name' => (string)($userRow['first_name'] ?? ''),
        'middle_name' => (string)($userRow['middle_name'] ?? ''),
        'last_name' => (string)($userRow['last_name'] ?? ''),
        'extension_name' => (string)($userRow['extension_name'] ?? ''),
        'full_name' => (string)($userRow['full_name'] ?? ''),
    ];
    $name = studentEnrollmentFormDisplayName($form, $userNameRow);

    return $name !== '' ? $name : (string)($userRow['full_name'] ?? 'Unknown');
}

function syncStudentCohortForEnrollment(PDO $pdo, int $enrollmentId): void
{
    if ($enrollmentId <= 0 || !cohortTableExists($pdo)) {
        return;
    }
    if (!enrollmentTableExists($pdo, 'enrollments')) {
        return;
    }

    $hasFirst = enrollmentColumnExists($pdo, 'users', 'first_name');
    $hasMiddle = enrollmentColumnExists($pdo, 'users', 'middle_name');
    $hasLast = enrollmentColumnExists($pdo, 'users', 'last_name');
    $hasExt = enrollmentColumnExists($pdo, 'users', 'extension_name');
    $hasSchoolUsername = enrollmentColumnExists($pdo, 'users', 'school_username');

    $selFirst = $hasFirst ? 'u.first_name' : "'' AS first_name";
    $selMiddle = $hasMiddle ? 'u.middle_name' : "'' AS middle_name";
    $selLast = $hasLast ? 'u.last_name' : "'' AS last_name";
    $selExt = $hasExt ? 'u.extension_name' : "'' AS extension_name";
    $selUsername = $hasSchoolUsername ? 'u.school_username' : 'NULL AS school_username';

    $stmt = $pdo->prepare(
        "SELECT e.id, e.user_id, e.status, e.grade_level, e.strand, e.school_year, e.enrollment_steps,
                u.email, u.full_name, {$selFirst}, {$selMiddle}, {$selLast}, {$selExt}, {$selUsername}
           FROM enrollments e
          INNER JOIN users u ON u.id = e.user_id
          WHERE e.id = :id
          LIMIT 1"
    );
    $stmt->execute([':id' => $enrollmentId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || !is_array($row)) {
        $pdo->prepare('DELETE FROM student_cohorts WHERE enrollment_id = :id')->execute([':id' => $enrollmentId]);

        return;
    }

    $cohort = classifyEnrollmentCohort(
        (string)($row['status'] ?? ''),
        (string)($row['grade_level'] ?? '')
    );
    if ($cohort === null) {
        $pdo->prepare('DELETE FROM student_cohorts WHERE enrollment_id = :id')->execute([':id' => $enrollmentId]);

        return;
    }

    $grade = normaliseGradeLevel((string)($row['grade_level'] ?? ''));
    $displayName = cohortDisplayNameFromEnrollment($pdo, $row, $row);
    $schoolUsername = isset($row['school_username']) && $row['school_username'] !== null
        ? (string)$row['school_username']
        : null;

    $upsert = $pdo->prepare(
        'INSERT INTO student_cohorts
            (user_id, enrollment_id, cohort_type, school_year, grade_level, strand,
             enrollment_status, display_name, email, school_username)
         VALUES
            (:user_id, :enrollment_id, :cohort_type, :school_year, :grade_level, :strand,
             :enrollment_status, :display_name, :email, :school_username)
         ON DUPLICATE KEY UPDATE
            cohort_type = VALUES(cohort_type),
            school_year = VALUES(school_year),
            grade_level = VALUES(grade_level),
            strand = VALUES(strand),
            enrollment_status = VALUES(enrollment_status),
            display_name = VALUES(display_name),
            email = VALUES(email),
            school_username = VALUES(school_username),
            synced_at = CURRENT_TIMESTAMP'
    );
    $upsert->execute([
        ':user_id' => (int)$row['user_id'],
        ':enrollment_id' => $enrollmentId,
        ':cohort_type' => $cohort,
        ':school_year' => trim((string)($row['school_year'] ?? '')),
        ':grade_level' => $grade,
        ':strand' => trim((string)($row['strand'] ?? '')),
        ':enrollment_status' => strtolower(trim((string)($row['status'] ?? ''))),
        ':display_name' => $displayName,
        ':email' => (string)($row['email'] ?? ''),
        ':school_username' => $schoolUsername,
    ]);
}

function syncStudentCohortsForUser(PDO $pdo, int $userId): void
{
    if ($userId <= 0 || !cohortTableExists($pdo)) {
        return;
    }
    $stmt = $pdo->prepare('SELECT id FROM enrollments WHERE user_id = :uid');
    $stmt->execute([':uid' => $userId]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        syncStudentCohortForEnrollment($pdo, (int)($row['id'] ?? 0));
    }
}

function rebuildAllStudentCohorts(PDO $pdo): int
{
    cohortMigrateSchema($pdo);
    if (!cohortTableExists($pdo) || !enrollmentTableExists($pdo, 'enrollments')) {
        return 0;
    }

    $pdo->exec('DELETE FROM student_cohorts');
    $ids = $pdo->query('SELECT id FROM enrollments ORDER BY id ASC')->fetchAll(PDO::FETCH_COLUMN) ?: [];
    $count = 0;
    foreach ($ids as $id) {
        syncStudentCohortForEnrollment($pdo, (int)$id);
        $count++;
    }

    return $count;
}

/**
 * @return array{applicant: int, enrolled_grade_11: int, enrolled_grade_12: int}
 */
function cohortCounts(PDO $pdo, string $schoolYearFilter = ''): array
{
    $counts = ['applicant' => 0, 'enrolled_grade_11' => 0, 'enrolled_grade_12' => 0];
    if (!cohortTableExists($pdo)) {
        return $counts;
    }

    $sql = 'SELECT cohort_type, COUNT(*) AS c FROM student_cohorts WHERE 1=1';
    $params = [];
    if ($schoolYearFilter !== '') {
        $sql .= ' AND TRIM(school_year) = :sy';
        $params[':sy'] = $schoolYearFilter;
    }
    $sql .= ' GROUP BY cohort_type';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $type = (string)($row['cohort_type'] ?? '');
        if (isset($counts[$type])) {
            $counts[$type] = (int)($row['c'] ?? 0);
        }
    }

    return $counts;
}

/**
 * School years that have cohort rows (applicants or enrolled), plus configured years.
 *
 * @return list<string> YYYY-YYYY labels, newest first
 */
function cohortSchoolYearOptions(PDO $pdo): array
{
    $years = [];

    if (enrollmentTableExists($pdo, 'school_years') && enrollmentColumnExists($pdo, 'school_years', 'year')) {
        $rows = $pdo->query('SELECT year FROM school_years ORDER BY year DESC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as $row) {
            $y = trim((string)($row['year'] ?? ''));
            if ($y !== '' && preg_match('/^\d{4}-\d{4}$/', $y) === 1) {
                $years[$y] = true;
            }
        }
    }

    if (cohortTableExists($pdo)) {
        $rows = $pdo->query(
            "SELECT DISTINCT TRIM(school_year) AS sy FROM student_cohorts
              WHERE TRIM(COALESCE(school_year, '')) <> ''
              ORDER BY sy DESC"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as $row) {
            $y = trim((string)($row['sy'] ?? ''));
            if ($y !== '' && preg_match('/^\d{4}-\d{4}$/', $y) === 1) {
                $years[$y] = true;
            }
        }
    }

    if ($years === [] && enrollmentTableExists($pdo, 'enrollments') && enrollmentColumnExists($pdo, 'enrollments', 'school_year')) {
        $rows = $pdo->query(
            "SELECT DISTINCT TRIM(school_year) AS sy FROM enrollments
              WHERE TRIM(COALESCE(school_year, '')) <> ''
              ORDER BY sy DESC"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as $row) {
            $y = trim((string)($row['sy'] ?? ''));
            if ($y !== '' && preg_match('/^\d{4}-\d{4}$/', $y) === 1) {
                $years[$y] = true;
            }
        }
    }

    $list = array_keys($years);
    rsort($list, SORT_STRING);

    return $list;
}
