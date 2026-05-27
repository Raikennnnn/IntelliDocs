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
$actorId = (int)($_SERVER['HTTP_X_USER_ID'] ?? 0);
if ($actorId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Missing user context']);
    exit;
}
$role = getUserRole($pdo, $actorId);
if (!in_array($role, ['registrar', 'admin'], true)) {
    appLogEvent($pdo, 'registrar_physical_docs', 'registrar', 'failed', $actorId, 'endpoint', 'physical-docs', ['reason' => 'access_denied']);
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

require_once __DIR__ . '/security_guard.php';
runAuthenticatedSecurityGuards($pdo, $actorId, 'registrar/physical-docs');

// -----------------------------------------------------------------------------
// Schema guard. The migration creates the table; without it we degrade to a
// 503 so the UI can render an explanatory banner rather than throwing.
// -----------------------------------------------------------------------------
if (!tableExists($pdo, 'enrollment_physical_docs')) {
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'error' => 'schema_not_migrated',
        'details' => ['hint' => 'Run database_migration_physical_docs.sql.'],
    ]);
    exit;
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
// -----------------------------------------------------------------------------
function physicalRequirementCatalog(string $enrollmentStatus): array
{
    // Each entry: key, label, required, transferee_only.
    // `required` controls whether the item must be checked before the
    // enrollment can be flipped to `enrolled`. `transferee_only` filters the
    // item out for non-transferee students.
    return [
        ['key' => 'psa_birth_certificate', 'label' => 'PSA Birth Certificate (original)', 'required' => true,  'transferee_only' => false],
        ['key' => 'psa_birth_photocopy_x2', 'label' => 'PSA Birth Certificate (2 photocopies)', 'required' => true, 'transferee_only' => false],
        ['key' => 'report_card_sf9', 'label' => 'Grade 10 Report Card (SF9)', 'required' => true,  'transferee_only' => false],
        ['key' => 'good_moral', 'label' => 'Good Moral Certificate', 'required' => true,  'transferee_only' => false],
        ['key' => 'form_137', 'label' => 'SF10 / Form 137', 'required' => true,  'transferee_only' => false],
        ['key' => 'photo_2x2', 'label' => '2x2 Picture (white background, original)', 'required' => true, 'transferee_only' => false],
        ['key' => 'photo_2x2_x2', 'label' => '2x2 Picture (2 pcs, white background)', 'required' => true,  'transferee_only' => false],
        ['key' => 'tor', 'label' => 'Transcript of Records (TOR)', 'required' => true, 'transferee_only' => true],
    ];
}

/**
 * Read the enrollment row + the cached enrollment_status flag for the
 * supplied `$enrollmentId`. Returns null when the row does not exist.
 *
 * @return array{user_id:int, status:string, enrollment_status_meta:string, enrollment_steps:string}|null
 */
