<?php
declare(strict_types=1);

/**
 * Persist AI verification results on the documents row.
 */

const AI_VERIFY_PAYLOAD_VERSION = 44;

/**
 * Cached AI envelopes below the current version must be re-verified (signature/seal fixes, etc.).
 */
function aiPersistedEnvelopeIsStale(?array $envelope): bool
{
    if (!is_array($envelope)) {
        return true;
    }
    $v = (int)($envelope['v'] ?? 0);
    if ($v <= 0) {
        return true;
    }

    if ($v < AI_VERIFY_PAYLOAD_VERSION) {
        return true;
    }

    $checks = is_array($envelope['field_checks'] ?? null) ? $envelope['field_checks'] : [];
    foreach ($checks as $check) {
        if (!is_array($check)) {
            continue;
        }
        if (strtolower(trim((string)($check['field'] ?? ''))) !== 'signature') {
            continue;
        }
        if (strtolower(trim((string)($check['scan_method'] ?? ''))) !== 'visual') {
            return true;
        }
    }

    return false;
}

function aiPersistColumnExists(PDO $pdo, string $column): bool
{
    static $cache = [];
    $key = $column;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1'
    );
    $stmt->execute([':table' => 'documents', ':column' => $column]);
    $cache[$key] = (bool)$stmt->fetchColumn();
    return $cache[$key];
}

/**
 * Ensure AI columns can store full verification results (scores 0–100, processing, tampered).
 */
function ensureDocumentAiPersistenceSchema(PDO $pdo): void
{
    static $ensured = false;
    if ($ensured) {
        return;
    }
    $ensured = true;

    if (!aiPersistColumnExists($pdo, 'ai_status')) {
        $pdo->exec("ALTER TABLE documents ADD COLUMN ai_status VARCHAR(40) NOT NULL DEFAULT 'pending'");
    } else {
        $typeStmt = $pdo->prepare(
            'SELECT COLUMN_TYPE FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1'
        );
        $typeStmt->execute([':table' => 'documents', ':column' => 'ai_status']);
        $columnType = strtolower((string)($typeStmt->fetchColumn() ?: ''));
        if (str_contains($columnType, 'enum')) {
            $pdo->exec("ALTER TABLE documents MODIFY COLUMN ai_status VARCHAR(40) NOT NULL DEFAULT 'pending'");
        }
    }

    if (!aiPersistColumnExists($pdo, 'ai_score')) {
        $pdo->exec('ALTER TABLE documents ADD COLUMN ai_score DECIMAL(5,2) NULL');
    } else {
        $pdo->exec('ALTER TABLE documents MODIFY COLUMN ai_score DECIMAL(5,2) NULL');
    }

    if (!aiPersistColumnExists($pdo, 'ai_security_json')) {
        $pdo->exec('ALTER TABLE documents ADD COLUMN ai_security_json TEXT NULL');
    }
}

function documentDeriveAiStatusFromArtifacts(?string $aiSecurityJson, mixed $aiScore): string
{
    $envelope = parseStoredAiVerifyEnvelope($aiSecurityJson);
    if (is_array($envelope)) {
        $tamper = isset($envelope['tamper_score']) ? (float)$envelope['tamper_score'] : 1.0;
        $sec = is_array($envelope['security_levels'] ?? null) ? $envelope['security_levels'] : null;
        if ($tamper < 0.35 || persistDocumentAiIntegrityFailed($sec)) {
            return 'tampered';
        }
        $statusRaw = strtolower(trim((string)($envelope['status'] ?? '')));
        if ($statusRaw === 'verified') {
            return 'verified';
        }
        if ($statusRaw === 'failed') {
            return 'failed';
        }
    }

    if ($aiScore !== null && $aiScore !== '' && is_numeric($aiScore)) {
        return 'verified';
    }

    return 'pending';
}

/**
 * Rows with saved scores but blank ai_status (legacy ENUM mismatch) should be treated as scored.
 */
