import registrationImage from 'figma:asset/da4150ecce5f1b8daf4daba3e7d3afeee240ac53.png'
import { apiFetch } from '../../lib/api';
import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import schoolLogo from "figma:asset/e11655a0bb448323cab4def085b422d71c615f64.png";

// Registration Page Component
export function RegistrationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'register' | 'otp'>('register');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.fullName || !formData.email || !formData.password || !formData.confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters long');
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
          full_name: formData.fullName
        }),
      });
      const data = await response.json();
      
      if (data.success) {
        setIsLoading(false);
        toast.success('Account created! OTP sent.');
        setStep('otp');
      } else {
        toast.error(data.error || 'Registration failed');
        setIsLoading(false);
      }
    } catch (error) {
      toast.error('Network error');
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

    // Mock OTP - use 123456
    if (enteredOtp === '123456') {
      toast.success('Welcome! Please login.');
      navigate('/login');
    } else {
      toast.error('Enter 6-digit OTP (demo: 123456)');
    }
    setIsLoading(false);
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
              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <Label htmlFor="fullName" className="text-gray-700 mb-2 block">
                    Enter your full name <span className="text-[#8B1538]">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="fullName"
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      placeholder="John Doe"
                      className="pl-10 h-12"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="text-gray-700 mb-2 block">
                    Enter your email <span className="text-[#8B1538]">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
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
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder="Minimum 8 characters"
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
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      placeholder="Re-enter your password"
                      className="pl-10 pr-10 h-12"
                      required
                    />
                  </div>
                </div>

                {/* Terms and Privacy */}
                <div className="text-sm text-gray-600">
                  By signing up, I have read and agreed to{' '}
                  <a href="#" className="text-[#8B1538] hover:underline font-medium">NSDGA Terms of Use</a>{' '}
                  and{' '}
                  <a href="#" className="text-[#8B1538] hover:underline font-medium">
                    Privacy Policy
                  </a>
                  .
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#8B1538] hover:bg-[#8B1538]/90 text-white h-12 text-base font-semibold"
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
                  We've sent a 6-digit code to <span className="font-semibold">{formData.email}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div>
                  <Label className="text-gray-700 mb-3 block">Enter OTP Code</Label>
                  <div className="flex gap-3 justify-between">
                    {otp.map((digit, index) => (
                      <Input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        className="w-14 h-14 text-center text-2xl font-semibold"
                      />
                    ))}
                  </div>
                </div>

                <div className="bg-green-50 border border-[#2D5016]/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#2D5016] mt-0.5" />
                    <div className="text-sm text-gray-800">
                      <p className="font-medium mb-1">Demo: Enter 123456</p>
                      <p>Production: Real email OTP</p>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#2D5016] hover:bg-[#2D5016]/90 text-white h-12 text-base font-semibold"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Complete Registration'}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">Demo OTP: 123456</p>
                  <button
                    type="button"
                    onClick={() => toast.success('OTP resent to your email')}
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

