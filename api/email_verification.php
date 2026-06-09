<?php
declare(strict_types=1);

function ensureEmailVerifiedColumn(PDO $pdo): void
{
    if (columnExists($pdo, 'users', 'email_verified_at')) {
        return;
    }

    $pdo->exec('ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP NULL DEFAULT NULL AFTER full_name');
    backfillEmailVerifiedAt($pdo);
}

function markEmailVerified(PDO $pdo, int $userId): void
{
    if ($userId <= 0) {
        return;
    }
    ensureEmailVerifiedColumn($pdo);
    $pdo->prepare(
        'UPDATE users SET email_verified_at = NOW() WHERE id = :id AND email_verified_at IS NULL'
    )->execute([':id' => $userId]);
}

function studentEmailVerified(PDO $pdo, array $user, string $role): bool
{
    if ($role !== 'student') {
        return true;
    }
    if (!columnExists($pdo, 'users', 'email_verified_at')) {
        return true;
    }

    return !empty($user['email_verified_at']);
}

/** One-time backfill after adding email_verified_at. */
function backfillEmailVerifiedAt(PDO $pdo): void
{
    if (!columnExists($pdo, 'users', 'email_verified_at')) {
        return;
    }

    if (roleTablesExist($pdo)) {
        $pdo->exec("
            UPDATE users u
            INNER JOIN admin_users a ON a.user_id = u.id
               SET u.email_verified_at = COALESCE(u.email_verified_at, u.created_at)
             WHERE u.email_verified_at IS NULL
        ");
        $pdo->exec("
            UPDATE users u
            INNER JOIN registrar_users r ON r.user_id = u.id
               SET u.email_verified_at = COALESCE(u.email_verified_at, u.created_at)
             WHERE u.email_verified_at IS NULL
        ");
    }

    $purposeClause = columnExists($pdo, 'otp_codes', 'purpose')
        ? "AND o.purpose = 'registration'"
        : '';

    $pdo->exec("
        UPDATE users u
        INNER JOIN otp_codes o ON LOWER(TRIM(o.email)) = LOWER(TRIM(u.email))
           SET u.email_verified_at = COALESCE(u.email_verified_at, u.created_at)
         WHERE u.email_verified_at IS NULL
           AND o.used = 1
           {$purposeClause}
    ");
}
