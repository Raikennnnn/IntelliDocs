<?php
declare(strict_types=1);

/**
 * One registration consent row per user: Terms, Privacy Policy, and DPA together.
 */

function userRegistrationConsentsTableExists(PDO $pdo): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute([':t' => 'user_registration_consents']);

    return (bool)$stmt->fetchColumn();
}

function ensureUserRegistrationConsentsTable(PDO $pdo): void
{
    if (userRegistrationConsentsTableExists($pdo)) {
        return;
    }

    $pdo->exec(
        "CREATE TABLE user_registration_consents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            terms_of_use_accepted TINYINT(1) NOT NULL DEFAULT 0,
            privacy_policy_accepted TINYINT(1) NOT NULL DEFAULT 0,
            dpa_accepted TINYINT(1) NOT NULL DEFAULT 0,
            accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ip_address VARCHAR(64) NULL,
            user_agent VARCHAR(512) NULL,
            source VARCHAR(40) NOT NULL DEFAULT 'registration',
            UNIQUE KEY uniq_registration_consent_user (user_id),
            INDEX idx_registration_consent_at (accepted_at),
            CONSTRAINT fk_registration_consent_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

/** @deprecated Legacy columns on users; no longer written. Kept for old DB reads during migrate. */
function ensureUserConsentColumns(PDO $pdo): void
{
    ensureUserRegistrationConsentsTable($pdo);
    migrateLegacyConsentStorage($pdo);
}

function consentClientIp(): ?string
{
    $ip = trim((string)($_SERVER['REMOTE_ADDR'] ?? ''));

    return $ip !== '' ? substr($ip, 0, 64) : null;
}

function consentClientUserAgent(): ?string
{
    $ua = trim((string)($_SERVER['HTTP_USER_AGENT'] ?? ''));

    return $ua !== '' ? substr($ua, 0, 512) : null;
}

function saveUserRegistrationConsents(
    PDO $pdo,
    int $userId,
    bool $termsPrivacyAccepted,
    bool $dpaAccepted,
    ?string $ipAddress = null
): void {
    if ($userId <= 0) {
        return;
    }

    ensureUserRegistrationConsentsTable($pdo);

    $ip = $ipAddress !== null && $ipAddress !== ''
        ? substr($ipAddress, 0, 64)
        : consentClientIp();

    $termsVal = $termsPrivacyAccepted ? 1 : 0;
    $privacyVal = $termsPrivacyAccepted ? 1 : 0;
    $dpaVal = $dpaAccepted ? 1 : 0;

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO user_registration_consents
                (user_id, terms_of_use_accepted, privacy_policy_accepted, dpa_accepted,
                 ip_address, user_agent, source)
             VALUES
                (:user_id, :terms, :privacy, :dpa, :ip, :ua, :source)
             ON DUPLICATE KEY UPDATE
                terms_of_use_accepted = VALUES(terms_of_use_accepted),
                privacy_policy_accepted = VALUES(privacy_policy_accepted),
                dpa_accepted = VALUES(dpa_accepted),
                ip_address = VALUES(ip_address),
                user_agent = VALUES(user_agent),
                accepted_at = CURRENT_TIMESTAMP,
                source = VALUES(source)'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':terms' => $termsVal,
            ':privacy' => $privacyVal,
            ':dpa' => $dpaVal,
            ':ip' => $ip,
            ':ua' => consentClientUserAgent(),
            ':source' => 'registration',
        ]);
    } catch (Throwable $e) {
        // Do not roll back registration if consent storage fails.
    }
}

function parseConsentFlag(mixed $value): bool
{
    if (is_bool($value)) {
        return $value;
    }
    if (is_int($value) || is_float($value)) {
        return (int)$value === 1;
    }
    $normalized = strtolower(trim((string)$value));

    return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
}

