import { Link, useLocation } from 'react-router';
import { Button } from './ui/button';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import schoolLogo from '../../assets/logo.png';

const NAV_LINKS = [
  { name: 'Home', href: '/landing' },
  { name: 'About', href: '/about' },
  { name: 'Admissions', href: '/admissions' },
  { name: 'Contact Us', href: '/contact' },
] as const;

export function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <nav className="sticky top-0 z-50 bg-white/95 shadow-md backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link to="/landing" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <img
              src={schoolLogo}
              alt="Nuestra Señora De Guia Academy"
              className="h-10 w-10 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-[#8B1538] sm:text-lg">
                Nuestra Señora De Guia
              </p>
              <p className="truncate text-[10px] font-semibold text-[#2D5016] sm:text-xs">
                Academy of Marikina
              </p>
            </div>
          </Link>

          {/* Desktop / large tablet */}
          <div className="hidden items-center gap-6 lg:flex lg:gap-8">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="font-medium text-gray-700 transition-colors hover:text-[#8B1538]"
              >
                {item.name}
              </Link>
            ))}
            <Link to="/login">
              <Button className="bg-[#2D5016] text-white hover:bg-[#2D5016]/90">Login</Button>
            </Link>
          </div>

          {/* Mobile + tablet menu toggle */}
          <button
            type="button"
            className="shrink-0 rounded-lg p-2 lg:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-gray-700" />
            ) : (
              <Menu className="h-6 w-6 text-gray-700" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile / tablet drawer */}
      {mobileMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 right-0 top-16 z-50 border-t border-gray-200 bg-white shadow-lg lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="rounded-lg px-3 py-3 font-medium text-gray-700 transition-colors hover:bg-red-50 hover:text-[#8B1538]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <Link to="/login" className="pt-2" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-[#2D5016] text-white hover:bg-[#2D5016]/90">
                  Login
                </Button>
              </Link>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
