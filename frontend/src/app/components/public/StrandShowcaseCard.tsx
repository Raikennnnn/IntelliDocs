import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { StrandPhoto } from '../StrandPhoto';
import { BRAND } from '../../lib/publicBrand';
import type { StrandSlug } from '../../pages/public/strandInfoData';

export type StrandShowcaseItem = {
  slug: StrandSlug;
  track: 'Academic' | 'TVL';
  title: string;
  description: string;
  Icon: LucideIcon;
};

export function StrandShowcaseCard({ strand }: { strand: StrandShowcaseItem }) {
  const { Icon } = strand;
  const isAcademic = strand.track === 'Academic';
  const trackColor = isAcademic ? BRAND.maroon : BRAND.green;

  return (
    <Link
      to={`/admissions/strands/${strand.slug}`}
      className="group flex flex-col overflow-hidden rounded-[14px] border border-gray-200 bg-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1538] focus-visible:ring-offset-2"
    >
      <div className="relative h-[200px] shrink-0 overflow-hidden sm:h-[220px]">
        <StrandPhoto
          slug={strand.slug}
          alt={`${strand.title} strand`}
          variant="card"
          className={`h-full w-full ${isAcademic ? 'bg-[#faf5f6]' : 'bg-[#f4f8f2]'}`}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
          style={{
            background: isAcademic
              ? 'linear-gradient(to top, rgba(139,21,56,0.85) 0%, transparent 100%)'
              : 'linear-gradient(to top, rgba(45,80,22,0.85) 0%, transparent 100%)',
          }}
        />
        <div
          className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-[10px] shadow sm:left-4 sm:top-4 sm:size-10"
          style={{ backgroundColor: trackColor }}
        >
          <Icon className="size-4 text-white sm:size-5" aria-hidden />
        </div>
        <span
          className="absolute bottom-3 left-3 rounded-[8px] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white sm:bottom-4 sm:left-4"
          style={{ backgroundColor: trackColor }}
        >
          {strand.track} Track
        </span>
      </div>
      <div className="relative z-10 flex min-h-[9.5rem] flex-col bg-white p-5 pt-4">
        <div className="mb-3 h-1 w-12 shrink-0 rounded-full" style={{ backgroundColor: trackColor }} aria-hidden />
        <h3 className="text-lg font-bold" style={{ color: trackColor }}>
          {strand.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: BRAND.slate }}>
          {strand.description}
        </p>
        <span
          className="mt-4 block shrink-0 text-sm font-semibold group-hover:underline"
          style={{ color: trackColor }}
        >
          View strand details →
        </span>
      </div>
    </Link>
  );
}
