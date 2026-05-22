import { useMemo, useState } from 'react';
import type { StrandSlug } from '../pages/public/strandInfoData';
import { strandImageSources } from '../pages/public/strandImages';

interface StrandHeroImageProps {
  slug: StrandSlug;
  title: string;
  accent: string;
}

export function StrandHeroImage({ slug, title, accent }: StrandHeroImageProps) {
  const sources = useMemo(() => strandImageSources(slug), [slug]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const src = sources[Math.min(sourceIndex, sources.length - 1)];
  const isPlaceholder = sourceIndex >= sources.length - 1;

  return (
    <div
      className="relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-lg"
      style={{ boxShadow: `0 20px 40px -12px ${accent}22` }}
    >
      <img
        src={src}
        alt={`${title} strand`}
        className={`mx-auto block w-full object-contain object-center ${
          isPlaceholder ? 'max-h-[320px] p-4' : 'max-h-[min(520px,70vh)]'
        }`}
        onError={() => {
          setSourceIndex((current) => (current < sources.length - 1 ? current + 1 : current));
        }}
      />
    </div>
  );
}
