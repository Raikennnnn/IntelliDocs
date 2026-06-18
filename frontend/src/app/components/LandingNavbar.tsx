import { Link } from 'react-router';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import schoolLogo from '../../assets/logo.png';

const NAV_LINKS = [
  { name: 'Home', href: '/landing' },
  { name: 'About', href: '/about' },
  { name: 'Admissions', href: '/admissions' },
  { name: 'Contact Us', href: '/contact' },
] as const;

/** Public marketing nav — matches original V1 / Figma layout. */
export function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 h-[64px] border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="section-container flex h-full max-w-7xl items-center justify-between">
        <Link to="/landing" className="flex items-center gap-3">
          <div className="size-[40px]">
            <img
              src={schoolLogo}
              alt="Nuestra Señora De Guia Academy"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="text-[18px] font-bold leading-tight text-[#8b1538]">
              Nuestra Señora De Guia
            </p>
            <p className="text-[12px] font-semibold text-[#2d5016]">Academy of Marikina</p>
          </div>
        </Link>

        <div className="hidden items-center gap-6 lg:gap-8 md:flex">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="text-[15px] font-medium text-[#364153] transition-colors hover:text-[#8b1538]"
            >
              {item.name}
            </Link>
          ))}
          <Link to="/login">
            <div className="flex h-[36px] items-center justify-center rounded-[8px] border border-[#2d5016] px-5 text-[14px] font-medium text-[#2d5016] transition-colors hover:bg-[#2d5016]/5">
              Login
            </div>
          </Link>
          <Link to="/registration">
            <div className="flex h-[36px] items-center justify-center rounded-[8px] bg-[#8b1538] px-5 transition-colors hover:bg-[#7a1231]">
              <p className="text-[14px] font-medium text-white">Apply Now</p>
            </div>
          </Link>
        </div>

        <button
          type="button"
          className="p-2 md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6 text-[#364153]" />
          ) : (
            <Menu className="h-6 w-6 text-[#364153]" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-gray-200 bg-white px-8 py-4 md:hidden">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-4">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="text-[16px] font-medium text-[#364153] hover:text-[#8b1538]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
              <div className="flex h-[40px] w-full items-center justify-center rounded-[8px] border border-[#2d5016] px-6 text-[#2d5016] hover:bg-[#2d5016]/5">
                <p className="text-[14px] font-medium">Login</p>
              </div>
            </Link>
            <Link to="/registration" onClick={() => setMobileMenuOpen(false)}>
              <div className="flex h-[40px] w-full items-center justify-center rounded-[8px] bg-[#8b1538] px-6 hover:bg-[#7a1231]">
                <p className="text-[14px] font-medium text-white">Apply Now</p>
              </div>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
