<?php
declare(strict_types=1);

/**
 * Shared password strength rules for register, change_password, and create_user.
 *
 * @return array{code: string, error: string}|null Null when password is acceptable.
 */
function validatePasswordStrength(string $password): ?array
{
    if (strlen($password) < 8) {
        return [
            'code' => 'password_too_short',
            'error' => 'Password must be at least 8 characters',
        ];
    }

    // Reject ********, aaaaaaaa, 11111111, etc.
    if (preg_match('/^(.)\1*$/u', $password) === 1) {
        return [
            'code' => 'password_too_weak',
            'error' => 'Password cannot be a single repeated character',
        ];
    }

    if (!preg_match('/[a-zA-Z]/', $password)) {
        return [
            'code' => 'password_too_weak',
            'error' => 'Password must include at least one letter',
        ];
    }

    if (!preg_match('/\d/', $password)) {
        return [
            'code' => 'password_too_weak',
            'error' => 'Password must include at least one number',
        ];
    }

    return null;
}
