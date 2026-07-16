<?php
declare(strict_types=1);

/**
 * Bring a Friend promo: one-time referral control numbers per school year.
 */

require_once __DIR__ . '/enrollment_status_helpers.php';

const REFERRAL_CONTROL_DIGIT_LENGTH = 5;
const REFERRAL_CONTROL_MAX_VALUE = 99999;

/** @return list<string> */
function referralPromoReferrerTypes(): array
{
    return [
        'enrolled_student',
        'graduate',
        'parent_civilian',
        'visitation',
        'other_civilian',
    ];
}

function referralPromoReferrerTypeLabel(string $type): string
{
    return match (strtolower(trim($type))) {
        'enrolled_student' => 'Enrolled student',
        'graduate' => 'Graduate',
        'parent_civilian' => 'Parent / civilian',
        'visitation' => 'School visitation',
        'other_civilian' => 'Other civilian',
        default => ucwords(str_replace('_', ' ', trim($type))),
    };
}

function referralPromoFreebieStatusLabel(string $status): string
{
    return match (strtolower(trim($status))) {
        'eligible' => 'Eligible (awaiting release)',
        'given' => 'Given',
        'void' => 'Void',
        default => 'Pending enrollment approval',
    };
}

function referralPromoIncentiveStatusLabel(string $status): string
{
    return match (strtolower(trim($status))) {
        'eligible' => 'Eligible for ₱500 (1st semester completed)',
        'paid' => 'Paid',
        'void' => 'Void',
        default => 'Pending (after referred completes 1st semester)',
    };
}

