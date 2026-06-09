<?php
declare(strict_types=1);

/**
 * Notifies the student that the registrar has rejected one of their
 * uploaded documents and that they need to resubmit it.
 *
 * The same template includes the registrar's remarks (so the student knows
 * exactly what to fix) and the number of upload attempts they have left
 * out of the per-document maximum, mirroring the messaging on the student
 * portal.
 */

require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/in_person_verification_email.php';

/**
 * Build the subject + body for the "document rejected" email.
 *
 * @param array{
 *   student_name?: string,
 *   requirement?: string,
 *   remarks?: string,
 *   attempts_used?: int,
 *   attempt_limit?: int,
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

    $subject = 'Action required: please resubmit your ' . $requirement;

    $body = "Hello {$name},\n\n"
        . "The registrar has reviewed your uploaded document and is asking you to "
        . "resubmit the following requirement:\n\n"
        . "    • {$requirement}\n\n";

    if ($remarks !== '') {
        $body .= "Registrar's note\n"
            . "-----------------\n"
            . $remarks . "\n\n";
    }

    $body .= "What to do next\n"
        . "----------------\n"
        . "1. Log in to your student portal.\n"
        . "2. Open Application Status (or the Enrollment page) and find the "
        . "document marked \"Resubmission required\".\n"
        . "3. Click \"Resubmit\" and upload a clearer, complete copy that "
        . "addresses the registrar's note above.\n\n";

    if ($remaining <= 0) {
        // Shouldn't really happen — the registrar can't reject a document
        // whose upload cap has already been reached — but we handle it
        // gracefully so the student isn't left without instructions.
        $body .= "Important: You have already used all {$attemptLimit} of your upload attempts "
            . "for this requirement, so the system can no longer accept another digital copy. "
            . "Please bring the ORIGINAL document to the registrar's office for face-to-face "
            . "verification.\n\n";
    } elseif ($onLastChance) {
        $body .= "Important: You have ALREADY USED {$attemptsUsed} of your {$attemptLimit} "
            . "upload attempts for this requirement. This will be your LAST allowed upload. "
            . "If this re-upload is also rejected, you will need to bring the original "
            . "document to the registrar's office for face-to-face verification.\n\n";
    } else {
        $body .= "You have {$remaining} upload attempt" . ($remaining === 1 ? '' : 's')
            . " remaining for this requirement (you've used {$attemptsUsed} of {$attemptLimit}). "
            . "After all attempts are used, the document must be brought in person to the "
            . "registrar.\n\n";
    }

    $body .= "If you believe the rejection was made in error or you need help preparing the "
        . "new file, please reply to this message or visit the registrar's office.\n\n"
        . "— Nuestra Señora De Guia Academy Registrar's Office";

    return ['subject' => $subject, 'body' => $body];
}

/**
 * Queue and immediately try to deliver the resubmission email. Returns
 * true on successful dispatch, false on failure (the queued row remains
 * for the background worker to retry).
 *
 * @param array{
 *   student_name?: string,
 *   requirement?: string,
 *   remarks?: string,
 *   attempts_used?: int,
 *   attempt_limit?: int,
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
