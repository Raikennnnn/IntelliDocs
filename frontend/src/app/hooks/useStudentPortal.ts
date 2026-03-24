import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

export type EnrollmentStep = {
  key: string;
  title: string;
  status: 'completed' | 'current' | 'pending';
};

export type StudentPortalData = {
  profile: {
    full_name: string;
    date_of_birth: string;
    gender: string;
    phone: string;
    email: string;
    address: string;
    strand: string;
    grade_level: string;
    school_year: string;
    application_status: string;
  };
  guardian: {
    name: string;
    relationship: string;
    contact: string;
    email: string;
    occupation: string;
  };
  enrollment_progress: {
    completed_count: number;
    total_steps: number;
    percent: number;
    steps: EnrollmentStep[];
  };
  application: {
    id: string;
    status: string;
    submittedDate: string;
    lastUpdated: string;
    documents: { name: string; status: string; remarks: string }[];
    registrarRemarks: string;
  };
};

export function useStudentPortal() {
  const [data, setData] = useState<StudentPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/student/me');
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `Request failed (${res.status})`);
        setData(null);
        return;
      }
      if (json.success && json.profile) {
        setData({
          profile: json.profile,
          guardian: json.guardian,
          enrollment_progress: json.enrollment_progress,
          application: json.application,
        });
      } else {
        setError('Unexpected response');
        setData(null);
      }
    } catch (e) {
      setError('Network error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
