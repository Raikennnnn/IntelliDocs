<?php
declare(strict_types=1);

/**
 * Sends a one-time notification to the student when they have exhausted
 * the maximum number of upload attempts (5) for a specific requirement.
 *
 * The email tells the student to bring the original document to the
 * registrar's office for face-to-face verification. The same template is
 * used regardless of which document type tripped the limit; only the
 * requirement label changes.
 */

require_once __DIR__ . '/mailer.php';

/**
 * Human-readable label for a requirement type key (mirrors the mapping in
 * api/student_me.php so students always see consistent wording).
 */
function inPersonRequirementLabel(string $type): string
{
    $t = strtolower(trim($type));
    switch ($t) {
        case 'birth_certificate':
        case 'birthcert':
        case 'psa':
            return 'PSA Birth Certificate';
        case 'good_moral':
        case 'goodmoral':
            return 'Good Moral Certificate';
        case 'sf9':
        case 'report_card':
            return 'SF9 / Report Card';
        case 'form137':
        case 'sf10':
            return 'SF10 / Form 137';
        case 'photo_2x2':
        case 'id_picture':
        case 'picture_2x2':
            return '2x2 Picture (White Background)';
        case '':
        case 'document':
            return 'Required Document';
        default:
            $pretty = preg_replace('/[_\-]+/', ' ', $t) ?? $t;
            return ucwords(trim($pretty));
    }
}

/**
 * Build the email subject + body that informs the student they need to
 * bring the document in person.
 *
 * @param string $studentName  Full name of the student (used for greeting).
 * @param string $requirement  Human-readable requirement label.
 * @param int    $maxAttempts  Maximum allowed attempts (informational).
 * @return array{subject:string, body:string}
 */
function buildInPersonVerificationEmail(string $studentName, string $requirement, int $maxAttempts = 5): array
{
    $name = trim($studentName) !== '' ? trim($studentName) : 'Student';
    $subject = 'Action required: bring your ' . $requirement . ' to the registrar';

    $body = "Hello {$name},\n\n"
        . "You have used all {$maxAttempts} upload attempts for the following requirement:\n\n"
        . "    • {$requirement}\n\n"
        . "Because the maximum number of online uploads has been reached, our system can "
        . "no longer accept another digital copy of this document.\n\n"
        . "Next step — face-to-face verification\n"
        . "Please bring the ORIGINAL copy of the document above to the registrar's office "
        . "during business hours so we can verify it in person and complete your enrollment.\n\n"
        . "What to bring:\n"
        . "    • The original requirement listed above\n"
        . "    • A valid ID (yours or your guardian's)\n"
        . "    • Your application ID (you can find it on your student portal)\n\n"
        . "Once verified by the registrar, your enrollment review will continue normally.\n\n"
        . "If you believe this email was sent in error, please reply to this message or "
        . "visit the registrar's office for assistance.\n\n"
        . "— Nuestra Señora De Guia Academy Registrar's Office";

    return ['subject' => $subject, 'body' => $body];
}

/**
 * Queue (and immediately try to deliver) the in-person verification email
 * to the given recipient. Returns true when the email was successfully
 * dispatched, false when delivery failed (the row is still in the queue
 * for the background processor to retry).
 */
function sendInPersonVerificationEmail(
    PDO $pdo,
    string $recipientEmail,
    string $studentName,
    string $requirement,
    int $maxAttempts = 5
): bool {
    $recipient = trim($recipientEmail);
    if ($recipient === '') {
        return false;
    }

    $rendered = buildInPersonVerificationEmail($studentName, $requirement, $maxAttempts);
    try {
        $queueId = queueEmail($pdo, $recipient, $rendered['subject'], $rendered['body']);
        return processSingleQueuedEmail($pdo, $queueId);
    } catch (Throwable $e) {
        // Swallow the error: the email queue is best-effort. The upload
        // endpoint should still return its "limit reached" response even
        // when the email transport is down.
        return false;
    }
}
