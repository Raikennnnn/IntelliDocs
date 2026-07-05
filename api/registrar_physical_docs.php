<?php
declare(strict_types=1);

/**
 * Registrar physical-document checklist for approved enrollments.
 *
 *   GET  /api/registrar/physical-docs?enrollment_id=123
 *        Lists every checklist item for the given approved enrollment.
 *        Lazily seeds the canonical requirement list on the first call.
 *
 *   POST /api/registrar/physical-docs
 *        action = "toggle"        -- check/uncheck a single requirement
 *        action = "mark_enrolled" -- flip enrollments.status to "enrolled"
 *                                    (only when every required item is checked)
 *        action = "send_reminder" -- email the student a list of every
 *                                    currently-unchecked item
 *
 * Auth: X-User-Id must resolve to a registrar or admin.
 */

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/physical_docs_helpers.php';

header('Content-Type: application/json');

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

// -----------------------------------------------------------------------------
// Auth gate
// -----------------------------------------------------------------------------
require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/permission_guard.php';
$actor = apiRequireActor($pdo, 'registrar/physical-docs');
$actorId = $actor['id'];
$actorRole = $actor['role'];
if (!in_array($actorRole, ['registrar', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

requireActorPermission($pdo, $actor, 'viewApplications');

// -----------------------------------------------------------------------------
// Reminder cadence (in days). Approved-but-not-enrolled students get an
// automatic email reminder this often until they hand in every required
// physical document. The lazy sweep below runs whenever the registrar
// hits this endpoint, so no external cron is required.
// -----------------------------------------------------------------------------
const PHYSICAL_DOCS_AUTO_REMINDER_INTERVAL_DAYS = 3;

// -----------------------------------------------------------------------------
// Schema guard. Auto-create the checklist table on the fly when missing
// instead of forcing the operator to run the SQL migration by hand —
// matches how `sections`, `students`, and a few other tables are
// self-healed elsewhere in the API. Also widen `enrollments.status` to
// include "enrolled" so the "Mark as enrolled" flow works without a
// separate migration step.
// -----------------------------------------------------------------------------
if (!tableExists($pdo, 'enrollment_physical_docs')) {
    try {
        $pdo->exec(
            "CREATE TABLE enrollment_physical_docs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                enrollment_id INT NOT NULL,
                requirement_key VARCHAR(64) NOT NULL,
                requirement_label VARCHAR(160) NOT NULL,
                received TINYINT(1) NOT NULL DEFAULT 0,
                received_at TIMESTAMP NULL DEFAULT NULL,
                received_by INT NULL,
                notes VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_enrollment_requirement (enrollment_id, requirement_key),
                INDEX idx_enrollment_received (enrollment_id, received)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
    } catch (Throwable $e) {
        appLogEvent($pdo, 'registrar_physical_docs', 'registrar', 'failed', $actorId, 'endpoint', 'physical-docs', [
            'reason'  => 'schema_create_failed',
            'message' => $e->getMessage(),
        ]);
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'error'   => 'schema_not_migrated',
            'message' => 'The physical-docs checklist table could not be auto-created. Please run database_migration_physical_docs.sql.',
            'details' => ['hint' => 'Run database_migration_physical_docs.sql.'],
        ]);
        exit;
    }
}

// Make sure the enrollments.status ENUM includes 'enrolled'. This used to
// live in the migration script; doing it inline here keeps the "Mark as
// enrolled" action working on freshly-bootstrapped databases. The check
// is cheap (information_schema lookup) and the ALTER is idempotent for
// already-correct columns.
try {
    $colTypeStmt = $pdo->prepare(
        'SELECT COLUMN_TYPE FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = "enrollments"
            AND COLUMN_NAME = "status"
          LIMIT 1'
    );
    $colTypeStmt->execute();
    $colType = (string)$colTypeStmt->fetchColumn();
    if ($colType !== '' && stripos($colType, "'enrolled'") === false) {
        $pdo->exec(
            "ALTER TABLE enrollments
                MODIFY COLUMN status ENUM('pending','under_review','approved','enrolled','rejected')
                NOT NULL DEFAULT 'pending'"
        );
    }
} catch (Throwable $e) {
    // Non-fatal — "Mark as enrolled" will surface a clearer error if the
    // ALTER never happened.
}

// -----------------------------------------------------------------------------
// Reminder tracking columns on `enrollments`. We add two columns:
//   - last_physical_reminder_at: timestamp of the most recent reminder
//     (auto OR manual). Used by the sweep below to throttle so a student
//     never gets more than one reminder per interval, even if the
//     registrar opens multiple students or visits the page repeatedly.
//   - physical_reminder_count: how many reminders we have sent in total.
//     Surfaced in the UI so the registrar can see "we've nudged this
//     student 3 times already".
// Both columns are nullable / default 0 and added lazily — no separate
// migration script required.
// -----------------------------------------------------------------------------
try {
    if (!columnExists($pdo, 'enrollments', 'last_physical_reminder_at')) {
        $pdo->exec('ALTER TABLE enrollments ADD COLUMN last_physical_reminder_at TIMESTAMP NULL DEFAULT NULL');
    }
    if (!columnExists($pdo, 'enrollments', 'physical_reminder_count')) {
        $pdo->exec('ALTER TABLE enrollments ADD COLUMN physical_reminder_count INT NOT NULL DEFAULT 0');
    }
    if (!columnExists($pdo, 'enrollments', 'physical_docs_completed_at')) {
        $pdo->exec('ALTER TABLE enrollments ADD COLUMN physical_docs_completed_at TIMESTAMP NULL DEFAULT NULL');
    }
} catch (Throwable $e) {
    // Non-fatal — auto-reminders will simply skip until the columns exist.
}

// -----------------------------------------------------------------------------
// Canonical requirements list. Mirrors the digital upload step
// (api/student_enrollment.php) plus the extra physical-only items the
// registrar collects in person:
//
//   - Two photocopies of the PSA Birth Certificate
//   - Two pieces of 2x2 picture
//
// The TOR is required only for transferees; we track it as optional otherwise
// so the "Mark as enrolled" gate doesn't block non-transferee students.
// Catalog lives in api/physical_docs_helpers.php.
// -----------------------------------------------------------------------------

/**
 * Read the enrollment row + the cached enrollment_status flag for the
 * supplied `$enrollmentId`. Returns null when the row does not exist.
 *
 * @return array{user_id:int, status:string, enrollment_status_meta:string, enrollment_steps:string}|null
 */
function loadEnrollmentForPhysicalDocs(PDO $pdo, int $enrollmentId): ?array
{
    // The two reminder columns are added lazily by this same file, so guard
    // the SELECT in case the ALTER hasn't run yet (e.g. the operator has
    // limited DDL permissions). Falls back to NULL/0 in that case.
    $hasReminderAt = columnExists($pdo, 'enrollments', 'last_physical_reminder_at');
    $hasReminderCount = columnExists($pdo, 'enrollments', 'physical_reminder_count');
    $hasPhysicalComplete = columnExists($pdo, 'enrollments', 'physical_docs_completed_at');
    $reminderAtExpr = $hasReminderAt ? 'last_physical_reminder_at' : 'NULL AS last_physical_reminder_at';
    $reminderCountExpr = $hasReminderCount ? 'physical_reminder_count' : '0 AS physical_reminder_count';
    $physicalCompleteExpr = $hasPhysicalComplete ? 'physical_docs_completed_at' : 'NULL AS physical_docs_completed_at';
    $stmt = $pdo->prepare(
        "SELECT id, user_id, status, enrollment_steps, $reminderAtExpr, $reminderCountExpr, $physicalCompleteExpr
         FROM enrollments WHERE id = :id LIMIT 1"
    );
    $stmt->execute([':id' => $enrollmentId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return null;
    return [
        'user_id' => (int)$row['user_id'],
        'status' => strtolower(trim((string)($row['status'] ?? ''))),
        'enrollment_steps' => (string)($row['enrollment_steps'] ?? '{}'),
        'last_physical_reminder_at' => $row['last_physical_reminder_at'] ?? null,
        'physical_reminder_count' => (int)($row['physical_reminder_count'] ?? 0),
        'physical_docs_completed_at' => $row['physical_docs_completed_at'] ?? null,
    ];
}

/**
 * When every required physical document is checked, stamp completion on the
 * enrollment row. Unchecking any item clears the stamp so the checklist
 * can be edited again.
 */
function syncPhysicalDocsCompletion(PDO $pdo, int $enrollmentId, array $enrollment, array $catalog): void
{
    syncEnrollmentPhysicalDocsCompletion(
        $pdo,
        $enrollmentId,
        $enrollment['physical_docs_completed_at'] ?? null,
        (string)($enrollment['enrollment_steps'] ?? '{}'),
        (string)($enrollment['status'] ?? '')
    );
}

/**
 * Build the response shape used by both GET and the POST actions. The same
 * structure is sent after every state change so the client can re-render
 * without an extra round trip.
 */
function buildPhysicalDocsResponse(PDO $pdo, int $enrollmentId, array $enrollment, array $catalog): array
{
    // Index DB rows by requirement_key so we can join with the catalog
    // without an N+1 query.
    $rowsStmt = $pdo->prepare(
        'SELECT id, requirement_key, requirement_label, received, received_at, received_by, notes
         FROM enrollment_physical_docs
         WHERE enrollment_id = :id'
    );
    $rowsStmt->execute([':id' => $enrollmentId]);
    $rowsByKey = [];
    foreach ($rowsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $r) {
        $rowsByKey[(string)$r['requirement_key']] = $r;
    }

    $items = [];
    $missingRequired = [];
    $allRequiredChecked = true;
    foreach ($catalog as $entry) {
        $row = $rowsByKey[$entry['key']] ?? null;
        $received = $row ? (int)$row['received'] === 1 : false;
        $items[] = [
            'id' => $row ? (int)$row['id'] : null,
            'key' => $entry['key'],
            'label' => $entry['label'],
            'required' => (bool)$entry['required'],
            'transfereeOnly' => (bool)$entry['transferee_only'],
            'received' => $received,
            'receivedAt' => $row['received_at'] ?? null,
            'receivedBy' => $row && $row['received_by'] !== null ? (int)$row['received_by'] : null,
            'notes' => $row['notes'] ?? null,
        ];
        if ($entry['required'] && !$received) {
            $missingRequired[] = $entry['label'];
            $allRequiredChecked = false;
        }
    }

    // Compute the next-auto-reminder timestamp so the registrar can see
    // when the system will nudge the student next. NULL means "as soon as
    // the next sweep runs" (i.e. eligible right now).
    $lastReminderAt = $enrollment['last_physical_reminder_at'] ?? null;
    $nextAutoReminderAt = null;
    if ($lastReminderAt) {
        $ts = strtotime((string)$lastReminderAt);
        if ($ts !== false) {
            $nextAutoReminderAt = date('Y-m-d H:i:s', $ts + PHYSICAL_DOCS_AUTO_REMINDER_INTERVAL_DAYS * 86400);
        }
    }

    return [
        'success' => true,
        'enrollmentId' => $enrollmentId,
        'enrollmentStatus' => $enrollment['status'],
        'items' => $items,
        'missingRequired' => $missingRequired,
        'allRequiredChecked' => $allRequiredChecked,
        'physicalDocsComplete' => $allRequiredChecked || !empty($enrollment['physical_docs_completed_at']),
        'physicalDocsCompletedAt' => $enrollment['physical_docs_completed_at'] ?? null,
        // Manual "Mark complete" is only offered when every box is ticked
        // but the completion stamp hasn't been saved yet (edge case).
        'canMarkComplete' => $allRequiredChecked && empty($enrollment['physical_docs_completed_at']),
        'autoReminder' => [
            'intervalDays' => PHYSICAL_DOCS_AUTO_REMINDER_INTERVAL_DAYS,
            'lastSentAt' => $lastReminderAt,
            'reminderCount' => (int)($enrollment['physical_reminder_count'] ?? 0),
            'nextScheduledAt' => $nextAutoReminderAt,
        ],
    ];
}

// -----------------------------------------------------------------------------
// Reusable reminder helpers. Used by both the manual "Email reminder"
// button (POST action=send_reminder) and the lazy auto-reminder sweep
// that runs from the GET endpoint.
// -----------------------------------------------------------------------------

/**
 * Send a single "missing physical documents" reminder email to the
 * student linked to `$enrollmentId`. Updates the reminder bookkeeping
 * columns on `enrollments` on success.
 *
 * Returns ['sent' => bool, 'error' => ?string, 'missingCount' => int,
 *          'reason' => ?string] — `reason` carries a non-error skip
 * marker (e.g. 'no_missing', 'wrong_status', 'no_email').
 */
function sendPhysicalDocsReminderEmail(PDO $pdo, int $enrollmentId, ?array $enrollment = null, ?array $catalog = null, string $source = 'manual'): array
{
    $enrollment = $enrollment ?? loadEnrollmentForPhysicalDocs($pdo, $enrollmentId);
    if (!$enrollment) {
        return ['sent' => false, 'error' => 'enrollment_not_found', 'missingCount' => 0, 'reason' => null];
    }
    // Enrolled students (including legacy `approved` rows) may still owe
    // physical documents — reminders stop once every required item is checked.
    if (!in_array($enrollment['status'], ['approved', 'enrolled'], true)) {
        return ['sent' => false, 'error' => null, 'missingCount' => 0, 'reason' => 'wrong_status'];
    }
    $catalog = $catalog ?? physicalRequirementCatalog($enrollment['status']);
    if (!isTransfereeFromEnrollmentSteps($enrollment['enrollment_steps'])) {
        $catalog = array_values(array_filter($catalog, fn($i) => !$i['transferee_only']));
    }
    ensurePhysicalDocsRows($pdo, $enrollmentId, $catalog);
    $resolved = buildPhysicalDocsResponse($pdo, $enrollmentId, $enrollment, $catalog);
    $missing = $resolved['missingRequired'];
    if (empty($missing)) {
        return ['sent' => false, 'error' => null, 'missingCount' => 0, 'reason' => 'no_missing'];
    }

    $userStmt = $pdo->prepare(
        'SELECT email, full_name, ' .
        (columnExists($pdo, 'users', 'first_name') ? 'first_name' : "'' AS first_name") .
        ' FROM users WHERE id = :id LIMIT 1'
    );
    $userStmt->execute([':id' => $enrollment['user_id']]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);
    if (!$user || trim((string)($user['email'] ?? '')) === '') {
        return ['sent' => false, 'error' => 'student_email_missing', 'missingCount' => count($missing), 'reason' => 'no_email'];
    }

    $firstName = trim((string)($user['first_name'] ?? '')) ?: trim((string)($user['full_name'] ?? '')) ?: 'there';

    require_once __DIR__ . '/physical_docs_reminder_email.php';

    $sent = false;
    $deliveryError = null;
    if (file_exists(__DIR__ . '/mailer.php')) {
        require_once __DIR__ . '/mailer.php';
        try {
            if (function_exists('sendPhysicalDocsReminderEmailMessage')) {
                $sent = sendPhysicalDocsReminderEmailMessage($pdo, (string)$user['email'], [
                    'first_name' => $firstName,
                    'missing_labels' => $missing,
                    'source' => $source,
                ]);
                if (!$sent) {
                    $deliveryError = 'send_failed';
                }
            } elseif (function_exists('queueEmail')) {
                $rendered = buildPhysicalDocsReminderEmail([
                    'first_name' => $firstName,
                    'missing_labels' => $missing,
                    'source' => $source,
                ]);
                $queueId = queueEmail($pdo, (string)$user['email'], $rendered['subject'], $rendered['body']);
                if ($queueId && function_exists('processSingleQueuedEmail')) {
                    $sent = (bool)processSingleQueuedEmail($pdo, (int)$queueId);
                } else {
                    $sent = (bool)$queueId;
                }
            } else {
                $deliveryError = 'mailer_unavailable';
            }
        } catch (Throwable $e) {
            $deliveryError = $e->getMessage();
        }
    } else {
        $deliveryError = 'mailer_not_available';
    }

    if ($sent) {
        try {
            // Bump the bookkeeping so the sweep skips this student for the
            // next interval and the registrar UI can show "last reminder
            // sent ..." + total count.
            $pdo->prepare(
                'UPDATE enrollments
                   SET last_physical_reminder_at = NOW(),
                       physical_reminder_count = physical_reminder_count + 1
                 WHERE id = :id'
            )->execute([':id' => $enrollmentId]);
        } catch (Throwable $e) {
            // Columns may not exist yet — non-fatal; the email still went out.
        }
    }

    return [
        'sent' => $sent,
        'error' => $sent ? null : ($deliveryError ?: 'failed_to_send'),
        'missingCount' => count($missing),
        'reason' => null,
    ];
}

/**
 * Walk every approved-but-not-enrolled enrollment and email a reminder to
 * any student whose last reminder is older than the configured interval
 * (or who has never received one). Designed to be cheap enough to run on
 * every registrar page load — typical Filipino senior-high cohorts are
 * <500 students and we LIMIT the per-sweep email volume so a single
 * registrar visit can't blow up the mailer.
 */
function autoRemindMissingPhysicalDocs(PDO $pdo, int $maxEmailsPerSweep = 25, bool $force = false): array
{
    $summary = ['eligible' => 0, 'sent' => 0, 'skipped' => 0, 'errors' => 0, 'forced' => $force];
    // Guard against the reminder columns not existing yet.
    if (!columnExists($pdo, 'enrollments', 'last_physical_reminder_at')) {
        return $summary + ['skipped_reason' => 'schema_pending'];
    }

    $intervalDays = PHYSICAL_DOCS_AUTO_REMINDER_INTERVAL_DAYS;
    $completeFilter = columnExists($pdo, 'enrollments', 'physical_docs_completed_at')
        ? 'AND (physical_docs_completed_at IS NULL)'
        : '';
    // When $force is set (e.g. "Remind all now" from the registrar UI) we
    // skip the throttle window so every approved student with missing
    // requirements is re-emailed immediately. Otherwise we honour the
    // configured interval so we don't spam.
    if ($force) {
        $stmt = $pdo->prepare(
            "SELECT id
               FROM enrollments
              WHERE status IN ('approved', 'enrolled')
                $completeFilter
              ORDER BY (last_physical_reminder_at IS NULL) DESC, last_physical_reminder_at ASC, id ASC
              LIMIT :lim"
        );
        $stmt->bindValue(':lim', $maxEmailsPerSweep, PDO::PARAM_INT);
    } else {
        $stmt = $pdo->prepare(
            "SELECT id
               FROM enrollments
              WHERE status IN ('approved', 'enrolled')
                $completeFilter
                AND (last_physical_reminder_at IS NULL
                     OR last_physical_reminder_at < DATE_SUB(NOW(), INTERVAL :days DAY))
              ORDER BY (last_physical_reminder_at IS NULL) DESC, last_physical_reminder_at ASC, id ASC
              LIMIT :lim"
        );
        $stmt->bindValue(':days', $intervalDays, PDO::PARAM_INT);
        $stmt->bindValue(':lim', $maxEmailsPerSweep, PDO::PARAM_INT);
    }
    $stmt->execute();
    $ids = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN) ?: []);
    $summary['eligible'] = count($ids);

    foreach ($ids as $eid) {
        try {
            $result = sendPhysicalDocsReminderEmail($pdo, $eid, null, null, 'auto');
            if ($result['sent']) {
                $summary['sent']++;
                appLogEvent(
                    $pdo, 'physical_docs_reminder_auto', 'system', 'success',
                    null, 'enrollment', (string)$eid,
                    ['delivery' => 'sent', 'missing_count' => $result['missingCount']]
                );
            } elseif ($result['error']) {
                $summary['errors']++;
                appLogEvent(
                    $pdo, 'physical_docs_reminder_auto', 'system', 'failed',
                    null, 'enrollment', (string)$eid,
                    ['delivery' => 'failed', 'error' => $result['error']]
                );
                // Still bump the timestamp on hard failures (e.g. no email
                // on file) so the sweep doesn't retry the same broken row
                // every page load; the registrar manual button still works.
                if (in_array($result['error'], ['student_email_missing'], true)) {
                    try {
                        $pdo->prepare(
                            'UPDATE enrollments SET last_physical_reminder_at = NOW() WHERE id = :id'
                        )->execute([':id' => $eid]);
                    } catch (Throwable $e) { /* ignore */ }
                }
            } else {
                // Skipped for a benign reason (no_missing, wrong_status).
                // Still bump the timestamp on no_missing so we don't keep
                // re-checking — the next genuine miss will reset it.
                $summary['skipped']++;
                if (($result['reason'] ?? null) === 'no_missing') {
                    try {
                        $pdo->prepare(
                            'UPDATE enrollments SET last_physical_reminder_at = NOW() WHERE id = :id'
                        )->execute([':id' => $eid]);
                    } catch (Throwable $e) { /* ignore */ }
                }
            }
        } catch (Throwable $e) {
            $summary['errors']++;
        }
    }

    return $summary;
}

// -----------------------------------------------------------------------------
// Dispatch
// -----------------------------------------------------------------------------
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $enrollmentId = (int)($_GET['enrollment_id'] ?? 0);
        if ($enrollmentId <= 0) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Invalid enrollment id']);
            exit;
        }
        $enrollment = loadEnrollmentForPhysicalDocs($pdo, $enrollmentId);
        if (!$enrollment) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Enrollment not found']);
            exit;
        }
        // Only approved / enrolled students get the checklist; everyone else
        // would clutter the registrar's view with a feature that doesn't apply.
        if (!in_array($enrollment['status'], ['approved', 'enrolled'], true)) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'enrollment_not_approved']);
            exit;
        }

        $rawCatalog = physicalRequirementCatalog($enrollment['status']);
        $isTransferee = isTransfereeFromEnrollmentSteps($enrollment['enrollment_steps']);
        $catalog = array_values(array_filter($rawCatalog, static fn ($e) => !$e['transferee_only'] || $isTransferee));

        ensurePhysicalDocsRows($pdo, $enrollmentId, $catalog);
        carryForwardPhysicalDocsForEnrollment($pdo, $enrollmentId, $enrollment);
        syncPhysicalDocsCompletion($pdo, $enrollmentId, $enrollment, $catalog);
        $enrollment = loadEnrollmentForPhysicalDocs($pdo, $enrollmentId) ?? $enrollment;

        // Best-effort: every time the registrar opens the panel, sweep
        // any approved-but-not-enrolled students whose reminders are due.
        // Wrapped so a mailer hiccup never breaks the panel load.
        $sweepSummary = null;
        try {
            $sweepSummary = autoRemindMissingPhysicalDocs($pdo);
            // Re-read the current enrollment so the panel reflects the
            // bumped `last_physical_reminder_at` if the sweep just emailed
            // *this* student.
            $enrollment = loadEnrollmentForPhysicalDocs($pdo, $enrollmentId) ?? $enrollment;
        } catch (Throwable $e) {
            // Non-fatal — the manual reminder button still works.
        }

        $response = buildPhysicalDocsResponse($pdo, $enrollmentId, $enrollment, $catalog);
        if ($sweepSummary) {
            $response['autoReminder']['lastSweep'] = $sweepSummary;
        }
        echo json_encode($response);
        exit;
    }

    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        exit;
    }

    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }
    $action = strtolower(trim((string)($payload['action'] ?? '')));

    // The sweep action operates across all enrollments rather than a
    // single row, so handle it before the per-enrollment validation
    // gates below. `force = true` bypasses the throttle window so every
    // approved student with missing docs is re-emailed immediately —
    // used by the registrar's "Send reminders to all" bulk button.
    if ($action === 'auto_remind_sweep') {
        $force = (bool)($payload['force'] ?? false);
        $summary = autoRemindMissingPhysicalDocs($pdo, 200, $force);
        appLogEvent(
            $pdo, $force ? 'physical_docs_reminder_force_sweep' : 'physical_docs_reminder_sweep',
            'registrar', 'success',
            $actorId, 'endpoint', 'physical-docs',
            $summary
        );
        echo json_encode(['success' => true, 'summary' => $summary]);
        exit;
    }

    $enrollmentId = (int)($payload['enrollment_id'] ?? 0);
    if ($enrollmentId <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Invalid enrollment id']);
        exit;
    }
    $enrollment = loadEnrollmentForPhysicalDocs($pdo, $enrollmentId);
    if (!$enrollment) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Enrollment not found']);
        exit;
    }
    if (!in_array($enrollment['status'], ['approved', 'enrolled'], true)) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'enrollment_not_approved']);
        exit;
    }

    $rawCatalog = physicalRequirementCatalog($enrollment['status']);
    $isTransferee = isTransfereeFromEnrollmentSteps($enrollment['enrollment_steps']);
    $catalog = array_values(array_filter($rawCatalog, static fn ($e) => !$e['transferee_only'] || $isTransferee));
    ensurePhysicalDocsRows($pdo, $enrollmentId, $catalog);

    if ($action === 'toggle') {
        $key = trim((string)($payload['requirement_key'] ?? ''));
        $received = (bool)($payload['received'] ?? false);
        if ($key === '') {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'requirement_key required']);
            exit;
        }
        $valid = false;
        foreach ($catalog as $entry) {
            if ($entry['key'] === $key) { $valid = true; break; }
        }
        if (!$valid) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'unknown requirement_key']);
            exit;
        }
        $stmt = $pdo->prepare(
            'UPDATE enrollment_physical_docs
             SET received = :received,
                 received_at = CASE WHEN :received2 = 1 THEN NOW() ELSE NULL END,
                 received_by = CASE WHEN :received3 = 1 THEN :actor ELSE NULL END
             WHERE enrollment_id = :eid AND requirement_key = :key'
        );
        $stmt->execute([
            ':received' => $received ? 1 : 0,
            ':received2' => $received ? 1 : 0,
            ':received3' => $received ? 1 : 0,
            ':actor' => $actorId,
            ':eid' => $enrollmentId,
            ':key' => $key,
        ]);
        appLogEvent($pdo, 'physical_doc_toggle', 'registrar', 'success', $actorId, 'enrollment', (string)$enrollmentId, [
            'requirement_key' => $key,
            'received' => $received,
        ]);
        syncPhysicalDocsCompletion($pdo, $enrollmentId, $enrollment, $catalog);
        $enrollment = loadEnrollmentForPhysicalDocs($pdo, $enrollmentId) ?? $enrollment;
        echo json_encode(buildPhysicalDocsResponse($pdo, $enrollmentId, $enrollment, $catalog));
        exit;
    }

    if ($action === 'mark_complete' || $action === 'mark_enrolled') {
        // Confirms the physical-document checklist is finished. Does NOT
        // change enrollments.status — the student is already enrolled once
        // the registrar approved the application.
        $check = buildPhysicalDocsResponse($pdo, $enrollmentId, $enrollment, $catalog);
        if (!$check['allRequiredChecked']) {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error' => 'requirements_incomplete',
                'details' => ['missing' => $check['missingRequired']],
            ]);
            exit;
        }
        if (columnExists($pdo, 'enrollments', 'physical_docs_completed_at')) {
            $pdo->prepare(
                'UPDATE enrollments SET physical_docs_completed_at = COALESCE(physical_docs_completed_at, NOW()) WHERE id = :id'
            )->execute([':id' => $enrollmentId]);
        }
        appLogEvent($pdo, 'physical_docs_complete', 'registrar', 'success', $actorId, 'enrollment', (string)$enrollmentId);
        $enrollment = loadEnrollmentForPhysicalDocs($pdo, $enrollmentId) ?? $enrollment;
        echo json_encode(buildPhysicalDocsResponse($pdo, $enrollmentId, $enrollment, $catalog));
        exit;
    }

    if ($action === 'send_reminder') {
        // Manual "Email reminder" button from the registrar UI. Delegates
        // to the shared helper so the email body, throttling, and logging
        // stay identical to the auto-sweep path below.
        $result = sendPhysicalDocsReminderEmail($pdo, $enrollmentId, $enrollment, $catalog, 'manual');
        if ($result['reason'] === 'no_missing') {
            echo json_encode([
                'success' => false,
                'error' => 'no_missing_requirements',
                'details' => ['hint' => 'All required physical documents are already checked.'],
            ]);
            exit;
        }
        if ($result['error'] === 'student_email_missing') {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'student_email_missing']);
            exit;
        }
        appLogEvent(
            $pdo, 'physical_docs_reminder', 'registrar', $result['sent'] ? 'success' : 'failed',
            $actorId, 'enrollment', (string)$enrollmentId,
            ['delivery' => $result['sent'] ? 'sent' : 'failed', 'missing_count' => $result['missingCount'], 'error' => $result['error']]
        );
        // Re-read so the response carries the bumped reminder timestamp.
        $enrollment = loadEnrollmentForPhysicalDocs($pdo, $enrollmentId) ?? $enrollment;
        $response = buildPhysicalDocsResponse($pdo, $enrollmentId, $enrollment, $catalog);
        $response['delivery'] = $result['sent'] ? 'sent' : 'failed';
        $response['missingCount'] = $result['missingCount'];
        $response['error'] = $result['sent'] ? null : ($result['error'] ?: 'failed_to_send');
        $response['success'] = $result['sent'];
        echo json_encode($response);
        exit;
    }

    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'unknown_action']);
} catch (Throwable $e) {
    appLogEvent($pdo, 'registrar_physical_docs', 'registrar', 'failed', $actorId, 'endpoint', 'physical-docs', [
        'reason' => 'server_error',
        'message' => $e->getMessage(),
    ]);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error']);
}