function loadEnrollmentForPhysicalDocs(PDO $pdo, int $enrollmentId): ?array
{
    $stmt = $pdo->prepare('SELECT id, user_id, status, enrollment_steps FROM enrollments WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $enrollmentId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return null;
    return [
        'user_id' => (int)$row['user_id'],
        'status' => strtolower(trim((string)($row['status'] ?? ''))),
        'enrollment_steps' => (string)($row['enrollment_steps'] ?? '{}'),
    ];
}

/**
 * Decide whether the student is a transferee based on enrollment_steps.form_data.
 * Falls back to false when the marker is missing.
 */
function isTransfereeStudent(string $enrollmentStepsJson): bool
{
    $decoded = json_decode($enrollmentStepsJson, true);
    if (!is_array($decoded)) return false;
    $fd = $decoded['form_data'] ?? [];
    if (!is_array($fd)) return false;
    $status = strtolower(trim((string)($fd['enrollmentStatus'] ?? '')));
    return $status === 'transferee';
}

/**
 * Lazy-seed the checklist rows for an enrollment. Idempotent: existing rows
 * are left alone and only the missing requirements are inserted.
 */
function ensurePhysicalDocsRows(PDO $pdo, int $enrollmentId, array $catalog): void
{
    $existingStmt = $pdo->prepare('SELECT requirement_key FROM enrollment_physical_docs WHERE enrollment_id = :id');
    $existingStmt->execute([':id' => $enrollmentId]);
    $existing = array_flip(array_map('strval', $existingStmt->fetchAll(PDO::FETCH_COLUMN) ?: []));

    $insertStmt = $pdo->prepare(
        'INSERT INTO enrollment_physical_docs (enrollment_id, requirement_key, requirement_label, received)
         VALUES (:eid, :key, :label, 0)'
    );
    foreach ($catalog as $item) {
        if (isset($existing[$item['key']])) continue;
        $insertStmt->execute([
            ':eid' => $enrollmentId,
            ':key' => $item['key'],
            ':label' => $item['label'],
        ]);
    }
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

    return [
        'success' => true,
        'enrollmentId' => $enrollmentId,
        'enrollmentStatus' => $enrollment['status'],
        'items' => $items,
        'missingRequired' => $missingRequired,
        'allRequiredChecked' => $allRequiredChecked,
        'canMarkEnrolled' => $allRequiredChecked && $enrollment['status'] === 'approved',
    ];
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
        $isTransferee = isTransfereeStudent($enrollment['enrollment_steps']);
        $catalog = array_values(array_filter($rawCatalog, static fn ($e) => !$e['transferee_only'] || $isTransferee));

        ensurePhysicalDocsRows($pdo, $enrollmentId, $catalog);

        echo json_encode(buildPhysicalDocsResponse($pdo, $enrollmentId, $enrollment, $catalog));
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
    $isTransferee = isTransfereeStudent($enrollment['enrollment_steps']);
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
        echo json_encode(buildPhysicalDocsResponse($pdo, $enrollmentId, $enrollment, $catalog));
        exit;
    }

    if ($action === 'mark_enrolled') {
        // Server-side guard: refuse to flip status when any required item is
        // unchecked, even if the client somehow lets the button through.
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
        if ($enrollment['status'] === 'enrolled') {
            // Already enrolled — no-op, but return 200 with the current state
            // so the client UI converges.
            echo json_encode($check);
            exit;
        }
        $stmt = $pdo->prepare("UPDATE enrollments SET status = 'enrolled', updated_at = NOW() WHERE id = :id");
        $stmt->execute([':id' => $enrollmentId]);
        appLogEvent($pdo, 'mark_enrolled', 'registrar', 'success', $actorId, 'enrollment', (string)$enrollmentId);
        // Re-read the enrollment so the response carries the new status.
        $enrollment = loadEnrollmentForPhysicalDocs($pdo, $enrollmentId) ?? $enrollment;
        echo json_encode(buildPhysicalDocsResponse($pdo, $enrollmentId, $enrollment, $catalog));
        exit;
    }

    if ($action === 'send_reminder') {
        $resolved = buildPhysicalDocsResponse($pdo, $enrollmentId, $enrollment, $catalog);
        $missing = $resolved['missingRequired'];
        if (empty($missing)) {
            echo json_encode([
                'success' => false,
                'error' => 'no_missing_requirements',
                'details' => ['hint' => 'All required physical documents are already checked.'],
            ]);
            exit;
        }
        // Look up the student's email + first name for the body.
        $userStmt = $pdo->prepare(
            'SELECT email, full_name, ' .
            (columnExists($pdo, 'users', 'first_name') ? 'first_name' : "'' AS first_name") .
            ' FROM users WHERE id = :id LIMIT 1'
        );
        $userStmt->execute([':id' => $enrollment['user_id']]);
        $user = $userStmt->fetch(PDO::FETCH_ASSOC);
        if (!$user || trim((string)($user['email'] ?? '')) === '') {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'student_email_missing']);
            exit;
        }

        $firstName = trim((string)($user['first_name'] ?? '')) ?: trim((string)($user['full_name'] ?? '')) ?: 'there';
        $bullets = '';
        foreach ($missing as $label) {
            $bullets .= '  - ' . $label . "\n";
        }
        $body = "Hi {$firstName},\n\n"
            . "This is a reminder from the Nuestra Senora De Guia Academy registrar's office. "
            . "We have approved your enrollment, but the following physical documents are still missing:\n\n"
            . $bullets
            . "\nPlease bring them to the registrar's office at your earliest convenience to complete your enrollment.\n\n"
            . "Thank you,\n"
            . "Nuestra Senora De Guia Academy\n";
        $subject = 'Reminder — Missing physical enrollment documents';

        $sent = false;
        $deliveryError = null;
        if (file_exists(__DIR__ . '/mailer.php')) {
            require_once __DIR__ . '/mailer.php';
            try {
                if (function_exists('queueEmail')) {
                    $queueId = queueEmail($pdo, (string)$user['email'], $subject, $body);
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

        appLogEvent(
            $pdo, 'physical_docs_reminder', 'registrar', $sent ? 'success' : 'failed',
            $actorId, 'enrollment', (string)$enrollmentId,
            ['delivery' => $sent ? 'sent' : 'failed', 'missing_count' => count($missing), 'error' => $deliveryError]
        );

        echo json_encode([
            'success' => $sent,
            'delivery' => $sent ? 'sent' : 'failed',
            'missingCount' => count($missing),
            'error' => $sent ? null : ($deliveryError ?: 'failed_to_send'),
        ]);
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
