export type EmailValidationResult =
  | { ok: true }
  | { ok: false; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): EmailValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, message: 'Enter your email address.' };
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return {
      ok: false,
      message: 'Enter a valid email address (example: yourname@example.com).',
    };
  }
  return { ok: true };
}
