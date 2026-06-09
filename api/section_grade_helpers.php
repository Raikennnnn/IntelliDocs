<?php
declare(strict_types=1);

/**
 * Grade level helpers for sections (Grade 11 / Grade 12).
 */

const SECTION_GRADE_LEVELS = ['11', '12'];
const SECTION_DEFAULT_GRADE = '11';

function normaliseGradeLevel(string $raw, string $default = SECTION_DEFAULT_GRADE): string
{
    $t = strtolower(trim($raw));
    if ($t === '12' || str_contains($t, '12')) {
        return '12';
    }
    if ($t === '11' || str_contains($t, '11')) {
        return '11';
    }
    if (in_array($default, SECTION_GRADE_LEVELS, true)) {
        return $default;
    }

    return SECTION_DEFAULT_GRADE;
}

/**
 * SQL expression: normalise enrollments.grade_level to '11' or '12'.
 */
function sqlEnrollmentGradeKey(string $gradeColumn = 'e.grade_level'): string
{
    return "CASE
        WHEN LOWER(TRIM(COALESCE({$gradeColumn}, ''))) LIKE '%12%' THEN '12'
        ELSE '11'
    END";
}

/**
 * JOIN clause: one enrolled/approved enrollment per student, preferring a school year.
 *
 * @return array{join: string, param: string}
 */
function rosterEnrollmentContext(PDO $pdo): array
{
    require_once __DIR__ . '/school_year_helpers.php';
    $sy = getEnrollmentSchoolYear($pdo);
    if ($sy === null || trim($sy) === '') {
        $ongoing = getOngoingSchoolYear($pdo);
        $sy = $ongoing ?? '';
    }

    return ['school_year' => trim((string)$sy)];
}

/**
 * @param string $studentUserIdCol e.g. s.user_id
 * @param string|null $preferGrade normalised 11|12; when set, ORDER BY prefers that grade
 */
function sqlEnrolledEnrollmentJoin(string $studentUserIdCol = 's.user_id', ?string $preferGrade = null): string
{
    $gradeOrder = '';
    if ($preferGrade !== null && $preferGrade !== '') {
        $gradeKey = sqlEnrollmentGradeKey('e2.grade_level');
        $gradeOrder = ",
               CASE WHEN {$gradeKey} = :sec_grade_order THEN 0 ELSE 1 END";
    }

    return "LEFT JOIN enrollments e ON e.user_id = {$studentUserIdCol}
        AND e.id = (
            SELECT e2.id FROM enrollments e2
             WHERE e2.user_id = {$studentUserIdCol}
               AND LOWER(TRIM(COALESCE(e2.status, ''))) IN ('enrolled', 'approved')
               AND (
                   :roster_sy_filter = ''
                   OR TRIM(COALESCE(e2.school_year, '')) = :roster_sy_filter_val
               )
             ORDER BY
               (TRIM(COALESCE(e2.school_year, '')) = :roster_sy) DESC{$gradeOrder},
               e2.id DESC
             LIMIT 1
        )";
}

function sectionGradeMigrateSchema(PDO $pdo, callable $tableExists, callable $columnExists): void
{
    if (!$tableExists($pdo, 'sections')) {
        return;
    }
    if (!$columnExists($pdo, 'sections', 'grade_level')) {
        try {
            $pdo->exec(
                "ALTER TABLE sections ADD COLUMN grade_level VARCHAR(2) NOT NULL DEFAULT '" . SECTION_DEFAULT_GRADE . "'"
            );
        } catch (Throwable $e) {
            // ignore
        }
    }
    try {
        $pdo->exec('ALTER TABLE sections DROP INDEX uniq_section_strand_name_shift');
    } catch (Throwable $e) {
        // ignore
    }
    try {
        $pdo->exec('ALTER TABLE sections DROP INDEX uniq_section_strand_name');
    } catch (Throwable $e) {
        // ignore
    }
    try {
        $pdo->exec(
            'ALTER TABLE sections ADD UNIQUE KEY uniq_section_strand_grade_shift_name (strand, grade_level, shift, name)'
        );
    } catch (Throwable $e) {
        // already exists
    }
}
