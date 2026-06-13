<?php
declare(strict_types=1);

/**
 * Shared enrollment status guards for student-facing APIs.
 */

function enrollmentColumnExists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column
         LIMIT 1'
    );
    $stmt->execute([':table' => $table, ':column' => $column]);

    return (bool)$stmt->fetchColumn();
}

function enrollmentTableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = :table
         LIMIT 1'
    );
    $stmt->execute([':table' => $table]);

    return (bool)$stmt->fetchColumn();
}

/**
 * Pick the enrollment row the student portal should treat as "current".
 *
 * Avoids blindly using MAX(id), which can surface an abandoned Grade 12 draft
 * from the wrong school year while the student is still enrolled in Grade 11.
 */
function pickPrimaryEnrollmentRow(PDO $pdo, int $userId, ?string $enrollmentSchoolYear = null): ?array
{
    if ($userId <= 0 || !enrollmentTableExists($pdo, 'enrollments')) {
        return null;
    }

    $sy = $enrollmentSchoolYear !== null ? trim($enrollmentSchoolYear) : '';

    $stmt = $pdo->prepare(
        "SELECT id, status, grade_level, strand, school_year, enrollment_steps, updated_at, applied_at
           FROM enrollments
          WHERE user_id = :uid
          ORDER BY
            (TRIM(COALESCE(school_year, '')) = :sy) DESC,
            CASE
              WHEN LOWER(TRIM(COALESCE(status, ''))) IN ('enrolled', 'approved') THEN 0
              WHEN LOWER(TRIM(COALESCE(status, ''))) IN ('pending', 'under_review', 'under review', 'review', 'draft') THEN 1
              WHEN LOWER(TRIM(COALESCE(status, ''))) = 'cancelled' THEN 3
              ELSE 2
            END,
            id DESC
          LIMIT 1"
    );
    $stmt->execute([':uid' => $userId, ':sy' => $sy]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || !is_array($row)) {
        return null;
    }

    $st = strtolower(trim((string)($row['status'] ?? '')));
    if ($st === '') {
        $eid = (int)($row['id'] ?? 0);
        if ($eid > 0) {
            $pdo->prepare("UPDATE enrollments SET status = 'draft', updated_at = NOW() WHERE id = :id")
                ->execute([':id' => $eid]);
            $row['status'] = 'draft';
        }
    }

    return $row;
}

/**
 * A newer enrollment row was incorrectly marked enrolled because the student
 * already has portal credentials from a prior approved year.
 */
function revertAutoEnrolledNewSyApplication(PDO $pdo, int $userId, ?array &$enrollmentRow): void
{
    if (!$enrollmentRow || !is_array($enrollmentRow)) {
        return;
    }

    $st = strtolower(trim((string)($enrollmentRow['status'] ?? '')));
    if (!in_array($st, ['enrolled', 'approved'], true)) {
        return;
    }

    $eid = (int)($enrollmentRow['id'] ?? 0);
    if ($eid <= 0) {
        return;
    }

    $rowSy = trim((string)($enrollmentRow['school_year'] ?? ''));
    if ($rowSy === '') {
        return;
    }

    $priorStmt = $pdo->prepare(
        "SELECT 1 FROM enrollments
         WHERE user_id = :uid AND school_year <> :sy AND TRIM(school_year) <> ''
           AND LOWER(status) IN ('approved', 'enrolled')
         LIMIT 1"
    );
    $priorStmt->execute([':uid' => $userId, ':sy' => $rowSy]);
    if (!$priorStmt->fetchColumn()) {
        return;
    }

    $steps = json_decode((string)($enrollmentRow['enrollment_steps'] ?? '{}'), true);
    $formData = is_array($steps) && is_array($steps['form_data'] ?? null) ? $steps['form_data'] : [];
    $confirmed = !empty($formData['confirmInformation']);
    if ($confirmed) {
        return;
    }

    $pdo->prepare("UPDATE enrollments SET status = 'draft', updated_at = NOW() WHERE id = :id")
        ->execute([':id' => $eid]);
    $enrollmentRow['status'] = 'draft';
}

/**
 * Repair rows where credentials were issued but status was accidentally
 * reset (e.g. a re-submit overwrote `enrolled` → `pending`).
 * Must NOT apply to new school-year applications while an older SY row is enrolled.
 */
function repairEnrollmentStatusIfCredentialsIssued(PDO $pdo, int $userId, ?array &$enrollmentRow): void
{
    if (!$enrollmentRow || !is_array($enrollmentRow)) {
        return;
    }

    $st = strtolower(trim((string)($enrollmentRow['status'] ?? '')));
    if (in_array($st, ['enrolled', 'approved', 'rejected', 'draft'], true)) {
        return;
    }

    $eid = (int)($enrollmentRow['id'] ?? 0);
    if ($eid <= 0) {
        return;
    }

    $priorEnrolledStmt = $pdo->prepare(
        "SELECT 1 FROM enrollments
         WHERE user_id = :uid AND id <> :eid
           AND LOWER(status) IN ('approved', 'enrolled')
         LIMIT 1"
    );
    $priorEnrolledStmt->execute([':uid' => $userId, ':eid' => $eid]);
    if ($priorEnrolledStmt->fetchColumn()) {
        return;
    }

    if (!enrollmentColumnExists($pdo, 'users', 'school_username')) {
        return;
    }

    $uStmt = $pdo->prepare('SELECT school_username FROM users WHERE id = :id LIMIT 1');
    $uStmt->execute([':id' => $userId]);
    $su = trim((string)($uStmt->fetchColumn() ?: ''));
    if ($su === '') {
        return;
    }

    $pdo->prepare("UPDATE enrollments SET status = 'enrolled', updated_at = NOW() WHERE id = :id")
        ->execute([':id' => $eid]);
    $enrollmentRow['status'] = 'enrolled';

    if (!function_exists('syncStudentCohortForEnrollment')) {
        require_once __DIR__ . '/cohort_helpers.php';
    }
    syncStudentCohortForEnrollment($pdo, $eid);
}

