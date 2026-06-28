import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from './AuthContext';

export interface SchoolYear {
  id: number;
  year: string;
  status: 'Active' | 'Inactive';
  startDate: string;
  endDate: string;
  enrolledStudents: number;
  createdBy: string;
  createdDate: string;
  archived?: boolean;
}

interface SchoolYearContextType {
  schoolYears: SchoolYear[];
  activeSchoolYear: SchoolYear | undefined;
  /** False when admin disabled enrollment or no active year is configured */
  enrollmentEnabled: boolean;
  ongoingSchoolYearLabel: string | null;
  enrollmentSchoolYearLabel: string | null;
  endedSchoolYears: string[];
  catalogStats: { total: number; hidden: number; visible: number };
  settingsLoaded: boolean;
  settingsError: string | null;
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
      archived: Boolean(r?.archived),
    };
  });
}

function buildFallbackSchoolYearRows(
  payload: {
    ongoing_school_year?: string | null;
    enrollment_school_year?: string | null;
    active_school_year?: string | null;
    ended_school_years?: string[];
  },
  activeLabel: string | null,
): SchoolYear[] {
  const years = new Set<string>();
  const ongoing = (payload.ongoing_school_year ?? '').trim();
  const enrollment = (payload.enrollment_school_year ?? payload.active_school_year ?? '').trim();
  if (ongoing) years.add(ongoing);
  if (enrollment) years.add(enrollment);
  (Array.isArray(payload.ended_school_years) ? payload.ended_school_years : []).forEach((y) => {
    const t = String(y ?? '').trim();
    if (t) years.add(t);
  });
  return Array.from(years)
    .sort((a, b) => b.localeCompare(a))
    .map((year, idx) => ({
      id: -(idx + 1),
      year,
      status: activeLabel && year === activeLabel ? 'Active' : 'Inactive',
      startDate: '',
      endDate: '',
      enrolledStudents: 0,
      createdBy: 'System',
      createdDate: '',
      archived: false,
    }));
}

export function SchoolYearProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [enrollmentEnabled, setEnrollmentEnabled] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [ongoingSchoolYearLabel, setOngoingSchoolYearLabel] = useState<string | null>(null);
  const [enrollmentSchoolYearLabel, setEnrollmentSchoolYearLabel] = useState<string | null>(null);
  const [endedSchoolYears, setEndedSchoolYears] = useState<string[]>([]);
  const [catalogStats, setCatalogStats] = useState({ total: 0, hidden: 0, visible: 0 });

  const applySchoolYearPayload = useCallback((j: {
    enrollment_enabled?: boolean;
    active_school_year?: string | null;
    ongoing_school_year?: string | null;
    enrollment_school_year?: string | null;
    ended_school_years?: string[];
    school_years?: any[];
    school_year_catalog_stats?: { total?: number; hidden?: number; visible?: number };
  }) => {
    setEnrollmentEnabled(!!j.enrollment_enabled);
    setOngoingSchoolYearLabel(j.ongoing_school_year ?? null);
    setEnrollmentSchoolYearLabel(j.enrollment_school_year ?? j.active_school_year ?? null);
    setEndedSchoolYears(Array.isArray(j.ended_school_years) ? j.ended_school_years : []);
    const stats = j.school_year_catalog_stats;
    setCatalogStats({
      total: Number(stats?.total ?? 0),
      hidden: Number(stats?.hidden ?? 0),
      visible: Number(stats?.visible ?? 0),
    });
    const activeLabel = (j.enrollment_school_year ?? j.active_school_year) ?? null;
    if (Array.isArray(j.school_years) && j.school_years.length > 0) {
      setSchoolYears(normalizeSchoolYearRows(j.school_years, activeLabel));
    } else {
      setSchoolYears(buildFallbackSchoolYearRows(j, activeLabel));
    }
  }, []);

  const reloadSchoolYearSettings = useCallback(async () => {
    setSettingsError(null);
    try {
      const res = await apiFetch('/api/school-year');
      const text = await res.text();
      let j: {
        success?: boolean;
        error?: string;
        enrollment_enabled?: boolean;
        active_school_year?: string | null;
        ongoing_school_year?: string | null;
        enrollment_school_year?: string | null;
        ended_school_years?: string[];
        school_years?: any[];
        school_year_catalog_stats?: { total?: number; hidden?: number; visible?: number };
      };
      try {
        j = JSON.parse(text) as typeof j;
      } catch {
        setSettingsError('Server returned an invalid response. Try Ctrl+Shift+R to reload the app.');
        return;
      }
      if (!res.ok || !j.success) {
        setSettingsError(j.error || `Failed to load school year settings (${res.status})`);
        return;
      }
      applySchoolYearPayload(j);
    } catch {
      setSettingsError('Network error while loading school year settings.');
    } finally {
      setSettingsLoaded(true);
    }
  }, [applySchoolYearPayload]);

  useEffect(() => {
    void reloadSchoolYearSettings();
  }, [reloadSchoolYearSettings]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void reloadSchoolYearSettings();
  }, [isAuthenticated, user?.id, reloadSchoolYearSettings]);

  useEffect(() => {
    const onRefresh = () => {
      void reloadSchoolYearSettings();
    };
    window.addEventListener('school-year-settings-changed', onRefresh);
    window.addEventListener('auth-session-changed', onRefresh);
    return () => {
      window.removeEventListener('school-year-settings-changed', onRefresh);
      window.removeEventListener('auth-session-changed', onRefresh);
    };
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
        catalogStats,
        settingsLoaded,
        settingsError,
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
