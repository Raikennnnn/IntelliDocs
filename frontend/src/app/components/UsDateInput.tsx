import { Calendar } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  formatBirthDateUsDisplay,
  parseBirthDateUsToYmd,
  sanitizeBirthDateUsInput,
} from '../lib/enrollmentFieldValidation';
import { Input } from './ui/input';
import { cn } from './ui/utils';

type UsDateInputProps = {
  id?: string;
  /** Canonical value: YYYY-MM-DD */
  value: string;
  onChange: (ymd: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onBlurInvalid?: () => void;
};

export function formatYmdAsUs(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  return formatBirthDateUsDisplay(ymd) || '—';
}

export function UsDateInput({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = 'MM/DD/YYYY',
  disabled,
  className,
  onBlurInvalid,
}: UsDateInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [display, setDisplay] = useState(() => formatBirthDateUsDisplay(value));

  useEffect(() => {
    setDisplay(formatBirthDateUsDisplay(value));
  }, [value]);

  const commitDisplay = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const ymd = parseBirthDateUsToYmd(trimmed);
    if (!ymd) return null;
    if (min && ymd < min) return null;
    if (max && ymd > max) return null;
    return ymd;
  };

  const openCalendar = () => {
    if (disabled) return;
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
      picker.click();
    }
  };

  const applyYmd = (ymd: string) => {
    onChange(ymd);
    setDisplay(formatBirthDateUsDisplay(ymd));
  };

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder={placeholder}
        value={display}
        disabled={disabled}
        onChange={(e) => {
          const next = sanitizeBirthDateUsInput(e.target.value);
          setDisplay(next);
          if (next.length === 10) {
            const ymd = commitDisplay(next);
            if (ymd !== null && ymd !== '') {
              onChange(ymd);
            }
          } else if (next === '') {
            onChange('');
          }
        }}
        onBlur={() => {
          if (!display.trim()) {
            onChange('');
            return;
          }
          const ymd = commitDisplay(display);
          if (!ymd) {
            onBlurInvalid?.();
            return;
          }
          applyYmd(ymd);
        }}
        className={cn('pr-10', className)}
      />
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const ymd = e.target.value;
          if (ymd) {
            applyYmd(ymd);
          } else {
            onChange('');
            setDisplay('');
          }
        }}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      <button
        type="button"
        onClick={openCalendar}
        disabled={disabled}
        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#8B1538] disabled:pointer-events-none disabled:opacity-50"
        aria-label="Open calendar"
      >
        <Calendar className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
