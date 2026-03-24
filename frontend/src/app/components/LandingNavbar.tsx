import { Link } from 'react-router';
import { Button } from './ui/button';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import schoolLogo from 'figma:asset/e11655a0bb448323cab4def085b422d71c615f64.png';

export function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Home', href: '/landing' },
    { name: 'About', href: '/about' },
    { name: 'Admissions', href: '/admissions' },
    { name: 'Contact Us', href: '/contact' },
  ];

  return (
    <nav className="bg-white/95 backdrop-blur-sm shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and School Name */}
          <Link to="/landing" className="flex items-center gap-3">
            <img 
              src={schoolLogo} 
              alt="Nuestra Señora De Guia Academy" 
              className="w-10 h-10 object-contain"
            />
            <div className="hidden sm:block">
              <p className="font-bold text-[#8B1538] text-lg leading-tight">
                Nuestra Señora De Guia
              </p>
              <p className="text-xs text-[#2D5016] font-semibold">Academy of Marikina</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="text-gray-700 hover:text-[#8B1538] font-medium transition-colors"
              >
                {item.name}
              </Link>
            ))}
            <Link to="/login">
              <Button className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white">
                Login
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-gray-700" />
            ) : (
              <Menu className="w-6 h-6 text-gray-700" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col gap-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="text-gray-700 hover:text-[#8B1538] font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white w-full">
                  Student Portal Login
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}