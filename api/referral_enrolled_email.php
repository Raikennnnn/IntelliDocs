<?php
declare(strict_types=1);

/**
 * Emails the Bring a Friend referrer when the referred student is enrolled.
 */

require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/email_layout.php';
require_once __DIR__ . '/welcome_email.php';
require_once __DIR__ . '/system_settings_helpers.php';

function isReferrerEnrollEmailEnabled(PDO $pdo): bool
{
    $raw = readSystemSetting($pdo, 'email_referrer_on_enroll');
    if ($raw === null || trim((string)$raw) === '') {
        return true;
    }
    $v = strtolower(trim((string)$raw));

    return !in_array($v, ['0', 'false', 'off', 'no'], true);
}

/**
 * @param array{
 *   referrer_name?: string,
 *   referred_student_name?: string,
 *   control_number?: string,
 *   school_year?: string,
 *   app_host?: string,
 * } $opts
 * @return array{subject: string, body: string}
 */
function buildReferralEnrolledEmail(array $opts): array
{
    $referrerName = trim((string)($opts['referrer_name'] ?? ''));
    if ($referrerName === '') {
        $referrerName = 'Friend';
    }
    $studentName = trim((string)($opts['referred_student_name'] ?? ''));
    if ($studentName === '') {
        $studentName = 'your referred student';
    }
    $control = trim((string)($opts['control_number'] ?? ''));
    $schoolYear = trim((string)($opts['school_year'] ?? ''));
    $appHost = isset($opts['app_host']) && trim((string)$opts['app_host']) !== ''
        ? trim((string)$opts['app_host'])
        : welcomeEmailResolveAppHost();
    $homeUrl = 'https://' . $appHost . '/';

    $subject = 'Bring a Friend — your referral was enrolled — NSDGA';

    $metaRows = [];
    if ($control !== '') {
        $metaRows[] = ['label' => 'Control number', 'value' => $control];
    }
    if ($schoolYear !== '') {
        $metaRows[] = ['label' => 'School year', 'value' => $schoolYear];
    }
    $metaRows[] = ['label' => 'Referred student', 'value' => $studentName];

    $content =
        emailLayoutParagraph('Hello ' . $referrerName . ',')
        . emailLayoutParagraph(
            'Thank you for referring a student to Nuestra Señora De Guia Academy through our Bring a Friend promo.'
        )
        . emailLayoutParagraph(
            $studentName . ' has been enrolled. Your referral card is now claimed, and reward tracking is open with the registrar.'
        )
        . emailLayoutCredentialBox($metaRows)
        . emailLayoutSectionTitle('What happens next')
        . emailLayoutBulletList([
            'The referred student may claim their enrollment freebie once the registrar releases it.',
            'Your ₱500 referrer incentive becomes eligible after the referred student completes their first semester.',
            'Please keep your contact details up to date with the registrar\'s office.',
        ])
        . emailLayoutButton($homeUrl, 'Visit NSDGA');

    $body = renderBrandedEmailHtml(
        'Bring a Friend',
        'Your referral was enrolled',
        $content,
        '— Nuestra Señora De Guia Academy Registrar\'s Office'
    );

    return ['subject' => $subject, 'body' => $body];
}

/**
 * @param array{
 *   referrer_name?: string,
 *   referred_student_name?: string,
 *   control_number?: string,
 *   school_year?: string,
 *   app_host?: string,
 * } $opts
 */
