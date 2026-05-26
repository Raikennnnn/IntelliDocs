<?php
declare(strict_types=1);

/**
 * Welcome_Email template renderer.
 *
 * Renders the plain-text Welcome email body and subject for a student whose
 * school credentials have just been issued by the registrar approve flow.
 *
 * The body is plain text only. No HTML tags are emitted. Placeholders
 * (`{first_name}`, `{school_username}`, `{temporary_password}`, `{app_host}`)
 * are substituted via simple string replacement.
 *
 * Design references:
 *   - .kiro/specs/student-school-credentials/design.md
 *     "Welcome_Email template (plain text)"
 *     "Property 10: Welcome email body contains required pieces and is plain text"
 *
 * Requirements: 5.2, 5.3
 */

if (!function_exists('renderWelcomeEmail')) {
    /**
     * Render the Welcome_Email subject and body from the supplied variables.
     *
     * @param array<string, string|null> $vars Expected keys:
     *   - first_name         (string, required) Student's given name as displayed in the greeting.
     *   - school_username    (string, required) Newly issued school username.
     *   - temporary_password (string, required) Cleartext temporary password (mm-dd-yyyy of DOB).
     *   - app_host           (string, optional) Host portion of the login URL.
     *                        Defaults to APP_PUBLIC_URL env (host part) or 'intellidocs.local'.
     *
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

        $subject = 'Welcome to Nuestra Señora De Guia Academy — Your School Account';

        // Plain-text body. No HTML tags. Each line ends with "\n".
        $template =
            "Hi {first_name},\n"
            . "\n"
            . "Your Nuestra Señora De Guia Academy student account has been created.\n"
            . "\n"
            . "  School username:    {school_username}\n"
            . "  Temporary password: {temporary_password}\n"
            . "\n"
            . "You can sign in at https://{app_host}/login using either your personal\n"
            . "email or your school username.\n"
            . "\n"
            . "You will be asked to set a new password the first time you sign in.\n"
            . "\n"
            . "If you did not expect this email, please contact the registrar's office.\n"
            . "\n"
            . "— Nuestra Señora De Guia Academy\n";

        $body = strtr($template, [
            '{first_name}'         => $firstName,
            '{school_username}'    => $schoolUsername,
            '{temporary_password}' => $temporaryPassword,
            '{app_host}'           => $appHost,
        ]);

        return [
            'subject' => $subject,
            'body'    => $body,
        ];
    }
}

if (!function_exists('welcomeEmailResolveAppHost')) {
    /**
     * Resolve the host portion of the application's public URL.
     *
     * Reads APP_PUBLIC_URL from the environment (already populated by
     * loadProjectEnv() at handler boot). Strips the scheme and any path so the
     * template emits exactly one `https://` prefix.
     */
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

        // Drop the scheme (http://, https://) if present so the template's
        // "https://" prefix is not duplicated.
        $parts = parse_url($value);
        if (is_array($parts) && isset($parts['host']) && $parts['host'] !== '') {
            $host = $parts['host'];
            if (isset($parts['port'])) {
                $host .= ':' . $parts['port'];
            }
            return $host;
        }

        // parse_url() returns false for bare hostnames; fall back to a manual strip.
        $stripped = preg_replace('#^[a-zA-Z][a-zA-Z0-9+.\-]*://#', '', $value);
        if (!is_string($stripped) || $stripped === '') {
            return 'intellidocs.local';
        }
        // Trim any trailing path/query so we keep just `host[:port]`.
        $slash = strpos($stripped, '/');
        if ($slash !== false) {
            $stripped = substr($stripped, 0, $slash);
        }
        return $stripped !== '' ? $stripped : 'intellidocs.local';
    }
}
