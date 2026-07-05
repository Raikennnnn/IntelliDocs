<?php
declare(strict_types=1);

/**
 * Reminds a student of their school username when credentials were already issued.
 * Does not include the cleartext temporary password (only the hash is stored).
 */

require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/welcome_email.php';

/**
 * @param array{
 *   first_name?: string,
 *   school_username?: string,
 *   app_host?: string,
 * } $opts
 * @return array{subject: string, body: string}
 */
function buildAccountReminderEmail(array $opts): array
{
    $firstName = trim((string)($opts['first_name'] ?? ''));
    if ($firstName === '') {
        $firstName = 'there';
    }
    $schoolUsername = trim((string)($opts['school_username'] ?? ''));
    if ($schoolUsername === '') {
        $schoolUsername = '(contact the registrar)';
    }

    $appHost = isset($opts['app_host']) && trim((string)$opts['app_host']) !== ''
        ? trim((string)$opts['app_host'])
        : welcomeEmailResolveAppHost();

    $subject = 'Nuestra Señora De Guia Academy — your school account reminder';

    $body = "Hi {$firstName},\n\n"
        . "This is a reminder of your Nuestra Señora De Guia Academy student account.\n\n"
        . "  School username:    {$schoolUsername}\n"
        . "  Temporary password: your date of birth in mm-dd-yyyy format\n\n"
        . "You can sign in at https://{$appHost}/login using either your personal\n"
        . "email or your school username.\n\n"
        . "If you have already changed your password, use your new password.\n"
        . "If you've forgotten it, contact the registrar's office for a reset.\n\n"
        . "— Nuestra Señora De Guia Academy\n";

    return ['subject' => $subject, 'body' => $body];
}

/**
 * @param array{
 *   first_name?: string,
 *   school_username?: string,
 *   app_host?: string,
 * } $opts
 */
function sendAccountReminderEmail(PDO $pdo, string $recipientEmail, array $opts): bool
{
    $recipient = trim($recipientEmail);
    if ($recipient === '') {
        return false;
    }
    $rendered = buildAccountReminderEmail($opts);
    try {
        $queueId = queueEmail($pdo, $recipient, $rendered['subject'], $rendered['body']);
        return processSingleQueuedEmail($pdo, $queueId);
    } catch (Throwable $e) {
        return false;
    }
}
