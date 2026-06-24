<?php
declare(strict_types=1);

/**
 * Role tables list who has each role; username is copied from users so phpMyAdmin is easy to read.
 */

function columnExistsInTable(PDO $pdo, string $table, string $column): bool
{
    try {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c LIMIT 1');
        $stmt->execute([':t' => $table, ':c' => $column]);
        return (bool)$stmt->fetchColumn();
    } catch (Throwable $e) {
        return false;
    }
}

function userRoleColumnExists(PDO $pdo): bool
{
    try {
        $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c LIMIT 1');
        $stmt->execute([':t' => 'users', ':c' => 'role']);
        return (bool)$stmt->fetchColumn();
    } catch (Throwable $e) {
        return false;
    }
}

function roleTablesExist(PDO $pdo): bool
{
    try {
        $stmt = $pdo->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'admin_users' LIMIT 1");
        $stmt->execute();
        return (bool)$stmt->fetchColumn();
    } catch (Throwable $e) {
        return false;
    }
}

function ensureRoleTables(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS admin_users (
            user_id INT NOT NULL PRIMARY KEY,
            username VARCHAR(64) NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_admin_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS registrar_users (
            user_id INT NOT NULL PRIMARY KEY,
            username VARCHAR(64) NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_registrar_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS student_users (
            user_id INT NOT NULL PRIMARY KEY,
            username VARCHAR(64) NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_student_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

/** Add username to older role tables that only had user_id + created_at. */
function ensureRoleTablesUsernameColumn(PDO $pdo): void
{
    foreach (['admin_users', 'registrar_users', 'student_users'] as $table) {
        if (!columnExistsInTable($pdo, $table, 'username')) {
            try {
                $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN username VARCHAR(64) NOT NULL DEFAULT '' AFTER user_id");
            } catch (Throwable $e) {
                // ignore
            }
        }
    }
}

function syncRoleTableUsernamesFromUsers(PDO $pdo): void
{
    if (!roleTablesExist($pdo)) {
        return;
    }
    foreach (['admin_users', 'registrar_users', 'student_users'] as $table) {
        if (!columnExistsInTable($pdo, $table, 'username')) {
            continue;
        }
        try {
            $pdo->exec("
                UPDATE `{$table}` t
                INNER JOIN users u ON u.id = t.user_id
                SET t.username = u.username
            ");
        } catch (Throwable $e) {
            // ignore
        }
    }
}

/**
 * @return 'admin'|'registrar'|'student'|null null when user is not in any role table
 */
function getUserRoleFromRoleTables(PDO $pdo, int $userId): ?string
{
    if ($userId <= 0 || !roleTablesExist($pdo)) {
        return null;
    }
    $stmt = $pdo->prepare("
        SELECT
            au.user_id AS admin_id,
            ru.user_id AS registrar_id,
            su.user_id AS student_id
        FROM users u
        LEFT JOIN admin_users au ON au.user_id = u.id
        LEFT JOIN registrar_users ru ON ru.user_id = u.id
        LEFT JOIN student_users su ON su.user_id = u.id
        WHERE u.id = :id
        LIMIT 1
    ");
    $stmt->execute([':id' => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return null;
    }
    if (!empty($row['admin_id'])) {
        return 'admin';
    }
    if (!empty($row['registrar_id'])) {
        return 'registrar';
    }
    if (!empty($row['student_id'])) {
        return 'student';
    }

    return null;
}

/**
 * @return 'admin'|'registrar'|'student'
 */
function getUserRole(PDO $pdo, int $userId): string
{
    if ($userId <= 0) {
        return 'student';
    }
    if (roleTablesExist($pdo)) {
        $tableRole = getUserRoleFromRoleTables($pdo, $userId);
        if ($tableRole !== null) {
            // Role tables are authoritative — never promote via legacy users.role.
            return $tableRole;
        }
        if (userRoleColumnExists($pdo)) {
            $legacyStmt = $pdo->prepare('SELECT LOWER(TRIM(COALESCE(role, \'\'))) FROM users WHERE id = :id LIMIT 1');
            $legacyStmt->execute([':id' => $userId]);
            $legacy = strtolower(trim((string)($legacyStmt->fetchColumn() ?: '')));
            if (in_array($legacy, ['admin', 'registrar', 'student'], true)) {
                return $legacy;
            }
        }

        return 'student';
    }
    if (userRoleColumnExists($pdo)) {
        $stmt = $pdo->prepare('SELECT role FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $r = strtolower(trim((string)($row['role'] ?? '')));
        if ($r === '' || $r === 'null') {
            return 'student';
        }

        return in_array($r, ['admin', 'registrar', 'student'], true) ? $r : 'student';
    }

    return 'student';
}

/** True when the user may manage school-year settings (admin portal). */
function userIsAdmin(PDO $pdo, int $userId): bool
{
    return getUserRole($pdo, $userId) === 'admin';
}

/**
 * Student accounts (enrollment portal) must not be promoted to staff roles.
 */
function studentRolePromotionBlocked(string $currentRole, string $newRole): bool
{
    $current = strtolower(trim($currentRole));
    $new = strtolower(trim($newRole));

    return $current === 'student' && $new !== 'student';
}

function rejectStudentRolePromotion(): void
{
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'Student accounts cannot be promoted to admin or registrar. Create a separate staff account instead.',
        'code' => 'student_role_locked',
    ]);
    exit;
}

/**
 * @param 'admin'|'registrar'|'student' $role
 */
function setUserRole(PDO $pdo, int $userId, string $role): void
{
    $role = strtolower(trim($role));
    if (!in_array($role, ['admin', 'registrar', 'student'], true)) {
        $role = 'student';
    }
    // DDL inside a transaction causes MySQL to implicit-commit — only run when missing.
    if (!roleTablesExist($pdo)) {
        ensureRoleTables($pdo);
    }
    ensureRoleTablesUsernameColumn($pdo);
    $unameStmt = $pdo->prepare('SELECT username FROM users WHERE id = :id LIMIT 1');
    $unameStmt->execute([':id' => $userId]);
    $username = (string)($unameStmt->fetchColumn() ?: '');

    $pdo->prepare('DELETE FROM admin_users WHERE user_id = :id')->execute([':id' => $userId]);
    $pdo->prepare('DELETE FROM registrar_users WHERE user_id = :id')->execute([':id' => $userId]);
    $pdo->prepare('DELETE FROM student_users WHERE user_id = :id')->execute([':id' => $userId]);
    if ($role === 'admin') {
        $pdo->prepare('INSERT INTO admin_users (user_id, username) VALUES (:id, :username)')->execute([
            ':id' => $userId,
            ':username' => $username,
        ]);
    } elseif ($role === 'registrar') {
        $pdo->prepare('INSERT INTO registrar_users (user_id, username) VALUES (:id, :username)')->execute([
            ':id' => $userId,
            ':username' => $username,
        ]);
    } else {
        $pdo->prepare('INSERT INTO student_users (user_id, username) VALUES (:id, :username)')->execute([
            ':id' => $userId,
            ':username' => $username,
        ]);
    }
}

/**
 * SQL fragment: resolved role for users table alias u (requires LEFT JOINs to admin_users, registrar_users, student_users as au_r, ru_r, su_r).
 */
function sqlUserResolvedRoleExpression(string $userAlias = 'u', string $au = 'au_r', string $ru = 'ru_r', string $su = 'su_r'): string
{
    return "(CASE
        WHEN {$au}.user_id IS NOT NULL THEN 'admin'
        WHEN {$ru}.user_id IS NOT NULL THEN 'registrar'
        WHEN {$su}.user_id IS NOT NULL THEN 'student'
        ELSE 'student' END)";
}

/**
 * Insert user row (no role on users — roles live in admin_users / registrar_users / student_users).
 *
 * @param 'admin'|'registrar'|'student' $role
 */
function insertUserWithRole(
    PDO $pdo,
    string $username,
    string $email,
    string $passwordHash,
    string $fullName,
    string $role
): int {
    $stmt = $pdo->prepare(
        'INSERT INTO users (username, email, password, full_name) VALUES (:username, :email, :password, :full_name)'
    );
    $stmt->execute([
        ':username' => $username,
        ':email' => $email,
        ':password' => $passwordHash,
        ':full_name' => $fullName,
    ]);
    $id = (int)$pdo->lastInsertId();
    if (roleTablesExist($pdo)) {
        setUserRole($pdo, $id, $role);
    }

    return $id;
}

/**
 * Copy users.role into role tables, then drop users.role so `users` stays clean.
 */
function migrateUsersRoleToSplitTables(PDO $pdo): void
{
    if (!userRoleColumnExists($pdo)) {
        return;
    }
    ensureRoleTables($pdo);
    ensureRoleTablesUsernameColumn($pdo);
    try {
        $pdo->beginTransaction();
        $pdo->exec('UPDATE users SET role = \'student\' WHERE role IS NULL OR role = \'\' OR TRIM(COALESCE(role, \'\')) = \'\'');
        $pdo->exec("UPDATE users SET role = 'admin' WHERE LOWER(TRIM(role)) IN ('admin', 'administrator')");
        $pdo->exec("UPDATE users SET role = 'registrar' WHERE LOWER(TRIM(role)) = 'registrar'");
        $pdo->exec("UPDATE users SET role = 'student' WHERE LOWER(TRIM(role)) IN ('student', 'applicant')");
        $pdo->exec("UPDATE users SET role = 'registrar' WHERE LOWER(TRIM(role)) = 'teacher'");
        $pdo->exec("UPDATE users SET role = 'admin' WHERE LOWER(TRIM(role)) = 'principal'");
        $pdo->exec("UPDATE users SET role = 'student' WHERE LOWER(TRIM(role)) NOT IN ('admin', 'registrar', 'student')");

        $pdo->exec('DELETE FROM admin_users');
        $pdo->exec('DELETE FROM registrar_users');
        $pdo->exec('DELETE FROM student_users');

        $pdo->exec("
            INSERT INTO admin_users (user_id, username)
            SELECT u.id, u.username FROM users u WHERE LOWER(TRIM(u.role)) = 'admin'
        ");
        $pdo->exec("
            INSERT INTO registrar_users (user_id, username)
            SELECT u.id, u.username FROM users u WHERE LOWER(TRIM(u.role)) = 'registrar'
        ");
        $pdo->exec("
            INSERT INTO student_users (user_id, username)
            SELECT u.id, u.username FROM users u WHERE LOWER(TRIM(u.role)) = 'student'
        ");

        $pdo->exec("
            INSERT IGNORE INTO student_users (user_id, username)
            SELECT u.id, u.username FROM users u
            WHERE NOT EXISTS (SELECT 1 FROM admin_users a WHERE a.user_id = u.id)
              AND NOT EXISTS (SELECT 1 FROM registrar_users r WHERE r.user_id = u.id)
              AND NOT EXISTS (SELECT 1 FROM student_users s WHERE s.user_id = u.id)
        ");

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        // Leave DB unchanged if migration fails (e.g. FK constraints on older MySQL).

        return;
    }
    try {
        if (userRoleColumnExists($pdo)) {
            $pdo->exec('ALTER TABLE users DROP COLUMN role');
        }
    } catch (Throwable $e) {
        // ignore; next request will retry migration while users.role still exists
    }
}
