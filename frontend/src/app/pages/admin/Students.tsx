import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, GraduationCap } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useSchoolYear } from '../../context/SchoolYearContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';

/**
 * Admin Students directory.
 *
 * Distinct from `admin/UserManagement.tsx` (which manages all user accounts):
 * this page only lists students and lets the admin filter / search across the
 * latest enrollment record per student. Names are pulled from the enrollment
 * data so the directory is meaningful even before the registrar has issued
 * credentials.
 */

type Student = {
  userId: number;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  schoolUsername: string | null;
  gradeLevel: string;
  gradeLevelNumber: number;
  strand: string;
  schoolYear: string;
  enrollmentStatusRaw: string;
  enrollmentStatus: string;
  enrollmentId: number | null;
};

type DirectoryResponse = {
  success?: boolean;
  students?: Student[];
  filters?: {
    school_year_current?: string | null;
    strand_options?: string[];
  };
  error?: string;
};

const GRADE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All grade levels' },
  { value: '11', label: 'Grade 11' },
  { value: '12', label: 'Grade 12' },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'approved', label: 'Enrolled' },
  { value: 'pending', label: 'Pending review' },
  { value: 'under_review', label: 'Under review' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
];

function statusBadgeClass(raw: string): string {
  switch ((raw || '').toLowerCase()) {
    case 'approved':
      return 'bg-green-600 text-white';
    case 'rejected':
      return 'bg-red-600 text-white';
    case 'pending':
    case 'under_review':
    case 'under review':
    case 'review':
      return 'bg-yellow-500 text-white';
    case 'draft':
      return 'bg-gray-500 text-white';
    default:
      return 'bg-gray-300 text-gray-700';
  }
}

export function Students() {
  const { enrollmentSchoolYearLabel } = useSchoolYear();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [grade, setGrade] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [strand, setStrand] = useState<string>('all');
  const [schoolYear, setSchoolYear] = useState<string>('all');
  const [strandOptions, setStrandOptions] = useState<string[]>([]);
  const [currentSy, setCurrentSy] = useState<string | null>(null);

  // Debounce the search box so we don't hit the server on every keystroke.
  // 300ms is short enough that name-search feels responsive.
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set('q', debouncedSearch);
        if (grade !== 'all') params.set('grade_level', grade);
        if (status !== 'all') params.set('status', status);
        if (strand !== 'all') params.set('strand', strand);
        if (schoolYear !== 'all') params.set('school_year', schoolYear);

        const url = '/api/admin/students' + (params.toString() ? `?${params.toString()}` : '');
        const res = await apiFetch(url);
        const text = await res.text();
        let json: DirectoryResponse | null = null;
        try {
          json = JSON.parse(text) as DirectoryResponse;
        } catch {
          json = null;
        }
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || `Failed to load students (${res.status})`);
        }
        if (cancelled) return;
        setStudents(Array.isArray(json.students) ? json.students : []);
        setStrandOptions(Array.isArray(json.filters?.strand_options) ? json.filters!.strand_options! : []);
        setCurrentSy(json.filters?.school_year_current ?? null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load students');
          setStudents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, grade, status, strand, schoolYear, enrollmentSchoolYearLabel]);

  useEffect(() => {
    if (schoolYear === 'current' && enrollmentSchoolYearLabel) {
      setCurrentSy(enrollmentSchoolYearLabel);
    }
  }, [enrollmentSchoolYearLabel, schoolYear]);

  // Strand options come from the backend (distinct over the whole table) so
  // they remain stable even when filters narrow the visible rows. Add a
  // current selection that's missing from the list (e.g. legacy strand
  // names) so the dropdown still shows it.
  const strandSelectOptions = useMemo(() => {
    const set = new Set(strandOptions);
    if (strand !== 'all' && !set.has(strand)) set.add(strand);
    return ['all', ...Array.from(set)];
  }, [strandOptions, strand]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Students</h1>
        <p className="text-sm text-gray-600">
          Directory of student accounts pulled from enrollment records. Names come from the
          latest enrollment a student has on file.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, or school username"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Grade level</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
              >
                {GRADE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Strand</label>
              <select
                value={strand}
                onChange={(e) => setStrand(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
              >
                {strandSelectOptions.map((s) => (
                  <option key={s} value={s}>
                    {s === 'all' ? 'All strands' : s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">School year</label>
              <select
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
              >
                <option value="all">All school years</option>
                {currentSy && (
                  <option value="current">Current ({currentSy})</option>
                )}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{`${students.length} student${students.length === 1 ? '' : 's'}`}</CardTitle>
          <CardDescription>Showing the latest enrollment record per student.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
              Loading students…
            </div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <GraduationCap className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No students match the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">School username</th>
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Grade</th>
                    <th className="py-2 pr-4 font-medium">Strand</th>
                    <th className="py-2 pr-4 font-medium">School year</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.userId} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-gray-900">{s.name || '—'}</div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-gray-700">
                        {s.schoolUsername || <span className="text-gray-400">not issued</span>}
                      </td>
                      <td className="py-3 pr-4 text-gray-700">{s.email || '—'}</td>
                      <td className="py-3 pr-4 text-gray-700">
                        {s.gradeLevelNumber > 0 ? `Grade ${s.gradeLevelNumber}` : (s.gradeLevel || '—')}
                      </td>
                      <td className="py-3 pr-4 text-gray-700">{s.strand || '—'}</td>
                      <td className="py-3 pr-4 text-gray-700">{s.schoolYear || '—'}</td>
                      <td className="py-3 pr-4">
                        <Badge className={statusBadgeClass(s.enrollmentStatusRaw)}>
                          {s.enrollmentStatus}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
