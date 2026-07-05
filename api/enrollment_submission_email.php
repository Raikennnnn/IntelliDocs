<?php
declare(strict_types=1);

/**
 * Confirms to the student that their enrollment application was submitted.
 */

require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/email_layout.php';
require_once __DIR__ . '/welcome_email.php';

/**
 * @param array{
 *   student_name?: string,
 *   application_id?: string,
 *   school_year?: string,
 *   strand?: string,
 *   grade_level?: string,
 *   app_host?: string,
 * } $opts
 * @return array{subject: string, body: string}
 */
function buildEnrollmentSubmissionEmail(array $opts): array
{
    $name = trim((string)($opts['student_name'] ?? ''));
    if ($name === '') {
        $name = 'Student';
    }
    $appId = trim((string)($opts['application_id'] ?? ''));
    $sy = trim((string)($opts['school_year'] ?? ''));
    $strand = trim((string)($opts['strand'] ?? ''));
    $grade = trim((string)($opts['grade_level'] ?? ''));

    $appHost = isset($opts['app_host']) && trim((string)$opts['app_host']) !== ''
        ? trim((string)$opts['app_host'])
        : welcomeEmailResolveAppHost();
    $loginUrl = 'https://' . $appHost . '/login';

    $subject = 'Enrollment application received — IntelliDocs';

    $metaRows = [];
    if ($appId !== '') {
        $metaRows[] = ['label' => 'Application ID', 'value' => $appId];
    }
    if ($sy !== '') {
        $metaRows[] = ['label' => 'School year', 'value' => $sy];
    }
    if ($grade !== '') {
        $metaRows[] = ['label' => 'Grade level', 'value' => $grade];
    }
    if ($strand !== '') {
        $metaRows[] = ['label' => 'Strand', 'value' => $strand];
    }

    $content =
        emailLayoutParagraph('Hello ' . $name . ',')
        . emailLayoutParagraph('Your enrollment application has been successfully submitted.')
        . emailLayoutCredentialBox($metaRows)
        . emailLayoutSectionTitle('What happens next')
        . emailLayoutBulletList([
            'Our AI system will verify your uploaded documents.',
            'The registrar will review your application.',
            'You will receive email updates when a decision is made or if a document needs resubmission.',
        ])
        . emailLayoutParagraph('Track progress anytime in the student portal under Application Status.')
        . emailLayoutButton($loginUrl, 'View application status');

    $body = renderBrandedEmailHtml(
        'Application received',
        'Enrollment application submitted',
        $content
    );

    return ['subject' => $subject, 'body' => $body];
}

/**
 * @param array{
 *   student_name?: string,
 *   application_id?: string,
 *   school_year?: string,
 *   strand?: string,
 *   grade_level?: string,
 *   app_host?: string,
 * } $opts
 */
function sendEnrollmentSubmissionEmail(PDO $pdo, string $recipientEmail, array $opts): bool
{
    $recipient = trim($recipientEmail);
    if ($recipient === '') {
        return false;
    }
    $rendered = buildEnrollmentSubmissionEmail($opts);
    try {
        $queueId = queueEmail($pdo, $recipient, $rendered['subject'], $rendered['body']);
        return processSingleQueuedEmail($pdo, $queueId);
    } catch (Throwable $e) {
        return false;
    }
}
