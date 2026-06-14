import { useState, type ClipboardEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';import { apiFetch } from '../../lib/api';
import { validatePassword } from '../../lib/passwordPolicy';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert, AlertDescription } from '../../components/ui/alert';
import schoolLogo from '../../../assets/logo.png';
import homePageImage from '../../../assets/homepage-Bxdbuq6s.png';

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
    <div className="relative h-[100dvh] w-full overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img alt="" className="absolute left-0 top-0 h-full w-full scale-110 object-cover" src={homePageImage} />
      </div>
      <div className="absolute inset-0 bg-[rgba(72,0,21,0.32)]" />

      <div className="absolute left-0 top-0 z-10 flex h-[63px] w-full items-center bg-[#8B1538] px-4 shadow-md sm:px-8">
        <Link to="/landing" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="size-10 shrink-0">
            <img alt="School Logo" className="h-full w-full object-contain" src={schoolLogo} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-white sm:text-lg">Nuestra Señora De Guia</p>
            <p className="truncate text-xs font-semibold text-white">Academy of Marikina</p>
          </div>
        </Link>
      </div>

      <div className="relative z-10 flex h-full items-center justify-center px-4 py-20">
        <div className="w-full max-w-[527px] rounded-lg border border-gray-300 bg-white/80 p-5 shadow-lg backdrop-blur-sm sm:p-8">
          <div className="space-y-6">
            <div>
              <h2 className="mb-2 text-2xl font-bold text-[#101828]">
                {step === 'email' ? 'Forgot password' : 'Reset password'}
              </h2>
              <p className="text-base text-black">
                {step === 'email'
                  ? 'Enter your email and we will send a 6-digit reset code (valid for 5 minutes).'
                  : 'Enter the code from your email and choose a new password.'}
              </p>
            </div>

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
                <Button type="submit" disabled={loading} className="w-full h-12 bg-[#8B1538] hover:bg-[#8B1538]/90 text-white">
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
                  Codes expire in 5 minutes. Max 5 attempts, then a 15-minute lockout. Up to 3 code requests per hour.
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
                <Button type="submit" disabled={loading} className="w-full h-12 bg-[#8B1538] hover:bg-[#8B1538]/90 text-white">
                  {loading ? 'Updating…' : 'Update password'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={resending || loading}
                  onClick={() => {
                    setResending(true);
                    void requestResetCode().finally(() => setResending(false));
                  }}
                >
                  {resending ? 'Sending…' : 'Resend reset code'}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('email')}>
                  Use a different email
                </Button>
              </form>
            )}

            <div className="text-center">
              <Link to="/login" className="text-sm text-[#8B1538] font-semibold hover:underline">
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
