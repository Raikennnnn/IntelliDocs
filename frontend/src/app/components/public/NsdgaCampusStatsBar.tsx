import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BRAND } from '../../lib/publicBrand';

type Stat = {
  value: string;
  label: string;
  Icon: LucideIcon;
};

type NsdgaCampusStatsBarProps = {
  stats: Stat[];
  /** Sit on the seam between hero image and the section below (50/50 split). */
  onBorder?: boolean;
  /** Hidden on load; fades in after the user scrolls. */
  revealOnScroll?: boolean;
};

function StatsCard({ stats }: { stats: Stat[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-lg">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const { Icon } = stat;
          const isMaroon = index % 2 === 0;
          const accent = isMaroon ? BRAND.maroon : BRAND.green;
          const showRightBorder = index % 2 === 0 && index < stats.length - 1;
          const showBottomBorder = index < 2;

          return (
            <div
              key={stat.label}
              className={[
                'flex items-center gap-3 px-4 py-5 sm:gap-4 sm:px-6 sm:py-6',
                showRightBorder ? 'border-r border-gray-100' : '',
                showBottomBorder ? 'border-b border-gray-100 lg:border-b-0' : '',
                index < 3 ? 'lg:border-r lg:border-gray-100' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-full sm:size-11"
                style={{ backgroundColor: `${accent}14` }}
              >
                <Icon className="size-5" style={{ color: accent }} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight sm:text-xl" style={{ color: BRAND.ink }}>
                  {stat.value}
                </p>
                <p
                  className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide sm:text-xs"
                  style={{ color: BRAND.muted }}
                >
                  {stat.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SCROLL_REVEAL_PX = 80;
const SCROLL_HIDE_PX = 48;

export function NsdgaCampusStatsBar({
  stats,
  onBorder = false,
  revealOnScroll = false,
}: NsdgaCampusStatsBarProps) {
  const [visible, setVisible] = useState(!revealOnScroll);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    if (!revealOnScroll) return;

    lastScrollYRef.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const scrollingDown = y > lastScrollYRef.current;
      lastScrollYRef.current = y;

      if (y <= SCROLL_HIDE_PX) {
        setVisible(false);
        return;
      }

      if (scrollingDown && y >= SCROLL_REVEAL_PX) {
        setVisible(true);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [revealOnScroll]);

  const motionClass = visible
    ? 'translate-y-1/2 opacity-100'
    : 'pointer-events-none translate-y-[calc(50%+1.25rem)] opacity-0';

  const card = (
    <div
      aria-hidden={!visible}
      className={`transition-all duration-500 ease-out ${motionClass}`}
    >
      <StatsCard stats={stats} />
    </div>
  );

  if (onBorder) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
        <div className="section-container pointer-events-auto">{card}</div>
      </div>
    );
  }

  return (
    <section className="relative z-10">
      <div className="section-container">{card}</div>
    </section>
  );
}

/** Top padding for the section below a border-straddling stats card. */
export const NSDGA_STATS_BORDER_SPACER = 'pt-24 sm:pt-28 lg:pt-24';
