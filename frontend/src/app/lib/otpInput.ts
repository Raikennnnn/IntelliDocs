import type { KeyboardEvent } from 'react';

export const OTP_LENGTH = 6;

export function focusOtpInput(inputIdPrefix: string, index: number): void {
  document.getElementById(`${inputIdPrefix}-${index}`)?.focus();
}

/** Backspace clears the current digit, or the previous one when the box is already empty. */
export function handleOtpBackspaceKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  index: number,
  otp: string[],
  setOtp: (next: string[]) => void,
  inputIdPrefix: string,
): void {
  if (event.key !== 'Backspace') return;

  if (otp[index]) {
    event.preventDefault();
    const next = [...otp];
    next[index] = '';
    setOtp(next);
    return;
  }

  if (index > 0) {
    event.preventDefault();
    const next = [...otp];
    next[index - 1] = '';
    setOtp(next);
    focusOtpInput(inputIdPrefix, index - 1);
  }
}
