<?php
declare(strict_types=1);

/**
 * Notifies the student when the registrar rejects their enrollment application.
 */

require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/email_layout.php';
require_once __DIR__ . '/welcome_email.php';

/**
 * @param array{
 *   student_name?: string,
 *   application_id?: string,
 *   school_year?: string,
 *   remarks?: string,
 *   app_host?: string,
 * } $opts
 * @return array{subject: string, body: string}
 */
function buildApplicationRejectionEmail(array $opts): array
{
    $name = trim((string)($opts['student_name'] ?? ''));
    if ($name === '') {
        $name = 'Student';
    }
    $appId = trim((string)($opts['application_id'] ?? ''));
    $schoolYear = trim((string)($opts['school_year'] ?? ''));
    $remarks = trim((string)($opts['remarks'] ?? ''));
    $appHost = isset($opts['app_host']) && trim((string)$opts['app_host']) !== ''
        ? trim((string)$opts['app_host'])
        : welcomeEmailResolveAppHost();
    $loginUrl = 'https://' . $appHost . '/login';

    $subject = 'Enrollment application update — Nuestra Señora De Guia Academy';

    $metaRows = [];
    if ($appId !== '') {
        $metaRows[] = ['label' => 'Application ID', 'value' => $appId];
    }
    if ($schoolYear !== '') {
        $metaRows[] = ['label' => 'School year', 'value' => $schoolYear];
    }

    $content =
        emailLayoutParagraph('Hello ' . $name . ',')
        . emailLayoutParagraph('Thank you for applying to Nuestra Señora De Guia Academy through IntelliDocs.')
        . emailLayoutParagraph('After review, your enrollment application was not approved at this time.')
        . emailLayoutCredentialBox($metaRows);

    if ($remarks !== '') {
        $safeRemarks = str_replace("\n", '<br>', emailLayoutEscape($remarks));
        $content .= emailLayoutSectionTitle('Registrar\'s note')
            . emailLayoutCallout($safeRemarks);
    }

    $content .=
        emailLayoutSectionTitle('What you can do')
        . emailLayoutBulletList([
            'Sign in to your student portal to view your application status.',
            'Contact the registrar\'s office if you have questions or believe this decision was made in error.',
        ])
        . emailLayoutButton($loginUrl, 'View application status');

    $body = renderBrandedEmailHtml(
        'Application update',
        'Enrollment application not approved',
        $content,
        '— Nuestra Señora De Guia Academy Registrar\'s Office'
    );

    return ['subject' => $subject, 'body' => $body];
}

/**
 * @param array{
 *   student_name?: string,
 *   application_id?: string,
 *   school_year?: string,
 *   remarks?: string,
 *   app_host?: string,
 * } $opts
 */
function sendApplicationRejectionEmail(PDO $pdo, string $recipientEmail, array $opts): bool
{
    $recipient = trim($recipientEmail);
    if ($recipient === '') {
        return false;
    }
    $rendered = buildApplicationRejectionEmail($opts);
    try {
        $queueId = queueEmail($pdo, $recipient, $rendered['subject'], $rendered['body']);
        return processSingleQueuedEmail($pdo, $queueId);
    } catch (Throwable $e) {
        return false;
    }
}
