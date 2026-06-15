/** Keep in sync with defaults in api/otp_guard.php */
export const AUTH_OTP_LIMITS = {
  maxAttempts: 5,
  lockoutMinutes: 15,
  loginCodesPerHour: 10,
  registrationCodesPerHour: 6,
  passwordResetCodesPerHour: 6,
} as const;

export function otpAttemptHelpText(codesPerHour: number): string {
  return `Codes expire in 5 minutes. Max ${AUTH_OTP_LIMITS.maxAttempts} attempts, then a ${AUTH_OTP_LIMITS.lockoutMinutes}-minute lockout. Up to ${codesPerHour} code requests per hour.`;
}
