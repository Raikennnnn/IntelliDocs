<?php
/**
 * GET /api/student/physical-docs
 *
 * Returns the physical-document checklist for the *currently-authenticated
 * student*. It's the read-only student-facing companion to
 * api/registrar_physical_docs.php — same canonical catalog, same logical
 * shape, but the student cannot toggle items and can only ever see
 * their own enrollment.
 *
 * Kept self-contained on purpose: we don't include
 * registrar_physical_docs.php (which has a registrar-only auth gate that
 * would 403 a student) — instead we duplicate the small catalog block
 * here and reuse only the `enrollment_physical_docs` table that the
 * registrar endpoint already creates.
 *
 * Response shape:
 *   {
 *     success: true,
 *     enrollmentId: int|null,
 *     enrollmentStatus: "approved"|"enrolled"|"pending"|"under_review"|"rejected"|null,
 *     totalRequired: int,
 *     receivedCount: int,
 *     missingCount: int,
 *     items: Array<{
 *       key, label, required, transfereeOnly, received, receivedAt
 *     }>
 *   }
 */
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/user_role.php';
require_once __DIR__ . '/physical_docs_helpers.php';
header('Content-Type: application/json');

// -----------------------------------------------------------------------------
// Tiny shared helpers (duplicated from registrar_physical_docs.php on
// purpose — see file header). Guarded with function_exists so loading
// both files in the same request never redeclares them.
// -----------------------------------------------------------------------------
if (!function_exists('tableExists')) {
    function tableExists(PDO $pdo, string $table): bool
    {
        try {
            $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1');
            $stmt->execute([':t' => $table]);
            return (bool)$stmt->fetchColumn();
        } catch (Throwable $e) {
            return false;
        }
    }
}
if (!function_exists('columnExists')) {
    function columnExists(PDO $pdo, string $table, string $column): bool
    {
        try {
            $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c LIMIT 1');
            $stmt->execute([':t' => $table, ':c' => $column]);
            return (bool)$stmt->fetchColumn();
        } catch (Throwable $e) {
            return false;
        }
    }
}

// -----------------------------------------------------------------------------
// Method + auth gate
// -----------------------------------------------------------------------------
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/permission_guard.php';
$actor = apiRequireActor($pdo, 'student/physical-docs');
$userId = $actor['id'];
if ($actor['role'] !== 'student') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

requireActorPermission($pdo, $actor, 'viewApplicationStatus', false);

// -----------------------------------------------------------------------------
// Canonical requirement catalog. MUST stay in sync with
// physicalRequirementCatalog() in api/physical_docs_helpers.php.
// -----------------------------------------------------------------------------

function studentIsTransfereeFromSteps(string $enrollmentStepsJson): bool
{
    return isTransfereeFromEnrollmentSteps($enrollmentStepsJson);
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
try {
    // Find the student's latest enrollment. We don't enforce a status
    // filter here — a pending/rejected student still gets a friendly 200
    // back so the UI can show "Available once your application is approved".
    $enrStmt = $pdo->prepare(
        'SELECT id, status, enrollment_steps
           FROM enrollments
          WHERE user_id = :uid
          ORDER BY id DESC
          LIMIT 1'
    );
    $enrStmt->execute([':uid' => $userId]);
    $enr = $enrStmt->fetch(PDO::FETCH_ASSOC);

    if (!$enr) {
        echo json_encode([
            'success' => true,
            'enrollmentId' => null,
            'enrollmentStatus' => null,
            'totalRequired' => 0,
            'receivedCount' => 0,
            'missingCount' => 0,
            'items' => [],
        ]);
        exit;
    }

    $enrollmentId = (int)$enr['id'];
    $status = strtolower(trim((string)($enr['status'] ?? '')));
    $stepsJson = (string)($enr['enrollment_steps'] ?? '{}');

    // Only approved / enrolled enrollments have a meaningful checklist.
    if (!in_array($status, ['approved', 'enrolled'], true)) {
        echo json_encode([
            'success' => true,
            'enrollmentId' => $enrollmentId,
            'enrollmentStatus' => $status,
            'totalRequired' => 0,
            'receivedCount' => 0,
            'missingCount' => 0,
            'items' => [],
        ]);
        exit;
    }

    // Build the requirement catalog same way the registrar endpoint does —
    // full list minus transferee-only entries when not a transferee.
    $catalog = physicalDocsCatalogForEnrollment($stepsJson, $status);

    ensurePhysicalDocsRows($pdo, $enrollmentId, $catalog);
    carryForwardPhysicalDocsForEnrollment($pdo, $enrollmentId, $enr);

    // Read the existing checklist rows the registrar has toggled.
    $rowsByKey = [];
    if (tableExists($pdo, 'enrollment_physical_docs')) {
        $rowsStmt = $pdo->prepare(
            'SELECT requirement_key, received, received_at
               FROM enrollment_physical_docs
              WHERE enrollment_id = :id'
        );
        $rowsStmt->execute([':id' => $enrollmentId]);
        foreach ($rowsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $r) {
            $rowsByKey[(string)$r['requirement_key']] = $r;
        }
    }

    $items = [];
    $totalRequired = 0;
    $receivedCount = 0;
    foreach ($catalog as $entry) {
        $row = $rowsByKey[$entry['key']] ?? null;
        $received = $row ? (int)$row['received'] === 1 : false;
        if ($entry['required']) {
            $totalRequired++;
            if ($received) $receivedCount++;
        }
        $items[] = [
            'key' => $entry['key'],
            'label' => $entry['label'],
            'required' => (bool)$entry['required'],
            'transfereeOnly' => (bool)$entry['transferee_only'],
            'received' => $received,
            'receivedAt' => $row['received_at'] ?? null,
        ];
    }

    echo json_encode([
        'success' => true,
        'enrollmentId' => $enrollmentId,
        'enrollmentStatus' => $status,
        'totalRequired' => $totalRequired,
        'receivedCount' => $receivedCount,
        'missingCount' => max(0, $totalRequired - $receivedCount),
        'items' => $items,
    ]);
    exit;
} catch (Throwable $e) {
    if (function_exists('appLogEvent')) {
        appLogEvent($pdo, 'student_physical_docs', 'student', 'failed', $userId, 'endpoint', 'student/physical-docs', [
            'reason' => 'server_error',
            'message' => $e->getMessage(),
        ]);
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error']);
}
