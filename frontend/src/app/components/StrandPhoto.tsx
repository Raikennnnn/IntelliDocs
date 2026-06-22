import { useMemo, useState } from 'react';
import type { StrandSlug } from '../pages/public/strandInfoData';
import { strandImageSources } from '../pages/public/strandImages';

export type StrandPhotoVariant = 'hero' | 'card';

interface StrandPhotoProps {
  slug: StrandSlug;
  alt: string;
  variant?: StrandPhotoVariant;
  /** Hero variant: used for image frame shadow tint */
  accent?: string;
  className?: string;
}

const variantStyles: Record<
  StrandPhotoVariant,
  { frame: string; img: (isPlaceholder: boolean) => string }
> = {
  hero: {
    frame:
      'relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-lg',
    img: (isPlaceholder) =>
      `mx-auto block w-full object-contain object-center ${
        isPlaceholder ? 'max-h-[320px] p-4' : 'max-h-[min(520px,70vh)]'
      }`,
  },
  card: {
    frame:
      'relative flex h-full w-full shrink-0 items-center justify-center overflow-hidden',
    img: () =>
      'mx-auto block max-h-full max-w-full object-contain object-center p-2 transition-transform duration-500 group-hover:scale-[1.02] sm:p-3',
  },
};

export function StrandPhoto({ slug, alt, variant = 'hero', accent, className }: StrandPhotoProps) {
  const sources = useMemo(() => strandImageSources(slug), [slug]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const src = sources[Math.min(sourceIndex, sources.length - 1)];
  const isPlaceholder = sourceIndex >= sources.length - 1;
  const styles = variantStyles[variant];

  return (
    <div
      className={className ? `${styles.frame} ${className}` : styles.frame}
      style={variant === 'hero' && accent ? { boxShadow: `0 20px 40px -12px ${accent}22` } : undefined}
    >
      <img
        src={src}
        alt={alt}
        className={styles.img(isPlaceholder)}
        loading={variant === 'card' ? 'lazy' : undefined}
        onError={() => {
          setSourceIndex((current) => (current < sources.length - 1 ? current + 1 : current));
        }}
      />
    </div>
  );
}

/** @deprecated Use StrandPhoto with variant="hero" */
export function StrandHeroImage({
  slug,
  title,
  accent,
}: {
  slug: StrandSlug;
  title: string;
  accent: string;
}) {
  return <StrandPhoto slug={slug} alt={`${title} strand`} variant="hero" accent={accent} />;
}