function documentRepairAiStatusFromArtifacts(
    PDO $pdo,
    int $docId,
    ?string $aiStatus,
    ?string $aiSecurityJson,
    mixed $aiScore
): string {
    $st = strtolower(trim((string)$aiStatus));
    if ($st !== '' && !in_array($st, ['pending', 'queued', 'processing'], true)) {
        return $st;
    }
    if (!documentHasPersistedAiArtifacts($aiStatus, $aiSecurityJson, $aiScore)) {
        return $st !== '' ? $st : 'pending';
    }

    $derived = documentDeriveAiStatusFromArtifacts($aiSecurityJson, $aiScore);
    if ($docId > 0 && aiPersistColumnExists($pdo, 'ai_status')) {
        $stmt = $pdo->prepare(
            "UPDATE documents SET ai_status = :st
              WHERE id = :id
                AND (ai_status IS NULL OR TRIM(ai_status) = '' OR LOWER(TRIM(ai_status)) IN ('pending', 'processing', 'queued'))"
        );
        $stmt->execute([':st' => $derived, ':id' => $docId]);
    }

    return $derived;
}

function persistDocumentAiIntegrityFailed(?array $sec): bool
{
    if (!is_array($sec) || !is_array($sec['levels'] ?? null)) {
        return false;
    }
    foreach ($sec['levels'] as $lv) {
        if (!is_array($lv)) {
            continue;
        }
        $title = strtolower((string)($lv['title'] ?? ''));
        if (str_contains($title, 'tamper') || str_contains($title, 'integrity')) {
            return empty($lv['pass']);
        }
    }
    // Legacy 3-level payload: integrity was index 2.
    return isset($sec['levels'][2]) && empty($sec['levels'][2]['pass']);
}

/**
 * Full verify payload stored in documents.ai_security_json (v2 envelope).
 *
 * @return array<string, mixed>
 */
function buildPersistedAiVerifyEnvelope(array $result, ?string $fileFingerprint = null): array
{
    $envelope = [
        'v' => AI_VERIFY_PAYLOAD_VERSION,
        'security_levels' => $result['security_levels'] ?? null,
        'field_checks' => is_array($result['field_checks'] ?? null) ? $result['field_checks'] : [],
        'doc_checks' => is_array($result['doc_checks'] ?? null) ? $result['doc_checks'] : [],
        'seal_scan' => is_array($result['seal_scan'] ?? null) ? $result['seal_scan'] : null,
        'signature_scan' => is_array($result['signature_scan'] ?? null) ? $result['signature_scan'] : null,
        'confidence' => $result['confidence'] ?? null,
        'match_score' => $result['match_score'] ?? null,
        'ocr_confidence' => $result['ocr_confidence'] ?? null,
        'tamper_score' => $result['tamper_score'] ?? null,
        'tamper_cells' => $result['tamper_cells'] ?? [],
        'tamper_fields' => $result['tamper_fields'] ?? [],
        'tamper_signals' => $result['tamper_signals'] ?? [],
        'tamper_applicable' => $result['tamper_applicable'] ?? null,
        'synthetic_score' => $result['synthetic_score'] ?? null,
        'synthetic_signals' => $result['synthetic_signals'] ?? [],
        'synthetic_applicable' => $result['synthetic_applicable'] ?? null,
        'status' => $result['status'] ?? null,
        'issues' => is_array($result['issues'] ?? null) ? $result['issues'] : [],
        'image_width' => $result['image_width'] ?? null,
        'image_height' => $result['image_height'] ?? null,
        'requested_doc_type' => $result['requested_doc_type'] ?? null,
        'resolved_doc_type' => $result['resolved_doc_type'] ?? null,
    ];
    if ($fileFingerprint !== null && trim($fileFingerprint) !== '') {
        $envelope['file_fingerprint'] = trim($fileFingerprint);
    }

    return $envelope;
}