/**
 * True when the student completed a real submission for the open enrollment SY
 * (submitted to registrar, or registrar-enrolled with confirmation on file).
 */
function enrollmentApplicationCompleteForCurrentSy(array $enrollmentRow): bool
{
    $st = strtolower(trim((string)($enrollmentRow['status'] ?? '')));
    if ($st === 'draft') {
        return false;
    }
    if (in_array($st, ['pending', 'under_review', 'review'], true)) {
        return true;
    }
    if (!in_array($st, ['enrolled', 'approved'], true)) {
        return false;
    }

    $steps = json_decode((string)($enrollmentRow['enrollment_steps'] ?? '{}'), true);
    $formData = is_array($steps) && is_array($steps['form_data'] ?? null) ? $steps['form_data'] : [];

    return !empty($formData['confirmInformation']);
}

/**
 * Student should see the Grade 12 confirmation screen before the enrollment wizard.
 */
function studentNeedsGrade12EnrollmentConfirmation(
    ?string $syCurrent,
    bool $isGraduate,
    ?array $priorApproved,
    ?array $latestRow,
    bool $hasPortalCredentials = false,
    ?PDO $pdo = null,
    int $userId = 0
): bool {
    if ($isGraduate || $syCurrent === null) {
        return false;
    }

    if ($pdo instanceof PDO && $userId > 0) {
        require_once __DIR__ . '/grade12_continuation_helpers.php';
        if (studentDeclinedGrade12ForTargetSy($pdo, $userId, $syCurrent)) {
            return false;
        }
    }

    $priorSy = $priorApproved !== null
        ? trim((string)($priorApproved['school_year'] ?? ''))
        : '';
    $hasPriorDifferentSy = $priorApproved !== null && $priorSy !== '' && $priorSy !== $syCurrent;

    if (!$hasPriorDifferentSy) {
        if (!$hasPortalCredentials || !$latestRow || !is_array($latestRow)) {
            return false;
        }
        $rowSy = trim((string)($latestRow['school_year'] ?? ''));
        if ($rowSy !== $syCurrent) {
            return false;
        }

        return !enrollmentApplicationCompleteForCurrentSy($latestRow);
    }

    if (!$latestRow || !is_array($latestRow)) {
        return true;
    }

    $rowSy = trim((string)($latestRow['school_year'] ?? ''));
    if ($rowSy !== $syCurrent) {
        return true;
    }

    return !enrollmentApplicationCompleteForCurrentSy($latestRow);
}

/**
 * Canonical key for matching requirement types across human labels and machine keys.
 * e.g. "PSA Birth Certificate" and "birth_certificate" → birth_certificate
 */
function normalizeDocumentRequirementKey(string $type): string
{
    $t = strtolower(trim($type));
    if ($t === '') {
        return '';
    }

    if (in_array($t, ['birth_certificate', 'birthcert', 'psa'], true)) {
        return 'birth_certificate';
    }
    if (in_array($t, ['good_moral', 'goodmoral'], true)) {
        return 'good_moral';
    }
    if (in_array($t, ['sf9', 'report_card'], true)) {
        return 'sf9';
    }
    if (in_array($t, ['sf10', 'form137', 'form_137'], true)) {
        return 'sf10';
    }
    if (in_array($t, ['photo_2x2', 'id_picture', 'picture_2x2'], true)) {
        return 'photo_2x2';
    }

    if (str_contains($t, '2x2') || (str_contains($t, 'picture') && str_contains($t, 'white'))) {
        return 'photo_2x2';
    }
    if (str_contains($t, 'good moral')) {
        return 'good_moral';
    }
    if (str_contains($t, 'psa') || str_contains($t, 'live birth')) {
        return 'birth_certificate';
    }
    if (str_contains($t, 'sf9') || str_contains($t, 'report card')) {
        return 'sf9';
    }
    if (str_contains($t, 'form 137') || str_contains($t, 'form137') || str_contains($t, 'sf10')) {
        return 'sf10';
    }
    if (str_contains($t, 'birth')) {
        return 'birth_certificate';
    }

    return $t;
}

/** Whether the registrar or AI requires a new upload for this row. */
function documentNeedsStudentResubmit(array $row): bool
{
    $ai = strtolower(trim((string)($row['ai_status'] ?? '')));
    if ($ai === 'rejected' || str_contains($ai, 'reject') || str_contains($ai, 'tamper')) {
        return true;
    }
    $decision = strtolower(trim((string)($row['registrar_doc_decision'] ?? '')));
    if ($decision === 'rejected') {
        return true;
    }

    return false;
}

/** True when the registrar explicitly rejected — resubmit attempt limits apply. */
function documentRegistrarRejectedForResubmit(array $row): bool
{
    return strtolower(trim((string)($row['registrar_doc_decision'] ?? ''))) === 'rejected';
}

/**
 * Latest document row for a requirement (deduped by normalized type key).
 *
 * @return array<string, mixed>|null
 */