function ensureReferralPromoSchema(PDO $pdo): void
{
    if (!enrollmentTableExists($pdo, 'referral_promo_claims')) {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS referral_promo_claims (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                school_year VARCHAR(30) NOT NULL,
                control_number CHAR(5) NOT NULL,
                enrollment_id INT NULL,
                referrer_name VARCHAR(120) NOT NULL,
                referrer_contact VARCHAR(20) NOT NULL,
                referrer_email VARCHAR(190) NOT NULL DEFAULT '',
                referrer_type VARCHAR(40) NOT NULL,
                referred_freebie_status ENUM('pending', 'eligible', 'given', 'void') NOT NULL DEFAULT 'pending',
                referrer_incentive_status ENUM('pending', 'eligible', 'void', 'paid') NOT NULL DEFAULT 'pending',
                first_semester_completed_at DATETIME NULL,
                void_reason VARCHAR(255) NULL,
                claimed_at DATETIME NULL,
                referrer_notified_at DATETIME NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_referral_sy_control (school_year, control_number),
                INDEX idx_referral_enrollment (enrollment_id),
                INDEX idx_referral_incentive (referrer_incentive_status),
                INDEX idx_referral_freebie (referred_freebie_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    } else {
        $colStmt = $pdo->prepare(
            'SELECT 1 FROM information_schema.columns
              WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column
              LIMIT 1'
        );
        $colStmt->execute([':table' => 'referral_promo_claims', ':column' => 'referrer_email']);
        if (!$colStmt->fetchColumn()) {
            $pdo->exec(
                "ALTER TABLE referral_promo_claims
                    ADD COLUMN referrer_email VARCHAR(190) NOT NULL DEFAULT ''
                    AFTER referrer_contact"
            );
        }

        $colStmt->execute([':table' => 'referral_promo_claims', ':column' => 'referrer_notified_at']);
        if (!$colStmt->fetchColumn()) {
            $pdo->exec(
                "ALTER TABLE referral_promo_claims
                    ADD COLUMN referrer_notified_at DATETIME NULL
                    AFTER claimed_at"
            );
        }

        migrateReferralControlNumberWidth($pdo);
    }
}

function migrateReferralControlNumberWidth(PDO $pdo): void
{
    $lenStmt = $pdo->prepare(
        'SELECT CHARACTER_MAXIMUM_LENGTH
           FROM information_schema.columns
          WHERE table_schema = DATABASE()
            AND table_name = :table
            AND column_name = :column
          LIMIT 1'
    );
    $lenStmt->execute([':table' => 'referral_promo_claims', ':column' => 'control_number']);
    $currentLen = (int)($lenStmt->fetchColumn() ?: REFERRAL_CONTROL_DIGIT_LENGTH);
    if ($currentLen === REFERRAL_CONTROL_DIGIT_LENGTH) {
        return;
    }

    // Widen first when growing (e.g. CHAR(4) -> CHAR(5)) so padded values fit.
    if ($currentLen < REFERRAL_CONTROL_DIGIT_LENGTH) {
        $pdo->exec(
            'ALTER TABLE referral_promo_claims
                MODIFY control_number CHAR(' . REFERRAL_CONTROL_DIGIT_LENGTH . ') NOT NULL'
        );
    }

    $rows = $pdo->query(
        'SELECT id, school_year, control_number FROM referral_promo_claims ORDER BY id ASC'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $seen = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $normalized = normalizeReferralControlNumber((string)($row['control_number'] ?? ''));
        if ($normalized === '') {
            continue;
        }
        $key = (string)($row['school_year'] ?? '') . '|' . $normalized;
        if (isset($seen[$key])) {
            throw new RuntimeException(
                'Cannot migrate referral control numbers to '
                . REFERRAL_CONTROL_DIGIT_LENGTH . ' digits: duplicate '
                . $normalized . ' for school year ' . (string)($row['school_year'] ?? '')
            );
        }
        $seen[$key] = true;
        $upd = $pdo->prepare('UPDATE referral_promo_claims SET control_number = :control WHERE id = :id');
        $upd->execute([
            ':control' => $normalized,
            ':id' => (int)($row['id'] ?? 0),
        ]);
    }

    if ($currentLen > REFERRAL_CONTROL_DIGIT_LENGTH) {
        $pdo->exec(
            'ALTER TABLE referral_promo_claims
                MODIFY control_number CHAR(' . REFERRAL_CONTROL_DIGIT_LENGTH . ') NOT NULL'
        );
    }
}

function normalizeReferrerEmail(string $raw): string
{
    return strtolower(trim($raw));
}

function normalizeReferralControlNumber(string $raw): string
{
    $digits = preg_replace('/\D+/', '', trim($raw)) ?? '';
    if ($digits === '') {
        return '';
    }

    // Accept legacy 4/6-digit cards by numeric value (e.g. 0001 / 000001 -> 00001).
    $num = (int)$digits;
    if ($num < 1 || $num > REFERRAL_CONTROL_MAX_VALUE) {
        return '';
    }

    return str_pad((string)$num, REFERRAL_CONTROL_DIGIT_LENGTH, '0', STR_PAD_LEFT);
}

/** @return array{has_referral: bool, control_number: string, referrer_name: string, referrer_contact: string, referrer_email: string, referrer_type: string} */
function referralPromoDataFromForm(array $formData): array
{
    $hasReferral = !empty($formData['hasReferralCode']);
    if (!$hasReferral) {
        return [
            'has_referral' => false,
            'control_number' => '',
            'referrer_name' => '',
            'referrer_contact' => '',
            'referrer_email' => '',
            'referrer_type' => '',
        ];
    }

    return [
        'has_referral' => true,
        'control_number' => normalizeReferralControlNumber((string)($formData['referralCardControlNumber'] ?? '')),
        'referrer_name' => trim((string)($formData['referrerName'] ?? '')),
        'referrer_contact' => preg_replace('/\D+/', '', (string)($formData['referrerContactNumber'] ?? '')) ?? '',
        'referrer_email' => normalizeReferrerEmail((string)($formData['referrerEmail'] ?? '')),
        'referrer_type' => strtolower(trim((string)($formData['referrerType'] ?? ''))),
    ];
}

/**
 * @return array{ok: true}|array{ok: false, error: string, code: string}
 */
function validateReferralPromoFormData(array $formData): array
{
    $data = referralPromoDataFromForm($formData);
    if (!$data['has_referral']) {
        if (!array_key_exists('hasReferralCode', $formData) || $formData['hasReferralCode'] === null) {
            return ['ok' => false, 'error' => 'Please indicate whether you have a Bring a Friend referral card.', 'code' => 'referral_choice_required'];
        }

        return ['ok' => true];
    }

    if ($data['control_number'] === '' || !preg_match('/^\d{5}$/', $data['control_number'])) {
        return ['ok' => false, 'error' => 'Referral card control number must be a 5-digit number.', 'code' => 'referral_control_invalid'];
    }
    if ($data['referrer_name'] === '') {
        return ['ok' => false, 'error' => "Referrer's name is required.", 'code' => 'referrer_name_required'];
    }
    if ($data['referrer_contact'] === '' || !preg_match('/^09\d{9}$/', $data['referrer_contact'])) {
        return ['ok' => false, 'error' => "Referrer's contact number must be 11 digits starting with 09.", 'code' => 'referrer_contact_invalid'];
    }
    if ($data['referrer_email'] === '' || filter_var($data['referrer_email'], FILTER_VALIDATE_EMAIL) === false) {
        return ['ok' => false, 'error' => "Referrer's email address is required and must be valid.", 'code' => 'referrer_email_invalid'];
    }
    if (!in_array($data['referrer_type'], referralPromoReferrerTypes(), true)) {
        return ['ok' => false, 'error' => 'Please select who the referrer is.', 'code' => 'referrer_type_required'];
    }

    return ['ok' => true];
}

/**
 * @return array{ok: true}|array{ok: false, error: string, code: string}
 */
function validateReferralControlAvailable(
    PDO $pdo,
    string $schoolYear,
    string $controlNumber,
    int $currentEnrollmentId = 0,
): array {
    ensureReferralPromoSchema($pdo);
    $sy = trim($schoolYear);
    $control = normalizeReferralControlNumber($controlNumber);
    if ($sy === '' || $control === '') {
        return ['ok' => false, 'error' => 'Referral validation failed.', 'code' => 'referral_invalid'];
    }

    $stmt = $pdo->prepare(
        'SELECT id, enrollment_id
           FROM referral_promo_claims
          WHERE school_year = :sy AND control_number = :control
          LIMIT 1'
    );
    $stmt->execute([':sy' => $sy, ':control' => $control]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || !is_array($row)) {
        return [
            'ok' => false,
            'error' => 'This referral control number was not issued for the current school year. Check the number printed on your card.',
            'code' => 'referral_control_not_found',
        ];
    }

    $claimedEnrollmentId = (int)($row['enrollment_id'] ?? 0);
    if ($claimedEnrollmentId > 0 && $claimedEnrollmentId !== $currentEnrollmentId) {
        return [
            'ok' => false,
            'error' => 'This referral card has already been used for this enrollment period.',
            'code' => 'referral_control_used',
        ];
    }

    return ['ok' => true];
}

/**
 * @return array<string, mixed>|null
 */
function fetchReferralPromoClaimForEnrollment(PDO $pdo, int $enrollmentId): ?array
{
    if ($enrollmentId <= 0) {
        return null;
    }
    ensureReferralPromoSchema($pdo);
    $stmt = $pdo->prepare(
        'SELECT *
           FROM referral_promo_claims
          WHERE enrollment_id = :eid
          ORDER BY id DESC
          LIMIT 1'
    );
    $stmt->execute([':eid' => $enrollmentId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row ?: null;
}

/**
 * Claim control number and open reward tracking when enrollment is approved.
 *
 * @return array{ok: bool, code?: string, error?: string, claim_id?: int}
 */
function finalizeReferralPromoOnEnrollmentApproval(
    PDO $pdo,
    int $enrollmentId,
    string $schoolYear,
    array $formData,
): array {
    $data = referralPromoDataFromForm($formData);
    if (!$data['has_referral']) {
        return ['ok' => true];
    }

    $validation = validateReferralPromoFormData($formData);
    if ($validation['ok'] !== true) {
        return ['ok' => false, 'code' => (string)($validation['code'] ?? 'referral_invalid'), 'error' => (string)($validation['error'] ?? 'Invalid referral data.')];
    }

    $availability = validateReferralControlAvailable($pdo, $schoolYear, $data['control_number'], $enrollmentId);
    if ($availability['ok'] !== true) {
        return ['ok' => false, 'code' => (string)($availability['code'] ?? 'referral_control_used'), 'error' => (string)($availability['error'] ?? 'Referral card already used.')];
    }

    ensureReferralPromoSchema($pdo);
    $sy = trim($schoolYear);
    $control = $data['control_number'];

    $existingStmt = $pdo->prepare(
        'SELECT id FROM referral_promo_claims
          WHERE school_year = :sy AND control_number = :control
          LIMIT 1'
    );
    $existingStmt->execute([':sy' => $sy, ':control' => $control]);
    $existingId = (int)($existingStmt->fetchColumn() ?: 0);

    if ($existingId > 0) {
        $upd = $pdo->prepare(
            'UPDATE referral_promo_claims
                SET enrollment_id = :eid,
                    referrer_name = :name,
                    referrer_contact = :contact,
                    referrer_email = :email,
                    referrer_type = :type,
                    referred_freebie_status = "eligible",
                    referrer_incentive_status = "pending",
                    claimed_at = COALESCE(claimed_at, NOW()),
                    updated_at = NOW()
              WHERE id = :id'
        );
        $upd->execute([
            ':eid' => $enrollmentId,
            ':name' => $data['referrer_name'],
            ':contact' => $data['referrer_contact'],
            ':email' => $data['referrer_email'],
            ':type' => $data['referrer_type'],
            ':id' => $existingId,
        ]);

        $claimId = $existingId;
    } else {
        $ins = $pdo->prepare(
            'INSERT INTO referral_promo_claims (
                school_year, control_number, enrollment_id, referrer_name, referrer_contact, referrer_email, referrer_type,
                referred_freebie_status, referrer_incentive_status, claimed_at
            ) VALUES (
                :sy, :control, :eid, :name, :contact, :email, :type, "eligible", "pending", NOW()
            )'
        );
        $ins->execute([
            ':sy' => $sy,
            ':control' => $control,
            ':eid' => $enrollmentId,
            ':name' => $data['referrer_name'],
            ':contact' => $data['referrer_contact'],
            ':email' => $data['referrer_email'],
            ':type' => $data['referrer_type'],
        ]);
        $claimId = (int)$pdo->lastInsertId();
    }

    // Best-effort: never fail enrollment approval if mail fails.
    try {
        require_once __DIR__ . '/referral_enrolled_email.php';
        notifyReferrerAfterReferralClaim($pdo, $claimId, $formData, false);
    } catch (Throwable $e) {
        // Ignore mail errors here; approve path logs separately if needed.
    }

    return ['ok' => true, 'claim_id' => $claimId];
}

/**
 * @return array<string, mixed>
 */
function referralPromoClaimToApiPayload(?array $row): array
{
    if (!$row || !is_array($row)) {
        return [];
    }

    return [
        'id' => (int)($row['id'] ?? 0),
        'schoolYear' => (string)($row['school_year'] ?? ''),
        'controlNumber' => (string)($row['control_number'] ?? ''),
        'enrollmentId' => isset($row['enrollment_id']) && $row['enrollment_id'] !== null && (int)$row['enrollment_id'] > 0
            ? (int)$row['enrollment_id']
            : null,
        'referrerName' => (string)($row['referrer_name'] ?? ''),
        'referrerContactNumber' => (string)($row['referrer_contact'] ?? ''),
        'referrerEmail' => (string)($row['referrer_email'] ?? ''),
        'referrerType' => (string)($row['referrer_type'] ?? ''),
        'referrerTypeLabel' => referralPromoReferrerTypeLabel((string)($row['referrer_type'] ?? '')),
        'referredFreebieStatus' => (string)($row['referred_freebie_status'] ?? 'pending'),
        'referredFreebieStatusLabel' => referralPromoFreebieStatusLabel((string)($row['referred_freebie_status'] ?? 'pending')),
        'referrerIncentiveStatus' => (string)($row['referrer_incentive_status'] ?? 'pending'),
        'referrerIncentiveStatusLabel' => referralPromoIncentiveStatusLabel((string)($row['referrer_incentive_status'] ?? 'pending')),
        'claimedAt' => (string)($row['claimed_at'] ?? ''),
        'referrerNotifiedAt' => (string)($row['referrer_notified_at'] ?? ''),
        'firstSemesterCompletedAt' => (string)($row['first_semester_completed_at'] ?? ''),
        'voidReason' => (string)($row['void_reason'] ?? ''),
        'isPreissued' => referralPromoClaimIsPreissued($row),
        'referredStudentName' => (string)($row['referred_student_name'] ?? ''),
        'applicationId' => referralPromoApplicationIdFromEnrollmentId(
            isset($row['enrollment_id']) ? (int)$row['enrollment_id'] : 0
        ),
        'createdAt' => (string)($row['created_at'] ?? ''),
        'updatedAt' => (string)($row['updated_at'] ?? ''),
    ];
}

function referralPromoPreissuePlaceholderName(): string
{
    return '(Pre-issued card)';
}

function referralPromoClaimIsPreissued(array $row): bool
{
    $enrollmentId = (int)($row['enrollment_id'] ?? 0);
    if ($enrollmentId > 0) {
        return false;
    }

    $name = trim((string)($row['referrer_name'] ?? ''));

    return $name === '' || $name === referralPromoPreissuePlaceholderName();
}

function referralPromoApplicationIdFromEnrollmentId(int $enrollmentId): string
{
    if ($enrollmentId <= 0) {
        return '';
    }

    return 'APP-' . date('Y') . '-' . str_pad((string)$enrollmentId, 3, '0', STR_PAD_LEFT);
}

/**
 * @return array{ok: true, control_numbers: list<string>}|array{ok: false, error: string, code: string}
 */
function preissueReferralControlNumbers(PDO $pdo, string $schoolYear, int $count, ?string $startControl = null): array
{
    ensureReferralPromoSchema($pdo);
    $sy = trim($schoolYear);
    if ($sy === '') {
        return ['ok' => false, 'error' => 'School year is required.', 'code' => 'school_year_required'];
    }
    if ($count < 1 || $count > 500) {
        return ['ok' => false, 'error' => 'Issue between 1 and 500 control numbers at a time.', 'code' => 'invalid_count'];
    }

    $maxStmt = $pdo->prepare(
        'SELECT MAX(CAST(control_number AS UNSIGNED)) FROM referral_promo_claims WHERE school_year = :sy'
    );
    $maxStmt->execute([':sy' => $sy]);
    $maxExisting = (int)($maxStmt->fetchColumn() ?: 0);

    $startNum = 1;
    if ($startControl !== null && trim($startControl) !== '') {
        $startNum = (int)normalizeReferralControlNumber($startControl);
        if ($startNum < 1 || $startNum > REFERRAL_CONTROL_MAX_VALUE) {
            return ['ok' => false, 'error' => 'Invalid starting control number.', 'code' => 'invalid_control'];
        }
    } elseif ($maxExisting > 0) {
        $startNum = $maxExisting + 1;
    }

    if ($startNum + $count - 1 > REFERRAL_CONTROL_MAX_VALUE) {
        return ['ok' => false, 'error' => 'Control number range exceeds ' . REFERRAL_CONTROL_MAX_VALUE . '.', 'code' => 'range_exceeded'];
    }

    $issued = [];
    $placeholderName = referralPromoPreissuePlaceholderName();
    $ins = $pdo->prepare(
        'INSERT INTO referral_promo_claims (
            school_year, control_number, enrollment_id, referrer_name, referrer_contact, referrer_email, referrer_type,
            referred_freebie_status, referrer_incentive_status
        ) VALUES (
            :sy, :control, NULL, :name, :contact, :email, :type, "pending", "pending"
        )'
    );

    for ($i = 0; $i < $count; $i++) {
        $control = str_pad((string)($startNum + $i), REFERRAL_CONTROL_DIGIT_LENGTH, '0', STR_PAD_LEFT);
        $check = validateReferralControlAvailable($pdo, $sy, $control, 0);
        if (($check['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'error' => "Control number {$control} is already in use.",
                'code' => 'referral_control_used',
            ];
        }
        try {
            $ins->execute([
                ':sy' => $sy,
                ':control' => $control,
                ':name' => $placeholderName,
                ':contact' => '09000000000',
                ':email' => '',
                ':type' => 'other_civilian',
            ]);
            $issued[] = $control;
        } catch (Throwable $e) {
            return [
                'ok' => false,
                'error' => "Failed to issue control number {$control}.",
                'code' => 'preissue_failed',
            ];
        }
    }

    return ['ok' => true, 'control_numbers' => $issued];
}

/**
 * @return array{ok: true, claim: array<string, mixed>}|array{ok: false, error: string, code: string}
 */
function updateReferralPromoClaimStatus(PDO $pdo, int $claimId, string $action, string $voidReason = ''): array
{
    ensureReferralPromoSchema($pdo);
    if ($claimId <= 0) {
        return ['ok' => false, 'error' => 'Invalid claim id.', 'code' => 'invalid_claim'];
    }

    $stmt = $pdo->prepare('SELECT * FROM referral_promo_claims WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $claimId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || !is_array($row)) {
        return ['ok' => false, 'error' => 'Referral claim not found.', 'code' => 'not_found'];
    }

    $freebie = strtolower(trim((string)($row['referred_freebie_status'] ?? 'pending')));
    $incentive = strtolower(trim((string)($row['referrer_incentive_status'] ?? 'pending')));
    $enrollmentId = (int)($row['enrollment_id'] ?? 0);

    switch ($action) {
        case 'mark_freebie_given':
            if (!in_array($freebie, ['eligible', 'pending'], true)) {
                return ['ok' => false, 'error' => 'Freebie cannot be marked given from its current status.', 'code' => 'invalid_transition'];
            }
            if ($enrollmentId <= 0) {
                return ['ok' => false, 'error' => 'Card is not linked to an enrolled student yet.', 'code' => 'not_claimed'];
            }
            $pdo->prepare(
                'UPDATE referral_promo_claims SET referred_freebie_status = "given", updated_at = NOW() WHERE id = :id'
            )->execute([':id' => $claimId]);
            break;

        case 'mark_first_semester_complete':
            if ($enrollmentId <= 0) {
                return ['ok' => false, 'error' => 'Card is not linked to an enrolled student yet.', 'code' => 'not_claimed'];
            }
            if (in_array($incentive, ['paid', 'void'], true)) {
                return ['ok' => false, 'error' => 'Incentive is already finalized.', 'code' => 'invalid_transition'];
            }
            $pdo->prepare(
                'UPDATE referral_promo_claims
                    SET referrer_incentive_status = "eligible",
                        first_semester_completed_at = COALESCE(first_semester_completed_at, NOW()),
                        updated_at = NOW()
                  WHERE id = :id'
            )->execute([':id' => $claimId]);
            break;

        case 'mark_incentive_paid':
            if ($incentive !== 'eligible') {
                return ['ok' => false, 'error' => 'Incentive must be eligible before marking paid.', 'code' => 'invalid_transition'];
            }
            $pdo->prepare(
                'UPDATE referral_promo_claims SET referrer_incentive_status = "paid", updated_at = NOW() WHERE id = :id'
            )->execute([':id' => $claimId]);
            break;

        case 'void':
            $reason = trim($voidReason);
            if ($reason === '') {
                return ['ok' => false, 'error' => 'Void reason is required.', 'code' => 'void_reason_required'];
            }
            if ($incentive === 'paid') {
                return ['ok' => false, 'error' => 'Paid incentives cannot be voided.', 'code' => 'invalid_transition'];
            }
            $pdo->prepare(
                'UPDATE referral_promo_claims
                    SET referred_freebie_status = "void",
                        referrer_incentive_status = "void",
                        void_reason = :reason,
                        updated_at = NOW()
                  WHERE id = :id'
            )->execute([':id' => $claimId, ':reason' => $reason]);
            break;

        default:
            return ['ok' => false, 'error' => 'Unknown action.', 'code' => 'unknown_action'];
    }

    $refetch = $pdo->prepare('SELECT * FROM referral_promo_claims WHERE id = :id LIMIT 1');
    $refetch->execute([':id' => $claimId]);
    $updated = $refetch->fetch(PDO::FETCH_ASSOC);

    return ['ok' => true, 'claim' => referralPromoClaimToApiPayload($updated ?: $row)];
}

/**
 * @return array{
 *   claims: list<array<string, mixed>>,
 *   stats: array<string, int>,
 *   school_year: string,
 *   matched: int,
 *   limit: int,
 *   offset: int
 * }
 */
function listReferralPromoClaims(
    PDO $pdo,
    string $schoolYear,
    string $search = '',
    string $freebieStatus = '',
    string $incentiveStatus = '',
    int $limit = 50,
    int $offset = 0,
): array {
    ensureReferralPromoSchema($pdo);
    $sy = trim($schoolYear);
    $limit = max(1, min(500, $limit));
    $offset = max(0, $offset);

    $where = ['c.school_year = :sy'];
    $params = [':sy' => $sy];

    $search = trim($search);
    if ($search !== '') {
        // Use distinct named params — PDO MySQL rejects reusing :search four times.
        $where[] = '(c.control_number LIKE :search_control
            OR c.referrer_name LIKE :search_name
            OR c.referrer_contact LIKE :search_contact
            OR c.referrer_email LIKE :search_email
            OR u.full_name LIKE :search_student)';
        $like = '%' . $search . '%';
        $params[':search_control'] = $like;
        $params[':search_name'] = $like;
        $params[':search_contact'] = $like;
        $params[':search_email'] = $like;
        $params[':search_student'] = $like;
    }

    $freebieStatus = strtolower(trim($freebieStatus));
    if ($freebieStatus !== '' && in_array($freebieStatus, ['pending', 'eligible', 'given', 'void'], true)) {
        $where[] = 'c.referred_freebie_status = :freebie';
        $params[':freebie'] = $freebieStatus;
    }

    $incentiveStatus = strtolower(trim($incentiveStatus));
    if ($incentiveStatus !== '' && in_array($incentiveStatus, ['pending', 'eligible', 'void', 'paid'], true)) {
        $where[] = 'c.referrer_incentive_status = :incentive';
        $params[':incentive'] = $incentiveStatus;
    }

    $whereSql = implode(' AND ', $where);

    $countSql = '
        SELECT COUNT(*)
          FROM referral_promo_claims c
          LEFT JOIN enrollments e ON e.id = c.enrollment_id
          LEFT JOIN users u ON u.id = e.user_id
         WHERE ' . $whereSql;
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $matched = (int)($countStmt->fetchColumn() ?: 0);

    $sql = '
        SELECT c.*, u.full_name AS referred_student_name
          FROM referral_promo_claims c
          LEFT JOIN enrollments e ON e.id = c.enrollment_id
          LEFT JOIN users u ON u.id = e.user_id
         WHERE ' . $whereSql . '
         ORDER BY CAST(c.control_number AS UNSIGNED) ASC, c.id ASC
         LIMIT ' . $limit . ' OFFSET ' . $offset;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $claims = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $claims[] = referralPromoClaimToApiPayload($row);
    }

    $statsStmt = $pdo->prepare(
        'SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN enrollment_id IS NULL THEN 1 ELSE 0 END) AS preissued,
            SUM(CASE WHEN referred_freebie_status = "eligible" THEN 1 ELSE 0 END) AS freebie_eligible,
            SUM(CASE WHEN referred_freebie_status = "given" THEN 1 ELSE 0 END) AS freebie_given,
            SUM(CASE WHEN referrer_incentive_status = "eligible" THEN 1 ELSE 0 END) AS incentive_eligible,
            SUM(CASE WHEN referrer_incentive_status = "paid" THEN 1 ELSE 0 END) AS incentive_paid,
            SUM(CASE WHEN referred_freebie_status = "void" OR referrer_incentive_status = "void" THEN 1 ELSE 0 END) AS voided
           FROM referral_promo_claims
          WHERE school_year = :sy'
    );
    $statsStmt->execute([':sy' => $sy]);
    $statsRow = $statsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    return [
        'claims' => $claims,
        'stats' => [
            'total' => (int)($statsRow['total'] ?? 0),
            'preissued' => (int)($statsRow['preissued'] ?? 0),
            'freebieEligible' => (int)($statsRow['freebie_eligible'] ?? 0),
            'freebieGiven' => (int)($statsRow['freebie_given'] ?? 0),
            'incentiveEligible' => (int)($statsRow['incentive_eligible'] ?? 0),
            'incentivePaid' => (int)($statsRow['incentive_paid'] ?? 0),
            'voided' => (int)($statsRow['voided'] ?? 0),
        ],
        'school_year' => $sy,
        'matched' => $matched,
        'limit' => $limit,
        'offset' => $offset,
    ];
}
