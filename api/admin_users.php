<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}
require_once __DIR__ . '/logging.php';
require_once __DIR__ . '/user_role.php';

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if (!in_array($method, ['GET', 'DELETE', 'PUT'], true)) {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

function columnExists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1');
    $stmt->execute([':table' => $table, ':column' => $column]);
    return (bool)$stmt->fetchColumn();
}

if (!function_exists('tableExists')) {
    function tableExists(PDO $pdo, string $table): bool
    {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1');
        $stmt->execute([':t' => $table]);
        return (bool)$stmt->fetchColumn();
    }
}

function ensureUserStatusColumn(PDO $pdo): void
{
    if (!columnExists($pdo, 'users', 'status')) {
        // Keep it tolerant: some DBs may not have status field.
        $pdo->exec("ALTER TABLE users ADD COLUMN status VARCHAR(20) NULL DEFAULT 'active'");
    }
}

function toDbRole(string $role): ?string
{
    $r = strtolower(trim($role));
    if ($r === 'admin') return 'admin';
    if ($r === 'registrar') return 'registrar';
    if ($r === 'student') return 'student';
    // UI can send "Admin"/"Registrar"/"Student"
    if ($r === 'administrator') return 'admin';
    return null;
}

function toDbStatus(string $status): ?string
{
    $s = strtolower(trim($status));
    if ($s === 'active') return 'active';
    if ($s === 'inactive') return 'inactive';
    return null;
}