function findLatestDocumentRowForRequirement(PDO $pdo, int $enrollmentId, string $documentType): ?array
{
    if ($enrollmentId <= 0 || trim($documentType) === '' || !enrollmentTableExists($pdo, 'documents')) {
        return null;
    }
    if (!enrollmentColumnExists($pdo, 'documents', 'enrollment_id')) {
        return null;
    }

    $typeKey = normalizeDocumentRequirementKey($documentType);
    if ($typeKey === '') {
        return null;
    }

    $hasDecision = enrollmentColumnExists($pdo, 'documents', 'registrar_doc_decision');
    $hasUploadCount = enrollmentColumnExists($pdo, 'documents', 'upload_count');
    $hasAi = enrollmentColumnExists($pdo, 'documents', 'ai_status');
    $selectDecision = $hasDecision ? 'registrar_doc_decision' : "'' AS registrar_doc_decision";
    $selectUploadCount = $hasUploadCount ? 'upload_count' : '0 AS upload_count';
    $selectAi = $hasAi ? 'ai_status' : "'' AS ai_status";

    $stmt = $pdo->prepare(
        "SELECT id, type, {$selectDecision}, {$selectUploadCount}, {$selectAi}
           FROM documents
          WHERE enrollment_id = :eid
          ORDER BY id DESC"
    );
    $stmt->execute([':eid' => $enrollmentId]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        if (!is_array($row)) {
            continue;
        }
        if (normalizeDocumentRequirementKey((string)($row['type'] ?? '')) === $typeKey) {
            return $row;
        }
    }

    return null;
}

/** Cleared/approved docs should not carry a resubmit attempt count. */
function healClearedDocumentUploadCounts(PDO $pdo, int $enrollmentId): void
{
    if ($enrollmentId <= 0 || !enrollmentTableExists($pdo, 'documents')) {
        return;
    }
    if (!enrollmentColumnExists($pdo, 'documents', 'upload_count')) {
        return;
    }

    $hasReviewed = enrollmentColumnExists($pdo, 'documents', 'registrar_reviewed');
    $hasDecision = enrollmentColumnExists($pdo, 'documents', 'registrar_doc_decision');
    if (!$hasReviewed && !$hasDecision) {
        return;
    }

    $clearedParts = [];
    if ($hasReviewed) {
        $clearedParts[] = 'registrar_reviewed = 1';
    }
    if ($hasDecision) {
        $clearedParts[] = "LOWER(TRIM(COALESCE(registrar_doc_decision, ''))) <> 'rejected'";
    }
    if ($clearedParts === []) {
        return;
    }

    $pdo->prepare(
        'UPDATE documents
            SET upload_count = 0
          WHERE enrollment_id = :eid
            AND upload_count > 0
            AND (' . implode(' OR ', $clearedParts) . ')'
    )->execute([':eid' => $enrollmentId]);
}

/** True when the student is filling a new-SY Grade 12 enrollment with a prior enrolled year. */
function studentEnrollmentIsGrade12Rollover(PDO $pdo, int $userId, int $enrollmentId): bool
{
    if ($enrollmentId <= 0 || !enrollmentTableExists($pdo, 'enrollments')) {
        return false;
    }

    $enrStmt = $pdo->prepare(
        'SELECT id, school_year, status, grade_level, enrollment_steps
           FROM enrollments WHERE id = :eid AND user_id = :uid LIMIT 1'
    );
    $enrStmt->execute([':eid' => $enrollmentId, ':uid' => $userId]);
    $enrollment = $enrStmt->fetch(PDO::FETCH_ASSOC);
    if (!$enrollment || !is_array($enrollment)) {
        return false;
    }

    if (enrollmentGradeFromRow($enrollment) !== 12) {
        return false;
    }

    $st = strtolower(trim((string)($enrollment['status'] ?? '')));
    if (!in_array($st, ['draft', 'pending'], true)) {
        return false;
    }

    $currSy = trim((string)($enrollment['school_year'] ?? ''));
    if ($currSy === '') {
        return false;
    }

    $priorEid = priorEnrolledEnrollmentId($pdo, $userId, $enrollmentId);
    if ($priorEid <= 0) {
        return false;
    }

    $priorSyStmt = $pdo->prepare(
        'SELECT school_year, grade_level FROM enrollments WHERE id = :id LIMIT 1'
    );
    $priorSyStmt->execute([':id' => $priorEid]);
    $priorRow = $priorSyStmt->fetch(PDO::FETCH_ASSOC);
    if (!$priorRow || !is_array($priorRow)) {
        return false;
    }

    $priorSy = trim((string)($priorRow['school_year'] ?? ''));
    if ($priorSy === '' || $priorSy === $currSy) {
        return false;
    }

    $priorGrade = enrollmentGradeNumber((string)($priorRow['grade_level'] ?? ''));

    return $priorGrade > 0 && $priorGrade < 12;
}

/**
 * Block student re-upload when a requirement is already on file and cleared.
 * Returns a user-facing message, or null when upload is allowed.
 */
