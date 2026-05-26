<?php
declare(strict_types=1);

/**
 * Username_Generator
 *
 * Pure PHP helpers (no DB access in `generateSchoolUsername`) that derive a
 * deterministic, ASCII-only `school_username` of the form
 *   {firstInitial}{middleInitial}{lastName}
 * lowercased, stripped of non-letters, truncated to 32 characters, with an
 * optional numeric suffix for collisions.
 *
 * See: .kiro/specs/student-school-credentials/design.md, "Username_Generator".
 *
 * Requirements covered: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.3, 3.4.
 */

if (!defined('SCHOOL_USERNAME_MAX_LENGTH')) {
    define('SCHOOL_USERNAME_MAX_LENGTH', 32);
}
if (!defined('SCHOOL_USERNAME_MAX_COLLISION_ATTEMPTS')) {
    define('SCHOOL_USERNAME_MAX_COLLISION_ATTEMPTS', 1000);
}

/**
 * Transliterate a UTF-8 string to ASCII letters/digits, best-effort.
 *
 * Prefers iconv `ASCII//TRANSLIT//IGNORE` when available; falls back to a
 * small lookup map for common Latin diacritics (and the Spanish ñ that comes
 * up frequently in PH names) when iconv is missing or returns false.
 */
function schoolUsername_transliterateToAscii(string $value): string
{
    if ($value === '') {
        return '';
    }

    if (function_exists('iconv')) {
        // Suppress the iconv notice that some libc builds emit when a
        // character has no transliteration; we'll fall back manually below.
        $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if (is_string($converted) && $converted !== '') {
            return $converted;
        }
    }

    // Manual fallback map for environments without iconv (or where the
    // current locale produces a useless result). Keep this small and
    // focused on the diacritics most commonly seen in NSDGA student names.
    static $map = [
        'À' => 'A', 'Á' => 'A', 'Â' => 'A', 'Ã' => 'A', 'Ä' => 'A', 'Å' => 'A', 'Ā' => 'A',
        'à' => 'a', 'á' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a', 'å' => 'a', 'ā' => 'a',
        'Ç' => 'C', 'ç' => 'c', 'Ć' => 'C', 'ć' => 'c', 'Č' => 'C', 'č' => 'c',
        'Ð' => 'D', 'ð' => 'd',
        'È' => 'E', 'É' => 'E', 'Ê' => 'E', 'Ë' => 'E', 'Ē' => 'E', 'Ě' => 'E',
        'è' => 'e', 'é' => 'e', 'ê' => 'e', 'ë' => 'e', 'ē' => 'e', 'ě' => 'e',
        'Ì' => 'I', 'Í' => 'I', 'Î' => 'I', 'Ï' => 'I', 'Ī' => 'I',
        'ì' => 'i', 'í' => 'i', 'î' => 'i', 'ï' => 'i', 'ī' => 'i',
        'Ñ' => 'N', 'ñ' => 'n', 'Ń' => 'N', 'ń' => 'n',
        'Ò' => 'O', 'Ó' => 'O', 'Ô' => 'O', 'Õ' => 'O', 'Ö' => 'O', 'Ø' => 'O', 'Ō' => 'O',
        'ò' => 'o', 'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o', 'ø' => 'o', 'ō' => 'o',
        'Ś' => 'S', 'ś' => 's', 'Š' => 'S', 'š' => 's',
        'Ù' => 'U', 'Ú' => 'U', 'Û' => 'U', 'Ü' => 'U', 'Ū' => 'U',
        'ù' => 'u', 'ú' => 'u', 'û' => 'u', 'ü' => 'u', 'ū' => 'u',
        'Ý' => 'Y', 'ý' => 'y', 'ÿ' => 'y',
        'Ź' => 'Z', 'ź' => 'z', 'Ż' => 'Z', 'ż' => 'z', 'Ž' => 'Z', 'ž' => 'z',
        'Æ' => 'AE', 'æ' => 'ae', 'Œ' => 'OE', 'œ' => 'oe', 'ß' => 'ss',
    ];
    return strtr($value, $map);
}

/**
 * Reduce an arbitrary name part to its lowercase `[a-z]` letters only.
 *
 * Whitespace, hyphens, apostrophes, digits, and any character that did not
 * survive transliteration are dropped.
 */
function schoolUsername_normalizeNamePart(?string $name): string
{
    if ($name === null || $name === '') {
        return '';
    }
    $ascii = schoolUsername_transliterateToAscii($name);
    $lower = strtolower($ascii);
    return preg_replace('/[^a-z]/', '', $lower) ?? '';
}

