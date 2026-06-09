<?php
declare(strict_types=1);

/**
 * Student declaration that uploaded enrollment documents are genuine.
 * One row per enrollment application (mirrors registration consent audit trail).
 */

require_once __DIR__ . '/user_consents.php';

function documentAuthenticityConsentsTableExists(PDO $pdo): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1'
    );
    $stmt->execute([':t' => 'enrollment_document_authenticity_consents']);

    return (bool)$stmt->fetchColumn();
}

function ensureDocumentAuthenticityConsentsTable(PDO $pdo): void
{
    if (documentAuthenticityConsentsTableExists($pdo)) {
        return;
    }

    $pdo->exec(
        "CREATE TABLE enrollment_document_authenticity_consents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            enrollment_id INT NOT NULL,
            user_id INT NOT NULL,
            school_year VARCHAR(30) NULL,
            authenticity_confirmed TINYINT(1) NOT NULL DEFAULT 1,
            confirmed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ip_address VARCHAR(64) NULL,
            user_agent VARCHAR(512) NULL,
            source VARCHAR(40) NOT NULL DEFAULT 'enrollment_step_4',
            UNIQUE KEY uniq_doc_auth_enrollment (enrollment_id),
            INDEX idx_doc_auth_user (user_id),
            INDEX idx_doc_auth_confirmed_at (confirmed_at),
            CONSTRAINT fk_doc_auth_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function saveDocumentAuthenticityConsent(
    PDO $pdo,
    int $enrollmentId,
    int $userId,
    ?string $schoolYear = null,
    string $source = 'enrollment_step_4',
): bool {
    if ($enrollmentId <= 0 || $userId <= 0) {
        return false;
    }

    ensureDocumentAuthenticityConsentsTable($pdo);

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO enrollment_document_authenticity_consents
                (enrollment_id, user_id, school_year, authenticity_confirmed,
                 ip_address, user_agent, source)
             VALUES
                (:enrollment_id, :user_id, :school_year, 1, :ip, :ua, :source)
             ON DUPLICATE KEY UPDATE
                authenticity_confirmed = 1,
                school_year = VALUES(school_year),
                ip_address = VALUES(ip_address),
                user_agent = VALUES(user_agent),
                source = VALUES(source),
                confirmed_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([
            ':enrollment_id' => $enrollmentId,
            ':user_id' => $userId,
            ':school_year' => $schoolYear !== null && trim($schoolYear) !== '' ? trim($schoolYear) : null,
            ':ip' => consentClientIp(),
            ':ua' => consentClientUserAgent(),
            ':source' => substr(trim($source), 0, 40) !== '' ? substr(trim($source), 0, 40) : 'enrollment_step_4',
        ]);

        return true;
    } catch (Throwable $e) {
        return false;
    }
}

function hasDocumentAuthenticityConsent(PDO $pdo, int $enrollmentId): bool
{
    if ($enrollmentId <= 0 || !documentAuthenticityConsentsTableExists($pdo)) {
        return false;
    }

    $stmt = $pdo->prepare(
        'SELECT authenticity_confirmed FROM enrollment_document_authenticity_consents
          WHERE enrollment_id = :eid LIMIT 1'
    );
    $stmt->execute([':eid' => $enrollmentId]);

    return (int)$stmt->fetchColumn() === 1;
}

/** @return array<string, mixed>|null */
function getDocumentAuthenticityConsent(PDO $pdo, int $enrollmentId): ?array
{
    ensureDocumentAuthenticityConsentsTable($pdo);
    if ($enrollmentId <= 0) {
        return null;
    }

    $stmt = $pdo->prepare(
        'SELECT id, enrollment_id, user_id, school_year, authenticity_confirmed,
                confirmed_at, ip_address, user_agent, source
           FROM enrollment_document_authenticity_consents
          WHERE enrollment_id = :eid
          LIMIT 1'
    );
    $stmt->execute([':eid' => $enrollmentId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($row) ? $row : null;
}
