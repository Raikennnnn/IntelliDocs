import { useState, type ClipboardEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { apiFetch } from '../../lib/api';
import { validatePassword } from '../../lib/passwordPolicy';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { AUTH_OTP_LIMITS, otpAttemptHelpText } from '../../lib/authOtpLimits';
import { AuthPageShell } from '../../components/public/AuthPageShell';
import { BRAND } from '../../lib/publicBrand';

type Step = 'email' | 'reset';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleOtpChange = (index: number, value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length > 1) {
      const next = [...otp];
      for (let i = 0; i < digitsOnly.length && index + i < 6; i++) {
        next[index + i] = digitsOnly[i];
      }
      setOtp(next);
      document.getElementById(`reset-otp-${Math.min(index + digitsOnly.length, 5)}`)?.focus();
      return;
    }
    if (/^\d?$/.test(value)) {
      const next = [...otp];
      next[index] = value;
      setOtp(next);
      if (value && index < 5) {
        document.getElementById(`reset-otp-${index + 1}`)?.focus();
      }
    }
  };

  const handleOtpPaste = (e: ClipboardEvent) => {
    const raw = e.clipboardData.getData('text') || '';
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    if (digits.length === 0) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < digits.length && i < 6; i++) next[i] = digits[i];
    setOtp(next);
    document.getElementById(`reset-otp-${Math.min(digits.length, 5)}`)?.focus();
  };

  const requestResetCode = async () => {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'forgot_password', email: email.trim().toLowerCase() }),
      });
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        code?: string;
        message?: string;
        dev_otp?: string;
      } | null;
      if (!res.ok || !data?.success) {
        if (data?.code === 'otp_resend_limit') {
          setError(data.error || 'Too many reset code requests. Try again in an hour.');
        } else {
          setError(data?.error || 'Could not send reset code.');
        }
        return;
      }
      setStep('reset');
      setOtp(['', '', '', '', '', '']);
      setInfo(data.message || 'If an account exists, a reset code was sent to your email.');
      if (data.dev_otp) {
        setInfo((prev) => `${prev} Dev OTP: ${data.dev_otp}`);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter your account email.');
      return;
    }
    void requestResetCode();
  };

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Enter the complete 6-digit code.');
      return;
    }
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.ok) {
      setError(passwordCheck.message);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'reset_password',
          email: email.trim().toLowerCase(),
          otp: code,
          new_password: newPassword,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        code?: string;
        message?: string;
        attempts_remaining?: number;
        retry_after_minutes?: number;
      } | null;
      if (!res.ok || !data?.success) {
        if (data?.code === 'otp_locked') {
          setError(data.error || 'Too many incorrect attempts. Try again later.');
        } else if (data?.code === 'invalid_otp') {
          setError(data.error || 'Invalid or expired code.');
        } else {
          setError(data?.error || 'Could not reset password.');
        }
        return;
      }
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      eyebrow="Account Recovery"
      title={step === 'email' ? 'Forgot password' : 'Reset password'}
      subtitle={
        step === 'email'
          ? 'We will email you a 6-digit reset code valid for 5 minutes.'
          : 'Enter the code from your email and choose a new password.'
      }
    >
      <div className="space-y-6">

            {info && (
              <Alert>
                <AlertDescription>{info}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === 'email' ? (
              <form onSubmit={handleEmailSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 bg-[#F9FAFB]"
                    placeholder="you@example.com"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full text-white"
                  style={{ backgroundColor: BRAND.maroon }}
                >
                  {loading ? 'Sending…' : 'Send reset code'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-6">
                <div className="min-w-0">
                  <Label className="mb-3 block text-gray-700">Reset code</Label>
                  <div
                    className="mx-auto grid w-full max-w-xs grid-cols-6 gap-1.5 sm:max-w-sm sm:gap-2"
                    onPaste={handleOtpPaste}
                  >
                    {otp.map((digit, index) => (
                      <Input
                        key={index}
                        id={`reset-otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onPaste={handleOtpPaste}
                        className="aspect-square h-auto w-full min-w-0 max-h-12 p-0 text-center text-base font-semibold sm:max-h-14 sm:text-xl"
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center">
                  {otpAttemptHelpText(AUTH_OTP_LIMITS.passwordResetCodesPerHour)}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="h-12 bg-[#F9FAFB]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-12 bg-[#F9FAFB]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-[8px] border-2 border-[#8b1538] bg-[#8b1538] text-base font-semibold text-white transition-colors hover:bg-[#8b1538]/90 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-500"
                >
                  {loading ? 'Updating…' : 'Update password'}
                </button>
                <button
                  type="button"
                  disabled={resending || loading}
                  onClick={() => {
                    setResending(true);
                    void requestResetCode().finally(() => setResending(false));
                  }}
                  className="h-12 w-full rounded-[8px] border-2 border-[#2d5016] bg-white text-base font-semibold text-[#2d5016] transition-colors hover:bg-[#2d5016]/5 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  {resending ? 'Sending…' : 'Resend reset code'}
                </button>
                <button
                  type="button"
                  className="h-11 w-full rounded-[8px] text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                  onClick={() => setStep('email')}
                >
                  Use a different email
                </button>
              </form>
            )}

            <div className="text-center">
              <Link to="/login" className="text-sm font-semibold hover:underline" style={{ color: BRAND.maroon }}>
                Back to login
              </Link>
            </div>
          </div>
    </AuthPageShell>
  );
}
