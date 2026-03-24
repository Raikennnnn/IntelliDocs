import { createContext, useContext, useState, ReactNode } from 'react';

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
  setActiveSchoolYear: (year: SchoolYear) => void;
  addSchoolYear: (year: SchoolYear) => void;
  updateSchoolYear: (id: number, updates: Partial<SchoolYear>) => void;
}

const SchoolYearContext = createContext<SchoolYearContextType | undefined>(undefined);

// Initial mock data
const initialSchoolYears: SchoolYear[] = [
  { 
    id: 1, 
    year: '2025-2026', 
    status: 'Active', 
    startDate: '2025-06-01', 
    endDate: '2026-03-31',
    enrolledStudents: 1247,
    createdBy: 'Dr. Maria Santos',
    createdDate: '2025-05-15'
  },
  { 
    id: 2, 
    year: '2024-2025', 
    status: 'Inactive', 
    startDate: '2024-06-01', 
    endDate: '2025-03-31',
    enrolledStudents: 1189,
    createdBy: 'Dr. Maria Santos',
    createdDate: '2024-05-20'
  },
  { 
    id: 3, 
    year: '2023-2024', 
    status: 'Inactive', 
    startDate: '2023-06-01', 
    endDate: '2024-03-31',
    enrolledStudents: 1156,
    createdBy: 'Dr. Maria Santos',
    createdDate: '2023-05-18'
  },
];

export function SchoolYearProvider({ children }: { children: ReactNode }) {
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>(initialSchoolYears);
  
  const activeSchoolYear = schoolYears.find(sy => sy.status === 'Active');

  const setActiveSchoolYear = (year: SchoolYear) => {
    setSchoolYears(prevYears =>
      prevYears.map(sy => ({
        ...sy,
        status: sy.id === year.id ? 'Active' : 'Inactive'
      }))
    );
  };

  const addSchoolYear = (year: SchoolYear) => {
    setSchoolYears(prevYears => [year, ...prevYears]);
  };

  const updateSchoolYear = (id: number, updates: Partial<SchoolYear>) => {
    setSchoolYears(prevYears =>
      prevYears.map(sy => (sy.id === id ? { ...sy, ...updates } : sy))
    );
  };

  return (
    <SchoolYearContext.Provider
      value={{
        schoolYears,
        activeSchoolYear,
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
 * Hook to check if enrollment is allowed
 * Returns true only if there is an active school year
 */
export function useEnrollmentAllowed() {
  const { activeSchoolYear } = useSchoolYear();
  return !!activeSchoolYear;
}

/**
 * Hook to get school year filter options
 * Used in dropdowns across Enrollment, Grades, Attendance, Reports, Student Records
 */
export function useSchoolYearOptions() {
  const { schoolYears, activeSchoolYear } = useSchoolYear();
  
  return {
    options: schoolYears.map(sy => ({
      value: sy.year,
      label: sy.status === 'Active' ? `${sy.year} (Active)` : sy.year,
      isActive: sy.status === 'Active'
    })),
    defaultValue: activeSchoolYear?.year || schoolYears[0]?.year || ''
  };
}
