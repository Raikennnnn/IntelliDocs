import registrationImage from '../../../assets/registerpage.png'
import { apiFetch } from '../../lib/api';
import { validatePassword } from '../../lib/passwordPolicy';
import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import schoolLogo from "../../../assets/logo.png";

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
  const [otpDelivery, setOtpDelivery] = useState<'sent' | 'failed' | null>(null);
  const [termsPrivacyAccepted, setTermsPrivacyAccepted] = useState(false);
  const [dpaAccepted, setDpaAccepted] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    const passwordCheck = validatePassword(formData.password);
    if (!passwordCheck.ok) {
      toast.error(passwordCheck.message);
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
      let data: { success?: boolean; error?: string; message?: string; otp_delivery?: string; mail_error?: string } = {};
      try {
        data = JSON.parse(responseText) as { success?: boolean; error?: string };
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
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
      let data: { success?: boolean; error?: string; message?: string } = {};
      try {
        data = JSON.parse(text) as { success?: boolean; error?: string; message?: string };
      } catch {
        throw new Error('Server returned an invalid response');
      }
      if (response.ok && data.success) {
        toast.success(data.message || 'Account created. Please sign in.');
        navigate('/login');
      } else {
        toast.error(data.error || `OTP verification failed (${response.status})`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* School Header Bar */}
      <div className="bg-[#8B1538] py-3 px-6 flex-shrink-0">
        {/* TODO: Replace with official NSGDA logo image */}
        <div className="flex items-center gap-3">
          <img 
            src={schoolLogo} 
            alt="Nuestra Señora De Guia Academy" 
            className="w-10 h-10 object-contain bg-white rounded-full p-1"
          />
          <div>
            <p className="font-bold text-white text-base leading-tight">
              Nuestra Señora De Guia
            </p>
            <p className="text-xs text-white/90">Academy of Marikina</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Back Button */}
          <button
            onClick={() => step === 'otp' ? setStep('register') : navigate('/admissions')}
            className="flex items-center gap-2 text-gray-600 hover:text-[#8B1538] mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          {step === 'register' ? (
            <>
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Create your account
                </h1>
                <p className="text-gray-600">
                  Fill up all the fields as per your valid details.
                </p>
              </div>

              {/* Registration Form */}
              <form onSubmit={handleRegister} className="space-y-5" autoComplete="off">
                <div>
                  <Label htmlFor="email" className="text-gray-700 mb-2 block">
                    Enter your email <span className="text-[#8B1538]">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      name="email"
                      autoComplete="off"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="yourname@example.com"
                      className="pl-10 h-12"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password" className="text-gray-700 mb-2 block">
                    Create a password <span className="text-[#8B1538]">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder="Letters and numbers, 8+ characters"
                      className="pl-10 pr-10 h-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Use at least 8 characters with letters and numbers. Single repeated characters are
                    not allowed.
                  </p>
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-gray-700 mb-2 block">
                    Confirm password <span className="text-[#8B1538]">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      placeholder="Re-enter your password"
                      className="pl-10 pr-10 h-12"
                      required
                    />
                  </div>
                </div>

                {/* Terms, Privacy, and DPA */}
                <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Required agreements
                  </p>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms-privacy"
                      checked={termsPrivacyAccepted}
                      onCheckedChange={(checked) => setTermsPrivacyAccepted(checked === true)}
                      className="mt-0.5 size-5 shrink-0 border-2 border-gray-500 bg-white shadow-sm data-[state=checked]:bg-[#8B1538] data-[state=checked]:border-[#8B1538] data-[state=checked]:text-white"
                    />
                    <div className="text-sm text-gray-700 leading-snug">
                      <label htmlFor="terms-privacy" className="cursor-pointer font-normal">
                        I have read and agree to the
                      </label>{' '}
                      <Link
                        to="/legal/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#8B1538] hover:underline font-semibold"
                      >
                        NSDGA Terms of Use
                      </Link>{' '}
                      <span className="text-gray-600">and</span>{' '}
                      <Link
                        to="/legal/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#8B1538] hover:underline font-semibold"
                      >
                        Privacy Policy
                      </Link>
                      <span className="text-gray-600">.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="dpa"
                      checked={dpaAccepted}
                      onCheckedChange={(checked) => setDpaAccepted(checked === true)}
                      className="mt-0.5 size-5 shrink-0 border-2 border-gray-500 bg-white shadow-sm data-[state=checked]:bg-[#8B1538] data-[state=checked]:border-[#8B1538] data-[state=checked]:text-white"
                    />
                    <div className="text-sm text-gray-700 leading-snug">
                      <label htmlFor="dpa" className="cursor-pointer font-normal">
                        I consent to the processing of my personal data as described in the
                      </label>{' '}
                      <Link
                        to="/legal/dpa"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#8B1538] hover:underline font-semibold"
                      >
                        Data Processing Agreement (DPA)
                      </Link>
                      <span className="text-gray-600">.</span>
                    </div>
                  </div>
                  {(!termsPrivacyAccepted || !dpaAccepted) && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      Check both boxes above to continue with registration.
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 text-base font-semibold text-white bg-[#8B1538] hover:bg-[#6d102c] disabled:bg-[#8B1538]/40 disabled:opacity-100"
                >
                  {isLoading ? 'Processing...' : 'Continue'}
                </Button>

                <p className="text-center text-sm text-gray-600">
                  Have an account?{' '}
                  <Link to="/login" className="text-[#8B1538] font-semibold hover:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            </>
          ) : (
            <>
              {/* OTP Verification */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Verify your email
                </h1>
                <p className="text-gray-600">
                  Enter the 6-digit code from your email inbox.
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-6" autoComplete="off">
                <div>
                  <Label className="text-gray-700 mb-3 block">Enter OTP Code</Label>
                  <div className="flex gap-3 justify-between" onPaste={handleOtpPaste}>
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
                        className="w-14 h-14 text-center text-2xl font-semibold"
                      />
                    ))}
                  </div>
                </div>

                {otpDelivery === 'sent' ? (
                  <div className="bg-green-50 border border-[#2D5016]/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-[#2D5016] mt-0.5 shrink-0" />
                      <p className="text-sm text-gray-800">
                        Check your email for the 6-digit code. It expires in 10 minutes.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
                    We could not send the verification email. Try <strong>Resend OTP</strong> below.
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#2D5016] hover:bg-[#2D5016]/90 text-white h-12 text-base font-semibold"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Complete Registration'}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const response = await apiFetch('/api/auth', {
                          method: 'POST',
                          body: JSON.stringify({
                            action: 'resend_otp',
                            email: formData.email,
                          }),
                        });
                        const text = await response.text();
                        let data: { success?: boolean; error?: string; message?: string; otp_delivery?: string; mail_error?: string } = {};
                        try {
                          data = JSON.parse(text) as { success?: boolean; error?: string; message?: string; otp_delivery?: string; mail_error?: string };
                        } catch {
                          throw new Error('Server returned an invalid response');
                        }
                        if (response.ok && data.success) {
                          setOtpDelivery(data.otp_delivery === 'sent' ? 'sent' : 'failed');
                          if (data.otp_delivery === 'sent') {
                            toast.success(data.message || 'OTP resent to your email');
                          } else {
                            toast.warning(data.message || 'OTP could not be sent');
                            if (data.mail_error) {
                              toast.error(data.mail_error, { duration: 8000 });
                            }
                          }
                        } else {
                          toast.error(data.error || `Resend failed (${response.status})`);
                        }
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'Network error');
                      }
                    }}
                    className="text-[#8B1538] font-semibold hover:underline text-sm"
                  >
                    Resend OTP
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Right Side - Image/Hero */}
      <div className="hidden lg:block lg:w-1/2 relative bg-gray-100">
        {/* TODO: Replace with legitimate registration-themed image */}
        <img
          src={registrationImage}
          alt="Registration"
          className="w-full h-full object-contain object-center"
        />
      </div>
      </div>
    </div>
  );
}