function documentAiFileFingerprint(string $fullPath): string
{
    if (!is_file($fullPath)) {
        return '';
    }
    $hash = @hash_file('sha256', $fullPath);
    if (is_string($hash) && $hash !== '') {
        return 'sha256:' . $hash;
    }

    return 'mtime:' . (string)@filemtime($fullPath) . ':' . (string)@filesize($fullPath);
}

function documentAiVerificationLocked(?string $aiStatus): bool
{
    $st = strtolower(trim((string)$aiStatus));

    return $st !== '' && !in_array($st, ['pending', 'queued'], true);
}

function documentHasPersistedAiArtifacts(?string $aiStatus, ?string $aiSecurityJson, mixed $aiScore): bool
{
    if (parseStoredAiVerifyEnvelope($aiSecurityJson) !== null) {
        return true;
    }
    if ($aiScore !== null && $aiScore !== '' && is_numeric($aiScore)) {
        return true;
    }

    return documentAiVerificationLocked($aiStatus);
}

function documentMarkAiProcessing(PDO $pdo, int $docId): void
{
    if ($docId <= 0 || !aiPersistColumnExists($pdo, 'ai_status')) {
        return;
    }
    $stmt = $pdo->prepare(
        "UPDATE documents SET ai_status = 'processing'
          WHERE id = :id
            AND LOWER(TRIM(COALESCE(ai_status, ''))) IN ('', 'pending')"
    );
    $stmt->execute([':id' => $docId]);
}

