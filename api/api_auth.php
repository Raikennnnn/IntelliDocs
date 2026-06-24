<?php
declare(strict_types=1);

/**
 * Resolve authenticated actor for protected API endpoints.
 *
 * @return array{id: int, role: string, session_id: int|null}
 */
function apiRequireActor(PDO $pdo, string $endpointLabel, bool $touchActivity = true): array
{
    require_once __DIR__ . '/session_token.php';
    return requireAuthenticatedActor($pdo, $endpointLabel, $touchActivity);
}

/**
 * @param list<'admin'|'registrar'|'student'> $allowedRoles
 * @return array{id: int, role: string, session_id: int|null}
 */
function apiRequireRoles(PDO $pdo, string $endpointLabel, array $allowedRoles, bool $touchActivity = true): array
{
    require_once __DIR__ . '/user_role.php';
    $actor = apiRequireActor($pdo, $endpointLabel, $touchActivity);
    $userId = (int)$actor['id'];
    $role = getUserRole($pdo, $userId);

    if (roleTablesExist($pdo)) {
        if (in_array('admin', $allowedRoles, true) && userIsAdmin($pdo, $userId)) {
            $actor['role'] = 'admin';
            return $actor;
        }
        if (in_array('registrar', $allowedRoles, true) && userIsRegistrar($pdo, $userId)) {
            $actor['role'] = 'registrar';
            return $actor;
        }
        if (in_array('student', $allowedRoles, true) && $role === 'student') {
            $actor['role'] = 'student';
            return $actor;
        }
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Access denied', 'code' => 'forbidden']);
        exit;
    }

    $actor['role'] = $role;
    if (!in_array($role, $allowedRoles, true)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Access denied', 'code' => 'forbidden']);
        exit;
    }

    return $actor;
}

/** @return array{id: int, role: string, session_id: int|null} */
function apiRequireAdmin(PDO $pdo, string $endpointLabel): array
{
    return apiRequireRoles($pdo, $endpointLabel, ['admin']);
}
