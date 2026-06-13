<?php
declare(strict_types=1);

/**
 * HTTP helpers for the local Python AI service.
 */

/**
 * Probe /health on a candidate AI base URL.
 *
 * @return array<string, mixed>|null
 */
function aiServiceHealthProbe(string $base): ?array
{
    if (!function_exists('curl_init')) {
        return null;
    }

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => rtrim($base, '/') . '/health',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => 5,
    ]);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false || $status < 200 || $status >= 300) {
        return null;
    }

    $decoded = json_decode((string)$raw, true);
    return is_array($decoded) ? $decoded : null;
}

/**
 * Resolve AI service URL: env first, then probe 8080 (droplet) and 5000 (local dev).
 */
function aiServiceBaseUrl(): string
{
    static $resolved = null;
    if ($resolved !== null) {
        return $resolved;
    }

    $candidates = [];
    $fromEnv = getenv('AI_BASE_URL');
    if (is_string($fromEnv) && trim($fromEnv) !== '') {
        $candidates[] = rtrim(trim($fromEnv), '/');
    }
    foreach (['http://127.0.0.1:8080', 'http://127.0.0.1:5000'] as $fallback) {
        if (!in_array($fallback, $candidates, true)) {
            $candidates[] = $fallback;
        }
    }

    foreach ($candidates as $base) {
        if (aiServiceHealthProbe($base) !== null) {
            $resolved = $base;
            return $resolved;
        }
    }

    $resolved = $candidates[0] ?? 'http://127.0.0.1:5000';
    return $resolved;
}

/**
 * @return array{ok: bool, status: int, body: array<string, mixed>|null, error?: string, base_url?: string}
 */
function aiPostMultipart(
    string $path,
    string $fullPath,
    string $downloadName,
    string $mimeType,
    array $fields = [],
    int $timeoutSeconds = 25,
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

    $base = aiServiceBaseUrl();
    $url = $base . $path;
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $postFields,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => max(5, $timeoutSeconds),
    ]);

    $raw = curl_exec($ch);
    $curlErr = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false) {
        $hint = $curlErr ?: 'AI service unreachable';
        if (stripos($hint, 'connection refused') !== false || stripos($hint, 'failed to connect') !== false) {
            $hint .= '. Start the AI service (local: python ai/app.py on port 5000; droplet: systemctl start intellidocs-ai on port 8080).';
        }
        return [
            'ok' => false,
            'status' => 0,
            'body' => null,
            'error' => $hint,
            'base_url' => $base,
        ];
    }

    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded)) {
        $snippet = trim(substr(preg_replace('/\s+/', ' ', (string)$raw), 0, 200));
        return [
            'ok' => false,
            'status' => $status,
            'body' => null,
            'error' => $snippet !== ''
                ? 'AI returned invalid JSON: ' . $snippet
                : 'AI returned invalid JSON',
            'base_url' => $base,
        ];
    }

    return [
        'ok' => $status >= 200 && $status < 300,
        'status' => $status,
        'body' => $decoded,
        'base_url' => $base,
    ];
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
    ], 45);

    if (!$res['ok'] || !is_array($res['body'])) {
        return [
            'ok' => false,
            'pass' => false,
            'level' => 1,
            'message' => $res['error'] ?? 'AI quality check unavailable. Try again later.',
            'body' => $res['body'],
            'error' => $res['error'] ?? null,
        ];
    }

    $body = $res['body'];
    $pass = !empty($body['pass']);
    $level = (int)($body['level'] ?? ($pass ? 2 : 1));
    $message = trim((string)($body['message'] ?? ''));
    if ($message === '' && !$pass) {
        $message = $level === 2
            ? 'We could not read enough text on this document. Upload a clearer photo (JPG or PNG).'
            : 'Image quality check failed. Use a clear, well-lit photo.';
    }

    return [
        'ok' => true,
        'pass' => $pass,
        'level' => $level,
        'message' => $message,
        'body' => $body,
    ];
}
