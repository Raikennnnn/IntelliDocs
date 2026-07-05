<?php
declare(strict_types=1);

/**
 * Notifies the student when the registrar rejects their enrollment application.
 */

require_once __DIR__ . '/mailer.php';
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

    $subject = 'Enrollment application update — Nuestra Señora De Guia Academy';

    $body = "Hello {$name},\n\n"
        . "Thank you for applying to Nuestra Señora De Guia Academy through IntelliDocs.\n\n"
        . "After review, your enrollment application was not approved at this time.\n\n";

    if ($appId !== '') {
        $body .= "Application ID: {$appId}\n";
    }
    if ($schoolYear !== '') {
        $body .= "School year: {$schoolYear}\n";
    }
    if ($appId !== '' || $schoolYear !== '') {
        $body .= "\n";
    }

    if ($remarks !== '') {
        $body .= "Registrar's note\n"
            . "-----------------\n"
            . $remarks . "\n\n";
    }

    $body .= "What you can do\n"
        . "----------------\n"
        . "• Sign in at https://{$appHost}/login to view your application status.\n"
        . "• If you have questions or believe this decision was made in error, "
        . "please contact the registrar's office during business hours.\n\n"
        . "— Nuestra Señora De Guia Academy Registrar's Office\n";

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
