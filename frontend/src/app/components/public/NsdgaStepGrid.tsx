import type { LucideIcon } from 'lucide-react';
import { BRAND } from '../../lib/publicBrand';

export type StepItem = {
  step: number;
  Icon: LucideIcon;
  title: string;
  description: string;
};

/** Large watermark numbers — editorial enrollment layout. */
export function NsdgaStepGrid({ steps }: { steps: StepItem[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {steps.map(({ step, Icon, title, description }) => {
        const isMaroon = step % 2 === 1;
        const accent = isMaroon ? BRAND.maroon : BRAND.green;
        return (
          <article
            key={step}
            className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <span
              className="pointer-events-none absolute -right-2 -top-4 select-none text-8xl font-bold leading-none opacity-[0.06]"
              style={{ color: accent }}
              aria-hidden
            >
              {String(step).padStart(2, '0')}
            </span>
            <div className="relative">
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: accent }}
                >
                  {step}
                </span>
                <Icon className="size-5" style={{ color: accent }} aria-hidden />
              </div>
              <h3 className="text-lg font-bold" style={{ color: BRAND.ink }}>
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: BRAND.slate }}>
                {description}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
