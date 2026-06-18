import { useState } from 'react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { BRAND } from '../../lib/publicBrand';
import { strandImageSources } from '../../pages/public/strandImages';
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
  const sources = strandImageSources(strand.slug);
  const [sourceIndex, setSourceIndex] = useState(0);
  const src = sources[Math.min(sourceIndex, sources.length - 1)];

  return (
    <Link
      to={`/admissions/strands/${strand.slug}`}
      className="group flex flex-col overflow-hidden rounded-[14px] border border-gray-200 bg-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1538] focus-visible:ring-offset-2"
    >
      <div
        className="relative aspect-[4/3] w-full overflow-hidden"
        style={{ backgroundColor: isAcademic ? '#faf5f6' : '#f4f8f2' }}
      >
        <img
          src={src}
          alt={`${strand.title} strand`}
          className="h-full w-full object-contain object-center p-3 transition-transform duration-500 group-hover:scale-[1.02] sm:p-4"
          loading="lazy"
          onError={() => {
            setSourceIndex((current) => (current < sources.length - 1 ? current + 1 : current));
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%]"
          style={{
            background: isAcademic
              ? 'linear-gradient(to top, rgba(139,21,56,0.92) 0%, rgba(139,21,56,0.35) 70%, transparent 100%)'
              : 'linear-gradient(to top, rgba(45,80,22,0.92) 0%, rgba(45,80,22,0.35) 70%, transparent 100%)',
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
      <div className="flex flex-1 flex-col border-t-4 p-5" style={{ borderTopColor: trackColor }}>
        <h3 className="text-lg font-bold" style={{ color: isAcademic ? BRAND.maroon : BRAND.green }}>
          {strand.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: BRAND.slate }}>
          {strand.description}
        </p>
        <p
          className="mt-4 text-sm font-semibold group-hover:underline"
          style={{ color: BRAND.maroon }}
        >
          View strand details →
        </p>
      </div>
    </Link>
  );
}
