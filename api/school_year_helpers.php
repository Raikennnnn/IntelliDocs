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

/**
 * School years the admin has formally ended (archived). Stored as JSON array in app_settings.
 *
 * @return list<string>
 */
function getEndedSchoolYears(PDO $pdo): array
{
    $r = readSchoolYearSetting($pdo, 'ended_school_years');
    if ($r['exists'] === false || trim((string)($r['value'] ?? '')) === '') {
        return [];
    }
    $decoded = json_decode((string)$r['value'], true);
    if (!is_array($decoded)) {
        return [];
    }
    $out = [];
    foreach ($decoded as $y) {
        $t = trim((string)$y);
        if ($t !== '' && preg_match('/^\d{4}-\d{4}$/', $t) === 1) {
            $out[] = $t;
        }
    }

    return array_values(array_unique($out));
}

function setEndedSchoolYears(PDO $pdo, array $years): void
{
    $clean = [];
    foreach ($years as $y) {
        $t = trim((string)$y);
        if ($t !== '' && preg_match('/^\d{4}-\d{4}$/', $t) === 1) {
            $clean[] = $t;
        }
    }
    $clean = array_values(array_unique($clean));
    ensureAppSettingsTable($pdo);
    $stmt = $pdo->prepare('
        INSERT INTO app_settings (setting_key, setting_value) VALUES (:k, :v)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    ');
    $stmt->execute([
        ':k' => 'ended_school_years',
        ':v' => json_encode($clean, JSON_UNESCAPED_UNICODE),
    ]);
}

function isSchoolYearEnded(PDO $pdo, ?string $year): bool
{
    if ($year === null) {
        return false;
    }
    $t = trim((string)$year);
    if ($t === '') {
        return false;
    }

    return in_array($t, getEndedSchoolYears($pdo), true);
}

/**
 * School year label for a section roster (mode of student rows, then settings).
 *
 * @param list<array{schoolYear?: string}> $students
 */
function resolveRosterDisplaySchoolYear(PDO $pdo, array $students): string
{
    $counts = [];
    foreach ($students as $st) {
        $sy = trim((string)($st['schoolYear'] ?? ''));
        if ($sy !== '') {
            $counts[$sy] = ($counts[$sy] ?? 0) + 1;
        }
    }
    if ($counts !== []) {
        arsort($counts);

        return (string)array_key_first($counts);
    }

    $ongoingRaw = readSchoolYearSetting($pdo, 'ongoing_school_year');
    if ($ongoingRaw['exists'] && trim((string)($ongoingRaw['value'] ?? '')) !== '') {
        $norm = normalizeSchoolYearValue((string)$ongoingRaw['value']);

        return $norm ?? '';
    }

    $enrollment = getEnrollmentSchoolYear($pdo);

    return $enrollment ?? '';
}

/**
 * Apply archived/grey state after ended-school-year admin action.
 *
 * @param list<array<string, mixed>> $students
 * @return array{students: list<array<string, mixed>>, rosterSchoolYear: string, rosterSchoolYearEnded: bool, rosterArchived: bool}
 */
function applyRosterArchivedFlags(PDO $pdo, array $students): array
{
    $rosterSchoolYear = resolveRosterDisplaySchoolYear($pdo, $students);
    $rosterSchoolYearEnded = isSchoolYearEnded($pdo, $rosterSchoolYear);
    $endedSchoolYears = getEndedSchoolYears($pdo);

    foreach ($students as $idx => $st) {
        $sy = trim((string)($st['schoolYear'] ?? ''));
        $studentEnded = $sy !== '' && in_array($sy, $endedSchoolYears, true);
        $students[$idx]['archived'] = $rosterSchoolYearEnded
            || $studentEnded
            || ($rosterSchoolYearEnded && $sy === '');
    }

    $rosterArchived = $rosterSchoolYearEnded;
    if (!$rosterArchived) {
        foreach ($students as $st) {
            if (!empty($st['archived'])) {
                $rosterArchived = true;
                break;
            }
        }
    }

    return [
        'students' => $students,
        'rosterSchoolYear' => $rosterSchoolYear,
        'rosterSchoolYearEnded' => $rosterSchoolYearEnded,
        'rosterArchived' => $rosterArchived,
    ];
}

/**
 * Mark a school year as ended: archive list, clear ongoing/enrollment when they match.
 */
function endSchoolYear(PDO $pdo, string $year): void
{
    $y = trim($year);
    if (!preg_match('/^\d{4}-\d{4}$/', $y)) {
        throw new InvalidArgumentException('School year must look like YYYY-YYYY (e.g. 2025-2026).');
    }

    $ended = getEndedSchoolYears($pdo);
    if (!in_array($y, $ended, true)) {
        $ended[] = $y;
        setEndedSchoolYears($pdo, $ended);
    }

    $ongoingRaw = readSchoolYearSetting($pdo, 'ongoing_school_year');
    if ($ongoingRaw['exists'] && trim((string)($ongoingRaw['value'] ?? '')) === $y) {
        setOngoingSchoolYearSetting($pdo, null);
    }

    $enrollRaw = readSchoolYearSetting($pdo, 'enrollment_school_year');
    if ($enrollRaw['exists'] && trim((string)($enrollRaw['value'] ?? '')) === $y) {
        setEnrollmentSchoolYearSetting($pdo, null);
    }

    $legacyRaw = readSchoolYearSetting($pdo, 'active_school_year');
    if ($legacyRaw['exists'] && trim((string)($legacyRaw['value'] ?? '')) === $y) {
        setSchoolYearSetting($pdo, 'active_school_year', null);
    }
}

/**
 * Remove a year from the ended (archived) list so enrollment can open again.
 * Class lists stay archived until you end the year again.
 */
function reopenSchoolYear(PDO $pdo, string $year): void
{
    $y = trim($year);
    if (!preg_match('/^\d{4}-\d{4}$/', $y)) {
        throw new InvalidArgumentException('School year must look like YYYY-YYYY (e.g. 2025-2026).');
    }
    $ended = getEndedSchoolYears($pdo);
    $ended = array_values(array_filter($ended, static fn (string $e): bool => $e !== $y));
    setEndedSchoolYears($pdo, $ended);
}
