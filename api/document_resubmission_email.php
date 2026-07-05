<?php
declare(strict_types=1);

/**
 * Notifies the student that the registrar has rejected one of their
 * uploaded documents and that they need to resubmit it.
 */

require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/email_layout.php';
require_once __DIR__ . '/welcome_email.php';
require_once __DIR__ . '/in_person_verification_email.php';

/**
 * @param array{
 *   student_name?: string,
 *   requirement?: string,
 *   remarks?: string,
 *   attempts_used?: int,
 *   attempt_limit?: int,
 *   app_host?: string,
 * } $opts
 * @return array{subject:string, body:string}
 */
function buildDocumentResubmissionEmail(array $opts): array
{
    $name = trim((string)($opts['student_name'] ?? ''));
    if ($name === '') {
        $name = 'Student';
    }
    $requirement = trim((string)($opts['requirement'] ?? ''));
    if ($requirement === '') {
        $requirement = 'a required document';
    }
    $remarks = trim((string)($opts['remarks'] ?? ''));
    $attemptsUsed = max(0, (int)($opts['attempts_used'] ?? 0));
    $attemptLimit = max(1, (int)($opts['attempt_limit'] ?? 5));
    $remaining = max(0, $attemptLimit - $attemptsUsed);
    $onLastChance = $remaining === 1;

    $appHost = isset($opts['app_host']) && trim((string)$opts['app_host']) !== ''
        ? trim((string)$opts['app_host'])
        : welcomeEmailResolveAppHost();
    $loginUrl = 'https://' . $appHost . '/login';

    $subject = 'Action required: please resubmit your ' . $requirement;

    $content =
        emailLayoutParagraph('Hello ' . $name . ',')
        . emailLayoutParagraph('The registrar has reviewed your uploaded document and is asking you to resubmit the following requirement:')
        . emailLayoutBulletList([$requirement]);

    if ($remarks !== '') {
        $safeRemarks = str_replace("\n", '<br>', emailLayoutEscape($remarks));
        $content .= emailLayoutSectionTitle('Registrar\'s note')
            . emailLayoutCallout($safeRemarks);
    }

    $content .= emailLayoutSectionTitle('What to do next')
        . emailLayoutBulletList([
            'Log in to your student portal.',
            'Open Application Status (or the Enrollment page) and find the document marked "Resubmission required".',
            'Click "Resubmit" and upload a clearer, complete copy that addresses the registrar\'s note.',
        ]);

    if ($remaining <= 0) {
        $content .= emailLayoutCallout(
            '<strong style="color:#101828;">Important:</strong> You have already used all '
            . emailLayoutEscape((string)$attemptLimit)
            . ' upload attempts for this requirement. Please bring the <strong>original document</strong> to the registrar\'s office for face-to-face verification.'
        );
    } elseif ($onLastChance) {
        $content .= emailLayoutCallout(
            '<strong style="color:#101828;">Last upload attempt:</strong> You have used '
            . emailLayoutEscape((string)$attemptsUsed) . ' of ' . emailLayoutEscape((string)$attemptLimit)
            . ' attempts. If this re-upload is also rejected, you must bring the original document to the registrar.'
        );
    } else {
        $content .= emailLayoutParagraph(
            'You have ' . $remaining . ' upload attempt' . ($remaining === 1 ? '' : 's')
            . ' remaining (used ' . $attemptsUsed . ' of ' . $attemptLimit . ').'
        );
    }

    $content .= emailLayoutButton($loginUrl, 'Resubmit document in portal');

    $body = renderBrandedEmailHtml(
        'Document resubmission',
        'Please resubmit a required document',
        $content,
        '— Nuestra Señora De Guia Academy Registrar\'s Office'
    );

    return ['subject' => $subject, 'body' => $body];
}

/**
 * @param array{
 *   student_name?: string,
 *   requirement?: string,
 *   remarks?: string,
 *   attempts_used?: int,
 *   attempt_limit?: int,
 *   app_host?: string,
 * } $opts
 */
function sendDocumentResubmissionEmail(PDO $pdo, string $recipientEmail, array $opts): bool
{
    $recipient = trim($recipientEmail);
    if ($recipient === '') {
        return false;
    }
    $rendered = buildDocumentResubmissionEmail($opts);
    try {
        $queueId = queueEmail($pdo, $recipient, $rendered['subject'], $rendered['body']);
        return processSingleQueuedEmail($pdo, $queueId);
    } catch (Throwable $e) {
        return false;
    }
}
