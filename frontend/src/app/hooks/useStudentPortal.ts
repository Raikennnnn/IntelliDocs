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
    /** Filled in once the enrollment application is submitted; empty before. */
    first_name: string;
    middle_name: string;
    last_name: string;
    /** Generation suffix (Jr., III, etc.) when provided in the enrollment form. */
    extension_name: string;
    date_of_birth: string;
    gender: string;
    phone: string;
    email: string;
    address: string;
    strand: string;
    grade_level: string;
    school_year: string;
    application_status: string;
    school_username?: string | null;
    must_change_password?: boolean;
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
    /** Formatted id e.g. APP-2026-015 — matches registrar views. */
    display_id?: string;
    status: string;
    /** Normalized DB status: approved, pending, rejected, etc. */
    status_code?: string;
    submittedDate: string;
    lastUpdated: string;
    documents: {
      /** Original uploaded filename (e.g. "psa tamper 1.jpg"). */
      name: string;
      /** Machine key for the requirement (e.g. "birth_certificate"). */
      type?: string;
      /** Human-readable requirement label, e.g. "PSA Birth Certificate". */
      requirementLabel?: string;
      status: string;
      /** True once the registrar has manually marked this document as reviewed. */
      registrarReviewed?: boolean;
      /** Empty when no per-document decision; otherwise "reject" / "clear" / etc. */
      registrarDecision?: string;
      remarks: string;
    }[];
    registrarRemarks: string;
    mode_of_payment?: string;
    voucher_no?: string;
  };
  needs_resubmission?: boolean;
  school_username?: string | null;
  must_change_password?: boolean;
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
      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        setError('Something went wrong. Please try again.');
        setData(null);
        return;
      }
      if (!res.ok) {
        setError(json.error || 'Request failed. Please try again.');
        setData(null);
        return;
      }
      if (json.success && json.profile) {
        setData({
          profile: json.profile,
          guardian: json.guardian,
          enrollment_progress: json.enrollment_progress,
          application: json.application,
          needs_resubmission: Boolean(json.needs_resubmission),
          school_username: json.school_username ?? json.profile?.school_username ?? null,
          must_change_password: Boolean(
            json.must_change_password ?? json.profile?.must_change_password
          ),
        });
      } else {
        setError('Unexpected response');
        setData(null);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Network error';
      setError(message);
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
