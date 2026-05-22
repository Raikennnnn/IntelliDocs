import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { Button } from './ui/button';
import { publicAssetUrl } from '../lib/api';

const AUTO_ADVANCE_MS = 6000;

export type CarouselAnnouncement = {
  id?: string;
  title: string;
  body: string;
  badge: string;
  date: string;
  imageUrl?: string | null;
};

type AnnouncementCarouselProps = {
  items: CarouselAnnouncement[];
  className?: string;
  imageHeightClass?: string;
  /** Milliseconds between automatic slide changes (0 = off). */
  autoAdvanceMs?: number;
};

const navBtnClass =
  'absolute top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full border-2 border-white/70 bg-transparent text-white shadow-md backdrop-blur-[2px] transition-colors hover:border-[#8b1538] hover:bg-[#8b1538] hover:text-white focus-visible:ring-2 focus-visible:ring-[#8b1538] focus-visible:ring-offset-2';

function formatDisplayDate(date: string): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function AnnouncementCarousel({
  items,
  className = '',
  imageHeightClass = 'h-64 md:h-80',
  autoAdvanceMs = AUTO_ADVANCE_MS,
}: AnnouncementCarouselProps) {
  const slides = useMemo(() => items.filter((a) => a.title || a.body), [items]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slideCount = slides.length;
  const slideCountRef = useRef(slideCount);
  slideCountRef.current = slideCount;

  useEffect(() => {
    setIndex(0);
  }, [slideCount]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % slideCountRef.current);
  }, []);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + slideCountRef.current) % slideCountRef.current);
  }, []);

  useEffect(() => {
    if (slideCount <= 1 || autoAdvanceMs <= 0 || paused) return undefined;
    const timer = window.setInterval(goNext, autoAdvanceMs);
    return () => window.clearInterval(timer);
  }, [slideCount, autoAdvanceMs, paused, goNext]);

  if (slides.length === 0) {
    return null;
  }

  const current = slides[index] ?? slides[0];
  const imageSrc = publicAssetUrl(current.imageUrl);
  const hasMultiple = slides.length > 1;

  return (
    <div
      className={`relative overflow-hidden rounded-[14px] border border-[rgba(0,0,0,0.1)] bg-white shadow-sm ${className}`}
    >
      <div
        className={`relative w-full overflow-hidden bg-gray-100 ${imageHeightClass}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={current.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-400">
            <ImageIcon className="h-12 w-12 opacity-60" />
            <span className="text-sm font-medium">No image for this announcement</span>
          </div>
        )}
        {hasMultiple && (
          <>
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-20 bg-gradient-to-b from-black/35 to-transparent"
              aria-hidden
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`${navBtnClass} left-3`}
              onClick={goPrev}
              aria-label="Previous announcement"
            >
              <ChevronLeft className="h-6 w-6 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]" strokeWidth={2.5} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`${navBtnClass} right-3`}
              onClick={goNext}
              aria-label="Next announcement"
            >
              <ChevronRight className="h-6 w-6 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]" strokeWidth={2.5} />
            </Button>
          </>
        )}
      </div>

      <div className="p-6 md:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-md bg-[#2d5016]/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[#2d5016]">
            {current.badge}
          </span>
          <span className="text-sm text-gray-500 tabular-nums">{formatDisplayDate(current.date)}</span>
        </div>
        <h3 className="mb-3 text-xl font-bold leading-snug text-[#101828] md:text-2xl">{current.title}</h3>
        <p className="text-base leading-relaxed text-[#4a5565]">{current.body}</p>

        {hasMultiple && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              {index + 1} of {slides.length}
            </p>
            <div className="flex items-center gap-2">
              {slides.map((slide, i) => (
                <button
                  key={slide.id || `${slide.title}-${i}`}
                  type="button"
                  aria-label={`Go to announcement ${i + 1}`}
                  className={`h-2.5 rounded-full transition-all ${
                    i === index ? 'w-8 bg-[#8b1538]' : 'w-2.5 bg-gray-300 hover:bg-gray-400'
                  }`}
                  onClick={() => {
                    setPaused(true);
                    setIndex(i);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
