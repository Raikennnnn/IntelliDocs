export const MIN_PASSWORD_LENGTH = 8;

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export type PasswordRequirementId = 'length' | 'letter' | 'number' | 'symbol' | 'notRepeated';

export type PasswordRequirement = {
  id: PasswordRequirementId;
  label: string;
  met: boolean;
  required: boolean;
};

export type PasswordStrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

/** Mirrors `api/password_policy.php` plus optional symbol for strength UI. */
export function getPasswordRequirements(password: string): PasswordRequirement[] {
  const hasLength = password.length >= MIN_PASSWORD_LENGTH;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const notRepeated = password.length > 0 && !/^(.)\1*$/u.test(password);

  return [
    {
      id: 'length',
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      met: hasLength,
      required: true,
    },
    {
      id: 'letter',
      label: 'At least one letter (A–Z)',
      met: hasLetter,
      required: true,
    },
    {
      id: 'number',
      label: 'At least one number (0–9)',
      met: hasNumber,
      required: true,
    },
    {
      id: 'symbol',
      label: 'At least one symbol (!@#$…)',
      met: hasSymbol,
      required: false,
    },
    {
      id: 'notRepeated',
      label: 'Not a single repeated character',
      met: notRepeated,
      required: true,
    },
  ];
}

export function getPasswordStrength(password: string): PasswordStrengthLevel {
  if (!password) return 'empty';

  const requirements = getPasswordRequirements(password);
  const requiredMet = requirements.filter((r) => r.required).every((r) => r.met);
  const symbolMet = requirements.find((r) => r.id === 'symbol')?.met ?? false;
  const metCount = requirements.filter((r) => r.met).length;

  if (requiredMet && symbolMet && password.length >= 12) return 'strong';
  if (requiredMet && symbolMet) return 'good';
  if (requiredMet) return 'fair';
  if (metCount >= 2) return 'fair';
  return 'weak';
}

export const PASSWORD_STRENGTH_LABEL: Record<Exclude<PasswordStrengthLevel, 'empty'>, string> = {
  weak: 'Weak',
  fair: 'Fair',
  good: 'Good',
  strong: 'Strong',
};

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
