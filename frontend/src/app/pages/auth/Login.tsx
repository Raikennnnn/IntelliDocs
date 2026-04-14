import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Alert, AlertDescription } from '../../components/ui/alert';
import schoolLogo from "../../../assets/logo.png";
import homePageImage from "../../../assets/homepage.jpg";

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const { ok, user: loggedIn } = await login(email, password);
      if (!ok) {
        setError('Invalid email or password');
        return;
      }
      if (!loggedIn) {
        setError('Login succeeded but user data was missing. Try again.');
        return;
      }
      switch (loggedIn.role) {
        case 'registrar':
          navigate('/registrar/dashboard', { replace: true });
          break;
        case 'admin':
          navigate('/admin/dashboard', { replace: true });
          break;
        default:
          navigate('/student/dashboard', { replace: true });
      }
    } catch (err) {
      setError('Login failed. Check backend connection.');
      console.error(err);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-white">
      {/* Background Image */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* TODO: Replace with legitimate login background photo (e.g., school gate/entrance) */}
            <img 
              alt="" 
              className="absolute h-full left-0 top-0 w-full object-cover scale-110" 
              src={homePageImage} 
            />
      </div>

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-[rgba(72,0,21,0.32)]" />

      {/* Top Navigation Bar */}
      <div className="absolute top-0 left-0 w-full bg-[#8B1538] h-[63px] shadow-md z-10 flex items-center px-8">
        <Link to="/landing" className="flex items-center gap-3">
          <div className="w-10 h-10">
            {/* TODO: Replace with official NSGDA logo image */}
            <img 
              alt="School Logo" 
              className="w-full h-full object-contain" 
              src={schoolLogo} 
            />
          </div>
          <div>
            <p className="font-bold text-lg text-white leading-tight">
              Nuestra Señora De Guia
            </p>
            <p className="font-semibold text-xs text-white">
              Academy of Marikina
            </p>
          </div>
        </Link>
      </div>

      {/* Login Card */}
      <div className="relative z-10 flex items-center justify-center h-full px-4">
        <div className="bg-white/80 backdrop-blur-sm border border-gray-300 rounded-lg shadow-lg w-full max-w-[527px] p-8">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h2 className="font-bold text-2xl text-[#101828] mb-2">
                Login
              </h2>
              <p className="font-normal text-base text-black">
                Enter your credentials to access the system
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Email */}
              <div className="space-y-2">
                <label className="block font-medium text-sm text-black">
                  Email
                </label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-12 bg-[#F9FAFB] border-[#D1D5DC] border rounded-lg px-3 text-sm placeholder:text-[#6B7280] focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
                  placeholder="Enter your email"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="block font-medium text-sm text-black">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-12 bg-[#F9FAFB] border-[#D1D5DC] border rounded-lg px-3 text-sm placeholder:text-[#6B7280] focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
                  placeholder="Enter password"
                />
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                className="w-full h-12 bg-[#8B1538] hover:bg-[#8B1538]/90 text-white text-base font-semibold rounded-lg"
              >
                Login
              </Button>

              {/* Forgot Password Link */}
              <div className="text-right">
                <button
                  type="button"
                  className="text-xs text-black hover:underline"
                  onClick={() => alert('Please contact the IT department for password reset.')}
                >
                  Forgot Password?
                </button>
              </div>
            </form>

            {/* Register Link */}
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link to="/registration" className="text-[#8B1538] font-semibold hover:underline">
                  Register Now
                </Link>
              </p>
            </div>

            {/* Back to Home Link */}
            <div className="text-center">
              <Link 
                to="/landing" 
                className="text-sm text-[#2D5016] hover:underline font-medium"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}