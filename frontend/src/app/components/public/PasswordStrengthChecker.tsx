import { Check, X } from 'lucide-react';
import {
  getPasswordRequirements,
  getPasswordStrength,
  PASSWORD_STRENGTH_LABEL,
  type PasswordStrengthLevel,
} from '../../lib/passwordPolicy';

const STRENGTH_BAR: Record<Exclude<PasswordStrengthLevel, 'empty'>, string> = {
  weak: 'w-1/4 bg-red-500',
  fair: 'w-2/4 bg-amber-500',
  good: 'w-3/4 bg-[#2d5016]',
  strong: 'w-full bg-[#2d5016]',
};

const STRENGTH_TEXT: Record<Exclude<PasswordStrengthLevel, 'empty'>, string> = {
  weak: 'text-red-600',
  fair: 'text-amber-700',
  good: 'text-[#2d5016]',
  strong: 'text-[#2d5016]',
};

type PasswordStrengthCheckerProps = {
  password: string;
  showWhenEmpty?: boolean;
};

export function PasswordStrengthChecker({ password, showWhenEmpty = false }: PasswordStrengthCheckerProps) {
  const strength = getPasswordStrength(password);
  if (strength === 'empty' && !showWhenEmpty) {
    return null;
  }

  const requirements = getPasswordRequirements(password);
  const visibleStrength = strength === 'empty' ? 'weak' : strength;

  return (
    <div
      className="mt-2 rounded-lg border border-gray-200 bg-gray-50/80 p-3"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Password strength
        </p>
        <p className={`text-xs font-semibold ${STRENGTH_TEXT[visibleStrength]}`}>
          {password ? PASSWORD_STRENGTH_LABEL[visibleStrength] : '—'}
        </p>
      </div>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-300 ${STRENGTH_BAR[visibleStrength]}`}
        />
      </div>
      <ul className="space-y-1.5">
        {requirements.map((req) => (
          <li key={req.id} className="flex items-start gap-2 text-xs leading-snug">
            <span
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${
                req.met ? 'bg-[#2d5016]/15 text-[#2d5016]' : 'bg-gray-200 text-gray-400'
              }`}
              aria-hidden
            >
              {req.met ? <Check className="size-3" /> : <X className="size-3" />}
            </span>
            <span className={req.met ? 'text-gray-800' : 'text-gray-500'}>
              {req.label}
              {!req.required ? (
                <span className="ml-1 text-[10px] font-medium text-gray-400">(recommended)</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
