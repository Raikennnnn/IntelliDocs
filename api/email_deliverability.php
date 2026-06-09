<?php
declare(strict_types=1);

/**
 * Signup-time email deliverability checks using PHP's built-in DNS functions.
 *
 * Recommended approach for this stack (plain PHP / XAMPP): native `dns_get_record`
 * and `checkdnsrr` — no Composer package required. Blocks domains with no MX
 * records and domains that publish a null MX (RFC 7505).
 *
 * Disable for local testing only: EMAIL_MX_CHECK=0 in project `env`.
 */

function isEmailMxCheckEnabled(): bool
{
    $flag = getenv('EMAIL_MX_CHECK');
    if ($flag === false || $flag === '') {
        return true;
    }

    $normalized = strtolower(trim((string)$flag));
    return !in_array($normalized, ['0', 'false', 'no', 'off'], true);
}

function extractEmailDomain(string $email): string
{
    $email = strtolower(trim($email));
    $at = strrpos($email, '@');
    if ($at === false || $at === strlen($email) - 1) {
        return '';
    }

    return substr($email, $at + 1);
}

/**
 * @return list<array<string, mixed>>
 */
function fetchMxRecords(string $domain): array
{
    if (function_exists('dns_get_record')) {
        $records = @dns_get_record($domain, DNS_MX);
        return is_array($records) ? $records : [];
    }

    if (function_exists('checkdnsrr') && @checkdnsrr($domain, 'MX')) {
        return [['target' => $domain, 'pri' => 10]];
    }

    return [];
}

function domainAcceptsMail(string $domain): bool
{
    $domain = strtolower(trim($domain));
    if ($domain === '' || !str_contains($domain, '.')) {
        return false;
    }

    $mxRecords = fetchMxRecords($domain);
    if ($mxRecords === []) {
        return false;
    }

    $hasUsableMx = false;
    foreach ($mxRecords as $record) {
        $target = strtolower(trim((string)($record['target'] ?? '')));
        // Null MX — domain explicitly does not accept mail.
        if ($target === '' || $target === '.') {
            continue;
        }
        $hasUsableMx = true;
    }

    return $hasUsableMx;
}

/**
 * @return array{code: string, error: string}|null Null when the address may receive mail.
 */
function validateEmailDeliverable(string $email): ?array
{
    if (!isEmailMxCheckEnabled()) {
        return null;
    }

    $domain = extractEmailDomain($email);
    if ($domain === '') {
        return [
            'code' => 'invalid_email',
            'error' => 'Invalid email address',
        ];
    }

    if (!domainAcceptsMail($domain)) {
        return [
            'code' => 'email_domain_undeliverable',
            'error' => 'Please enter a valid, active email address.',
        ];
    }

    return null;
}
