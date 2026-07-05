import { Link } from 'react-router';
import { BookOpen, ChevronRight, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStudentLocale } from '../../context/StudentLocaleContext';
import {
  ENROLLMENT_GUIDE_STEPS,
  enrollmentGuideDismissedStorageKey,
} from '../../lib/studentLocale';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type EnrollmentGuideProps = {
  /** When true, show a compact “show guide” control if the student dismissed the card. */
  allowRestore?: boolean;
  /** Scope dismiss state to this student (required on dashboard). */
  userId?: string | number | null;
  className?: string;
};

export function EnrollmentGuide({
  allowRestore = true,
  userId,
  className,
}: EnrollmentGuideProps) {
  const { t } = useStudentLocale();
  const storageKey = enrollmentGuideDismissedStorageKey(userId);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === '1');
    } catch {
      setDismissed(false);
    } finally {
      setReady(true);
    }
  }, [storageKey]);

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const restore = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setDismissed(false);
  };

  if (!ready) {
    return null;
  }

  if (dismissed) {
    if (!allowRestore) return null;
    return (
      <div className={className}>
        <Button type="button" variant="outline" size="sm" onClick={restore} className="border-[#8B1538]/30">
          <BookOpen className="mr-2 h-4 w-4" />
          {t('guide.showAgain')}
        </Button>
      </div>
    );
  }

  return (
    <Card className={`border-[#8B1538]/20 shadow-sm ${className ?? ''}`}>
      <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-[#8B1538]/5 to-[#2D5016]/5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8B1538]/10 text-[#8B1538]">
              <BookOpen className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-lg text-gray-900">{t('guide.title')}</CardTitle>
              <p className="mt-1 text-sm text-gray-600">{t('guide.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('guide.dismiss')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <ol className="space-y-3">
          {ENROLLMENT_GUIDE_STEPS.map((step, index) => (
            <li key={step.titleKey} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2D5016] text-xs font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-gray-900">{t(step.titleKey)}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{t(step.bodyKey)}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/student/enrollment"
            className="inline-flex items-center justify-center rounded-lg bg-[#8B1538] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8B1538]/90"
          >
            {t('guide.startEnrollment')}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
          <Button type="button" variant="ghost" size="sm" onClick={dismiss} className="text-gray-600">
            {t('guide.dismiss')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
