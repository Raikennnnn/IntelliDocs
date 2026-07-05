<?php
declare(strict_types=1);

/**
 * Reminds enrolled students to bring missing physical documents to the registrar.
 */

require_once __DIR__ . '/mailer.php';

/**
 * @param array{
 *   first_name?: string,
 *   missing_labels?: array<int, string>,
 *   source?: 'manual'|'auto'|string,
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

    $bullets = '';
    foreach ($missing as $label) {
        $label = trim((string)$label);
        if ($label === '') {
            continue;
        }
        $bullets .= '  - ' . $label . "\n";
    }
    if ($bullets === '') {
        $bullets = "  - (see your student portal for details)\n";
    }

    $intro = $source === 'auto'
        ? "This is an automated reminder from the Nuestra Señora De Guia Academy registrar's office. "
        : "This is a reminder from the Nuestra Señora De Guia Academy registrar's office. ";

    $subject = 'Reminder — Missing physical enrollment documents';

    $body = "Hi {$firstName},\n\n"
        . $intro
        . "You are enrolled, but the following physical documents are still missing:\n\n"
        . $bullets
        . "\nPlease bring them to the registrar's office at your earliest convenience to complete your enrollment.\n\n"
        . "If you have already submitted these documents, you may disregard this email.\n\n"
        . "Thank you,\n"
        . "Nuestra Señora De Guia Academy\n";

    return ['subject' => $subject, 'body' => $body];
}

/**
 * @param array{
 *   first_name?: string,
 *   missing_labels?: array<int, string>,
 *   source?: 'manual'|'auto'|string,
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
