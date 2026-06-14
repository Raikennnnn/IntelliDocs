<?php
declare(strict_types=1);

require_once __DIR__ . '/school_year_helpers.php';

const SYSTEM_SETTINGS_MASK = '••••••••';

/** @return array<string, array<string, bool>> */
function defaultRolePermissions(): array
{
    return [
        'student' => [
            'viewApplicationStatus' => true,
            'uploadDocuments' => true,
            'editProfile' => true,
            'viewNotifications' => true,
        ],
        'registrar' => [
            'viewApplications' => true,
            'approveApplications' => true,
            'rejectApplications' => true,
            'addRemarks' => true,
            'viewAIResults' => true,
            'generateReports' => true,
        ],
        'admin' => [
            'manageUsers' => true,
            'viewActivityLogs' => true,
            'configureSystem' => true,
            'viewReports' => true,
            'manageRoles' => true,
        ],
    ];
}

function readSystemSetting(PDO $pdo, string $key): ?string
{
    ensureAppSettingsTable($pdo);
    $stmt = $pdo->prepare('SELECT setting_value FROM app_settings WHERE setting_key = :k LIMIT 1');
    $stmt->execute([':k' => $key]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row === false) {
        return null;
    }
    $val = trim((string)($row['setting_value'] ?? ''));

    return $val === '' ? null : $val;
}

