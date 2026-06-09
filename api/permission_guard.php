<?php
declare(strict_types=1);

require_once __DIR__ . '/system_settings_helpers.php';

function normalizePermissionRole(string $role): string
{
    $r = strtolower(trim($role));

    return $r === 'applicant' ? 'student' : $r;
}

/** @return array<string, bool> */
function getPermissionsForRole(PDO $pdo, string $role): array
{
    $role = normalizePermissionRole($role);
    $perms = getRolePermissions($pdo);

    return is_array($perms[$role] ?? null) ? $perms[$role] : [];
}

function roleHasPermission(PDO $pdo, string $role, string $permissionKey): bool
{
    $role = normalizePermissionRole($role);
    $perms = getPermissionsForRole($pdo, $role);

    return (bool)($perms[$permissionKey] ?? false);
}

function actorHasPermission(PDO $pdo, array $actor, string $permissionKey, bool $adminBypass = true): bool
{
    $role = normalizePermissionRole((string)($actor['role'] ?? ''));
    if ($adminBypass && $role === 'admin') {
        return true;
    }

    return roleHasPermission($pdo, $role, $permissionKey);
}

function denyRolePermission(string $permissionKey): never
{
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'Permission denied',
        'permission' => $permissionKey,
    ]);
    exit;
}

/**
 * @param bool $adminBypass When true, admins skip registrar/student permission checks.
 */
function requireRolePermission(PDO $pdo, string $role, string $permissionKey, bool $adminBypass = true): void
{
    if (!actorHasPermission($pdo, ['role' => $role], $permissionKey, $adminBypass)) {
        denyRolePermission($permissionKey);
    }
}

function requireActorPermission(PDO $pdo, array $actor, string $permissionKey, bool $adminBypass = true): void
{
    if (!actorHasPermission($pdo, $actor, $permissionKey, $adminBypass)) {
        denyRolePermission($permissionKey);
    }
}

/**
 * @param string[] $permissionKeys
 */
function requireActorAnyPermission(PDO $pdo, array $actor, array $permissionKeys, bool $adminBypass = false): void
{
    $role = normalizePermissionRole((string)($actor['role'] ?? ''));
    if ($adminBypass && $role === 'admin') {
        return;
    }
    foreach ($permissionKeys as $key) {
        if (roleHasPermission($pdo, $role, $key)) {
            return;
        }
    }
    denyRolePermission((string)($permissionKeys[0] ?? 'access'));
}
