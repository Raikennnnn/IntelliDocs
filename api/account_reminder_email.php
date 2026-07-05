<?php
declare(strict_types=1);

/**
 * Reminds a student of their school username when credentials were already issued.
 */

require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/email_layout.php';
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
    $loginUrl = 'https://' . $appHost . '/login';

    $subject = 'Nuestra Señora De Guia Academy — your school account reminder';

    $content =
        emailLayoutParagraph('Hi ' . $firstName . ',')
        . emailLayoutParagraph('This is a reminder of your Nuestra Señora De Guia Academy student account.')
        . emailLayoutCredentialBox([
            ['label' => 'School username', 'value' => $schoolUsername],
            ['label' => 'Temporary password', 'value' => 'Your date of birth (mm-dd-yyyy)'],
        ])
        . emailLayoutParagraph('If you have already changed your password, use your new password. If you\'ve forgotten it, contact the registrar\'s office for a reset.')
        . emailLayoutButton($loginUrl, 'Sign in to IntelliDocs');

    $body = renderBrandedEmailHtml(
        'Account reminder',
        'Your school login details',
        $content
    );

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
