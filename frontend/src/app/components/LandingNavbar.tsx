import { Link } from 'react-router';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import schoolLogo from '../../assets/logo.png';
import { BRAND } from '../lib/publicBrand';

const NAV_LINKS = [
  { name: 'Home', href: '/landing' },
  { name: 'About', href: '/about' },
  { name: 'Admissions', href: '/admissions' },
  { name: 'Contact Us', href: '/contact' },
] as const;

export function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 border-b-2 bg-white/95 shadow-sm backdrop-blur-md"
      style={{ borderBottomColor: BRAND.maroon }}
    >
      <div className="section-container flex h-16 max-w-7xl items-center justify-between">
        <Link to="/landing" className="flex min-w-0 items-center gap-3">
          <div className="size-10 shrink-0">
            <img src={schoolLogo} alt="NSDGA" className="h-full w-full object-contain" />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-base font-bold leading-tight" style={{ color: BRAND.maroon }}>
              Nuestra Señora De Guia
            </p>
            <p className="truncate text-xs font-semibold" style={{ color: BRAND.green }}>
              Academy of Marikina
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="text-sm font-medium transition-colors hover:opacity-75"
              style={{ color: BRAND.ink }}
            >
              {item.name}
            </Link>
          ))}
          <Link
            to="/login"
            className="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-gray-50"
            style={{ borderColor: BRAND.green, color: BRAND.green }}
          >
            Login
          </Link>
          <Link
            to="/registration"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95"
            style={{ backgroundColor: BRAND.maroon }}
          >
            Apply Now
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
            <X className="size-6" style={{ color: BRAND.ink }} />
          ) : (
            <Menu className="size-6" style={{ color: BRAND.ink }} />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-gray-100 bg-white px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="text-base font-medium"
                style={{ color: BRAND.ink }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
              <span
                className="flex h-11 w-full items-center justify-center rounded-lg border text-sm font-semibold"
                style={{ borderColor: BRAND.green, color: BRAND.green }}
              >
                Login
              </span>
            </Link>
            <Link to="/registration" onClick={() => setMobileMenuOpen(false)}>
              <span
                className="flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: BRAND.maroon }}
              >
                Apply Now
              </span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
