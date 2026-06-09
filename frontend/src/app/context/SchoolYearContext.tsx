import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
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
  ongoingSchoolYearLabel: string | null;
  enrollmentSchoolYearLabel: string | null;
  endedSchoolYears: string[];
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
  const [ongoingSchoolYearLabel, setOngoingSchoolYearLabel] = useState<string | null>(null);
  const [enrollmentSchoolYearLabel, setEnrollmentSchoolYearLabel] = useState<string | null>(null);
  const [endedSchoolYears, setEndedSchoolYears] = useState<string[]>([]);

  const reloadSchoolYearSettings = useCallback(async () => {
    try {
      const res = await apiFetch('/api/school-year');
      const j = (await res.json()) as {
        success?: boolean;
        enrollment_enabled?: boolean;
        active_school_year?: string | null;
        ongoing_school_year?: string | null;
        enrollment_school_year?: string | null;
        ended_school_years?: string[];
        school_years?: any[];
      };
      if (j.success) {
        setEnrollmentEnabled(!!j.enrollment_enabled);
        setOngoingSchoolYearLabel(j.ongoing_school_year ?? null);
        setEnrollmentSchoolYearLabel(j.enrollment_school_year ?? j.active_school_year ?? null);
        setEndedSchoolYears(Array.isArray(j.ended_school_years) ? j.ended_school_years : []);
        if (Array.isArray(j.school_years)) {
          setSchoolYears(normalizeSchoolYearRows(j.school_years, (j.enrollment_school_year ?? j.active_school_year) ?? null));
        } else {
          // Minimal fallback: keep list but align active status if we already had local rows.
          setSchoolYears((prev) =>
            prev.map((sy) => ({
              ...sy,
              status: (j.enrollment_school_year ?? j.active_school_year) && sy.year === (j.enrollment_school_year ?? j.active_school_year) ? 'Active' : 'Inactive',
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

  const activeSchoolYear = useMemo(() => {
    const fromList = schoolYears.find((sy) => sy.status === 'Active');
    if (fromList) return fromList;
    // Enrollment may be open via app_settings even if school_years list is empty or stale.
    if (enrollmentEnabled && enrollmentSchoolYearLabel) {
      return {
        id: 0,
        year: enrollmentSchoolYearLabel,
        status: 'Active' as const,
        startDate: '',
        endDate: '',
        enrolledStudents: 0,
        createdBy: '',
        createdDate: '',
      };
    }
    return undefined;
  }, [schoolYears, enrollmentEnabled, enrollmentSchoolYearLabel]);

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
        ongoingSchoolYearLabel,
        enrollmentSchoolYearLabel,
        endedSchoolYears,
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
 * True when the server reports enrollment is open for a school year.
 * Uses enrollment_school_year from settings (not only the school_years table row).
 */
export function useEnrollmentAllowed() {
  const { enrollmentEnabled, enrollmentSchoolYearLabel, settingsLoaded } = useSchoolYear();
  if (!settingsLoaded) return null;
  return enrollmentEnabled && !!enrollmentSchoolYearLabel;
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