require_once __DIR__ . '/api_auth.php';
require_once __DIR__ . '/permission_guard.php';
$actor = apiRequireActor($pdo, 'admin/users');
$actorId = $actor['id'];
$actorRole = $actor['role'];
if ($actorRole !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

requireActorPermission($pdo, $actor, 'manageUsers', false);

try {
    if ($method === 'DELETE') {
        $rawBody = file_get_contents('php://input');
        $payload = json_decode($rawBody ?: '{}', true);
        $targetUserId = (int)($payload['id'] ?? 0);
        if ($targetUserId <= 0) {
            appLogEvent($pdo, 'admin_delete_user', 'admin', 'failed', $actorId, 'user', null, ['reason' => 'missing_target_id']);
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'User id is required']);
            exit;
        }
        if ($targetUserId === $actorId) {
            appLogEvent($pdo, 'admin_delete_user', 'admin', 'failed', $actorId, 'user', (string)$targetUserId, ['reason' => 'self_delete_blocked']);
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'You cannot delete your own account']);
            exit;
        }

        $targetStmt = $pdo->prepare('SELECT id, full_name, email FROM users WHERE id = :id LIMIT 1');
        $targetStmt->execute([':id' => $targetUserId]);
        $target = $targetStmt->fetch();
        if (!$target) {
            appLogEvent($pdo, 'admin_delete_user', 'admin', 'failed', $actorId, 'user', (string)$targetUserId, ['reason' => 'not_found']);
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'User not found']);
            exit;
        }

        $targetRole = getUserRole($pdo, $targetUserId);
        if ($targetRole === 'admin') {
            $adminCount = (int)$pdo->query('SELECT COUNT(*) FROM admin_users')->fetchColumn();
            if ($adminCount <= 1) {
                appLogEvent($pdo, 'admin_delete_user', 'admin', 'failed', $actorId, 'user', (string)$targetUserId, ['reason' => 'last_admin_blocked']);
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Cannot delete the last admin account']);
                exit;
            }
        }

        $delStmt = $pdo->prepare('DELETE FROM users WHERE id = :id LIMIT 1');
        $delStmt->execute([':id' => $targetUserId]);
        appLogEvent($pdo, 'admin_delete_user', 'admin', 'success', $actorId, 'user', (string)$targetUserId, [
            'email' => (string)$target['email'],
            'name' => (string)$target['full_name'],
            'role' => $targetRole,
        ]);
        echo json_encode(['success' => true, 'message' => 'User deleted successfully']);
        exit;
    }

    if ($method === 'PUT') {
        $rawBody = file_get_contents('php://input') ?: '';
        $payload = json_decode($rawBody !== '' ? $rawBody : '{}', true);
        if (!is_array($payload)) {
            // Fallback: some clients may send form-encoded bodies on PUT.
            $payload = [];
            parse_str($rawBody, $payload);
            if (!is_array($payload)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Invalid request payload']);
                exit;
            }
        }

        $targetUserId = (int)($payload['id'] ?? 0);
        $fullName = trim((string)($payload['name'] ?? ''));
        $email = strtolower(trim((string)($payload['email'] ?? '')));
        $role = toDbRole((string)($payload['role'] ?? ''));
        $status = toDbStatus((string)($payload['status'] ?? ''));

        if ($targetUserId <= 0) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'User id is required']);
            exit;
        }
        if ($fullName === '' || $email === '' || $role === null) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'name, email, and role are required']);
            exit;
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Invalid email address']);
            exit;
        }

        $targetStmt = $pdo->prepare('SELECT id, full_name, email FROM users WHERE id = :id LIMIT 1');
        $targetStmt->execute([':id' => $targetUserId]);
        $target = $targetStmt->fetch();
        if (!$target) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'User not found']);
            exit;
        }

        // Prevent duplicate email (excluding target).
        $dupStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email AND id <> :id LIMIT 1');
        $dupStmt->execute([':email' => $email, ':id' => $targetUserId]);
        if ($dupStmt->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Email already exists']);
            exit;
        }

        $currentRole = getUserRole($pdo, $targetUserId);
        $updatingAdminAway = ($currentRole === 'admin' && $role !== 'admin');
        $deactivatingAdmin = ($currentRole === 'admin' && $status === 'inactive');
        if (($updatingAdminAway || $deactivatingAdmin) && $currentRole === 'admin') {
            $adminCount = (int)$pdo->query('SELECT COUNT(*) FROM admin_users')->fetchColumn();
            if ($adminCount <= 1) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Cannot modify the last admin account']);
                exit;
            }
        }

        $setParts = ['full_name = :full_name', 'email = :email'];
        $params = [
            ':full_name' => $fullName,
            ':email' => $email,
            ':id' => $targetUserId,
        ];

        if ($status !== null) {
            ensureUserStatusColumn($pdo);
            $setParts[] = 'status = :status';
            $params[':status'] = $status;
        }

        $sql = 'UPDATE users SET ' . implode(', ', $setParts) . ' WHERE id = :id LIMIT 1';
        $upd = $pdo->prepare($sql);
        $upd->execute($params);

        setUserRole($pdo, $targetUserId, $role);

        appLogEvent($pdo, 'admin_update_user', 'admin', 'success', $actorId, 'user', (string)$targetUserId, [
            'email' => $email,
            'name' => $fullName,
            'role' => $role,
            'status' => $status,
        ]);

        echo json_encode(['success' => true, 'message' => 'User updated successfully']);
        exit;
    }

    $hasStatus = columnExists($pdo, 'users', 'status');
    ensureRoleTables($pdo);
    ensureLoggingTables($pdo);
    ensureUserLastLoginColumn($pdo);
    $roleCase = "CASE WHEN au_r.user_id IS NOT NULL THEN 'admin' WHEN ru_r.user_id IS NOT NULL THEN 'registrar' ELSE 'student' END";
    $lastLoginExpr = userLastLoginSelectSql('u');

    // Optional credential / structured-name columns. Older snapshots may
    // not have them; columnExists() guards every reference so the SELECT
    // stays valid on un-migrated environments.
    $hasFirstName = columnExists($pdo, 'users', 'first_name');
    $hasLastName = columnExists($pdo, 'users', 'last_name');
    $hasUsername = columnExists($pdo, 'users', 'username');
    $selFirstName = $hasFirstName ? 'u.first_name' : "'' AS first_name";
    $selLastName = $hasLastName ? 'u.last_name' : "'' AS last_name";
    $selUsername = $hasUsername ? 'u.username' : "'' AS username";

    // Student name fallback chain. For each user we pull the most recent
    // enrollment row's form_data via a correlated subquery — simpler and
    // more portable than a derived-table JOIN, and it sidesteps
    // ONLY_FULL_GROUP_BY pitfalls on stricter MySQL builds. The column is
    // selected only when the enrollments table exists.
    $hasEnrollments = tableExists($pdo, 'enrollments');
    $enrollmentNameSelect = $hasEnrollments
        ? "(SELECT e2.enrollment_steps
            FROM enrollments e2
            WHERE e2.user_id = u.id
            ORDER BY e2.id DESC
            LIMIT 1) AS enrollment_form_json"
        : "'' AS enrollment_form_json";

    $rows = $pdo->query(
        $hasStatus
            ? "SELECT u.id, u.full_name, u.email, u.status, u.created_at, {$roleCase} AS role,
                      {$selFirstName}, {$selLastName}, {$selUsername},
                      {$enrollmentNameSelect},
                      {$lastLoginExpr} AS last_login_at
               FROM users u
               LEFT JOIN admin_users au_r ON au_r.user_id = u.id
               LEFT JOIN registrar_users ru_r ON ru_r.user_id = u.id
               LEFT JOIN student_users su_r ON su_r.user_id = u.id
               ORDER BY u.created_at DESC, u.id DESC"
            : "SELECT u.id, u.full_name, u.email, u.created_at, {$roleCase} AS role,
                      {$selFirstName}, {$selLastName}, {$selUsername},
                      {$enrollmentNameSelect},
                      {$lastLoginExpr} AS last_login_at
               FROM users u
               LEFT JOIN admin_users au_r ON au_r.user_id = u.id
               LEFT JOIN registrar_users ru_r ON ru_r.user_id = u.id
               LEFT JOIN student_users su_r ON su_r.user_id = u.id
               ORDER BY u.created_at DESC, u.id DESC"
    )->fetchAll() ?: [];

    $users = array_map(static function (array $row) use ($hasStatus): array {
        $role = strtolower((string)($row['role'] ?? 'student'));
        $displayRole = $role === 'admin' ? 'Admin' : ($role === 'registrar' ? 'Registrar' : 'Student');
        $statusRaw = $hasStatus ? strtolower((string)($row['status'] ?? 'active')) : 'active';
        $displayStatus = $statusRaw === 'inactive' ? 'Inactive' : 'Active';

        // Display-name resolution. Order:
        //   1. users.full_name when populated (legacy / explicitly set)
        //   2. first_name + last_name from users (set by the credentials
        //      flow at registrar approve time, or backfilled at enrollment)
        //   3. enrollment_steps.form_data givenName + lastName (the field
        //      names the React enrollment form actually writes)
        //   4. users.username when present (sensible for admin/registrar)
        //   5. empty string (renders the email-only row gracefully).
        $fullName = trim((string)($row['full_name'] ?? ''));
        if ($fullName === '') {
            $first = trim((string)($row['first_name'] ?? ''));
            $last = trim((string)($row['last_name'] ?? ''));
            if ($first !== '' || $last !== '') {
                $fullName = trim($first . ' ' . $last);
            }
        }
        if ($fullName === '' && $role === 'student' && !empty($row['enrollment_form_json'])) {
            $decoded = json_decode((string)$row['enrollment_form_json'], true);
            if (is_array($decoded) && isset($decoded['form_data']) && is_array($decoded['form_data'])) {
                $fd = $decoded['form_data'];
                $first = trim((string)($fd['givenName'] ?? ''));
                $last = trim((string)($fd['lastName'] ?? ''));
                if ($first !== '' || $last !== '') {
                    $fullName = trim($first . ' ' . $last);
                }
            }
        }
        if ($fullName === '') {
            $username = trim((string)($row['username'] ?? ''));
            if ($username !== '') {
                $fullName = $username;
            }
        }

        return [
            'id' => (string)($row['id'] ?? ''),
            'name' => $fullName,
            'email' => (string)($row['email'] ?? ''),
            'role' => $displayRole,
            'status' => $displayStatus,
            'lastLogin' => formatUserLastLogin(isset($row['last_login_at']) ? (string)$row['last_login_at'] : null),
            'createdDate' => (string)($row['created_at'] ?? ''),
        ];
    }, $rows);

    echo json_encode([
        'success' => true,
        'users' => $users,
    ]);
    appLogEvent($pdo, 'admin_users_list', 'admin', 'success', $actorId, 'endpoint', 'admin/users', ['count' => count($users)]);
} catch (Throwable $e) {
    appLogEvent($pdo, $method === 'DELETE' ? 'admin_delete_user' : 'admin_users_list', 'admin', 'failed', $actorId, 'endpoint', 'admin/users', ['reason' => 'server_error', 'message' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $method === 'DELETE' ? 'Failed to delete user' : 'Failed to load users']);
}
