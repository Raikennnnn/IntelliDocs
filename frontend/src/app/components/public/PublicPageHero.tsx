import type { ReactNode } from 'react';
import { BRAND } from '../../lib/publicBrand';
import { PublicSectionEyebrow } from './PublicSectionEyebrow';

type PublicPageHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  imageSrc?: string;
  imageAlt?: string;
};

export function PublicPageHero({
  eyebrow,
  title,
  description,
  children,
  imageSrc,
  imageAlt = '',
}: PublicPageHeroProps) {
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: BRAND.maroon }}>
      {imageSrc ? (
        <>
          <img src={imageSrc} alt={imageAlt} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/55" />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(105deg, ${BRAND.maroon}cc 0%, transparent 50%, ${BRAND.green}88 100%)`,
            }}
          />
        </>
      ) : null}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-2 sm:w-3"
        style={{ backgroundColor: BRAND.green }}
        aria-hidden
      />
      <div className="section-container relative py-14 sm:py-20">
        {eyebrow ? <PublicSectionEyebrow light>{eyebrow}</PublicSectionEyebrow> : null}
        <h1 className="max-w-3xl text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}
