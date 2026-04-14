import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';

export interface SchoolYear {
  id: number;
  year: string;
  status: 'Active' | 'Inactive';
  startDate: string;
  endDate: string;
  enrolledStudents: number;
  createdBy: string;
  createdDate: string;
}

interface SchoolYearContextType {
  schoolYears: SchoolYear[];
  activeSchoolYear: SchoolYear | undefined;
  /** False when admin disabled enrollment or no active year is configured */
  enrollmentEnabled: boolean;
  settingsLoaded: boolean;
  reloadSchoolYearSettings: () => Promise<void>;
  setActiveSchoolYear: (year: SchoolYear) => void;
  addSchoolYear: (year: SchoolYear) => void;
  updateSchoolYear: (id: number, updates: Partial<SchoolYear>) => void;
}

const SchoolYearContext = createContext<SchoolYearContextType | undefined>(undefined);

function normalizeSchoolYearRows(rows: any[], activeLabel: string | null | undefined): SchoolYear[] {
  const active = activeLabel || null;
  return (Array.isArray(rows) ? rows : []).map((r: any) => {
    const year = String(r?.year ?? '');
    const status: SchoolYear['status'] =
      active && year === active ? 'Active' : (String(r?.status ?? 'Inactive') === 'Active' ? 'Active' : 'Inactive');
    return {
      id: Number(r?.id ?? 0),
      year,
      status,
      startDate: String(r?.startDate ?? ''),
      endDate: String(r?.endDate ?? ''),
      enrolledStudents: Number(r?.enrolledStudents ?? 0),
      createdBy: String(r?.createdBy ?? 'Administrator'),
      createdDate: String(r?.createdDate ?? ''),
    };
  });
}

export function SchoolYearProvider({ children }: { children: ReactNode }) {
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [enrollmentEnabled, setEnrollmentEnabled] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const reloadSchoolYearSettings = useCallback(async () => {
    try {
      const res = await apiFetch('/api/school-year');
      const j = (await res.json()) as {
        success?: boolean;
        enrollment_enabled?: boolean;
        active_school_year?: string | null;
        school_years?: any[];
      };
      if (j.success) {
        setEnrollmentEnabled(!!j.enrollment_enabled);
        if (Array.isArray(j.school_years)) {
          setSchoolYears(normalizeSchoolYearRows(j.school_years, j.active_school_year ?? null));
        } else {
          // Minimal fallback: keep list but align active status if we already had local rows.
          setSchoolYears((prev) =>
            prev.map((sy) => ({
              ...sy,
              status: j.active_school_year && sy.year === j.active_school_year ? 'Active' : 'Inactive',
            })),
          );
        }
      }
    } catch {
      // keep previous state
    } finally {
      setSettingsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reloadSchoolYearSettings();
  }, [reloadSchoolYearSettings]);

  useEffect(() => {
    const onRefresh = () => {
      void reloadSchoolYearSettings();
    };
    window.addEventListener('school-year-settings-changed', onRefresh);
    return () => window.removeEventListener('school-year-settings-changed', onRefresh);
  }, [reloadSchoolYearSettings]);

  const activeSchoolYear = schoolYears.find((sy) => sy.status === 'Active');

  const setActiveSchoolYear = (year: SchoolYear) => {
    setSchoolYears((prevYears) =>
      prevYears.map((sy) => ({
        ...sy,
        status: sy.id === year.id ? 'Active' : 'Inactive',
      })),
    );
  };

  const addSchoolYear = (year: SchoolYear) => {
    setSchoolYears((prevYears) => [year, ...prevYears]);
  };

  const updateSchoolYear = (id: number, updates: Partial<SchoolYear>) => {
    setSchoolYears((prevYears) =>
      prevYears.map((sy) => (sy.id === id ? { ...sy, ...updates } : sy)),
    );
  };

  return (
    <SchoolYearContext.Provider
      value={{
        schoolYears,
        activeSchoolYear,
        enrollmentEnabled,
        settingsLoaded,
        reloadSchoolYearSettings,
        setActiveSchoolYear,
        addSchoolYear,
        updateSchoolYear,
      }}
    >
      {children}
    </SchoolYearContext.Provider>
  );
}

export function useSchoolYear() {
  const context = useContext(SchoolYearContext);
  if (context === undefined) {
    throw new Error('useSchoolYear must be used within a SchoolYearProvider');
  }
  return context;
}

/**
 * True when the server reports an active school year and enrollment is enabled.
 */
export function useEnrollmentAllowed() {
  const { activeSchoolYear, enrollmentEnabled } = useSchoolYear();
  return enrollmentEnabled && !!activeSchoolYear;
}

export function useSchoolYearOptions() {
  const { schoolYears, activeSchoolYear } = useSchoolYear();

  return {
    options: schoolYears.map((sy) => ({
      value: sy.year,
      label: sy.status === 'Active' ? `${sy.year} (Active)` : sy.year,
      isActive: sy.status === 'Active',
    })),
    defaultValue: activeSchoolYear?.year || schoolYears[0]?.year || '',
  };
}