/** @return array<string, mixed>|null */
function getUserRegistrationConsent(PDO $pdo, int $userId): ?array
{
    ensureUserRegistrationConsentsTable($pdo);
    if ($userId <= 0) {
        return null;
    }

    $stmt = $pdo->prepare(
        'SELECT id, user_id, terms_of_use_accepted, privacy_policy_accepted, dpa_accepted,
                accepted_at, ip_address, user_agent, source
           FROM user_registration_consents
          WHERE user_id = :uid
          LIMIT 1'
    );
    $stmt->execute([':uid' => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($row) ? $row : null;
}

function migrateLegacyConsentStorage(PDO $pdo): void
{
    if (!userRegistrationConsentsTableExists($pdo)) {
        return;
    }

    $legacyTable = $pdo->prepare(
        'SELECT 1 FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );

    $legacyTable->execute([':t' => 'user_consent_records']);
    if ($legacyTable->fetchColumn()) {
        $pdo->exec(
            "INSERT INTO user_registration_consents
                (user_id, terms_of_use_accepted, privacy_policy_accepted, dpa_accepted,
                 accepted_at, ip_address, source)
             SELECT
                user_id,
                MAX(CASE WHEN consent_type IN ('terms_of_use', 'terms_privacy') AND accepted = 1 THEN 1 ELSE 0 END),
                MAX(CASE WHEN consent_type = 'privacy_policy' AND accepted = 1 THEN 1 ELSE 0 END),
                MAX(CASE WHEN consent_type = 'dpa' AND accepted = 1 THEN 1 ELSE 0 END),
                MAX(accepted_at),
                MAX(ip_address),
                'registration'
             FROM user_consent_records
             GROUP BY user_id
             ON DUPLICATE KEY UPDATE
                terms_of_use_accepted = GREATEST(user_registration_consents.terms_of_use_accepted, VALUES(terms_of_use_accepted)),
                privacy_policy_accepted = GREATEST(user_registration_consents.privacy_policy_accepted, VALUES(privacy_policy_accepted)),
                dpa_accepted = GREATEST(user_registration_consents.dpa_accepted, VALUES(dpa_accepted)),
                accepted_at = LEAST(user_registration_consents.accepted_at, VALUES(accepted_at)),
                ip_address = COALESCE(user_registration_consents.ip_address, VALUES(ip_address))"
        );
        try {
            $pdo->exec('DROP TABLE user_consent_records');
        } catch (Throwable $e) {
            // Ignore if drop not permitted.
        }
    }

    $hasUsersConsent = $pdo->prepare(
        'SELECT 1 FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c LIMIT 1'
    );
    $hasUsersConsent->execute([':t' => 'users', ':c' => 'terms_privacy_accepted']);
    if (!$hasUsersConsent->fetchColumn()) {
        return;
    }

    $pdo->exec(
        "INSERT INTO user_registration_consents
            (user_id, terms_of_use_accepted, privacy_policy_accepted, dpa_accepted,
             accepted_at, ip_address, source)
         SELECT
            u.id,
            GREATEST(COALESCE(u.terms_of_use_accepted, 0), COALESCE(u.terms_privacy_accepted, 0)),
            GREATEST(COALESCE(u.privacy_policy_accepted, 0), COALESCE(u.terms_privacy_accepted, 0)),
            COALESCE(u.dpa_accepted, 0),
            COALESCE(u.dpa_accepted_at, u.terms_privacy_accepted_at, u.created_at),
            u.consent_ip,
            'registration'
         FROM users u
         WHERE COALESCE(u.terms_privacy_accepted, 0) = 1 OR COALESCE(u.dpa_accepted, 0) = 1
         ON DUPLICATE KEY UPDATE
            terms_of_use_accepted = GREATEST(user_registration_consents.terms_of_use_accepted, VALUES(terms_of_use_accepted)),
            privacy_policy_accepted = GREATEST(user_registration_consents.privacy_policy_accepted, VALUES(privacy_policy_accepted)),
            dpa_accepted = GREATEST(user_registration_consents.dpa_accepted, VALUES(dpa_accepted)),
            accepted_at = LEAST(user_registration_consents.accepted_at, VALUES(accepted_at)),
            ip_address = COALESCE(user_registration_consents.ip_address, VALUES(ip_address))"
    );
}
