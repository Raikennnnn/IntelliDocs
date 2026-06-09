import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Label } from '../../components/ui/label';
import schoolLogo from "../../../assets/logo.png";
import homePageImage from "../../../assets/homepage-Bxdbuq6s.png";

function navigateForRole(role: string, navigate: ReturnType<typeof useNavigate>) {
  switch (role) {
    case 'registrar':
      navigate('/registrar/dashboard', { replace: true });
      break;
    case 'admin':
      navigate('/admin/dashboard', { replace: true });
      break;
    default:
      navigate('/student/dashboard', { replace: true });
  }
}

export function Login() {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submittingCredentials, setSubmittingCredentials] = useState(false);
  const [submittingOtp, setSubmittingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const { login, verifyLoginOtp, resendLoginOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sessionReason = searchParams.get('reason');
  const sessionReasonMessage =
    sessionReason === 'session_expired'
      ? 'Your session expired due to inactivity. Please sign in again.'
      : sessionReason === 'session_revoked' || sessionReason === 'invalid_token'
        ? 'Your session is no longer valid. Please sign in again.'
        : sessionReason === 'missing_token'
          ? 'Please sign in to continue.'
          : '';

  const handleOtpChange = (index: number, value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length > 1) {
      const next = [...otp];
      for (let i = 0; i < digitsOnly.length && index + i < 6; i++) {
        next[index + i] = digitsOnly[i];
      }
      setOtp(next);
      const focusIndex = Math.min(index + digitsOnly.length, 5);
      document.getElementById(`login-otp-${focusIndex}`)?.focus();
      return;
    }
    if (/^\d?$/.test(value)) {
      const next = [...otp];
      next[index] = value;
      setOtp(next);
      if (value && index < 5) {
        document.getElementById(`login-otp-${index + 1}`)?.focus();
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
    document.getElementById(`login-otp-${focusIndex}`)?.focus();
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingCredentials) return;
    setError('');
    setInfo('');
    setSubmittingCredentials(true);

    try {
      const result = await login(credential, password);
      if ('requiresOtp' in result && result.requiresOtp) {
        setOtpEmail(result.email);
        setOtp(['', '', '', '', '', '']);
        setStep('otp');
        setInfo(
          result.emailMasked
            ? `Enter the 6-digit code sent to ${result.emailMasked}.`
            : 'Enter the 6-digit verification code sent to your email.',
        );
        if (result.devOtp) {
          setInfo((prev) => `${prev} Dev OTP: ${result.devOtp}`);
        }
        return;
      }
      if (!result.ok) {
        if (result.errorCode === 'throttled' || result.errorCode === 'account_locked') {
          setError('Too many failed attempts. Please try again in a few minutes.');
        } else if (result.errorCode === 'email_not_verified') {
          setError(
            'Please complete email verification first. Return to registration and enter the OTP code sent to your email.',
          );
        } else {
          setError('Invalid email or password');
        }
        return;
      }
      if (result.user) {
        navigateForRole(result.user.role, navigate);
      }
    } catch {
      setError('Login failed. Check backend connection.');
    } finally {
      setSubmittingCredentials(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingOtp) return;
    setError('');
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit OTP.');
      return;
    }
    setSubmittingOtp(true);
    try {
      const result = await verifyLoginOtp(otpEmail, code);
      if (!result.ok) {
        if (result.errorCode === 'server_error') {
          setError('Verification failed due to a server error. Please try again or contact support.');
        } else {
          setError('Invalid or expired OTP. Request a new code below or sign in from the start.');
        }
        return;
      }
      navigateForRole(result.user.role, navigate);
    } finally {
      setSubmittingOtp(false);
    }
  };

  const handleResendLoginOtp = async () => {
    if (resendingOtp || !otpEmail) return;
    setResendingOtp(true);
    setError('');
    try {
      const result = await resendLoginOtp(otpEmail);
      if (!result.ok) {
        setError('Could not resend the login code. Try signing in from the start.');
        return;
      }
      setOtp(['', '', '', '', '', '']);
      setInfo(
        result.message ||
          (info.includes('sent to')
            ? info.split('.')[0] + '.'
            : 'A new 6-digit code was sent to your email.'),
      );
      if (result.devOtp) {
        setInfo((prev) => `${prev} Dev OTP: ${result.devOtp}`);
      }
    } finally {
      setResendingOtp(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img alt="" className="absolute h-full left-0 top-0 w-full object-cover scale-110" src={homePageImage} />
      </div>
      <div className="absolute inset-0 bg-[rgba(72,0,21,0.32)]" />

      <div className="absolute top-0 left-0 w-full bg-[#8B1538] h-[63px] shadow-md z-10 flex items-center px-8">
        <Link to="/landing" className="flex items-center gap-3">
          <div className="w-10 h-10">
            <img alt="School Logo" className="w-full h-full object-contain" src={schoolLogo} />
          </div>
          <div>
            <p className="font-bold text-lg text-white leading-tight">Nuestra Señora De Guia</p>
            <p className="font-semibold text-xs text-white">Academy of Marikina</p>
          </div>
        </Link>
      </div>

      <div className="relative z-10 flex items-center justify-center h-full px-4">
        <div className="bg-white/80 backdrop-blur-sm border border-gray-300 rounded-lg shadow-lg w-full max-w-[527px] p-8">
          <div className="space-y-6">
            <div>
              <h2 className="font-bold text-2xl text-[#101828] mb-2">
                {step === 'credentials' ? 'Login' : 'Email verification'}
              </h2>
              <p className="font-normal text-base text-black">
                {step === 'credentials'
                  ? 'Enter your credentials to access the system'
                  : 'Complete login with the OTP sent to your email (MFA)'}
              </p>
            </div>

            {sessionReasonMessage && step === 'credentials' && (
              <Alert>
                <AlertDescription>{sessionReasonMessage}</AlertDescription>
              </Alert>
            )}

            {step === 'credentials' ? (
              <form onSubmit={handleCredentialsSubmit} className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <label className="block font-medium text-sm text-black">Email or School Username</label>
                  <Input
                    type="text"
                    autoComplete="username"
                    value={credential}
                    onChange={(e) => setCredential(e.target.value)}
                    required
                    className="w-full h-12 bg-[#F9FAFB] border-[#D1D5DC] border rounded-lg px-3 text-sm"
                    placeholder="Enter your email or school username"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block font-medium text-sm text-black">Password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full h-12 bg-[#F9FAFB] border-[#D1D5DC] border rounded-lg px-3 text-sm"
                    placeholder="Enter password"
                  />
                </div>
                <Button type="submit" disabled={submittingCredentials} className="w-full h-12 bg-[#8B1538] hover:bg-[#8B1538]/90 text-white text-base font-semibold rounded-lg">
                  {submittingCredentials ? 'Signing in…' : 'Continue'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="space-y-6">
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
                <div>
                  <Label className="text-gray-700 mb-3 block">Enter OTP Code</Label>
                  <div className="flex gap-3 justify-between" onPaste={handleOtpPaste}>
                    {otp.map((digit, index) => (
                      <Input
                        key={index}
                        id={`login-otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onPaste={handleOtpPaste}
                        className="w-12 h-12 text-center text-lg font-semibold"
                      />
                    ))}
                  </div>
                </div>
                <Button type="submit" disabled={submittingOtp} className="w-full h-12 bg-[#8B1538] hover:bg-[#8B1538]/90 text-white text-base font-semibold rounded-lg">
                  {submittingOtp ? 'Verifying…' : 'Verify & Sign in'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={resendingOtp || submittingOtp}
                  onClick={() => void handleResendLoginOtp()}
                >
                  {resendingOtp ? 'Sending new code…' : 'Resend login code'}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep('credentials'); setOtp(['', '', '', '', '', '']); setError(''); }}>
                  Back to login
                </Button>
              </form>
            )}

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Don&apos;t have an account?{' '}
                <Link to="/registration" className="text-[#8B1538] font-semibold hover:underline">
                  Register Now
                </Link>
              </p>
            </div>
            <div className="text-center">
              <Link to="/landing" className="text-sm text-[#2D5016] hover:underline font-medium">
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