function studentDocumentReuploadBlocked(PDO $pdo, int $userId, int $enrollmentId, string $documentType): ?string
{
    if ($enrollmentId <= 0 || trim($documentType) === '' || !enrollmentTableExists($pdo, 'documents')) {
        return null;
    }
    if (!enrollmentColumnExists($pdo, 'documents', 'enrollment_id')) {
        return null;
    }

    $enrStmt = $pdo->prepare(
        'SELECT id, status, school_year FROM enrollments WHERE id = :eid AND user_id = :uid LIMIT 1'
    );
    $enrStmt->execute([':eid' => $enrollmentId, ':uid' => $userId]);
    $enrollment = $enrStmt->fetch(PDO::FETCH_ASSOC);
    if (!$enrollment || !is_array($enrollment)) {
        return null;
    }

    $enrStatus = strtolower(trim((string)($enrollment['status'] ?? '')));
    if (!in_array($enrStatus, ['draft', 'pending', 'under_review', 'review'], true)) {
        return null;
    }

    $typeKey = normalizeDocumentRequirementKey($documentType);
    $hasCarried = enrollmentColumnExists($pdo, 'documents', 'carried_forward');
    $selectCarried = $hasCarried ? 'carried_forward' : '0 AS carried_forward';
    $docStmt = $pdo->prepare(
        "SELECT id, type, ai_status, registrar_doc_decision, registrar_reviewed, {$selectCarried}
         FROM documents
         WHERE enrollment_id = :eid
         ORDER BY id DESC"
    );
    $docStmt->execute([':eid' => $enrollmentId]);
    $row = null;
    foreach ($docStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $candidate) {
        if (!is_array($candidate)) {
            continue;
        }
        if (normalizeDocumentRequirementKey((string)($candidate['type'] ?? '')) === $typeKey) {
            $row = $candidate;
            break;
        }
    }
    if (!$row || !is_array($row)) {
        return null;
    }

    if (studentEnrollmentIsGrade12Rollover($pdo, $userId, $enrollmentId)) {
        return 'Documents are locked during Grade 12 registration. Contact the registrar if you need to replace a file.';
    }

    if (documentNeedsStudentResubmit($row)) {
        return null;
    }

    if (documentRowCountsAsVerified($row)) {
        return 'This document is already approved and cannot be replaced. Contact the registrar if you need to make a change.';
    }

    if (
        enrollmentColumnExists($pdo, 'documents', 'carried_forward')
        && (int)($row['carried_forward'] ?? 0) === 1
        && studentEnrollmentIsGrade12Rollover($pdo, $userId, $enrollmentId)
    ) {
        return 'This document is on file from your previous enrollment and cannot be replaced here. Contact the registrar if you need to make a change.';
    }

    return null;
}

/** Registrar portal pill: Verified, Flagged, or Under Review. */
function documentRegistrarUiStatus(array $row): string
{
    if (documentNeedsStudentResubmit($row)) {
        return 'Flagged';
    }
    if (documentRowCountsAsVerified($row)) {
        return 'Verified';
    }

    return 'Under Review';
}

/** Whether a document row was already cleared by AI and/or the registrar. */
function documentRowCountsAsVerified(array $row): bool
{
    $ai = strtolower(trim((string)($row['ai_status'] ?? '')));
    if (in_array($ai, ['verified', 'approved', 'pass'], true)) {
        return true;
    }
    if ($ai !== '' && str_contains($ai, 'verify')) {
        return true;
    }
    if (!empty($row['registrar_reviewed']) && (int)$row['registrar_reviewed'] === 1) {
        return true;
    }
    $decision = strtolower(trim((string)($row['registrar_doc_decision'] ?? '')));
    if (in_array($decision, ['approved', 'accepted'], true)) {
        return true;
    }

    return false;
}

/** Parse "11", "Grade 11", etc. to an integer grade, or 0 when unknown. */
function enrollmentGradeNumber(string $gradeLevel): int
{
    if (preg_match('/(\d{1,2})/', $gradeLevel, $m)) {
        return (int)$m[1];
    }

    return 0;
}

/** Grade from enrollment row column and/or enrollment_steps form_data. */
function enrollmentGradeFromRow(array $enrollmentRow): int
{
    $grade = enrollmentGradeNumber((string)($enrollmentRow['grade_level'] ?? ''));
    if ($grade > 0) {
        return $grade;
    }

    $form = enrollmentStepsFormData((string)($enrollmentRow['enrollment_steps'] ?? ''));

    return enrollmentGradeNumber((string)($form['gradeLevel'] ?? ''));
}

/**
 * Latest approved/enrolled row from a prior school year (Grade 11 → 12 gate).
 *
 * @return array{
 *   id: int,
 *   grade_level: string,
 *   grade_level_number: int,
 *   strand: string,
 *   school_year: string,
 *   updated_at: string,
 *   form_data: array<string, mixed>
 * }|null
 */
function fetchPriorApprovedEnrollmentMeta(PDO $pdo, int $userId, ?string $syCurrent): ?array
{
    if ($syCurrent === null || !enrollmentTableExists($pdo, 'enrollments')) {
        return null;
    }

    $priorStmt = $pdo->prepare(
        "SELECT id, status, grade_level, strand, school_year, enrollment_steps, updated_at
           FROM enrollments
          WHERE user_id = :user_id
            AND LOWER(status) IN ('approved', 'enrolled')
            AND TRIM(school_year) <> ''
            AND school_year <> :sy_current
          ORDER BY id DESC
          LIMIT 1"
    );
    $priorStmt->execute([':user_id' => $userId, ':sy_current' => $syCurrent]);
    $priorApprovedRow = $priorStmt->fetch(PDO::FETCH_ASSOC) ?: null;

    if (!$priorApprovedRow) {
        $priorFallback = $pdo->prepare(
            "SELECT id, status, grade_level, strand, school_year, enrollment_steps, updated_at
               FROM enrollments
              WHERE user_id = :user_id
                AND LOWER(status) IN ('approved', 'enrolled')
              ORDER BY id DESC
              LIMIT 1"
        );
        $priorFallback->execute([':user_id' => $userId]);
        $priorApprovedRow = $priorFallback->fetch(PDO::FETCH_ASSOC) ?: null;
        if ($priorApprovedRow) {
            $fallbackSy = trim((string)($priorApprovedRow['school_year'] ?? ''));
            if ($fallbackSy === $syCurrent) {
                $priorApprovedRow = null;
            }
        }
    }

    if (!$priorApprovedRow) {
        return null;
    }

    $priorGrade = enrollmentGradeNumber((string)($priorApprovedRow['grade_level'] ?? ''));
    $priorFormData = parseEnrollmentFormDataFromSteps((string)($priorApprovedRow['enrollment_steps'] ?? ''));
    $priorFormData['confirmInformation'] = false;

    return [
        'id' => (int)$priorApprovedRow['id'],
        'grade_level' => (string)($priorApprovedRow['grade_level'] ?? ''),
        'grade_level_number' => $priorGrade,
        'strand' => (string)($priorApprovedRow['strand'] ?? ''),
        'school_year' => (string)($priorApprovedRow['school_year'] ?? ''),
        'updated_at' => (string)($priorApprovedRow['updated_at'] ?? ''),
        'form_data' => $priorFormData,
    ];
}

