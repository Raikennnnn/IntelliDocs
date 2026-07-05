<?php
declare(strict_types=1);

/**
 * Notifies the student to bring a document to the registrar after upload attempts are exhausted.
 */

require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/email_layout.php';
require_once __DIR__ . '/welcome_email.php';

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
 * @return array{subject:string, body:string}
 */
function buildInPersonVerificationEmail(string $studentName, string $requirement, int $maxAttempts = 5): array
{
    $name = trim($studentName) !== '' ? trim($studentName) : 'Student';
    $subject = 'Action required: bring your ' . $requirement . ' to the registrar';
    $loginUrl = 'https://' . welcomeEmailResolveAppHost() . '/login';

    $content =
        emailLayoutParagraph('Hello ' . $name . ',')
        . emailLayoutParagraph(
            'You have used all ' . $maxAttempts . ' upload attempts for the following requirement:'
        )
        . emailLayoutBulletList([$requirement])
        . emailLayoutParagraph(
            'Because the maximum number of online uploads has been reached, our system can no longer accept another digital copy of this document.'
        )
        . emailLayoutSectionTitle('Next step — face-to-face verification')
        . emailLayoutParagraph(
            'Please bring the original copy of the document above to the registrar\'s office during business hours so we can verify it in person and complete your enrollment.'
        )
        . emailLayoutSectionTitle('What to bring')
        . emailLayoutBulletList([
            'The original requirement listed above',
            'A valid ID (yours or your guardian\'s)',
            'Your application ID (find it on your student portal)',
        ])
        . emailLayoutParagraph('Once verified by the registrar, your enrollment review will continue normally.')
        . emailLayoutButton($loginUrl, 'Open student portal');

    $body = renderBrandedEmailHtml(
        'In-person verification',
        'Bring your document to the registrar',
        $content,
        'If you believe this email was sent in error, visit the registrar\'s office for assistance.'
    );

    return ['subject' => $subject, 'body' => $body];
}

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
        return false;
    }
}
