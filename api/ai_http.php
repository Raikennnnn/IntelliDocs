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
 * Candidate AI base URLs: env first, then local 5000, then droplet 8080.
 *
 * @return list<string>
 */
function aiServiceCandidateUrls(): array
{
    $candidates = [];
    $fromEnv = getenv('AI_BASE_URL');
    if (is_string($fromEnv) && trim($fromEnv) !== '') {
        $candidates[] = rtrim(trim($fromEnv), '/');
    }
    // Prefer local Flask (5000) before the droplet nginx AI port (8080).
    // Caching a dead 8080 when AI was briefly down caused every upload to
    // skip quality checks for the rest of the PHP worker lifetime.
    foreach (['http://127.0.0.1:5000', 'http://127.0.0.1:8080'] as $fallback) {
        if (!in_array($fallback, $candidates, true)) {
            $candidates[] = $fallback;
        }
    }
    return $candidates;
}

/**
 * Resolve AI service URL: env first, then probe healthy candidates.
 * Only caches a URL that passed /health (with a short TTL so a restart recovers).
 */
function aiServiceBaseUrl(): string
{
    static $resolved = null;
    static $resolvedAt = 0;

    $now = time();
    // Re-probe every 30s so a previously dead port can recover.
    if (is_string($resolved) && $resolved !== '' && ($now - $resolvedAt) < 30) {
        return $resolved;
    }

    $candidates = aiServiceCandidateUrls();
    foreach ($candidates as $base) {
        $health = aiServiceHealthProbe($base);
        if ($health !== null && !empty($health['ok'])) {
            $resolved = $base;
            $resolvedAt = $now;
            return $resolved;
        }
    }

    // Do NOT permanently cache an unreachable fallback — next request re-probes.
    $resolved = null;
    $resolvedAt = 0;
    return $candidates[0] ?? 'http://127.0.0.1:5000';
}

/** True when the Python AI service responds healthy on /health. */
function aiServiceIsReachable(): bool
{
    foreach (aiServiceCandidateUrls() as $base) {
        $health = aiServiceHealthProbe($base);
        if ($health !== null && !empty($health['ok'])) {
            return true;
        }
    }
    return false;
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

    // Try the preferred base first, then every other candidate on failure.
    $preferred = aiServiceBaseUrl();
    $bases = array_values(array_unique(array_merge([$preferred], aiServiceCandidateUrls())));
    $lastError = 'Document verification is temporarily unavailable. Please try again in a few minutes.';
    $lastStatus = 0;
    $lastBase = $preferred;

    foreach ($bases as $base) {
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
        $lastBase = $base;
        $lastStatus = $status;

        if ($raw === false) {
            $lastError = 'Document verification is temporarily unavailable. Please try again in a few minutes.';
            error_log('[ai_http] curl failed for ' . $path . ' via ' . $base . ': ' . ($curlErr ?: 'unreachable'));
            continue;
        }

        $decoded = json_decode((string)$raw, true);
        if (!is_array($decoded)) {
            $snippet = trim(substr(preg_replace('/\s+/', ' ', (string)$raw), 0, 200));
            error_log('[ai_http] invalid JSON from ' . $path . ' via ' . $base . ': ' . $snippet);
            $lastError = 'Document verification is temporarily unavailable. Please try again in a few minutes.';
            continue;
        }

        if ($status >= 200 && $status < 300) {
            return [
                'ok' => true,
                'status' => $status,
                'body' => $decoded,
                'base_url' => $base,
            ];
        }

        // Non-2xx with JSON body (e.g. validation error from AI) — return as-is.
        return [
            'ok' => false,
            'status' => $status,
            'body' => $decoded,
            'base_url' => $base,
            'error' => sanitizeClientErrorMessage((string)($decoded['error'] ?? $decoded['message'] ?? $lastError)),
        ];
    }

    return [
        'ok' => false,
        'status' => $lastStatus,
        'body' => null,
        'error' => $lastError,
        'base_url' => $lastBase,
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
 * Strip server paths and internal details from user-facing API errors.
 */
function sanitizeClientErrorMessage(string $message): string
{
    $message = trim($message);
    if ($message === '') {
        return $message;
    }

    if (preg_match('#(/var/www|/home/|/usr/|\\\\|ai/uploads|uploads/documents)#i', $message)) {
        return 'Document validation failed. Please upload a clearer photo (JPG or PNG).';
    }

    $message = preg_replace('#/var/www[^\s"\'\]},]+#', '[internal path]', $message);
    $message = preg_replace('#[A-Za-z]:\\\\[^\s"\'\]},]+#', '[internal path]', $message);

    return $message;
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
        'mode' => 'quality_only',
    ], 15);

    if (!$res['ok'] || !is_array($res['body'])) {
        $message = sanitizeClientErrorMessage($res['error'] ?? '');
        if ($message === '') {
            $message = 'AI quality check unavailable. Try again later.';
        }
        return [
            'ok' => false,
            'pass' => false,
            'level' => 1,
            'message' => $message,
            'body' => null,
            'error' => $message,
        ];
    }

    $body = $res['body'];
    $pass = !empty($body['pass']);
    $level = (int)($body['level'] ?? ($pass ? 2 : 1));
    $message = sanitizeClientErrorMessage(trim((string)($body['message'] ?? '')));
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
        'body' => null,
    ];
}

/**
 * Level 2 readability gate (deferred after fast quality upload).
 *
 * @return array{ok: bool, pass: bool, level: int, message: string, body: array<string, mixed>|null, error?: string}
 */
function aiScreenUploadReadability(
    string $fullPath,
    string $downloadName,
    string $mimeType,
    string $docType,
): array {
    $res = aiPostMultipart('/screen-readability', $fullPath, $downloadName, $mimeType, [
        'doc_type' => $docType,
    ], 120);

    if (!$res['ok'] || !is_array($res['body'])) {
        $message = sanitizeClientErrorMessage($res['error'] ?? '');
        if ($message === '') {
            $message = 'Document readability check unavailable. Try again later.';
        }
        return [
            'ok' => false,
            'pass' => false,
            'level' => 2,
            'message' => $message,
            'body' => null,
            'error' => $message,
        ];
    }

    $body = $res['body'];
    $pass = !empty($body['pass']);
    $level = (int)($body['level'] ?? ($pass ? 2 : 2));
    $message = sanitizeClientErrorMessage(trim((string)($body['message'] ?? '')));
    if ($message === '' && !$pass) {
        $message = 'We could not read enough text on this document. Upload a clearer photo (JPG or PNG).';
    }

    return [
        'ok' => true,
        'pass' => $pass,
        'level' => $level,
        'message' => $message,
        'body' => null,
    ];
}
