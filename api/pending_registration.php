<?php
declare(strict_types=1);

/** Pending signups — user row is created only after OTP verification. */

function pendingRegistrationsTableExists(PDO $pdo): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute([':t' => 'pending_registrations']);

    return (bool)$stmt->fetchColumn();
}

function ensurePendingRegistrationsTable(PDO $pdo): void
{
    if (pendingRegistrationsTableExists($pdo)) {
        return;
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS pending_registrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(100) NOT NULL,
            username VARCHAR(50) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(100) NOT NULL DEFAULT '',
            terms_privacy_accepted TINYINT(1) NOT NULL DEFAULT 1,
            dpa_accepted TINYINT(1) NOT NULL DEFAULT 1,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_pending_email (email),
            UNIQUE KEY uniq_pending_username (username),
            INDEX idx_pending_expires (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

function purgeExpiredPendingRegistrations(PDO $pdo): void
{
    ensurePendingRegistrationsTable($pdo);
    $pdo->exec('DELETE FROM pending_registrations WHERE expires_at < NOW()');
}

function pendingRegistrationEmailTaken(PDO $pdo, string $email, ?string $excludeEmail = null): bool
{
    ensurePendingRegistrationsTable($pdo);
    $email = strtolower(trim($email));
    $sql = 'SELECT 1 FROM pending_registrations WHERE email = :email AND expires_at >= NOW() LIMIT 1';
    $params = [':email' => $email];
    if ($excludeEmail !== null) {
        $sql = 'SELECT 1 FROM pending_registrations WHERE email = :email AND email <> :exclude AND expires_at >= NOW() LIMIT 1';
        $params[':exclude'] = strtolower(trim($excludeEmail));
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    return (bool)$stmt->fetchColumn();
}

function pendingRegistrationUsernameTaken(PDO $pdo, string $username, ?string $excludeEmail = null): bool
{
    ensurePendingRegistrationsTable($pdo);
    $username = trim($username);
    if ($excludeEmail !== null) {
        $stmt = $pdo->prepare(
            'SELECT 1 FROM pending_registrations
              WHERE username = :username AND email <> :exclude AND expires_at >= NOW()
              LIMIT 1'
        );
        $stmt->execute([
            ':username' => $username,
            ':exclude' => strtolower(trim($excludeEmail)),
        ]);
    } else {
        $stmt = $pdo->prepare(
            'SELECT 1 FROM pending_registrations
              WHERE username = :username AND expires_at >= NOW()
              LIMIT 1'
        );
        $stmt->execute([':username' => $username]);
    }

    return (bool)$stmt->fetchColumn();
}

function savePendingRegistration(
    PDO $pdo,
    string $email,
    string $username,
    string $passwordHash,
    string $fullName,
    bool $termsPrivacyAccepted,
    bool $dpaAccepted,
    int $ttlMinutes = 30,
): void {
    ensurePendingRegistrationsTable($pdo);
    purgeExpiredPendingRegistrations($pdo);

    $email = strtolower(trim($email));
    $username = trim($username);

    $stmt = $pdo->prepare("
        INSERT INTO pending_registrations (
            email, username, password_hash, full_name,
            terms_privacy_accepted, dpa_accepted, expires_at
        ) VALUES (
            :email, :username, :password_hash, :full_name,
            :terms_privacy, :dpa, DATE_ADD(NOW(), INTERVAL :minutes MINUTE)
        )
        ON DUPLICATE KEY UPDATE
            username = VALUES(username),
            password_hash = VALUES(password_hash),
            full_name = VALUES(full_name),
            terms_privacy_accepted = VALUES(terms_privacy_accepted),
            dpa_accepted = VALUES(dpa_accepted),
            expires_at = VALUES(expires_at),
            created_at = CURRENT_TIMESTAMP
    ");
    $stmt->bindValue(':email', $email);
    $stmt->bindValue(':username', $username);
    $stmt->bindValue(':password_hash', $passwordHash);
    $stmt->bindValue(':full_name', $fullName);
    $stmt->bindValue(':terms_privacy', $termsPrivacyAccepted ? 1 : 0, PDO::PARAM_INT);
    $stmt->bindValue(':dpa', $dpaAccepted ? 1 : 0, PDO::PARAM_INT);
    $stmt->bindValue(':minutes', $ttlMinutes, PDO::PARAM_INT);
    $stmt->execute();
}

/**
 * @return array<string, mixed>|null
 */
function getPendingRegistrationByEmail(PDO $pdo, string $email): ?array
{
    ensurePendingRegistrationsTable($pdo);
    $stmt = $pdo->prepare(
        'SELECT * FROM pending_registrations
          WHERE email = :email AND expires_at >= NOW()
          ORDER BY id DESC
          LIMIT 1'
    );
    $stmt->execute([':email' => strtolower(trim($email))]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row && is_array($row) ? $row : null;
}

function deletePendingRegistration(PDO $pdo, string $email): void
{
    ensurePendingRegistrationsTable($pdo);
    $pdo->prepare('DELETE FROM pending_registrations WHERE email = :email')->execute([
        ':email' => strtolower(trim($email)),
    ]);
}

function touchPendingRegistrationExpiry(PDO $pdo, string $email, int $ttlMinutes = 30): void
{
    ensurePendingRegistrationsTable($pdo);
    $pdo->prepare(
        'UPDATE pending_registrations
            SET expires_at = DATE_ADD(NOW(), INTERVAL :minutes MINUTE)
          WHERE email = :email'
    )->execute([
        ':email' => strtolower(trim($email)),
        ':minutes' => $ttlMinutes,
    ]);
}
