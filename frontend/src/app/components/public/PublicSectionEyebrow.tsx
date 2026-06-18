import type { ReactNode } from 'react';
import { BRAND } from '../../lib/publicBrand';

export function PublicSectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      className="mb-2 text-xs font-bold uppercase tracking-[0.18em] sm:text-sm"
      style={{ color: BRAND.green }}
    >
      {children}
    </p>
  );
}
