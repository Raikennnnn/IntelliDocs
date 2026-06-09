<?php
declare(strict_types=1);

/**
 * Confirms to the student that their enrollment application was submitted.
 */

require_once __DIR__ . '/mailer.php';

/**
 * @param array{
 *   student_name?: string,
 *   application_id?: string,
 *   school_year?: string,
 *   strand?: string,
 *   grade_level?: string,
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

    $subject = 'Enrollment application received — IntelliDocs';

    $body = "Hello {$name},\n\n"
        . "Your enrollment application has been successfully submitted.\n\n";

    if ($appId !== '') {
        $body .= "Application ID: {$appId}\n";
    }
    if ($sy !== '') {
        $body .= "School year: {$sy}\n";
    }
    if ($grade !== '') {
        $body .= "Grade level: {$grade}\n";
    }
    if ($strand !== '') {
        $body .= "Strand: {$strand}\n";
    }

    $body .= "\nWhat happens next\n"
        . "----------------\n"
        . "1. Our AI system will verify your uploaded documents.\n"
        . "2. The registrar will review your application.\n"
        . "3. You will receive email updates when a decision is made or if a document needs resubmission.\n\n"
        . "Track progress anytime in the student portal under Application Status.\n\n"
        . "— Nuestra Señora De Guia Academy\n";

    return ['subject' => $subject, 'body' => $body];
}

/**
 * @param array{
 *   student_name?: string,
 *   application_id?: string,
 *   school_year?: string,
 *   strand?: string,
 *   grade_level?: string,
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
