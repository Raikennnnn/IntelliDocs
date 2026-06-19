import type { ReactNode } from 'react';
import { Link } from 'react-router';
import schoolLogo from '../../../assets/logo.png';
import homePageHero from '../../../assets/homepage-Bxdbuq6s.png';
import { BRAND } from '../../lib/publicBrand';
import { PublicSectionEyebrow } from './PublicSectionEyebrow';

export function AuthPageHeader() {
  return (
    <header className="relative z-20 flex h-14 w-full items-center border-b border-white/10 bg-[#8b1538]/95 px-4 shadow-md backdrop-blur-sm sm:h-16 sm:px-6 lg:px-8">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1.5 sm:w-2"
        style={{ backgroundColor: BRAND.green }}
        aria-hidden
      />
      <Link to="/landing" className="flex min-w-0 items-center gap-2 sm:gap-3 pl-2 sm:pl-3">
        <div className="size-9 shrink-0 sm:size-10">
          <img alt="NSDGA" className="h-full w-full object-contain" src={schoolLogo} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-white sm:text-base">
            Nuestra Señora De Guia
          </p>
          <p className="truncate text-[11px] font-semibold text-white/90 sm:text-xs">
            Academy of Marikina
          </p>
        </div>
      </Link>
    </header>
  );
}

type AuthPageShellProps = {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
};

export function AuthPageShell({ children, eyebrow, title, subtitle }: AuthPageShellProps) {
  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-white">
      <div className="pointer-events-none absolute inset-0">
        <img alt="" className="absolute h-full w-full object-cover" src={homePageHero} />
        <div className="absolute inset-0 bg-black/45" />
        <div
          className="absolute inset-0 opacity-85"
          style={{
            background: `linear-gradient(105deg, ${BRAND.maroon}99 0%, transparent 45%, ${BRAND.green}55 100%)`,
          }}
        />
      </div>

      <AuthPageHeader />

      <div className="relative z-10 flex flex-1 items-center justify-center overflow-y-auto px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-[32rem]">
          {(eyebrow || title || subtitle) && (
            <div className="mb-5 text-center sm:mb-6">
              {eyebrow ? (
                <div className="flex justify-center">
                  <PublicSectionEyebrow light>{eyebrow}</PublicSectionEyebrow>
                </div>
              ) : null}
              {title ? (
                <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
              ) : null}
              {subtitle ? (
                <p
                  className="mx-auto mt-2 max-w-md text-sm font-semibold sm:text-base"
                  style={{ color: BRAND.heroAccent }}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
          )}
          <div
            className="overflow-hidden rounded-[14px] border border-white/30 bg-white/95 shadow-2xl backdrop-blur-md"
            style={{ borderTopWidth: 4, borderTopColor: BRAND.maroon }}
          >
            <div className="p-5 sm:p-8">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function authPortalCopy(pathname: string): {
  eyebrow: string;
  title: string;
  subtitle: string;
} {
  if (pathname.startsWith('/registrar-login')) {
    return {
      eyebrow: 'Registrar',
      title: 'Staff Sign In',
      subtitle: 'Access the registrar portal to review applications and manage enrollment.',
    };
  }
  if (pathname.startsWith('/admin-login')) {
    return {
      eyebrow: 'Administration',
      title: 'Admin Sign In',
      subtitle: 'Sign in with your administrator credentials.',
    };
  }
  if (pathname.startsWith('/student-login')) {
    return {
      eyebrow: 'Student Portal',
      title: 'Student Sign In',
      subtitle: 'Use your school username or email to access your dashboard.',
    };
  }
  return {
    eyebrow: 'NSDGA Portal',
    title: 'Sign In',
    subtitle: 'Students, registrars, and staff — enter your credentials to continue.',
  };
}
