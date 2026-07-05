<?php
declare(strict_types=1);

/**
 * Reminds enrolled students to bring missing physical documents to the registrar.
 */

require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/email_layout.php';
require_once __DIR__ . '/welcome_email.php';

/**
 * @param array{
 *   first_name?: string,
 *   missing_labels?: array<int, string>,
 *   source?: 'manual'|'auto'|string,
 *   app_host?: string,
 * } $opts
 * @return array{subject: string, body: string}
 */
function buildPhysicalDocsReminderEmail(array $opts): array
{
    $firstName = trim((string)($opts['first_name'] ?? ''));
    if ($firstName === '') {
        $firstName = 'there';
    }
    $missing = is_array($opts['missing_labels'] ?? null) ? $opts['missing_labels'] : [];
    $source = strtolower(trim((string)($opts['source'] ?? 'manual')));
    $appHost = isset($opts['app_host']) && trim((string)$opts['app_host']) !== ''
        ? trim((string)$opts['app_host'])
        : welcomeEmailResolveAppHost();
    $loginUrl = 'https://' . $appHost . '/login';

    $subject = 'Reminder — Missing physical enrollment documents';

    $intro = $source === 'auto'
        ? 'This is an automated reminder from the registrar\'s office.'
        : 'This is a reminder from the registrar\'s office.';

    $content =
        emailLayoutParagraph('Hi ' . $firstName . ',')
        . emailLayoutParagraph($intro . ' You are enrolled, but the following physical documents are still missing:')
        . emailLayoutBulletList($missing)
        . emailLayoutParagraph('Please bring them to the registrar\'s office at your earliest convenience to complete your enrollment.')
        . emailLayoutButton($loginUrl, 'Open student portal')
        . emailLayoutCallout(
            '<strong style="color:#101828;">Already submitted?</strong> If you have brought these documents in, you may disregard this email.'
        );

    $body = renderBrandedEmailHtml(
        'Physical documents',
        'Missing enrollment documents',
        $content,
        'Questions? Visit the registrar\'s office during business hours or sign in to your student portal.'
    );

    return ['subject' => $subject, 'body' => $body];
}

/**
 * @param array{
 *   first_name?: string,
 *   missing_labels?: array<int, string>,
 *   source?: 'manual'|'auto'|string,
 *   app_host?: string,
 * } $opts
 */
function sendPhysicalDocsReminderEmailMessage(PDO $pdo, string $recipientEmail, array $opts): bool
{
    $recipient = trim($recipientEmail);
    if ($recipient === '') {
        return false;
    }
    $rendered = buildPhysicalDocsReminderEmail($opts);
    try {
        $queueId = queueEmail($pdo, $recipient, $rendered['subject'], $rendered['body']);
        return processSingleQueuedEmail($pdo, $queueId);
    } catch (Throwable $e) {
        return false;
    }
}
