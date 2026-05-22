<?php
declare(strict_types=1);

/**
 * School year settings are stored in app_settings.
 *
 * - ongoing_school_year: the current academic year being displayed by default
 * - enrollment_school_year: the year currently accepting new enrollments
 *
 * Backward compatibility:
 * - If enrollment_school_year is missing, we fall back to active_school_year (older key).
 *
 * Notes:
 * - If a setting row exists and is an empty string, that feature is explicitly disabled by admin.
 * - If a setting row is missing entirely, we fall back to a computed PH-style school year.
 */

function ensureAppSettingsTable(PDO $pdo): void
{
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
            setting_value TEXT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ');
}

function fallbackComputedSchoolYear(): string
{
    $year = (int)date('Y');
    $month = (int)date('n');
    $startYear = $month >= 6 ? $year : $year - 1;

    return $startYear . '-' . ($startYear + 1);
}

function readSchoolYearSetting(PDO $pdo, string $key): array
{
    ensureAppSettingsTable($pdo);
    $stmt = $pdo->prepare('SELECT setting_value FROM app_settings WHERE setting_key = :k LIMIT 1');
    $stmt->execute([':k' => $key]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row === false) {
        return ['exists' => false, 'value' => null];
    }
    $s = (string)($row['setting_value'] ?? '');
    return ['exists' => true, 'value' => trim($s)];
}

function normalizeSchoolYearValue(?string $s): ?string
{
    if ($s === null) return null;
    $t = trim($s);
    if ($t === '') return null;
    if (!preg_match('/^\d{4}-\d{4}$/', $t)) {
        return fallbackComputedSchoolYear();
    }
    return $t;
}

/**
 * Ongoing school year shown across the system. Null means "not set" (explicitly disabled).
 */
function getOngoingSchoolYear(PDO $pdo): ?string
{
    $r = readSchoolYearSetting($pdo, 'ongoing_school_year');
    if ($r['exists'] === false) {
        return fallbackComputedSchoolYear();
    }
    $val = (string)($r['value'] ?? '');
    if ($val === '') return null;
    return normalizeSchoolYearValue($val);
}

/**
 * Enrollment year currently accepting enrollments. Null means enrollment closed.
 */
function getEnrollmentSchoolYear(PDO $pdo): ?string
{
    $r = readSchoolYearSetting($pdo, 'enrollment_school_year');
    if ($r['exists'] === true) {
        $val = (string)($r['value'] ?? '');
        if ($val === '') return null;
        return normalizeSchoolYearValue($val);
    }

    // Backward compat: older projects stored this as active_school_year.
    $old = readSchoolYearSetting($pdo, 'active_school_year');
    if ($old['exists'] === false) {
        return fallbackComputedSchoolYear();
    }
    $val = (string)($old['value'] ?? '');
    if ($val === '') return null;
    return normalizeSchoolYearValue($val);
}

function setSchoolYearSetting(PDO $pdo, string $key, ?string $year): void
{
    ensureAppSettingsTable($pdo);
    $val = '';
    if ($year === null || trim((string)$year) === '') {
        $val = '';
    } else {
        $y = trim((string)$year);
        if (!preg_match('/^\d{4}-\d{4}$/', $y)) {
            throw new InvalidArgumentException('School year must look like YYYY-YYYY (e.g. 2025-2026).');
        }
        $val = $y;
    }
    $stmt = $pdo->prepare('
        INSERT INTO app_settings (setting_key, setting_value) VALUES (:k, :v)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    ');
    $stmt->execute([':k' => $key, ':v' => $val]);
}

function setOngoingSchoolYearSetting(PDO $pdo, ?string $year): void
{
    setSchoolYearSetting($pdo, 'ongoing_school_year', $year);
}

function setEnrollmentSchoolYearSetting(PDO $pdo, ?string $year): void
{
    setSchoolYearSetting($pdo, 'enrollment_school_year', $year);
}