function writeSystemSetting(PDO $pdo, string $key, ?string $value): void
{
    ensureAppSettingsTable($pdo);
    $stmt = $pdo->prepare('
        INSERT INTO app_settings (setting_key, setting_value) VALUES (:k, :v)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    ');
    $stmt->execute([
        ':k' => $key,
        ':v' => $value ?? '',
    ]);
}

function getOtpExpiryMinutes(PDO $pdo): int
{
    $raw = readSystemSetting($pdo, 'otp_expiry_minutes');
    $minutes = $raw !== null ? (int)$raw : 5;

    return max(5, min(60, $minutes));
}

/**
 * Push DB mail overrides into the current request environment.
 */
function applySystemMailEnvOverrides(PDO $pdo): void
{
    $provider = readSystemSetting($pdo, 'mail_provider');
    if ($provider !== null && $provider !== '') {
        putenv('MAIL_PROVIDER=' . $provider);
        $_ENV['MAIL_PROVIDER'] = $provider;
        $_SERVER['MAIL_PROVIDER'] = $provider;
    }

    $from = readSystemSetting($pdo, 'mail_from_address');
    if ($from !== null && $from !== '') {
        putenv('MAIL_FROM_ADDRESS=' . $from);
        $_ENV['MAIL_FROM_ADDRESS'] = $from;
        $_SERVER['MAIL_FROM_ADDRESS'] = $from;
    }

    $fromName = readSystemSetting($pdo, 'mail_from_name');
    if ($fromName !== null && $fromName !== '') {
        putenv('MAIL_FROM_NAME=' . $fromName);
        $_ENV['MAIL_FROM_NAME'] = $fromName;
        $_SERVER['MAIL_FROM_NAME'] = $fromName;
    }

    $apiKey = readSystemSetting($pdo, 'brevo_api_key');
    if ($apiKey !== null && $apiKey !== '') {
        putenv('BREVO_API_KEY=' . $apiKey);
        $_ENV['BREVO_API_KEY'] = $apiKey;
        $_SERVER['BREVO_API_KEY'] = $apiKey;
    }
}

/** @return array<string, mixed> */
function getSystemEmailConfig(PDO $pdo): array
{
    applySystemMailEnvOverrides($pdo);

    $provider = strtolower((string)(readSystemSetting($pdo, 'mail_provider') ?: getenv('MAIL_PROVIDER') ?: 'phpmail'));
    if (!in_array($provider, ['brevo', 'phpmail'], true)) {
        $provider = 'phpmail';
    }

    $hasApiKey = readSystemSetting($pdo, 'brevo_api_key') !== null
        || trim((string)(getenv('BREVO_API_KEY') ?: '')) !== '';

    return [
        'mailProvider' => $provider,
        'smtpServer' => readSystemSetting($pdo, 'smtp_server') ?: 'smtp.gmail.com',
        'smtpPort' => readSystemSetting($pdo, 'smtp_port') ?: '587',
        'emailAddress' => readSystemSetting($pdo, 'mail_from_address')
            ?: (string)(getenv('MAIL_FROM_ADDRESS') ?: ''),
        'fromName' => readSystemSetting($pdo, 'mail_from_name')
            ?: (string)(getenv('MAIL_FROM_NAME') ?: 'Nuestra Señora De Guia Academy'),
        'emailPassword' => $hasApiKey ? SYSTEM_SETTINGS_MASK : '',
        'otpExpiry' => (string)getOtpExpiryMinutes($pdo),
        'hasApiKey' => $hasApiKey,
    ];
}

/** @return array<string, array<string, bool>> */
function getRolePermissions(PDO $pdo): array
{
    $defaults = defaultRolePermissions();
    $raw = readSystemSetting($pdo, 'role_permissions');
    if ($raw === null) {
        return $defaults;
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return $defaults;
    }

    foreach ($defaults as $role => $perms) {
        if (!isset($decoded[$role]) || !is_array($decoded[$role])) {
            continue;
        }
        foreach ($perms as $key => $defaultVal) {
            if (array_key_exists($key, $decoded[$role])) {
                $defaults[$role][$key] = (bool)$decoded[$role][$key];
            }
        }
    }

    return $defaults;
}

/**
 * @param array<string, array<string, bool>> $permissions
 */
function saveRolePermissions(PDO $pdo, array $permissions): void
{
    $merged = defaultRolePermissions();
    foreach ($merged as $role => $perms) {
        if (!isset($permissions[$role]) || !is_array($permissions[$role])) {
            continue;
        }
        foreach ($perms as $key => $_default) {
            if (array_key_exists($key, $permissions[$role])) {
                $merged[$role][$key] = (bool)$permissions[$role][$key];
            }
        }
    }

    writeSystemSetting($pdo, 'role_permissions', json_encode($merged, JSON_UNESCAPED_UNICODE));
}

/**
 * @param array<string, mixed> $payload
 */
function saveSystemEmailConfig(PDO $pdo, array $payload): void
{
    $provider = strtolower(trim((string)($payload['mailProvider'] ?? 'brevo')));
    if (!in_array($provider, ['brevo', 'phpmail'], true)) {
        $provider = 'brevo';
    }
    writeSystemSetting($pdo, 'mail_provider', $provider);

    $smtpServer = trim((string)($payload['smtpServer'] ?? ''));
    if ($smtpServer !== '') {
        writeSystemSetting($pdo, 'smtp_server', $smtpServer);
    }

    $smtpPort = trim((string)($payload['smtpPort'] ?? ''));
    if ($smtpPort !== '' && ctype_digit($smtpPort)) {
        writeSystemSetting($pdo, 'smtp_port', $smtpPort);
    }

    $email = trim((string)($payload['emailAddress'] ?? ''));
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        writeSystemSetting($pdo, 'mail_from_address', $email);
    }

    $fromName = trim((string)($payload['fromName'] ?? ''));
    if ($fromName !== '') {
        writeSystemSetting($pdo, 'mail_from_name', $fromName);
    }

    $password = (string)($payload['emailPassword'] ?? '');
    if ($password !== '' && $password !== SYSTEM_SETTINGS_MASK) {
        writeSystemSetting($pdo, 'brevo_api_key', $password);
    }

    $otpExpiry = (int)($payload['otpExpiry'] ?? 10);
    writeSystemSetting($pdo, 'otp_expiry_minutes', (string)max(5, min(60, $otpExpiry)));
}

function buildOtpEmailBodyWithExpiry(PDO $pdo, string $otp): string
{
    $minutes = getOtpExpiryMinutes($pdo);

    return "Your NSDGA IntelliDocs verification code is: {$otp}\n\n"
        . "This code expires in {$minutes} minutes.\n"
        . "If you did not request this, you can ignore this email.";
}
