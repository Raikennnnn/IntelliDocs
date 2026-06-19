import type { ReactNode } from 'react';
import { BRAND } from '../../lib/publicBrand';

type PublicSectionEyebrowProps = {
  children: ReactNode;
  /** Only for top-of-page heroes on dark maroon backgrounds */
  light?: boolean;
};

export function PublicSectionEyebrow({ children, light = false }: PublicSectionEyebrowProps) {
  return (
    <p
      className="mb-2 text-xs font-bold uppercase tracking-[0.18em] sm:text-sm"
      style={{ color: light ? BRAND.heroAccent : BRAND.green }}
    >
      {children}
    </p>
  );
}
