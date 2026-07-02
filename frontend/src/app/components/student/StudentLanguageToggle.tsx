import { useStudentLocale } from '../../context/StudentLocaleContext';
import type { StudentLocale } from '../../lib/studentLocale';
import { cn } from '../ui/utils';

export function StudentLanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useStudentLocale();

  const options: { id: StudentLocale; label: string }[] = [
    { id: 'en', label: t('language.english') },
    { id: 'tl', label: t('language.tagalog') },
  ];

  return (
    <div
      className={cn('flex items-center gap-1 rounded-lg border border-white/30 bg-white/10 p-0.5', className)}
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
              active
                ? 'bg-white text-[#8B1538] shadow-sm'
                : 'text-white/90 hover:bg-white/10',
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
