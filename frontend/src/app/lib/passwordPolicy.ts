export const MIN_PASSWORD_LENGTH = 8;

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/** Mirrors `api/password_policy.php`. */
export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  if (/^(.)\1*$/u.test(password)) {
    return {
      ok: false,
      message: 'Password cannot be a single repeated character.',
    };
  }

  if (!/[a-zA-Z]/.test(password)) {
    return {
      ok: false,
      message: 'Password must include at least one letter.',
    };
  }

  if (!/\d/.test(password)) {
    return {
      ok: false,
      message: 'Password must include at least one number.',
    };
  }

  return { ok: true };
}