/** Block Grade 12 save/submit when prior-SY physical documents are incomplete. Returns error message or null. */
function enforceGrade12PhysicalDocsComplete(
    PDO $pdo,
    int $userId,
    string $gradeLevel,
    string $schoolYear
): ?string {
    if (enrollmentGradeNumber($gradeLevel) !== 12) {
        return null;
    }

    require_once __DIR__ . '/physical_docs_helpers.php';
    $priorApproved = fetchPriorApprovedEnrollmentMeta($pdo, $userId, $schoolYear);
    if ($priorApproved === null) {
        return null;
    }

    $gate = grade12PriorPhysicalDocsGate($pdo, $userId, $priorApproved, $schoolYear);
    if ($gate['applies'] && !$gate['complete']) {
        return grade12PhysicalDocsBlockMessage($gate);
    }

    return null;
}

/** True when this enrollment belongs to a returning student (prior approved/enrolled row exists). */
function isReturningStudentReEnrollment(PDO $pdo, int $userId, int $enrollmentId): bool
{
    return priorEnrolledEnrollmentId($pdo, $userId, $enrollmentId) > 0;
}

/**
 * Grade 12 continuation: prior-SY enrolled student re-enrolling for the next year.
 * These students skip the registrar application queue and are enrolled on submit.
 */
function returningGrade12ShouldAutoEnroll(
    PDO $pdo,
    int $userId,
    int $excludeEnrollmentId,
    string $gradeLevel,
    string $schoolYear
): bool {
    $grade = preg_match('/(\d{1,2})/', $gradeLevel, $m) ? (int)$m[1] : 0;
    if ($grade !== 12 || trim($schoolYear) === '') {
        return false;
    }

    $exclude = $excludeEnrollmentId > 0 ? $excludeEnrollmentId : PHP_INT_MAX;
    $priorEid = priorEnrolledEnrollmentId($pdo, $userId, $exclude);
    if ($priorEid <= 0) {
        return false;
    }

    $priorStmt = $pdo->prepare(
        'SELECT school_year, status, grade_level FROM enrollments WHERE id = :id LIMIT 1'
    );
    $priorStmt->execute([':id' => $priorEid]);
    $prior = $priorStmt->fetch(PDO::FETCH_ASSOC);
    if (!$prior || !is_array($prior)) {
        return false;
    }

    $priorSt = strtolower(trim((string)($prior['status'] ?? '')));
    if (!in_array($priorSt, ['enrolled', 'approved'], true)) {
        return false;
    }

    $priorSy = trim((string)($prior['school_year'] ?? ''));
    if ($priorSy === '' || $priorSy === trim($schoolYear)) {
        return false;
    }

    $priorGrade = preg_match('/(\d{1,2})/', (string)($prior['grade_level'] ?? ''), $pm) ? (int)$pm[1] : 0;
    if ($priorGrade >= 12) {
        return false;
    }

    require_once __DIR__ . '/physical_docs_helpers.php';
    $priorApproved = [
        'id' => (int)($prior['id'] ?? 0),
        'school_year' => $priorSy,
        'grade_level' => (string)($prior['grade_level'] ?? ''),
        'grade_level_number' => $priorGrade,
    ];
    $gate = grade12PriorPhysicalDocsGate($pdo, $userId, $priorApproved, trim($schoolYear));
    if ($gate['applies'] && !$gate['complete']) {
        return false;
    }

    return true;
}

/**
 * Promote a submitted Grade 12 continuation application to enrolled.
 * Returning students already cleared admission in the prior school year.
 */
function autoEnrollReturningGrade12Rollover(PDO $pdo, int $userId, ?array &$enrollmentRow): void
{
    if (!$enrollmentRow || !is_array($enrollmentRow)) {
        return;
    }

    $st = strtolower(trim((string)($enrollmentRow['status'] ?? '')));
    if (!in_array($st, ['pending', 'under_review', 'under review', 'review', 'draft'], true)) {
        return;
    }

    $eid = (int)($enrollmentRow['id'] ?? 0);
    if ($eid <= 0) {
        return;
    }

    $schoolYear = trim((string)($enrollmentRow['school_year'] ?? ''));
    $gradeLevel = (string)($enrollmentRow['grade_level'] ?? '');

    if (!returningGrade12ShouldAutoEnroll($pdo, $userId, $eid, $gradeLevel, $schoolYear)) {
        return;
    }

    if ($st === 'draft' && !enrollmentApplicationCompleteForCurrentSy($enrollmentRow)) {
        return;
    }

    $pdo->prepare("UPDATE enrollments SET status = 'enrolled', updated_at = NOW() WHERE id = :id")
        ->execute([':id' => $eid]);
    $enrollmentRow['status'] = 'enrolled';

    if (!function_exists('syncStudentCohortForEnrollment')) {
        require_once __DIR__ . '/cohort_helpers.php';
    }
    syncStudentCohortForEnrollment($pdo, $eid);

    if (!function_exists('carryForwardPhysicalDocsForEnrollment')) {
        require_once __DIR__ . '/physical_docs_helpers.php';
    }
    carryForwardPhysicalDocsForEnrollment($pdo, $eid, $enrollmentRow);

    require_once __DIR__ . '/section_assignment.php';
    $formData = enrollmentStepsFormData((string)($enrollmentRow['enrollment_steps'] ?? ''));
    autoAssignSectionForGrade12Rollover(
        $pdo,
        $userId,
        (string)($enrollmentRow['strand'] ?? ($formData['strand'] ?? '')),
        (string)($formData['gender'] ?? ''),
        (string)($formData['preferredSchedule'] ?? '')
    );
}

