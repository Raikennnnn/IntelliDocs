<?php
declare(strict_types=1);

/**
 * Shared document AI verification (used by registrar API and background queue worker).
 */

require_once __DIR__ . '/ai_persist.php';
require_once __DIR__ . '/ai_verify_refine.php';
require_once __DIR__ . '/enrollment_status_helpers.php';
require_once __DIR__ . '/ai_http.php';

/**
 * @return array{
 *   ok: true,
 *   result: array<string, mixed>,
 *   cached?: bool,
 *   processing?: bool
 * }|array{
 *   ok: false,
 *   error: string,
 *   http_status?: int,
 *   detail?: mixed,
 *   ai_base_url?: string
 * }
 */
function runDocumentAiVerification(PDO $pdo, int $docId, array $options = []): array
{
    ensureDocumentAiPersistenceSchema($pdo);

    $forceRerun = !empty($options['force_rerun']);
    $docTypeOverride = strtolower(trim((string)($options['doc_type'] ?? '')));
    if ($docTypeOverride === 'sf10') {
        $docTypeOverride = 'form137';
    }
    $expectedOverrides = is_array($options['expected'] ?? null) ? $options['expected'] : [];

    if ($docId <= 0) {
        return ['ok' => false, 'error' => 'Invalid document id', 'http_status' => 422];
    }

    $stmt = $pdo->prepare('
        SELECT d.id,
               d.file_path,
               d.enrollment_id,
               d.type AS document_type,
               d.ai_status,
               d.ai_score,
               d.ai_security_json,
               COALESCE(NULLIF(d.original_name, \'\'), NULLIF(d.filename, \'\'), CONCAT(\'document_\', d.id)) AS download_name,
               COALESCE(NULLIF(d.mime_type, \'\'), \'\') AS mime_type,
               e.enrollment_steps,
               e.grade_level,
               e.strand,
               u.id AS user_id,
               u.full_name,
               u.first_name,
               u.middle_name,
               u.last_name,
               u.extension_name
        FROM documents d
        LEFT JOIN enrollments e ON e.id = d.enrollment_id
        LEFT JOIN users u ON u.id = e.user_id
        WHERE d.id = :id
        LIMIT 1
    ');
    $stmt->execute([':id' => $docId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || !is_array($row)) {
        return ['ok' => false, 'error' => 'Document not found', 'http_status' => 404];
    }

    $formData = [];
    $steps = json_decode((string)($row['enrollment_steps'] ?? '{}'), true);
    if (is_array($steps) && is_array($steps['form_data'] ?? null)) {
        $formData = $steps['form_data'];
    }

    $docType = $docTypeOverride;
    if ($docType === '' || $docType === 'other') {
        $docType = mapDocumentTypeForAi((string)($row['document_type'] ?? ''));
    }

    $userContext = [
        'full_name' => (string)($row['full_name'] ?? ''),
        'first_name' => (string)($row['first_name'] ?? ''),
        'middle_name' => (string)($row['middle_name'] ?? ''),
        'last_name' => (string)($row['last_name'] ?? ''),
        'extension_name' => (string)($row['extension_name'] ?? ''),
    ];
    $enrollmentContext = [
        'grade_level' => (string)($row['grade_level'] ?? ''),
        'strand' => (string)($row['strand'] ?? ''),
    ];

    $autoExpected = buildAiExpectedVerifyFieldsForDocument($formData, $docType, $userContext, $enrollmentContext);
    $identityExpected = buildAiExpectedVerifyFieldsForDocument(
        $formData,
        'birth_certificate',
        $userContext,
        $enrollmentContext
    );
    foreach (['expected_name', 'expected_sex', 'expected_dob', 'expected_birth_place'] as $identityKey) {
        $identityVal = trim((string)($identityExpected[$identityKey] ?? ''));
        if ($identityVal !== '') {
            $autoExpected[$identityKey] = $identityVal;
        }
    }

    $pickExpected = static function (string $autoKey) use ($autoExpected, $expectedOverrides): string {
        $fromOverride = trim((string)($expectedOverrides[$autoKey] ?? ''));
        if ($fromOverride !== '') {
            return $fromOverride;
        }

        return trim((string)($autoExpected[$autoKey] ?? ''));
    };

    $expectedName = $pickExpected('expected_name');
    $expectedLrn = preg_replace('/\D+/', '', $pickExpected('expected_lrn')) ?? '';
    $expectedSex = $pickExpected('expected_sex');
    $expectedSchoolYear = $pickExpected('expected_school_year');
    $expectedPrevSchool = $pickExpected('expected_prev_school');
    $expectedDob = $pickExpected('expected_dob');
    $expectedBirthPlace = $pickExpected('expected_birth_place');
    $expectedGradeLevel = $pickExpected('expected_grade_level');
    $expectedStrand = $pickExpected('expected_strand');

    $relative = trim(str_replace('\\', '/', (string)($row['file_path'] ?? '')));
    if ($relative === '' || strpos($relative, '..') !== false) {
        return ['ok' => false, 'error' => 'File path not recorded for this document', 'http_status' => 404];
    }

    $projectRoot = realpath(dirname(__DIR__));
    if ($projectRoot === false) {
        return ['ok' => false, 'error' => 'Server path error', 'http_status' => 500];
    }

    $fullPath = realpath($projectRoot . '/' . $relative);
    $allowedBase = realpath($projectRoot . '/uploads/documents');
    $normFull = $fullPath !== false ? strtolower(str_replace('\\', '/', $fullPath)) : '';
    $normAllowed = $allowedBase !== false ? strtolower(str_replace('\\', '/', $allowedBase)) : '';
    $underUploads = $normFull !== '' && $normAllowed !== '' && strpos($normFull, rtrim($normAllowed, '/') . '/') === 0;
    if (!$underUploads && $normFull !== '') {
        $prefix = strtolower(str_replace('\\', '/', $projectRoot . '/uploads/documents/'));
        $underUploads = strpos($normFull, $prefix) === 0;
    }

    if ($fullPath === false || !$underUploads || !is_file($fullPath)) {
        return ['ok' => false, 'error' => 'File not found on server', 'http_status' => 404];
    }

    $fileFingerprint = documentAiFileFingerprint($fullPath);
    $aiStatusRaw = (string)($row['ai_status'] ?? '');
    $storedEnvelope = parseStoredAiVerifyEnvelope(
        isset($row['ai_security_json']) ? (string)$row['ai_security_json'] : null
    );
    $scorePct = null;
    if (isset($row['ai_score']) && $row['ai_score'] !== '' && is_numeric($row['ai_score'])) {
        $scorePct = (float)$row['ai_score'];
    }

    $expectedContext = aiRefineExpectedContextFromAuto([
        'expected_name' => $expectedName,
        'expected_lrn' => $expectedLrn,
        'expected_sex' => $expectedSex,
        'expected_school_year' => $expectedSchoolYear,
        'expected_prev_school' => $expectedPrevSchool,
        'expected_dob' => $expectedDob,
        'expected_birth_place' => $expectedBirthPlace,
    ]);

    if (documentHasPersistedAiArtifacts($aiStatusRaw, isset($row['ai_security_json']) ? (string)$row['ai_security_json'] : null, $row['ai_score'] ?? null)) {
        if (!$forceRerun && !aiPersistedEnvelopeIsStale($storedEnvelope)) {
            $cached = reconstructAiVerifyFromLockedRow($aiStatusRaw, $scorePct, $storedEnvelope);
            $cached = refineAiVerifyResult($cached, $docType, $fullPath, $expectedContext);
            $cached['v'] = AI_VERIFY_PAYLOAD_VERSION;

            return ['ok' => true, 'result' => $cached, 'cached' => true];
        }
    }

    $aiStatusNorm = strtolower(trim($aiStatusRaw));
    if ($aiStatusNorm === 'processing' && $forceRerun) {
        documentResetAiPending($pdo, $docId);
        $aiStatusNorm = 'pending';
    }

    if ($aiStatusNorm === 'processing' && !$forceRerun) {
        if (documentHasPersistedAiArtifacts(
            $aiStatusRaw,
            isset($row['ai_security_json']) ? (string)$row['ai_security_json'] : null,
            $row['ai_score'] ?? null
        )) {
            return [
                'ok' => true,
                'processing' => true,
                'cached' => true,
                'result' => [
                    'status' => 'verified',
                    'confidence' => 0,
                    '_processing' => true,
                ],
            ];
        }
        documentResetAiPending($pdo, $docId);
        $aiStatusNorm = 'pending';
    }

    if (!function_exists('curl_init')) {
        return ['ok' => false, 'error' => 'PHP cURL extension is required for AI verification', 'http_status' => 500];
    }

    $downloadName = (string)($row['download_name'] ?? ('document_' . $docId));
    $mimeType = trim((string)($row['mime_type'] ?? ''));
    if ($mimeType === '') {
        $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
        $mimeType = match ($ext) {
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            default => 'application/octet-stream',
        };
    }

    $postFields = [
        'doc_type' => $docType !== '' ? $docType : 'other',
    ];
    if ($expectedName !== '') {
        $postFields['expected_name'] = $expectedName;
    }
    if ($expectedLrn !== '') {
        $postFields['expected_lrn'] = $expectedLrn;
    }
    if ($expectedSex !== '') {
        $postFields['expected_sex'] = $expectedSex;
    }
    if ($expectedSchoolYear !== '') {
        $postFields['expected_school_year'] = $expectedSchoolYear;
    }
    if ($expectedPrevSchool !== '') {
        $postFields['expected_prev_school'] = $expectedPrevSchool;
    }
    if ($expectedDob !== '') {
        $postFields['expected_dob'] = $expectedDob;
    }
    if ($expectedBirthPlace !== '') {
        $postFields['expected_birth_place'] = $expectedBirthPlace;
    }
    $skipGradeStrandForMoral = in_array(strtolower($docType), ['good_moral', 'goodmoral'], true);
    if ($expectedGradeLevel !== '' && !$skipGradeStrandForMoral) {
        $postFields['expected_grade_level'] = $expectedGradeLevel;
    }
    if ($expectedStrand !== '' && !$skipGradeStrandForMoral) {
        $postFields['expected_strand'] = $expectedStrand;
    }

    @set_time_limit(620);
    @ini_set('max_execution_time', '620');

    if ($forceRerun) {
        documentPrepareForAiRerun($pdo, $docId);
    } else {
        documentMarkAiProcessing($pdo, $docId);
    }

    $aiRes = aiPostMultipart('/verify', $fullPath, $downloadName, $mimeType, $postFields, 580);

    if (!$aiRes['ok'] || !is_array($aiRes['body'])) {
        documentResetAiPending($pdo, $docId);
        $decoded = is_array($aiRes['body']) ? $aiRes['body'] : null;
        $error = $aiRes['error'] ?? 'Failed to reach AI service';
        if ($decoded && isset($decoded['error']) && is_string($decoded['error']) && $decoded['error'] !== '') {
            $error = $decoded['error'];
        }

        return [
            'ok' => false,
            'error' => $error,
            'http_status' => 502,
            'detail' => $decoded ?? ($aiRes['base_url'] ?? null),
            'ai_base_url' => $aiRes['base_url'] ?? aiServiceBaseUrl(),
        ];
    }

    $decoded = $aiRes['body'];
    $decoded = refineAiVerifyResult($decoded, $docType, $fullPath, $expectedContext);
    $decoded['v'] = AI_VERIFY_PAYLOAD_VERSION;

    try {
        persistDocumentAiResult($pdo, $docId, $decoded, $fileFingerprint !== '' ? $fileFingerprint : null);
    } catch (Throwable $e) {
        // Return AI result even if DB persist fails.
    }

    return ['ok' => true, 'result' => $decoded];
}

/**
 * True when the document is an image we can send to full AI verify.
 */
function documentIsAiVerifiableImage(?string $mimeType, string $filePath = ''): bool
{
    $mime = strtolower(trim((string)$mimeType));
    if (in_array($mime, ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'], true)) {
        return true;
    }
    if ($mime !== '' && $mime !== 'application/octet-stream') {
        return false;
    }
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

    return in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true);
}
