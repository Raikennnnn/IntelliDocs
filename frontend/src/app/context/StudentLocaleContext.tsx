import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getStudentMessage,
  STUDENT_LOCALE_STORAGE_KEY,
  type StudentLocale,
  type StudentMessageKey,
} from '../lib/studentLocale';

type StudentLocaleContextValue = {
  locale: StudentLocale;
  setLocale: (locale: StudentLocale) => void;
  t: (key: StudentMessageKey, vars?: Record<string, string | number>) => string;
};

const StudentLocaleContext = createContext<StudentLocaleContextValue | null>(null);

function readStoredLocale(): StudentLocale {
  try {
    const stored = localStorage.getItem(STUDENT_LOCALE_STORAGE_KEY);
    if (stored === 'tl' || stored === 'en') return stored;
  } catch {
    // localStorage may be blocked
  }
  return 'en';
}

export function StudentLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<StudentLocale>(readStoredLocale);

  const setLocale = useCallback((next: StudentLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STUDENT_LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: StudentMessageKey, vars?: Record<string, string | number>) =>
      getStudentMessage(locale, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return (
    <StudentLocaleContext.Provider value={value}>{children}</StudentLocaleContext.Provider>
  );
}

export function useStudentLocale(): StudentLocaleContextValue {
  const ctx = useContext(StudentLocaleContext);
  if (!ctx) {
    throw new Error('useStudentLocale must be used within StudentLocaleProvider');
  }
  return ctx;
}

export function useStudentLocaleOptional(): StudentLocaleContextValue | null {
  return useContext(StudentLocaleContext);
}
