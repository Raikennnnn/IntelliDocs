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
    $fromName = (string)(getenv('MAIL_FROM_NAME') ?: 'Nuestra Señora De Guia Academy');

    if ($apiKey === '' || $fromEmail === '') {
        return [false, 'BREVO_API_KEY or MAIL_FROM_ADDRESS missing'];
    }

    if (!function_exists('curl_init')) {
        return [false, 'PHP cURL extension is not enabled on this host'];
    }

    $payload = json_encode([
        'sender' => ['email' => $fromEmail, 'name' => $fromName],
        'to' => [['email' => $recipientEmail]],
        'subject' => $subject,
        'textContent' => $bodyText,
        'htmlContent' => '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">'
            . nl2br(htmlspecialchars($bodyText, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'))
            . '</div>',
    ], JSON_UNESCAPED_UNICODE);

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
    $fromName = (string)(getenv('MAIL_FROM_NAME') ?: 'Nuestra Señora De Guia Academy');
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
    if (function_exists('applySystemMailEnvOverrides')) {
        applySystemMailEnvOverrides($pdo);
    }
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

function getEmailQueueLastError(PDO $pdo, int $queueId): ?string
{
    try {
        ensureEmailQueueTable($pdo);
        $stmt = $pdo->prepare('SELECT last_error FROM email_queue WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $queueId]);
        $err = $stmt->fetchColumn();
        if ($err === false || $err === null) {
            return null;
        }
        $text = trim((string)$err);

        return $text !== '' ? $text : null;
    } catch (Throwable $e) {
        return null;
    }
}

/** When false, failed OTP sends do not expose dev_otp on localhost (use real Brevo). */
function mailDevOtpFallbackEnabled(): bool
{
    $flag = strtolower(trim((string)(getenv('MAIL_DEV_OTP_FALLBACK') ?: '0')));

    return in_array($flag, ['1', 'true', 'yes', 'on'], true);
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

function otpEmailSubject(): string
{
    return 'NSDGA IntelliDocs - Email verification code';
}

function buildOtpEmailBody(string $otp): string
{
    return "Your NSDGA IntelliDocs verification code is: {$otp}\n\n"
        . "This code expires in 10 minutes.\n"
        . "If you did not request this, you can ignore this email.";
}

/** On localhost, optionally return OTP in the API response for testing (email is still sent). */
function mailLocalOtpInResponseEnabled(): bool
{
    $flag = strtolower(trim((string)(getenv('MAIL_LOCAL_OTP_IN_RESPONSE') ?: '0')));

    return in_array($flag, ['1', 'true', 'yes', 'on'], true);
}

/**
 * Pre-flight check for the configured mail transport. Returns a structured
 * report admins can read from the browser BEFORE going live, so deployment
 * surprises (revoked Brevo key, unverified sender, missing cURL, free-tier
 * exhausted) surface as a concrete error instead of silent OTP failures.
 *
 * For the Brevo provider this calls `GET /v3/account` — a free, idempotent
 * endpoint that validates the API key without sending mail. For phpmail it
 * just confirms the `mail()` function exists.
 *
 * @return array{
 *   ready: bool,
 *   provider: string,
 *   from: string,
 *   issues: array<int,string>,
 *   brevo?: array<string,mixed>
 * }
 */
function checkMailerReadiness(): array
{
    $provider = strtolower((string)(getenv('MAIL_PROVIDER') ?: 'phpmail'));
    $fromEmail = (string)(getenv('MAIL_FROM_ADDRESS') ?: '');
    $fromName = (string)(getenv('MAIL_FROM_NAME') ?: '');
    $issues = [];

    if ($fromEmail === '') {
        $issues[] = 'MAIL_FROM_ADDRESS is empty';
    } elseif (!filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
        $issues[] = 'MAIL_FROM_ADDRESS is not a valid email';
    }

    $report = [
        'ready' => false,
        'provider' => $provider,
        'from' => $fromEmail,
        'from_name' => $fromName,
        'issues' => $issues,
    ];

    if ($provider === 'brevo') {
        $apiKey = (string)(getenv('BREVO_API_KEY') ?: '');
        if ($apiKey === '') {
            $issues[] = 'BREVO_API_KEY is empty';
            $report['issues'] = $issues;
            return $report;
        }
        if (!function_exists('curl_init')) {
            $issues[] = 'PHP cURL extension is not enabled (required for Brevo)';
            $report['issues'] = $issues;
            return $report;
        }

        $ch = curl_init('https://api.brevo.com/v3/account');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'accept: application/json',
                'api-key: ' . $apiKey,
            ],
            CURLOPT_TIMEOUT => 10,
        ]);
        $body = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        $brevo = ['http' => $httpCode];
        if ($body === false) {
            $issues[] = 'Brevo unreachable: ' . $err;
            $report['brevo'] = $brevo;
            $report['issues'] = $issues;
            return $report;
        }

        if ($httpCode === 401) {
            $decoded401 = json_decode((string)$body, true);
            $apiMessage = is_array($decoded401) ? (string)($decoded401['message'] ?? '') : '';
            if (stripos($apiMessage, 'unrecognised IP') !== false || stripos($apiMessage, 'unauthorized IP') !== false) {
                $issues[] = 'Brevo blocked this server IP (Authorized IPs is on). Brevo dashboard → Settings → Security → Authorized IPs → deactivate for API keys, or add your current public IP.';
            } else {
                $issues[] = 'Brevo rejected the API key (HTTP 401). It may have been revoked — generate a new one and update env.';
            }
            $report['brevo'] = $brevo;
            $report['issues'] = $issues;
            return $report;
        }
        if ($httpCode < 200 || $httpCode >= 300) {
            $issues[] = 'Brevo /v3/account returned HTTP ' . $httpCode . ': ' . substr((string)$body, 0, 300);
            $report['brevo'] = $brevo;
            $report['issues'] = $issues;
            return $report;
        }

        // Decode account info (plan, sender quota) for the report.
        $decoded = json_decode((string)$body, true);
        if (is_array($decoded)) {
            $brevo['plan'] = $decoded['plan'] ?? null;
            $brevo['email'] = $decoded['email'] ?? null;
            $brevo['company'] = $decoded['companyName'] ?? null;
        }
        $report['brevo'] = $brevo;

        // Verify the configured sender is actually authorized in Brevo.
        if ($fromEmail !== '') {
            $ch2 = curl_init('https://api.brevo.com/v3/senders');
            curl_setopt_array($ch2, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => [
                    'accept: application/json',
                    'api-key: ' . $apiKey,
                ],
                CURLOPT_TIMEOUT => 10,
            ]);
            $sBody = curl_exec($ch2);
            $sCode = (int)curl_getinfo($ch2, CURLINFO_RESPONSE_CODE);
            curl_close($ch2);

            if ($sCode >= 200 && $sCode < 300 && is_string($sBody)) {
                $sDecoded = json_decode($sBody, true);
                $senders = is_array($sDecoded['senders'] ?? null) ? $sDecoded['senders'] : [];
                $matched = false;
                foreach ($senders as $sender) {
                    $senderEmail = strtolower((string)($sender['email'] ?? ''));
                    if ($senderEmail === strtolower($fromEmail)) {
                        $matched = true;
                        $brevo['sender_active'] = (bool)($sender['active'] ?? false);
                        break;
                    }
                }
                if (!$matched) {
                    $issues[] = 'MAIL_FROM_ADDRESS (' . $fromEmail . ') is not a verified Brevo sender. Add it under Brevo → Senders & IPs → Senders, then click the verification link.';
                } elseif (isset($brevo['sender_active']) && !$brevo['sender_active']) {
                    $issues[] = 'MAIL_FROM_ADDRESS (' . $fromEmail . ') is registered in Brevo but not yet active. Confirm the verification email.';
                }
                $report['brevo'] = $brevo;
            }
        }

        $report['issues'] = $issues;
        $report['ready'] = empty($issues);
        return $report;
    }

    // phpmail fallback
    if (!function_exists('mail')) {
        $issues[] = 'PHP mail() is not available on this host';
    }
    $report['issues'] = $issues;
    $report['ready'] = empty($issues);
    return $report;
}
