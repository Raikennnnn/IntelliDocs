<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/school_year_helpers.php';
require_once __DIR__ . '/api_auth.php';

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

function requireAdminActor(PDO $pdo, string $label): int
{
    $actor = apiRequireAdmin($pdo, $label);
    return $actor['id'];
}

function ensureSchoolYearsTable(PDO $pdo): void
{
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS school_years (
            id INT AUTO_INCREMENT PRIMARY KEY,
            year VARCHAR(9) NOT NULL UNIQUE,
            start_date DATE NULL,
            end_date DATE NULL,
            created_by_user_id INT NULL,
            created_by_name VARCHAR(120) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_school_years_year (year)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ');
}

function tableExistsLocal(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1');
    $stmt->execute([':t' => $table]);
    return (bool)$stmt->fetchColumn();
}

function countApprovedEnrollmentsForYear(PDO $pdo, string $year): int
{
    if (!tableExistsLocal($pdo, 'enrollments')) {
        return 0;
    }
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM enrollments WHERE school_year = :y AND LOWER(TRIM(status)) IN ('approved', 'enrolled')");
    $stmt->execute([':y' => $year]);
    return (int)$stmt->fetchColumn();
}

function listSchoolYearRecords(PDO $pdo, ?string $activeYear): array
{
    ensureSchoolYearsTable($pdo);
    $rows = $pdo->query('SELECT id, year, start_date, end_date, created_by_name, created_at FROM school_years ORDER BY year DESC')->fetchAll() ?: [];
    $out = [];
    foreach ($rows as $r) {
        $year = (string)($r['year'] ?? '');
        $out[] = [
            'id' => (int)($r['id'] ?? 0),
            'year' => $year,
            'startDate' => (string)($r['start_date'] ?? ''),
            'endDate' => (string)($r['end_date'] ?? ''),
            'status' => ($activeYear !== null && $year === $activeYear) ? 'Active' : 'Inactive',
            'enrolledStudents' => $year !== '' ? countApprovedEnrollmentsForYear($pdo, $year) : 0,
            'createdBy' => (string)($r['created_by_name'] ?? 'Administrator'),
            'createdDate' => (string)($r['created_at'] ?? ''),
        ];
    }
    return $out;
}

if ($method === 'GET') {
    $ongoing = getOngoingSchoolYear($pdo);
    $enrollment = getEnrollmentSchoolYear($pdo);
    $payload = [
        'success' => true,
        'ongoing_school_year' => $ongoing,
        'enrollment_school_year' => $enrollment,
        'active_school_year' => $enrollment,
        'enrollment_enabled' => $enrollment !== null,
    ];

    require_once __DIR__ . '/session_token.php';
    $actor = tryResolveActorFromRequest($pdo, 'school-year');
    $actorId = $actor !== null ? (int)$actor['id'] : 0;
    if ($actorId > 0 && userIsAdmin($pdo, $actorId)) {
        require_once __DIR__ . '/permission_guard.php';
        requireActorPermission($pdo, $actor, 'configureSystem', false);
        $payload['ended_school_years'] = getEndedSchoolYears($pdo);
        $payload['school_years'] = listSchoolYearRecords($pdo, $enrollment);
    } elseif ($actorId > 0 && getUserRole($pdo, $actorId) === 'student') {
        // Enrollment portal only — no admin management fields.
    } else {
        // Anonymous / landing page: enrollment gate info only.
    }

    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $actorId = requireAdminActor($pdo, 'admin/school-year');
    require_once __DIR__ . '/permission_guard.php';
    requireActorPermission($pdo, ['role' => 'admin', 'id' => $actorId], 'configureSystem', false);
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }
    $year = trim((string)($payload['year'] ?? ''));
    $startDate = trim((string)($payload['startDate'] ?? ''));
    $endDate = trim((string)($payload['endDate'] ?? ''));
    if ($year === '' || !preg_match('/^\d{4}-\d{4}$/', $year)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'School year must look like YYYY-YYYY (e.g. 2025-2026).']);
        exit;
    }
    if ($startDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Start date must be YYYY-MM-DD.']);
        exit;
    }
    if ($endDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'End date must be YYYY-MM-DD.']);
        exit;
    }
    $creatorName = 'Administrator';
    try {
        if (tableExistsLocal($pdo, 'users')) {
            $u = $pdo->prepare('SELECT COALESCE(full_name, username, email) FROM users WHERE id = :id LIMIT 1');
            $u->execute([':id' => $actorId]);
            $creatorName = (string)($u->fetchColumn() ?: 'Administrator');
        }
    } catch (Throwable $e) {
        // ignore
    }
    ensureSchoolYearsTable($pdo);
    try {
        $ins = $pdo->prepare('
            INSERT INTO school_years (year, start_date, end_date, created_by_user_id, created_by_name)
            VALUES (:year, :start_date, :end_date, :uid, :name)
        ');
        $ins->execute([
            ':year' => $year,
            ':start_date' => ($startDate === '' ? null : $startDate),
            ':end_date' => ($endDate === '' ? null : $endDate),
            ':uid' => $actorId,
            ':name' => $creatorName,
        ]);
    } catch (Throwable $e) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'School year already exists or could not be created.']);
        exit;
    }
    appLogEvent($pdo, 'admin_school_year_create', 'admin', 'success', $actorId, 'school_years', $year, []);
    $ongoing = getOngoingSchoolYear($pdo);
    $enrollment = getEnrollmentSchoolYear($pdo);
    echo json_encode([
        'success' => true,
        'ongoing_school_year' => $ongoing,
        'enrollment_school_year' => $enrollment,
        'active_school_year' => $enrollment,
        'enrollment_enabled' => $enrollment !== null,
        'school_years' => listSchoolYearRecords($pdo, $enrollment),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'PUT') {
    $actorId = requireAdminActor($pdo, 'admin/school-year');
    require_once __DIR__ . '/permission_guard.php';
    requireActorPermission($pdo, ['role' => 'admin', 'id' => $actorId], 'configureSystem', false);

    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $hasOngoing = array_key_exists('ongoing_school_year', $payload);
    $hasEnrollment = array_key_exists('enrollment_school_year', $payload);
    $hasLegacyActive = array_key_exists('active_school_year', $payload);
    $hasEndYear = array_key_exists('end_school_year', $payload);
    $hasReopenYear = array_key_exists('reopen_school_year', $payload);

    if (!$hasOngoing && !$hasEnrollment && !$hasLegacyActive && !$hasEndYear && !$hasReopenYear) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'ongoing_school_year, enrollment_school_year, end_school_year, or reopen_school_year is required']);
        exit;
    }

    $toSetOngoing = null;
    $toSetEnrollment = null;

    $parse = function ($raw, string $field) {
        if ($raw === null || $raw === '') return '';
        if (is_string($raw)) return trim($raw);
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => "{$field} must be a string or null"]);
        exit;
    };

    if ($hasOngoing) {
        $toSetOngoing = $parse($payload['ongoing_school_year'], 'ongoing_school_year');
    }
    if ($hasEnrollment) {
        $toSetEnrollment = $parse($payload['enrollment_school_year'], 'enrollment_school_year');
    }
    if ($hasLegacyActive && !$hasEnrollment) {
        // Backward compat: active_school_year maps to enrollment year (accepting enrollments).
        $toSetEnrollment = $parse($payload['active_school_year'], 'active_school_year');
    }

    try {
        if ($hasEndYear) {
            $toEnd = $parse($payload['end_school_year'], 'end_school_year');
            if ($toEnd === '') {
                http_response_code(422);
                echo json_encode(['success' => false, 'error' => 'end_school_year cannot be empty']);
                exit;
            }
            endSchoolYear($pdo, $toEnd);
            appLogEvent($pdo, 'admin_school_year_end', 'admin', 'success', $actorId, 'school_years', $toEnd, []);
        }
        if ($hasReopenYear) {
            $toReopen = $parse($payload['reopen_school_year'], 'reopen_school_year');
            if ($toReopen === '') {
                http_response_code(422);
                echo json_encode(['success' => false, 'error' => 'reopen_school_year cannot be empty']);
                exit;
            }
            reopenSchoolYear($pdo, $toReopen);
            $openEnrollment = !empty($payload['open_enrollment']);
            if ($openEnrollment) {
                setEnrollmentSchoolYearSetting($pdo, $toReopen);
            }
            appLogEvent($pdo, 'admin_school_year_reopen', 'admin', 'success', $actorId, 'school_years', $toReopen, [
                'open_enrollment' => $openEnrollment,
            ]);
        }
        if ($toSetOngoing !== null && $toSetOngoing !== '') {
            if (isSchoolYearEnded($pdo, $toSetOngoing)) {
                http_response_code(422);
                echo json_encode([
                    'success' => false,
                    'error'   => 'Cannot set an ended school year as ongoing. Choose a different year or create a new one.',
                ]);
                exit;
            }
        }
        if ($toSetEnrollment !== null && $toSetEnrollment !== '') {
            if (isSchoolYearEnded($pdo, $toSetEnrollment)) {
                http_response_code(422);
                echo json_encode([
                    'success' => false,
                    'error'   => 'Cannot open enrollment for an ended school year. Choose a year that is not ended, or create a new school year.',
                ]);
                exit;
            }
        }
        if ($toSetOngoing !== null) {
            if ($toSetOngoing === '') setOngoingSchoolYearSetting($pdo, null);
            else setOngoingSchoolYearSetting($pdo, $toSetOngoing);
        }
        if ($toSetEnrollment !== null) {
            if ($toSetEnrollment === '') setEnrollmentSchoolYearSetting($pdo, null);
            else setEnrollmentSchoolYearSetting($pdo, $toSetEnrollment);
        }
    } catch (InvalidArgumentException $e) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit;
    }

    $ongoing = getOngoingSchoolYear($pdo);
    $enrollment = getEnrollmentSchoolYear($pdo);
    $ended = getEndedSchoolYears($pdo);
    if (!$hasEndYear && !$hasReopenYear) {
        appLogEvent($pdo, 'admin_school_year_update', 'admin', 'success', $actorId, 'settings', 'school_year', [
            'ongoing_school_year' => $ongoing,
            'enrollment_school_year' => $enrollment,
            'enrollment_enabled' => $enrollment !== null,
        ]);
    }
    echo json_encode([
        'success' => true,
        'ongoing_school_year' => $ongoing,
        'enrollment_school_year' => $enrollment,
        'active_school_year' => $enrollment,
        'enrollment_enabled' => $enrollment !== null,
        'ended_school_years' => $ended,
        'school_years' => listSchoolYearRecords($pdo, $enrollment),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
