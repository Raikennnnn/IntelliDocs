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
        'emailReferrerOnEnroll' => isReferrerEnrollEmailEnabledFromSetting(
            readSystemSetting($pdo, 'email_referrer_on_enroll')
        ),
    ];
}

function isReferrerEnrollEmailEnabledFromSetting(?string $raw): bool
{
    if ($raw === null || trim($raw) === '') {
        return true;
    }
    $v = strtolower(trim($raw));

    return !in_array($v, ['0', 'false', 'off', 'no'], true);
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

    if (array_key_exists('emailReferrerOnEnroll', $payload)) {
        $enabled = filter_var($payload['emailReferrerOnEnroll'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($enabled === null) {
            $raw = strtolower(trim((string)$payload['emailReferrerOnEnroll']));
            $enabled = !in_array($raw, ['0', 'false', 'off', 'no', ''], true);
        }
        writeSystemSetting($pdo, 'email_referrer_on_enroll', $enabled ? '1' : '0');
    }
}

function buildOtpEmailBodyWithExpiry(PDO $pdo, string $otp, string $purpose = 'registration'): string
{
    $minutes = getOtpExpiryMinutes($pdo);

    return renderOtpEmailHtml($otp, $minutes, $purpose);
}

/**
 * Renders a branded, email-client-friendly HTML verification email.
 * Uses table layout + inline styles for broad compatibility (Gmail, Outlook,
 * Apple Mail). The mail transports auto-generate a plain-text fallback.
 */
function renderOtpEmailHtml(string $otp, int $minutes, string $purpose = 'registration'): string
{
    $safeOtp = htmlspecialchars($otp, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeMinutes = (int)$minutes;
    $maroon = '#8b1538';
    $maroonDark = '#7a1231';
    $green = '#2d5016';
    $ink = '#101828';
    $slate = '#4a5565';
    $year = date('Y');

    $purposeKey = strtolower(trim($purpose));
    $isLogin = $purposeKey === 'login';
    $isPasswordReset = $purposeKey === 'password_reset';
    $eyebrow = $isLogin ? 'Sign-in verification' : ($isPasswordReset ? 'Password reset' : 'Email verification');
    $headline = $isLogin ? 'Complete your sign-in' : ($isPasswordReset ? 'Reset your password' : 'Confirm your email address');
    $intro = $isLogin
        ? 'Enter the code below to sign in to NSDGA.'
        : ($isPasswordReset
            ? 'Enter the code below to reset your NSDGA password.'
            : 'Enter the code below to verify your email and finish creating your account.');

    $codeCells = '';
    foreach (str_split($safeOtp) as $digit) {
        $codeCells .=
            '<td style="padding:0 5px;">'
            . '<div style="width:44px;height:56px;line-height:56px;text-align:center;'
            . 'font-family:\'Courier New\',Consolas,monospace;font-size:30px;font-weight:700;'
            . 'color:' . $ink . ';background:#f6f2f3;border:1px solid #e7dfe2;'
            . 'border-bottom:3px solid ' . $maroon . ';border-radius:10px;">'
            . $digit . '</div></td>';
    }

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<title>Email verification code</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(16,24,40,0.08);">
<tr>
<td style="height:6px;background:{$green};font-size:0;line-height:0;">&nbsp;</td>
</tr>
<tr>
<td style="background:linear-gradient(135deg,{$maroon} 0%,{$maroonDark} 100%);padding:28px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:18px;font-weight:700;line-height:1.3;">
Nuestra Señora De Guia Academy
<div style="font-size:12px;font-weight:600;color:#f4dbe3;letter-spacing:0.06em;text-transform:uppercase;margin-top:4px;">NSDGA Enrollment Portal</div>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:36px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 6px 0;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:{$green};">{$eyebrow}</p>
<h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.25;color:{$ink};">{$headline}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:{$slate};">{$intro}</p>
</td>
</tr>
<tr>
<td align="center" style="padding:26px 32px 8px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>{$codeCells}</tr></table>
</td>
</tr>
<tr>
<td align="center" style="padding:0 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
<span style="display:inline-block;background:#eef4e8;color:{$green};font-size:13px;font-weight:600;padding:7px 14px;border-radius:999px;">This code expires in {$safeMinutes} minutes</span>
</td>
</tr>
<tr>
<td style="padding:20px 32px 4px 32px;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbfaf5;border:1px solid #efe9d8;border-radius:12px;">
<tr>
<td style="padding:14px 16px;font-size:13px;line-height:1.6;color:{$slate};">
<strong style="color:{$ink};">Didn't request this?</strong> You can safely ignore this email — your account stays secure and no changes are made. Never share this code with anyone; NSDGA staff will never ask for it.
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:24px 32px 32px 32px;font-family:Arial,Helvetica,sans-serif;border-top:1px solid #eef0f2;margin-top:12px;">
<p style="margin:18px 0 0 0;font-size:12px;line-height:1.6;color:#8a94a3;">This is an automated message from the NSDGA enrollment portal. Please do not reply.</p>
<p style="margin:6px 0 0 0;font-size:12px;line-height:1.6;color:#8a94a3;">&copy; {$year} Nuestra Señora De Guia Academy of Marikina. All rights reserved.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>
HTML;
}
