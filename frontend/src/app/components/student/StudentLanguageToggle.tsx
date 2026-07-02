import { useStudentLocale } from '../../context/StudentLocaleContext';
import type { StudentLocale } from '../../lib/studentLocale';
import { cn } from '../ui/utils';

type StudentLanguageToggleProps = {
  className?: string;
  /** `header` = burgundy top bar; `drawer` = light mobile menu panel */
  variant?: 'header' | 'drawer';
};

export function StudentLanguageToggle({
  className,
  variant = 'header',
}: StudentLanguageToggleProps) {
  const { locale, setLocale, t } = useStudentLocale();
  const onLightSurface = variant === 'drawer';

  const options: { id: StudentLocale; label: string }[] = [
    { id: 'en', label: t('language.english') },
    { id: 'tl', label: t('language.tagalog') },
  ];

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg p-0.5',
        onLightSurface
          ? 'border border-gray-200 bg-gray-50'
          : 'border border-white/30 bg-white/10',
        className,
      )}
      role="group"
      aria-label={t('language.label')}
    >
      {options.map((option) => {
        const active = locale === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setLocale(option.id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors sm:px-3 sm:text-sm',
              onLightSurface
                ? active
                  ? 'bg-white text-[#8B1538] shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
                : active
                  ? 'bg-white text-[#8B1538] shadow-sm'
                  : 'text-white hover:bg-white/10',
            )}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