/**
 * Derive a `school_username` candidate from name parts.
 *
 * Algorithm (per design "Username_Generator"):
 *   1. Transliterate each input UTF-8 → ASCII.
 *   2. Lowercase.
 *   3. Strip every non-[a-z] character.
 *   4. Take first character of firstName (`fi`), first character of
 *      middleName if non-empty after stripping (`mi`), full lastName (`ln`).
 *   5. Concatenate `fi . mi . ln`.
 *   6. If `fi` is empty or `ln` is empty, return [null, 'invalid_name'].
 *   7. Truncate to 32 characters.
 *
 * @return array{0: ?string, 1: ?string} `[candidate, null]` on success,
 *                                       `[null, 'invalid_name']` on failure.
 */
function generateSchoolUsername(string $firstName, ?string $middleName, string $lastName): array
{
    $firstClean  = schoolUsername_normalizeNamePart($firstName);
    $middleClean = schoolUsername_normalizeNamePart($middleName);
    $lastClean   = schoolUsername_normalizeNamePart($lastName);

    if ($firstClean === '' || $lastClean === '') {
        return [null, 'invalid_name'];
    }

    $fi = substr($firstClean, 0, 1);
    $mi = $middleClean !== '' ? substr($middleClean, 0, 1) : '';
    $ln = $lastClean;

    $candidate = $fi . $mi . $ln;

    if (strlen($candidate) > SCHOOL_USERNAME_MAX_LENGTH) {
        $candidate = substr($candidate, 0, SCHOOL_USERNAME_MAX_LENGTH);
    }

    return [$candidate, null];
}

/**
 * Resolve uniqueness for a candidate `school_username` against the `users`
 * table by appending the smallest integer `N >= 2` such that the resulting
 * string is unused.
 *
 * If `candidate . N` would exceed 32 characters, the candidate prefix is
 * truncated so the numeric suffix fits within the 32-character limit.
 *
 * `excludeUserId` lets the caller exclude a single row from the uniqueness
 * check (e.g. when re-resolving for a user who already owns `candidate`).
 *
 * @throws RuntimeException if no free slot is found within
 *                          SCHOOL_USERNAME_MAX_COLLISION_ATTEMPTS iterations.
 */
function resolveSchoolUsernameCollision(PDO $pdo, string $candidate, ?int $excludeUserId = null): string
{
    if ($candidate === '') {
        throw new RuntimeException('resolveSchoolUsernameCollision: empty candidate');
    }

    if (!schoolUsername_isTaken($pdo, $candidate, $excludeUserId)) {
        return $candidate;
    }

    for ($n = 2; $n <= SCHOOL_USERNAME_MAX_COLLISION_ATTEMPTS + 1; $n++) {
        $suffix = (string)$n;
        $maxPrefixLen = SCHOOL_USERNAME_MAX_LENGTH - strlen($suffix);
        if ($maxPrefixLen < 1) {
            // Suffix alone exceeds the column width; impossible in practice.
            break;
        }
        $prefix = strlen($candidate) > $maxPrefixLen
            ? substr($candidate, 0, $maxPrefixLen)
            : $candidate;
        $attempt = $prefix . $suffix;

        if (!schoolUsername_isTaken($pdo, $attempt, $excludeUserId)) {
            return $attempt;
        }
    }

    throw new RuntimeException(
        'resolveSchoolUsernameCollision: exhausted ' . SCHOOL_USERNAME_MAX_COLLISION_ATTEMPTS
        . ' attempts for candidate "' . $candidate . '"'
    );
}

/**
 * @internal Helper for `resolveSchoolUsernameCollision`.
 *
 * Returns true if some row in `users` already owns `value` in
 * `school_username` (excluding `$excludeUserId` when provided).
 */
function schoolUsername_isTaken(PDO $pdo, string $value, ?int $excludeUserId = null): bool
{
    if ($excludeUserId !== null) {
        $stmt = $pdo->prepare(
            'SELECT 1 FROM users WHERE school_username = :v AND id <> :id LIMIT 1'
        );
        $stmt->execute([':v' => $value, ':id' => $excludeUserId]);
    } else {
        $stmt = $pdo->prepare('SELECT 1 FROM users WHERE school_username = :v LIMIT 1');
        $stmt->execute([':v' => $value]);
    }
    return (bool)$stmt->fetchColumn();
}
