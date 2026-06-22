import registrationImage from '../../../assets/registerpage.png';
import { apiFetch } from '../../lib/api';
import { validateEmail } from '../../lib/emailValidation';
import { validatePassword } from '../../lib/passwordPolicy';
import { useState, type ClipboardEvent, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { AUTH_OTP_LIMITS, otpAttemptHelpText } from '../../lib/authOtpLimits';
import { AuthPageHeader } from '../../components/public/AuthPageShell';
import { PublicSectionEyebrow } from '../../components/public/PublicSectionEyebrow';
import { PasswordStrengthChecker } from '../../components/public/PasswordStrengthChecker';
import { BRAND } from '../../lib/publicBrand';

// Registration Page Component
export function RegistrationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'register' | 'otp'>('register');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [otpDelivery, setOtpDelivery] = useState<'sent' | 'failed' | null>(null);
  const [termsPrivacyAccepted, setTermsPrivacyAccepted] = useState(false);
  const [dpaAccepted, setDpaAccepted] = useState(false);
  const [showPasswordHints, setShowPasswordHints] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toastEmailValidation = () => {
    const result = validateEmail(formData.email);
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    return true;
  };

  const toastPasswordValidation = () => {
    const passwordCheck = validatePassword(formData.password);
    if (!passwordCheck.ok) {
      toast.error(passwordCheck.message);
      return false;
    }
    return true;
  };

  const passwordsMatch =
    formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword;

  const handleOtpChange = (index: number, value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length > 1) {
      const next = [...otp];
      for (let i = 0; i < digitsOnly.length && index + i < 6; i++) {
        next[index + i] = digitsOnly[i];
      }
      setOtp(next);
      document.getElementById(`otp-${Math.min(index + digitsOnly.length, 5)}`)?.focus();
      return;
    }
    if (/^\d?$/.test(value)) {
      const next = [...otp];
      next[index] = value;
      setOtp(next);
      if (value && index < 5) {
        document.getElementById(`otp-${index + 1}`)?.focus();
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
    const focusIndex = Math.min(digits.length, 5);
    const el = document.getElementById(`otp-${focusIndex}`);
    el?.focus();
  };

  const handleResendOtp = async () => {
    if (resendingOtp || isLoading) return;
    setResendingOtp(true);
    try {
      const response = await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'resend_otp',
          email: formData.email.trim().toLowerCase(),
        }),
      });
      const text = await response.text();
      let data: {
        success?: boolean;
        error?: string;
        message?: string;
        otp_delivery?: string;
        mail_error?: string;
        code?: string;
      } = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Server returned an invalid response');
      }
      if (response.ok && data.success) {
        setOtp(['', '', '', '', '', '']);
        setOtpDelivery(data.otp_delivery === 'sent' ? 'sent' : 'failed');
        if (data.otp_delivery === 'sent') {
          toast.success(data.message || 'OTP resent to your email');
        } else {
          toast.warning(data.message || 'OTP could not be sent');
          if (data.mail_error) {
            toast.error(data.mail_error, { duration: 8000 });
          }
        }
      } else if (data.code === 'otp_resend_limit') {
        toast.error(data.error || `Maximum ${AUTH_OTP_LIMITS.registrationCodesPerHour} registration code requests per hour reached.`);
      } else {
        toast.error(data.error || `Resend failed (${response.status})`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Network error');
    } finally {
      setResendingOtp(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim() || !formData.password || !formData.confirmPassword) {
      toast.error('Please fill in all fields.');
      return;
    }

    const emailCheck = validateEmail(formData.email);
    if (!emailCheck.ok) {
      toast.error(emailCheck.message);
      return;
    }

    if (!toastPasswordValidation()) {
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match. Re-enter the same password in both fields.');
      return;
    }

    if (!termsPrivacyAccepted) {
      toast.error('Please accept the Terms of Use and Privacy Policy');
      return;
    }

    if (!dpaAccepted) {
      toast.error('Please accept the Data Processing Agreement (DPA)');
      return;
    }

    setIsLoading(true);

    // Real backend register
    try {
      const response = await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'register',
          username: formData.email.split('@')[0],
          email: formData.email,
          password: formData.password,
          // Full name is collected later via the enrollment application form;
          // sending an empty string lets the backend skip the legacy validation.
          full_name: '',
          terms_privacy_accepted: termsPrivacyAccepted,
          dpa_accepted: dpaAccepted,
        }),
      });

      const responseText = await response.text();
      let data: {
        success?: boolean;
        error?: string;
        message?: string;
        otp_delivery?: string;
        mail_error?: string;
        code?: string;
      } = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('Server returned an invalid response. Check backend API setup.');
      }

      if (response.ok && data.success) {
        setOtpDelivery(data.otp_delivery === 'sent' ? 'sent' : 'failed');
        if (data.otp_delivery === 'sent') {
          toast.success(data.message || 'Verification code sent to your email.');
        } else {
          toast.warning(data.message || 'Could not send verification email.');
          if (data.mail_error) {
            toast.error(data.mail_error, { duration: 8000 });
          }
        }
        setStep('otp');
      } else if (data.code === 'otp_resend_limit') {
        toast.error(data.error || `Maximum ${AUTH_OTP_LIMITS.registrationCodesPerHour} registration code requests per hour reached. Try again later.`);
      } else {
        toast.error(data.error || `Registration failed (${response.status})`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();

    const enteredOtp = otp.join('');
    if (enteredOtp.length !== 6) {
      toast.error('Please enter the complete OTP code');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'verify_otp',
          email: formData.email.trim().toLowerCase(),
          otp: enteredOtp,
        }),
      });
      const text = await response.text();
      let data: {
        success?: boolean;
        error?: string;
        message?: string;
        code?: string;
        attempts_remaining?: number;
        retry_after_minutes?: number;
      } = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Server returned an invalid response');
      }
      if (response.ok && data.success) {
        toast.success(data.message || 'Account created. Please sign in.');
        navigate('/login');
      } else if (data.code === 'otp_locked') {
        toast.error(data.error || 'Too many incorrect attempts. Try again in 15 minutes.');
      } else if (data.code === 'invalid_otp') {
        const attemptsHint =
          typeof data.attempts_remaining === 'number'
            ? ` ${data.attempts_remaining} attempt(s) remaining.`
            : '';
        toast.error((data.error || 'Invalid or expired OTP.') + attemptsHint);
      } else {
        toast.error(data.error || `OTP verification failed (${response.status})`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const agreementsComplete = termsPrivacyAccepted && dpaAccepted;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-white">
      <AuthPageHeader />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className="flex w-full min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 py-4 pb-8 sm:px-6 sm:py-6 lg:w-1/2"
          style={{ backgroundColor: BRAND.surface }}
        >
          <div className="w-full max-w-md">
            <button
              type="button"
              onClick={() => (step === 'otp' ? setStep('register') : navigate('/admissions'))}
              className="mb-3 flex items-center gap-2 transition-colors hover:opacity-80"
              style={{ color: BRAND.maroon }}
            >
              <ArrowLeft className="size-4 shrink-0" />
              <span className="text-sm font-medium">Back</span>
            </button>

            {step === 'register' ? (
              <>
                <PublicSectionEyebrow>Register</PublicSectionEyebrow>
                <div className="mb-4">
                  <h1 className="mb-1 text-2xl font-bold leading-tight" style={{ color: BRAND.ink }}>
                    Create your account
                  </h1>
                  <p className="text-sm leading-snug" style={{ color: BRAND.slate }}>
                    Start your NSDGA senior high school application online.
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-3" autoComplete="off">
                <div className="min-w-0">
                  <Label htmlFor="email" className="mb-1 block text-sm text-gray-700">
                    Enter your email <span className="text-[#8B1538]">*</span>
                  </Label>
                  <div className="relative min-w-0">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      name="email"
                      autoComplete="off"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      onBlur={() => {
                        if (formData.email.trim()) {
                          void toastEmailValidation();
                        }
                      }}
                      placeholder="yourname@example.com"
                      className="h-11 pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <Label htmlFor="password" className="mb-1 block text-sm text-gray-700">
                    Create a password <span className="text-[#8B1538]">*</span>
                  </Label>
                  <div className="relative min-w-0">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      onFocus={() => setShowPasswordHints(true)}
                      onBlur={() => {
                        if (formData.password) {
                          void toastPasswordValidation();
                        }
                      }}
                      placeholder="Letters, numbers, and symbols"
                      className="h-11 pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                  {(showPasswordHints || formData.password.length > 0) && (
                    <PasswordStrengthChecker password={formData.password} />
                  )}
                </div>

                <div className="min-w-0">
                  <Label htmlFor="confirmPassword" className="mb-1 block text-sm text-gray-700">
                    Confirm password <span className="text-[#8B1538]">*</span>
                  </Label>
                  <div className="relative min-w-0">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      onBlur={() => {
                        if (
                          formData.confirmPassword &&
                          formData.password &&
                          formData.password !== formData.confirmPassword
                        ) {
                          toast.error('Passwords do not match.');
                        }
                      }}
                      placeholder="Re-enter your password"
                      className={`h-11 pl-10 pr-10 ${
                        formData.confirmPassword && !passwordsMatch
                          ? 'border-red-400 focus-visible:border-red-500 focus-visible:ring-red-500/30'
                          : ''
                      }`}
                      required
                    />
                  </div>
                  {formData.confirmPassword && !passwordsMatch ? (
                    <p className="mt-1 text-[11px] text-red-600">Passwords do not match.</p>
                  ) : formData.confirmPassword && passwordsMatch ? (
                    <p className="mt-1 text-[11px] text-[#2d5016]">Passwords match.</p>
                  ) : null}
                </div>

                {/* Terms, Privacy, and DPA */}
                <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm sm:p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Required agreements
                  </p>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="terms-privacy"
                      checked={termsPrivacyAccepted}
                      onCheckedChange={(checked) => setTermsPrivacyAccepted(checked === true)}
                      className="mt-0.5 size-4 shrink-0 border-2 border-gray-500 bg-white shadow-sm data-[state=checked]:border-[#8B1538] data-[state=checked]:bg-[#8B1538] data-[state=checked]:text-white"
                    />
                    <div className="min-w-0 flex-1 text-xs leading-snug text-gray-700 break-words">
                      <label htmlFor="terms-privacy" className="cursor-pointer font-normal">
                        I have read and agree to the
                      </label>{' '}
                      <Link
                        to="/legal/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#8B1538] hover:underline"
                      >
                        NSDGA Terms of Use
                      </Link>{' '}
                      <span className="text-gray-600">and</span>{' '}
                      <Link
                        to="/legal/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#8B1538] hover:underline"
                      >
                        Privacy Policy
                      </Link>
                      <span className="text-gray-600">.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="dpa"
                      checked={dpaAccepted}
                      onCheckedChange={(checked) => setDpaAccepted(checked === true)}
                      className="mt-0.5 size-4 shrink-0 border-2 border-gray-500 bg-white shadow-sm data-[state=checked]:border-[#8B1538] data-[state=checked]:bg-[#8B1538] data-[state=checked]:text-white"
                    />
                    <div className="min-w-0 flex-1 text-xs leading-snug text-gray-700 break-words">
                      <label htmlFor="dpa" className="cursor-pointer font-normal">
                        I consent to the processing of my personal data as described in the
                      </label>{' '}
                      <Link
                        to="/legal/dpa"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#8B1538] hover:underline"
                      >
                        Data Processing Agreement (DPA)
                      </Link>
                      <span className="text-gray-600">.</span>
                    </div>
                  </div>
                  {(!termsPrivacyAccepted || !dpaAccepted) && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-700">
                      Check both boxes above to continue with registration.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !agreementsComplete}
                  className={`h-11 w-full rounded-md border-2 text-sm font-semibold transition-colors ${
                    isLoading || !agreementsComplete
                      ? 'cursor-not-allowed border-gray-300 bg-white text-gray-700'
                      : 'border-[#8B1538] bg-[#8B1538] text-white hover:bg-[#8B1538]/90'
                  }`}
                >
                  {isLoading ? 'Processing...' : 'Continue'}
                </button>

                <p className="text-center text-xs leading-snug text-gray-600">
                  Have an account?{' '}
                  <Link to="/login" className="font-semibold text-[#8B1538] hover:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            </>
          ) : (
              <>
                <PublicSectionEyebrow>Verify Email</PublicSectionEyebrow>
                <div className="mb-8">
                  <h1 className="mb-2 text-3xl font-bold" style={{ color: BRAND.ink }}>
                    Verify your email
                  </h1>
                  <p className="text-base" style={{ color: BRAND.slate }}>
                    Enter the 6-digit code from your email inbox.
                  </p>
                </div>

              <form onSubmit={handleVerifyOtp} className="space-y-6" autoComplete="off">
                <div>
                  <Label className="mb-3 block text-gray-700">Enter OTP Code</Label>
                  <div className="flex justify-between gap-3" onPaste={handleOtpPaste}>
                    {otp.map((digit, index) => (
                      <Input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onPaste={handleOtpPaste}
                        autoComplete="one-time-code"
                        className="h-14 w-14 text-center text-2xl font-semibold"
                      />
                    ))}
                  </div>
                </div>

                <p className="text-center text-xs leading-relaxed text-gray-500">
                  {otpAttemptHelpText(AUTH_OTP_LIMITS.registrationCodesPerHour)}
                </p>

                {otpDelivery === 'sent' ? (
                  <div className="rounded-lg border border-[#2D5016]/30 bg-green-50 p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="mt-0.5 size-5 shrink-0 text-[#2D5016]" />
                      <p className="min-w-0 flex-1 text-sm leading-relaxed text-gray-800">
                        Check your email for the 6-digit code. It expires in 5 minutes.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 sm:p-4">
                    We could not send the verification email. Try <strong>Resend OTP</strong> below.
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-12 w-full border-2 border-[#2D5016] bg-[#2D5016] text-base font-semibold text-white hover:bg-[#2D5016]/90 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-white disabled:text-gray-600 disabled:opacity-100"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Complete Registration'}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    disabled={resendingOtp || isLoading}
                    onClick={() => void handleResendOtp()}
                    className="text-sm font-semibold text-[#8B1538] hover:underline disabled:no-underline disabled:opacity-50"
                  >
                    {resendingOtp ? 'Sending new code…' : 'Resend OTP'}
                  </button>
                </div>
              </form>
            </>
            )}
          </div>
        </div>

        <div
          className="relative hidden h-full min-h-0 overflow-hidden lg:block lg:w-1/2"
          style={{ backgroundColor: BRAND.surface }}
        >
          <img
            src={registrationImage}
            alt="NSDGA students and vocational programs"
            className="h-full w-full object-contain object-center"
          />
          <div className="absolute bottom-0 left-[38%] z-[2] w-[18rem] -translate-x-1/2 p-5 text-left sm:w-[20rem] sm:p-7">
            <PublicSectionEyebrow>NSDGA Marikina</PublicSectionEyebrow>
            <p className="text-xl font-bold leading-tight" style={{ color: BRAND.maroon }}>
              Senior High School
            </p>
            <p className="mt-1 text-lg font-semibold" style={{ color: BRAND.green }}>
              Register
            </p>
            <p className="mt-3 max-w-sm text-xs" style={{ color: BRAND.slate }}>
              Grades 11 &amp; 12 — Academic and TVL strands with online document submission.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

