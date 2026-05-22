<?php
declare(strict_types=1);

function ensureEmailQueueTable(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS email_queue (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            recipient_email VARCHAR(190) NOT NULL,
            subject VARCHAR(255) NOT NULL,
            body_text TEXT NOT NULL,
            status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
            attempts INT NOT NULL DEFAULT 0,
            last_error TEXT NULL,
            sent_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_email_queue_status (status),
            INDEX idx_email_queue_created_at (created_at)
        )
    ");
}

function queueEmail(PDO $pdo, string $recipientEmail, string $subject, string $bodyText): int
{
    ensureEmailQueueTable($pdo);
    $stmt = $pdo->prepare("
        INSERT INTO email_queue (recipient_email, subject, body_text, status, attempts)
        VALUES (:recipient_email, :subject, :body_text, 'pending', 0)
    ");
    $stmt->execute([
        ':recipient_email' => $recipientEmail,
        ':subject' => $subject,
        ':body_text' => $bodyText,
    ]);
    return (int)$pdo->lastInsertId();
}

/**
 * Brevo transactional email API transport (optional, production friendly).
 */
function sendViaBrevo(string $recipientEmail, string $subject, string $bodyText): array
{
    $apiKey = (string)(getenv('BREVO_API_KEY') ?: '');
    $fromEmail = (string)(getenv('MAIL_FROM_ADDRESS') ?: '');
    $fromName = (string)(getenv('MAIL_FROM_NAME') ?: 'IntelliDocs');

    if ($apiKey === '' || $fromEmail === '') {
        return [false, 'BREVO_API_KEY or MAIL_FROM_ADDRESS missing'];
    }

    $payload = json_encode([
        'sender' => ['email' => $fromEmail, 'name' => $fromName],
        'to' => [['email' => $recipientEmail]],
        'subject' => $subject,
        'textContent' => $bodyText,
    ]);

    $ch = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'accept: application/json',
            'api-key: ' . $apiKey,
            'content-type: application/json',
        ],
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_TIMEOUT => 15,
    ]);
    $response = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        return [false, 'Brevo transport error: ' . $err];
    }
    if ($httpCode < 200 || $httpCode >= 300) {
        return [false, 'Brevo API HTTP ' . $httpCode . ': ' . $response];
    }
    return [true, null];
}

/**
 * Fallback PHP mail() transport.
 */
function sendViaPhpMail(string $recipientEmail, string $subject, string $bodyText): array
{
    $fromEmail = (string)(getenv('MAIL_FROM_ADDRESS') ?: 'no-reply@intellidocs.local');
    $fromName = (string)(getenv('MAIL_FROM_NAME') ?: 'IntelliDocs');
    $headers = [
        'From: ' . $fromName . ' <' . $fromEmail . '>',
        'Content-Type: text/plain; charset=UTF-8',
    ];
    $ok = @mail($recipientEmail, $subject, $bodyText, implode("\r\n", $headers));
    return $ok ? [true, null] : [false, 'PHP mail() failed'];
}

/**
 * Sends one queued email and updates row status.
 */
function processSingleQueuedEmail(PDO $pdo, int $queueId): bool
{
    ensureEmailQueueTable($pdo);
    $stmt = $pdo->prepare("SELECT * FROM email_queue WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $queueId]);
    $row = $stmt->fetch();
    if (!$row) {
        return false;
    }

    $provider = strtolower((string)(getenv('MAIL_PROVIDER') ?: 'phpmail'));
    if ($provider === 'brevo') {
        [$sent, $error] = sendViaBrevo((string)$row['recipient_email'], (string)$row['subject'], (string)$row['body_text']);
    } else {
        [$sent, $error] = sendViaPhpMail((string)$row['recipient_email'], (string)$row['subject'], (string)$row['body_text']);
    }

    if ($sent) {
        $update = $pdo->prepare("
            UPDATE email_queue
            SET status = 'sent', attempts = attempts + 1, last_error = NULL, sent_at = NOW()
            WHERE id = :id
        ");
        $update->execute([':id' => $queueId]);
        return true;
    }

    $update = $pdo->prepare("
        UPDATE email_queue
        SET status = 'failed', attempts = attempts + 1, last_error = :last_error
        WHERE id = :id
    ");
    $update->execute([
        ':id' => $queueId,
        ':last_error' => $error ?: 'Unknown send error',
    ]);
    return false;
}

function processPendingEmailQueue(PDO $pdo, int $limit = 20): array
{
    ensureEmailQueueTable($pdo);
    $stmt = $pdo->prepare("
        SELECT id
        FROM email_queue
        WHERE status IN ('pending', 'failed') AND attempts < 5
        ORDER BY created_at ASC
        LIMIT :lim
    ");
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $ids = array_map(static fn(array $r): int => (int)$r['id'], $stmt->fetchAll() ?: []);
    $sentIds = [];
    foreach ($ids as $id) {
        if (processSingleQueuedEmail($pdo, $id)) {
            $sentIds[] = $id;
        }
    }
    return $sentIds;
}

function buildOtpEmailBody(string $otp): string
{
    return "Your IntelliDocs OTP is: {$otp}\n\nThis code expires in 10 minutes.\nIf you did not request this, ignore this email.";
}