function sendReferralEnrolledEmail(PDO $pdo, string $recipientEmail, array $opts): bool
{
    $recipient = trim($recipientEmail);
    if ($recipient === '' || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    $rendered = buildReferralEnrolledEmail($opts);
    try {
        $queueId = queueEmail($pdo, $recipient, $rendered['subject'], $rendered['body']);

        return processSingleQueuedEmail($pdo, $queueId);
    } catch (Throwable $e) {
        return false;
    }
}

/**
 * Best-effort notify after a claim is linked on approve. Never throws.
 *
 * @param array<string, mixed> $formData enrollment form_data (for student name)
 * @return array{ok: bool, sent?: bool, skipped?: string, error?: string}
 */
function notifyReferrerAfterReferralClaim(
    PDO $pdo,
    int $claimId,
    array $formData = [],
    bool $forceResend = false,
): array {
    if ($claimId <= 0) {
        return ['ok' => false, 'skipped' => 'invalid_claim'];
    }

    if (!$forceResend && !isReferrerEnrollEmailEnabled($pdo)) {
        return ['ok' => true, 'sent' => false, 'skipped' => 'disabled'];
    }

    require_once __DIR__ . '/referral_promo_helpers.php';
    ensureReferralPromoSchema($pdo);

    $stmt = $pdo->prepare('SELECT * FROM referral_promo_claims WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $claimId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return ['ok' => false, 'skipped' => 'claim_not_found'];
    }

    $email = trim((string)($row['referrer_email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => true, 'sent' => false, 'skipped' => 'no_email'];
    }

    $notifiedAt = trim((string)($row['referrer_notified_at'] ?? ''));
    if (!$forceResend && $notifiedAt !== '') {
        return ['ok' => true, 'sent' => false, 'skipped' => 'already_notified'];
    }

    $studentName = referralReferredStudentNameFromForm($formData);
    if ($studentName === '') {
        $studentName = trim((string)($row['referred_student_name'] ?? ''));
    }
    if ($studentName === '' && !empty($row['enrollment_id'])) {
        $studentName = referralReferredStudentNameFromEnrollment($pdo, (int)$row['enrollment_id']);
    }

    $sent = sendReferralEnrolledEmail($pdo, $email, [
        'referrer_name' => (string)($row['referrer_name'] ?? ''),
        'referred_student_name' => $studentName,
        'control_number' => (string)($row['control_number'] ?? ''),
        'school_year' => (string)($row['school_year'] ?? ''),
    ]);

    if ($sent) {
        try {
            $upd = $pdo->prepare(
                'UPDATE referral_promo_claims
                    SET referrer_notified_at = NOW(), updated_at = NOW()
                  WHERE id = :id'
            );
            $upd->execute([':id' => $claimId]);
        } catch (Throwable $e) {
            // Still report send success even if stamp fails.
        }

        return ['ok' => true, 'sent' => true];
    }

    return ['ok' => false, 'sent' => false, 'error' => 'send_failed'];
}

/**
 * @param array<string, mixed> $formData
 */
function referralReferredStudentNameFromForm(array $formData): string
{
    $given = trim((string)($formData['givenName'] ?? $formData['firstName'] ?? ''));
    $middle = trim((string)($formData['middleName'] ?? ''));
    $last = trim((string)($formData['lastName'] ?? ''));
    $parts = array_filter([$given, $middle, $last], static fn($p) => $p !== '');

    return trim(implode(' ', $parts));
}

function referralReferredStudentNameFromEnrollment(PDO $pdo, int $enrollmentId): string
{
    if ($enrollmentId <= 0) {
        return '';
    }
    try {
        $stmt = $pdo->prepare(
            'SELECT u.full_name, e.enrollment_steps
               FROM enrollments e
               INNER JOIN users u ON u.id = e.user_id
              WHERE e.id = :id
              LIMIT 1'
        );
        $stmt->execute([':id' => $enrollmentId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return '';
        }
        $full = trim((string)($row['full_name'] ?? ''));
        if ($full !== '') {
            return $full;
        }
        $steps = json_decode((string)($row['enrollment_steps'] ?? '{}'), true);
        $form = is_array($steps) && is_array($steps['form_data'] ?? null) ? $steps['form_data'] : [];

        return referralReferredStudentNameFromForm($form);
    } catch (Throwable $e) {
        return '';
    }
}