/** Registrar clicked Re-run AI — allow a fresh verify even when a prior score exists. */
function documentPrepareForAiRerun(PDO $pdo, int $docId): void
{
    if ($docId <= 0 || !aiPersistColumnExists($pdo, 'ai_status')) {
        return;
    }
    $stmt = $pdo->prepare("UPDATE documents SET ai_status = 'processing' WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $docId]);
}

function documentResetAiPending(PDO $pdo, int $docId): void
{
    if ($docId <= 0 || !aiPersistColumnExists($pdo, 'ai_status')) {
        return;
    }
    $stmt = $pdo->prepare(
        "UPDATE documents SET ai_status = 'pending'
          WHERE id = :id
            AND LOWER(TRIM(COALESCE(ai_status, ''))) = 'processing'"
    );
    $stmt->execute([':id' => $docId]);
}

/**
 * Abandoned AI runs can leave ai_status=processing with no stored scores.
 * Reset those rows so the registrar UI can finish scoring once.
 */
function documentReconcileStaleAiProcessing(
    PDO $pdo,
    int $docId,
    ?string $aiStatus,
    ?string $aiSecurityJson,
    mixed $aiScore
): string {
    $st = strtolower(trim((string)$aiStatus));
    if ($st === 'processing') {
        if (documentHasPersistedAiArtifacts($aiStatus, $aiSecurityJson, $aiScore)) {
            return documentRepairAiStatusFromArtifacts($pdo, $docId, $aiStatus, $aiSecurityJson, $aiScore);
        }

        documentResetAiPending($pdo, $docId);

        return 'pending';
    }

    return documentRepairAiStatusFromArtifacts($pdo, $docId, $aiStatus, $aiSecurityJson, $aiScore);
}

function documentHasStoredAiVerification(?string $aiStatus, ?string $aiSecurityJson): bool
{
    if (documentAiVerificationLocked($aiStatus)) {
        return true;
    }

    return parseStoredAiVerifyEnvelope($aiSecurityJson) !== null;
}

function documentHasRecordedAiScore(?string $aiStatus, mixed $aiScore): bool
{
    $st = strtolower(trim((string)$aiStatus));
    if ($st === '' || $st === 'pending') {
        return false;
    }

    return $aiScore !== null && $aiScore !== '' && is_numeric($aiScore);
}

/**
 * Minimal cached payload when only ai_status + ai_score exist (legacy rows).
 *
 * @return array<string, mixed>
 */
function reconstructAiVerifyFromScoreOnly(string $aiStatus, float $aiScorePct): array
{
    $confidence = max(0.0, min(1.0, $aiScorePct / 100.0));
    $verified = str_contains(strtolower($aiStatus), 'verify');

    return [
        'v' => AI_VERIFY_PAYLOAD_VERSION,
        'status' => $verified ? 'verified' : 'failed',
        'confidence' => $confidence,
        'security_levels' => null,
        'field_checks' => [],
        'doc_checks' => [],
        'issues' => [],
        '_cached' => true,
    ];
}

/**
 * Cached payload when ai_status is final but envelope is missing (legacy rows).
 *
 * @return array<string, mixed>
 */
function reconstructAiVerifyFromLockedRow(string $aiStatus, ?float $aiScorePct, ?array $envelope = null): array
{
    if (is_array($envelope)) {
        return reconstructAiVerifyApiResult($envelope, $aiScorePct, $aiStatus);
    }
    if ($aiScorePct !== null) {
        return reconstructAiVerifyFromScoreOnly($aiStatus, $aiScorePct);
    }
    $verified = str_contains(strtolower($aiStatus), 'verify');

    return [
        'v' => AI_VERIFY_PAYLOAD_VERSION,
        'status' => $verified ? 'verified' : 'failed',
        'confidence' => $verified ? 1.0 : 0.0,
        'security_levels' => null,
        'field_checks' => [],
        'doc_checks' => [],
        'issues' => [],
        '_cached' => true,
    ];
}

/**
 * Rebuild the API verify payload from a persisted envelope (no AI call).
 *
 * @return array<string, mixed>
 */
function reconstructAiVerifyApiResult(array $envelope, ?float $aiScorePct, string $aiStatus): array
{
    $confidence = $envelope['confidence'] ?? null;
    if ($confidence === null && $aiScorePct !== null) {
        $confidence = max(0.0, min(1.0, (float)$aiScorePct / 100.0));
    }
    $statusRaw = strtolower(trim((string)($envelope['status'] ?? '')));
    if ($statusRaw === '') {
        $aiSt = strtolower(trim($aiStatus));
        $statusRaw = str_contains($aiSt, 'verify') ? 'verified' : 'failed';
    }

    return [
        'v' => (int)($envelope['v'] ?? AI_VERIFY_PAYLOAD_VERSION),
        'status' => $statusRaw === 'verified' ? 'verified' : 'failed',
        'confidence' => $confidence,
        'match_score' => $envelope['match_score'] ?? null,
        'ocr_confidence' => $envelope['ocr_confidence'] ?? null,
        'tamper_score' => $envelope['tamper_score'] ?? null,
        'tamper_cells' => $envelope['tamper_cells'] ?? [],
        'tamper_fields' => $envelope['tamper_fields'] ?? [],
        'tamper_signals' => $envelope['tamper_signals'] ?? [],
        'tamper_applicable' => $envelope['tamper_applicable'] ?? null,
        'synthetic_score' => $envelope['synthetic_score'] ?? null,
        'synthetic_signals' => $envelope['synthetic_signals'] ?? [],
        'synthetic_applicable' => $envelope['synthetic_applicable'] ?? null,
        'security_levels' => $envelope['security_levels'] ?? null,
        'field_checks' => is_array($envelope['field_checks'] ?? null) ? $envelope['field_checks'] : [],
        'doc_checks' => is_array($envelope['doc_checks'] ?? null) ? $envelope['doc_checks'] : [],
        'seal_scan' => is_array($envelope['seal_scan'] ?? null) ? $envelope['seal_scan'] : null,
        'signature_scan' => is_array($envelope['signature_scan'] ?? null) ? $envelope['signature_scan'] : null,
        'issues' => is_array($envelope['issues'] ?? null) ? $envelope['issues'] : [],
        'image_width' => $envelope['image_width'] ?? null,
        'image_height' => $envelope['image_height'] ?? null,
        'requested_doc_type' => $envelope['requested_doc_type'] ?? null,
        'resolved_doc_type' => $envelope['resolved_doc_type'] ?? null,
        '_cached' => true,
    ];
}

/**
 * @return array<string, mixed>|null
 */
function parseStoredAiVerifyEnvelope(?string $json): ?array
{
    if ($json === null || trim($json) === '' || trim($json) === 'null') {
        return null;
    }
    $decoded = json_decode($json, true);
    if (!is_array($decoded)) {
        return null;
    }
    $ver = (int)($decoded['v'] ?? 0);
    if ($ver >= 1 && (isset($decoded['security_levels']) || isset($decoded['field_checks']))) {
        return $decoded;
    }
    if (isset($decoded['levels']) && is_array($decoded['levels'])) {
        return [
            'v' => 1,
            'security_levels' => $decoded,
            'field_checks' => [],
            'doc_checks' => [],
        ];
    }

    return null;
}

function persistDocumentAiResult(PDO $pdo, int $docId, array $result, ?string $fileFingerprint = null): void
{
    ensureDocumentAiPersistenceSchema($pdo);
    if ($docId <= 0 || !aiPersistColumnExists($pdo, 'ai_status')) {
        return;
    }

    $statusRaw = strtolower(trim((string)($result['status'] ?? 'failed')));
    $tamper = isset($result['tamper_score']) ? (float)$result['tamper_score'] : 1.0;
    $sec = is_array($result['security_levels'] ?? null) ? $result['security_levels'] : null;
    $l3Fail = persistDocumentAiIntegrityFailed($sec);

    if ($tamper < 0.35 || $l3Fail) {
        $aiStatus = 'tampered';
    } elseif ($statusRaw === 'verified' && is_array($sec) && !empty($sec['overall_pass'])) {
        $aiStatus = 'verified';
    } elseif ($statusRaw === 'verified') {
        $aiStatus = 'verified';
    } else {
        $aiStatus = 'failed';
    }

    $confidence = isset($result['confidence']) ? (float)$result['confidence'] : null;
    $scorePct = $confidence !== null ? round(max(0.0, min(100.0, $confidence * 100)), 1) : null;

    $envelope = buildPersistedAiVerifyEnvelope($result, $fileFingerprint);
    $securityJson = null;
    $encoded = json_encode($envelope, JSON_UNESCAPED_UNICODE);
    if ($encoded !== false) {
        $securityJson = $encoded;
    }

    $hasScore = aiPersistColumnExists($pdo, 'ai_score') && $scorePct !== null;
    $hasJson = aiPersistColumnExists($pdo, 'ai_security_json') && $securityJson !== null;

    if ($hasScore && $hasJson) {
        $stmt = $pdo->prepare(
            'UPDATE documents SET ai_status = :st, ai_score = :score, ai_security_json = :sec WHERE id = :id LIMIT 1'
        );
        $stmt->execute([':st' => $aiStatus, ':score' => $scorePct, ':sec' => $securityJson, ':id' => $docId]);
        return;
    }

    if ($hasScore) {
        $stmt = $pdo->prepare('UPDATE documents SET ai_status = :st, ai_score = :score WHERE id = :id LIMIT 1');
        $stmt->execute([':st' => $aiStatus, ':score' => $scorePct, ':id' => $docId]);
        return;
    }

    if ($hasJson) {
        $stmt = $pdo->prepare('UPDATE documents SET ai_status = :st, ai_security_json = :sec WHERE id = :id LIMIT 1');
        $stmt->execute([':st' => $aiStatus, ':sec' => $securityJson, ':id' => $docId]);
        return;
    }

    $stmt = $pdo->prepare('UPDATE documents SET ai_status = :st WHERE id = :id LIMIT 1');
    $stmt->execute([':st' => $aiStatus, ':id' => $docId]);
}
