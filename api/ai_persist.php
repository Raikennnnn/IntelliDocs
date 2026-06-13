<?php
declare(strict_types=1);

/**
 * Persist AI verification results on the documents row.
 */

const AI_VERIFY_PAYLOAD_VERSION = 19;

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
function buildPersistedAiVerifyEnvelope(array $result): array
{
    return [
        'v' => AI_VERIFY_PAYLOAD_VERSION,
        'security_levels' => $result['security_levels'] ?? null,
        'field_checks' => is_array($result['field_checks'] ?? null) ? $result['field_checks'] : [],
        'doc_checks' => is_array($result['doc_checks'] ?? null) ? $result['doc_checks'] : [],
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

function persistDocumentAiResult(PDO $pdo, int $docId, array $result): void
{
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
        $aiStatus = 'rejected';
    }

    $confidence = isset($result['confidence']) ? (float)$result['confidence'] : null;
    $scorePct = $confidence !== null ? round(max(0.0, min(100.0, $confidence * 100)), 1) : null;

    $envelope = buildPersistedAiVerifyEnvelope($result);
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
