<?php
declare(strict_types=1);

/**
 * Welcome email when school credentials are issued (registrar approve flow).
 */

require_once __DIR__ . '/email_layout.php';

if (!function_exists('renderWelcomeEmail')) {
    /**
     * @param array<string, string|null> $vars
     * @return array{subject: string, body: string}
     */
    function renderWelcomeEmail(array $vars): array
    {
        $firstName         = isset($vars['first_name']) ? (string)$vars['first_name'] : '';
        $schoolUsername    = isset($vars['school_username']) ? (string)$vars['school_username'] : '';
        $temporaryPassword = isset($vars['temporary_password']) ? (string)$vars['temporary_password'] : '';

        $appHost = isset($vars['app_host']) && $vars['app_host'] !== ''
            ? (string)$vars['app_host']
            : welcomeEmailResolveAppHost();
        $loginUrl = 'https://' . $appHost . '/login';

        $subject = 'Welcome to Nuestra Señora De Guia Academy — Your School Account';

        $content =
            emailLayoutParagraph('Hi ' . ($firstName !== '' ? $firstName : 'there') . ',')
            . emailLayoutParagraph('Your Nuestra Señora De Guia Academy student account has been created.')
            . emailLayoutCredentialBox([
                ['label' => 'School username', 'value' => $schoolUsername],
                ['label' => 'Temporary password', 'value' => $temporaryPassword],
            ])
            . emailLayoutParagraph('Sign in using either your personal email or your school username. You will be asked to set a new password the first time you sign in.')
            . emailLayoutButton($loginUrl, 'Sign in to NSDGA')
            . emailLayoutCallout(
                '<strong style="color:#101828;">Did not expect this?</strong> Contact the registrar\'s office immediately.'
            );

        $body = renderBrandedEmailHtml(
            'Welcome',
            'Your school account is ready',
            $content
        );

        return [
            'subject' => $subject,
            'body'    => $body,
        ];
    }
}

if (!function_exists('welcomeEmailResolveAppHost')) {
    function welcomeEmailResolveAppHost(): string
    {
        $raw = getenv('APP_PUBLIC_URL');
        if ($raw === false || $raw === '') {
            return 'intellidocs.local';
        }

        $value = trim((string)$raw);
        if ($value === '') {
            return 'intellidocs.local';
        }

        $parts = parse_url($value);
        if (is_array($parts) && isset($parts['host']) && $parts['host'] !== '') {
            $host = $parts['host'];
            if (isset($parts['port'])) {
                $host .= ':' . $parts['port'];
            }
            return $host;
        }

        $stripped = preg_replace('#^[a-zA-Z][a-zA-Z0-9+.\-]*://#', '', $value);
        if (!is_string($stripped) || $stripped === '') {
            return 'intellidocs.local';
        }
        $slash = strpos($stripped, '/');
        if ($slash !== false) {
            $stripped = substr($stripped, 0, $slash);
        }
        return $stripped !== '' ? $stripped : 'intellidocs.local';
    }
}