/** Latest prior-SY enrollment that was approved or enrolled (for document rollover). */
function priorEnrolledEnrollmentId(PDO $pdo, int $userId, int $excludeEnrollmentId): int
{
    if (!enrollmentTableExists($pdo, 'enrollments')) {
        return 0;
    }

    $stmt = $pdo->prepare(
        "SELECT id FROM enrollments
         WHERE user_id = :uid AND id <> :eid
           AND LOWER(status) IN ('approved', 'enrolled')
         ORDER BY id DESC
         LIMIT 1"
    );
    $stmt->execute([':uid' => $userId, ':eid' => $excludeEnrollmentId]);

    return (int)($stmt->fetchColumn() ?: 0);
}

/**
 * @return array<string, array<string, mixed>>
 */
function documentsByTypeLatest(PDO $pdo, int $enrollmentId): array
{
    if ($enrollmentId <= 0) {
        return [];
    }

    $stmt = $pdo->prepare(
        'SELECT * FROM documents WHERE enrollment_id = :eid ORDER BY id DESC'
    );
    $stmt->execute([':eid' => $enrollmentId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $byType = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $key = normalizeDocumentRequirementKey((string)($row['type'] ?? ''));
        if ($key === '' || isset($byType[$key])) {
            continue;
        }
        $byType[$key] = $row;
    }

    return $byType;
}

/**
 * Grade 12 rollover: mark copied files and restore verification from the prior SY
 * when those documents were already cleared. Never downgrade verified rows.
 */
function healGrade12CarriedDocuments(PDO $pdo, int $userId, ?array &$enrollmentRow): void
{
    if (!$enrollmentRow || !is_array($enrollmentRow) || !enrollmentTableExists($pdo, 'documents')) {
        return;
    }
    if (!enrollmentColumnExists($pdo, 'documents', 'enrollment_id')) {
        return;
    }

    $eid = (int)($enrollmentRow['id'] ?? 0);
    $rowSy = trim((string)($enrollmentRow['school_year'] ?? ''));
    $st = strtolower(trim((string)($enrollmentRow['status'] ?? '')));
    if ($eid <= 0 || $rowSy === '' || !in_array($st, ['draft', 'pending'], true)) {
        return;
    }

    if (!studentEnrollmentIsGrade12Rollover($pdo, $userId, $eid)) {
        return;
    }

    $priorEid = priorEnrolledEnrollmentId($pdo, $userId, $eid);
    if ($priorEid <= 0) {
        return;
    }

    $priorByType = documentsByTypeLatest($pdo, $priorEid);
    if ($priorByType === []) {
        return;
    }

    $priorStatus = '';
    if (enrollmentTableExists($pdo, 'enrollments')) {
        $ps = $pdo->prepare('SELECT status FROM enrollments WHERE id = :id LIMIT 1');
        $ps->execute([':id' => $priorEid]);
        $priorStatus = strtolower(trim((string)($ps->fetchColumn() ?: '')));
    }
    $priorEnrollmentCleared = in_array($priorStatus, ['enrolled', 'approved'], true);

    $hasCarriedForward = enrollmentColumnExists($pdo, 'documents', 'carried_forward');
    $hasReviewed = enrollmentColumnExists($pdo, 'documents', 'registrar_reviewed');
    $hasDecision = enrollmentColumnExists($pdo, 'documents', 'registrar_doc_decision');
    $hasRemarks = enrollmentColumnExists($pdo, 'documents', 'registrar_doc_remarks');

    $selectCarried = $hasCarriedForward ? 'carried_forward' : '0 AS carried_forward';
    $selectReviewed = $hasReviewed ? 'registrar_reviewed' : '0 AS registrar_reviewed';
    $selectDecision = $hasDecision ? 'registrar_doc_decision' : "'' AS registrar_doc_decision";
    $currStmt = $pdo->prepare(
        "SELECT id, type, ai_status, {$selectCarried}, {$selectReviewed}, {$selectDecision}
         FROM documents WHERE enrollment_id = :eid"
    );
    $currStmt->execute([':eid' => $eid]);
    $currRows = $currStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    foreach ($currRows as $doc) {
        if (!is_array($doc)) {
            continue;
        }
        $docId = (int)($doc['id'] ?? 0);
        $typeKey = normalizeDocumentRequirementKey((string)($doc['type'] ?? ''));
        if ($docId <= 0 || $typeKey === '') {
            continue;
        }

        // A new upload for this school year replaces the rollover copy (unless
        // the prior year was already fully enrolled — then still sync flags).
        $isFreshUpload = $hasCarriedForward && (int)($doc['carried_forward'] ?? 0) === 0;
        if ($isFreshUpload && documentNeedsStudentResubmit($doc)) {
            continue;
        }
        if ($isFreshUpload && !$priorEnrollmentCleared) {
            continue;
        }

        if (documentRowCountsAsVerified($doc)) {
            if ($hasCarriedForward) {
                $pdo->prepare('UPDATE documents SET carried_forward = 1 WHERE id = :id')
                    ->execute([':id' => $docId]);
            }
            continue;
        }

        $prior = $priorByType[$typeKey] ?? null;
        $sets = [];
        $params = [':id' => $docId];

        if ($hasCarriedForward) {
            $sets[] = 'carried_forward = 1';
        }

        $priorDocCleared = $prior !== null && documentRowCountsAsVerified($prior);
        $currentReviewed = $hasReviewed && (int)($doc['registrar_reviewed'] ?? 0) === 1;
        if ($currentReviewed) {
            if ($hasCarriedForward) {
                $pdo->prepare('UPDATE documents SET carried_forward = 1 WHERE id = :id')
                    ->execute([':id' => $docId]);
            }
            continue;
        }

        if ($priorDocCleared || $priorEnrollmentCleared) {
            $ai = $prior !== null ? trim((string)($prior['ai_status'] ?? '')) : '';
            if ($ai === '' || !documentRowCountsAsVerified(['ai_status' => $ai])) {
                $ai = 'verified';
            }
            $sets[] = 'ai_status = :ai_status';
            $params[':ai_status'] = $ai;

            if ($hasReviewed) {
                $sets[] = 'registrar_reviewed = :registrar_reviewed';
                $params[':registrar_reviewed'] = $priorDocCleared
                    ? max(1, (int)($prior['registrar_reviewed'] ?? 0))
                    : 1;
            }
            // Drop stale resubmit flags from an old rejection on a copied row.
            if ($hasDecision) {
                $sets[] = 'registrar_doc_decision = NULL';
            }
            if ($hasRemarks) {
                $sets[] = 'registrar_doc_remarks = NULL';
            }
        }

        if ($sets === []) {
            continue;
        }

        $pdo->prepare('UPDATE documents SET ' . implode(', ', $sets) . ' WHERE id = :id')
            ->execute($params);
    }
}

/** True while the student is completing Grade 12 enrollment for a new school year. */
function isGrade12PromotionActive(?string $syCurrent, ?array $priorApproved, ?array $latestRow): bool
{
    if ($syCurrent === null || $priorApproved === null) {
        return false;
    }

    $priorSy = trim((string)($priorApproved['school_year'] ?? ''));
    if ($priorSy === '' || $priorSy === $syCurrent) {
        return false;
    }

    if (!$latestRow || !is_array($latestRow)) {
        return false;
    }

    $rowSy = trim((string)($latestRow['school_year'] ?? ''));
    if ($rowSy !== $syCurrent) {
        return false;
    }

    $st = strtolower(trim((string)($latestRow['status'] ?? '')));

    if (enrollmentGradeFromRow($latestRow) !== 12) {
        return false;
    }

    return in_array($st, ['draft', 'pending', 'under_review', 'review'], true);
}

/**
 * Remove documents copied from a prior year when this is not a Grade 12 rollover.
 * Grade 11 (and other) enrollments must upload fresh files.
 */
function stripNonGrade12CarriedDocuments(PDO $pdo, int $userId, ?array &$enrollmentRow): void
{
    if (!$enrollmentRow || !is_array($enrollmentRow) || !enrollmentTableExists($pdo, 'documents')) {
        return;
    }
    if (!enrollmentColumnExists($pdo, 'documents', 'enrollment_id')) {
        return;
    }

    $eid = (int)($enrollmentRow['id'] ?? 0);
    if ($eid <= 0) {
        return;
    }

    if (studentEnrollmentIsGrade12Rollover($pdo, $userId, $eid)) {
        return;
    }

    if (enrollmentGradeFromRow($enrollmentRow) === 12) {
        return;
    }

    $st = strtolower(trim((string)($enrollmentRow['status'] ?? '')));
    if (!in_array($st, ['draft', 'pending', 'under_review', 'under review', 'review'], true)) {
        return;
    }

    if (!enrollmentColumnExists($pdo, 'documents', 'carried_forward')) {
        return;
    }

    $pdo->prepare(
        'DELETE FROM documents WHERE enrollment_id = :eid AND carried_forward = 1'
    )->execute([':eid' => $eid]);
}

/**
 * Parse `form_data` from an enrollments.enrollment_steps JSON blob.
 *
 * @return array<string, mixed>
 */
function enrollmentStepsFormData(?string $enrollmentStepsJson): array
{
    if ($enrollmentStepsJson === null || trim($enrollmentStepsJson) === '') {
        return [];
    }
    $steps = json_decode($enrollmentStepsJson, true);
    if (!is_array($steps)) {
        return [];
    }
    $form = $steps['form_data'] ?? null;

    return is_array($form) ? $form : [];
}

/**
 * Compose a single display string from name parts (skips blanks).
 */
function composeStudentFullNameParts(
    string $given,
    string $middle,
    string $last,
    string $extension = '',
    string $middleInitial = ''
): string {
    $middlePart = $middle !== '' ? $middle : $middleInitial;

    return trim(preg_replace(
        '/\s+/',
        ' ',
        sprintf('%s %s %s %s', $given, $middlePart, $last, $extension)
    ));
}

/**
 * Resolve name parts from enrollment form_data, then users.* columns.
 *
 * @param array<string, mixed> $formData
 * @param array<string, mixed> $userRow
 * @return array{given: string, middle: string, middle_initial: string, last: string, extension: string}
 */
function resolveStudentEnrollmentNameParts(array $formData, array $userRow = []): array
{
    $given = trim((string)($formData['givenName'] ?? ''));
    $middle = trim((string)($formData['middleName'] ?? ''));
    $middleInitial = trim((string)($formData['middleInitial'] ?? ''));
    $last = trim((string)($formData['lastName'] ?? ''));
    $ext = trim((string)($formData['extensionName'] ?? ''));

    $hasFormName = $given !== '' || $middle !== '' || $middleInitial !== '' || $last !== '' || $ext !== '';
    if (!$hasFormName) {
        $given = trim((string)($userRow['first_name'] ?? ''));
        $middle = trim((string)($userRow['middle_name'] ?? ''));
        $last = trim((string)($userRow['last_name'] ?? ''));
        $ext = trim((string)($userRow['extension_name'] ?? ''));
        $middleInitial = '';
    }

    return [
        'given' => $given,
        'middle' => $middle,
        'middle_initial' => $middleInitial,
        'last' => $last,
        'extension' => $ext,
    ];
}

/**
 * Student display name (Given Middle Last) for general UI.
 *
 * @param array<string, mixed> $formData
 * @param array<string, mixed> $userRow
 */
function studentEnrollmentFormDisplayName(array $formData, array $userRow = []): string
{
    $parts = resolveStudentEnrollmentNameParts($formData, $userRow);
    $composed = composeStudentFullNameParts(
        $parts['given'],
        $parts['middle'],
        $parts['last'],
        $parts['extension'],
        $parts['middle_initial']
    );
    if ($composed !== '') {
        return $composed;
    }

    return trim((string)($userRow['full_name'] ?? ''));
}

/**
 * Class-list name: Last name, First name [Middle] [Extension].
 *
 * @param array<string, mixed> $formData
 * @param array<string, mixed> $userRow
 */
function studentEnrollmentFormRosterName(array $formData, array $userRow = []): string
{
    $parts = resolveStudentEnrollmentNameParts($formData, $userRow);
    $middlePart = $parts['middle'] !== '' ? $parts['middle'] : $parts['middle_initial'];
    $firstSegment = trim(preg_replace(
        '/\s+/',
        ' ',
        sprintf('%s %s %s', $parts['given'], $middlePart, $parts['extension'])
    ));
    $last = $parts['last'];

    if ($last !== '' && $firstSegment !== '') {
        return $last . ', ' . $firstSegment;
    }
    if ($last !== '') {
        return $last;
    }
    if ($firstSegment !== '') {
        return $firstSegment;
    }

    return trim((string)($userRow['full_name'] ?? ''));
}

/**
 * Sort key for roster A–Z by last name, then first name.
 *
 * @param array{given: string, middle: string, middle_initial: string, last: string, extension: string} $parts
 */
function rosterNameSortKey(array $parts): string
{
    $middlePart = $parts['middle'] !== '' ? $parts['middle'] : $parts['middle_initial'];

    return strtolower($parts['last']) . "\0"
        . strtolower($parts['given']) . "\0"
        . strtolower($middlePart);
}

/**
 * Expected enrollment values for AI cross-checks on a single requirement.
 *
 * @param array<string, mixed> $formData enrollment_steps.form_data
 * @param array<string, mixed> $userRow users row (optional)
 * @param array<string, mixed> $enrollmentRow enrollments row (optional)
 * @return array<string, string>
 */
function buildAiExpectedVerifyFieldsForDocument(
    array $formData,
    string $docTypeKey,
    array $userRow = [],
    array $enrollmentRow = []
): array {
    $type = strtolower(trim($docTypeKey));
    $name = studentEnrollmentFormDisplayName($formData, $userRow);
    $lrn = preg_replace('/\D+/', '', (string)($formData['lrn'] ?? ''));
    $sex = trim((string)($formData['gender'] ?? ''));
    $schoolYear = trim((string)($formData['lastSchoolYearAttended'] ?? ''));
    $prevSchool = trim((string)($formData['previousSchoolAttended'] ?? ''));
    $dob = trim((string)($formData['birthDate'] ?? ''));
    $birthPlace = trim((string)($formData['birthPlace'] ?? ''));
    $gradeLevel = trim((string)($enrollmentRow['grade_level'] ?? $formData['gradeLevel'] ?? ''));
    $strand = trim((string)($enrollmentRow['strand'] ?? $formData['strand'] ?? ''));

    $all = [
        'expected_name' => $name,
        'expected_lrn' => $lrn,
        'expected_sex' => $sex,
        'expected_school_year' => $schoolYear,
        'expected_prev_school' => $prevSchool,
        'expected_dob' => $dob,
        'expected_birth_place' => $birthPlace,
        'expected_grade_level' => $gradeLevel,
        'expected_strand' => $strand,
    ];

    $keysByType = [
        'birth_certificate' => ['expected_name', 'expected_sex', 'expected_dob', 'expected_birth_place'],
        'birthcert' => ['expected_name', 'expected_sex', 'expected_dob', 'expected_birth_place'],
        'good_moral' => ['expected_name', 'expected_prev_school', 'expected_school_year'],
        'goodmoral' => ['expected_name', 'expected_prev_school', 'expected_school_year'],
        'sf9' => ['expected_name', 'expected_lrn', 'expected_sex', 'expected_school_year', 'expected_prev_school'],
        'report_card' => ['expected_name', 'expected_lrn', 'expected_sex', 'expected_school_year', 'expected_prev_school'],
        'sf10' => ['expected_name', 'expected_lrn', 'expected_sex', 'expected_school_year', 'expected_prev_school'],
        'form137' => ['expected_name', 'expected_lrn', 'expected_sex', 'expected_school_year', 'expected_prev_school'],
        'form157' => ['expected_name', 'expected_lrn', 'expected_sex', 'expected_school_year', 'expected_prev_school'],
    ];

    $pick = $keysByType[$type] ?? ['expected_name'];
    $out = [];
    foreach ($pick as $key) {
        $val = trim((string)($all[$key] ?? ''));
        if ($val !== '') {
            $out[$key] = $val;
        }
    }

    return $out;
}
