<?php
declare(strict_types=1);

/**
 * HTTP helpers for the local Python AI service.
 */

function aiServiceBaseUrl(): string
{
    $base = getenv('AI_BASE_URL');
    if ($base && trim($base) !== '') {
        return rtrim(trim($base), '/');
    }
    return 'http://127.0.0.1:5000';
}

/**
 * @return array{ok: bool, status: int, body: array<string, mixed>|null, error?: string}
 */
function aiPostMultipart(
    string $path,
    string $fullPath,
    string $downloadName,
    string $mimeType,
    array $fields = [],
): array {
    if (!is_file($fullPath)) {
        return ['ok' => false, 'status' => 0, 'body' => null, 'error' => 'File not found for AI'];
    }
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'status' => 0, 'body' => null, 'error' => 'PHP cURL is required for AI checks'];
    }

    $postFields = array_merge($fields, [
        'image' => new CURLFile($fullPath, $mimeType, $downloadName),
    ]);

    $url = aiServiceBaseUrl() . $path;
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $postFields,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 25,
    ]);

    $raw = curl_exec($ch);
    $curlErr = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false) {
        return ['ok' => false, 'status' => 0, 'body' => null, 'error' => $curlErr ?: 'AI service unreachable'];
    }

    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded)) {
        return ['ok' => false, 'status' => $status, 'body' => null, 'error' => 'AI returned invalid JSON'];
    }

    return ['ok' => $status >= 200 && $status < 300, 'status' => $status, 'body' => $decoded];
}

function mapDocumentTypeForAi(string $label): string
{
    require_once __DIR__ . '/enrollment_status_helpers.php';
    $key = normalizeDocumentRequirementKey($label);

    return match ($key) {
        'birth_certificate' => 'birth_certificate',
        'good_moral' => 'good_moral',
        'sf9' => 'sf9',
        'sf10' => 'form137',
        'photo_2x2' => 'photo_2x2',
        default => 'other',
    };
}

/**
 * Level 1 quality gate for student uploads.
 *
 * @return array{ok: bool, pass: bool, message: string, body: array<string, mixed>|null, error?: string}
 */
function aiScreenUploadQuality(
    string $fullPath,
    string $downloadName,
    string $mimeType,
    string $docType,
): array {
    $res = aiPostMultipart('/screen-quality', $fullPath, $downloadName, $mimeType, [
        'doc_type' => $docType,
    ]);

    if (!$res['ok'] || !is_array($res['body'])) {
        return [
            'ok' => false,
            'pass' => false,
            'message' => $res['error'] ?? 'AI quality check unavailable. Try again later.',
            'body' => $res['body'],
            'error' => $res['error'] ?? null,
        ];
    }

    $body = $res['body'];
    $pass = !empty($body['pass']);
    $message = trim((string)($body['message'] ?? ''));
    if ($message === '' && !$pass) {
        $message = 'Image quality check failed. Use a clear, well-lit photo.';
    }

    return [
        'ok' => true,
        'pass' => $pass,
        'message' => $message,
        'body' => $body,
    ];
}
