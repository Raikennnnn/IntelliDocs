import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { STRANDS, formatStrandDisplay, normalizeStrandCode } from '../../lib/strands';
import { useSchoolYear } from '../../context/SchoolYearContext';

type StrandRow = {
  name: string;
  totalApplications: number;
  enrolledStudents: number;
};

export function RegistrarDashboard() {
  const { enrollmentSchoolYearLabel } = useSchoolYear();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strands, setStrands] = useState<StrandRow[]>([]);
  const [schoolYearLabel, setSchoolYearLabel] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    overallQuota: 4000,
    totalApplications: 0,
    totalEnrolled: 0,
    remainingSlots: 4000,
  });

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/registrar/overview');
      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('Server returned an invalid response');
      }

      if (!res.ok || !json.success) {
        setError(json.error || `Failed to load dashboard (${res.status})`);
        setStrands([]);
        return;
      }

      const nextSummary = json.summary ?? {};
      setSchoolYearLabel(typeof json.schoolYearLabel === 'string' ? json.schoolYearLabel : null);
      setSummary({
        overallQuota: Number(nextSummary.overallQuota ?? 4000),
        totalApplications: Number(nextSummary.totalApplications ?? 0),
        totalEnrolled: Number(nextSummary.totalEnrolled ?? 0),
        remainingSlots: Number(nextSummary.remainingSlots ?? 0),
      });
      setStrands(Array.isArray(json.strands) ? json.strands as StrandRow[] : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setStrands([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview, enrollmentSchoolYearLabel]);

  useEffect(() => {
    const onRefresh = () => {
      void loadOverview();
    };
    window.addEventListener('school-year-settings-changed', onRefresh);
    return () => window.removeEventListener('school-year-settings-changed', onRefresh);
  }, [loadOverview]);

  const overallQuota = summary.overallQuota;
  const totalEnrolled = summary.totalEnrolled;
  const totalApplications = summary.totalApplications;

  const strandMeta = useMemo(() => {
    const meta: Record<string, { fullName: string; bg: string; icon: string }> = {
      Unspecified: { fullName: "No strand specified", bg: "bg-gray-100", icon: "text-gray-600" },
    };
    const styles: Record<string, { bg: string; icon: string }> = {
      ASSH: { bg: "bg-green-100", icon: "text-green-600" },
      BAE: { bg: "bg-purple-100", icon: "text-purple-600" },
      STEM: { bg: "bg-blue-100", icon: "text-blue-600" },
      "TECHPRO - CP": { bg: "bg-cyan-100", icon: "text-cyan-600" },
      "TECHPRO - IT": { bg: "bg-orange-100", icon: "text-orange-600" },
      "TECHPRO - HT": { bg: "bg-pink-100", icon: "text-pink-600" },
    };
    for (const strand of STRANDS) {
      const style = styles[strand.code] ?? { bg: "bg-gray-100", icon: "text-gray-600" };
      meta[strand.code] = { fullName: strand.fullName, ...style };
      meta[normalizeStrandCode(strand.code)] = meta[strand.code];
    }
    return meta;
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Registrar Dashboard</h2>
        <p className="text-gray-600">
          Student Information System Overview
          {schoolYearLabel ? (
            <span className="text-gray-500"> · {schoolYearLabel}</span>
          ) : null}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Overall Summary */}
      <div className="stat-grid">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-900">
                {totalApplications}
              </div>
              <Users className="w-8 h-8 text-[#8B1538]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-[#2D5016]">
                {totalEnrolled}
              </div>
              <CheckCircle className="w-8 h-8 text-[#2D5016]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Overall Quota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-900">
                {overallQuota}
              </div>
              <TrendingUp className="w-8 h-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Remaining Slots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-orange-600">
                {summary.remainingSlots}
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Strand Overview */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Strand Enrollment Overview</h3>
        <p className="text-xs text-gray-500 mb-3">
          The {overallQuota.toLocaleString()}-seat capacity is school-wide; per-strand cards show this
          strand's slice of the total enrolled students.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {strands.map((strand) => {
            // Share-of-school metric: what fraction of the school's enrolled
            // population is in this strand. NOT a per-strand quota — there
            // isn't one. Stays bounded by the overall enrolled total.
            const shareOfEnrolled =
              totalEnrolled > 0 ? (strand.enrolledStudents / totalEnrolled) * 100 : 0;
            const strandKey = normalizeStrandCode(strand.name);
            const meta = strandMeta[strandKey as keyof typeof strandMeta] ?? strandMeta.Unspecified;

            return (
              <Card key={strand.name} className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold text-[#8B1538]">
                        {formatStrandDisplay(strand.name)}
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">{meta.fullName}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-full ${meta.bg} flex items-center justify-center`}>
                      <Users className={`w-6 h-6 ${meta.icon}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats Grid: only the two numbers that are actually
                      per-strand. The school-wide quota / remaining seats is
                      shown once at the top of the dashboard. */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Pending applications</p>
                      <p className="text-2xl font-bold text-gray-900">{strand.totalApplications}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Enrolled students</p>
                      <p className="text-2xl font-bold text-[#2D5016]">{strand.enrolledStudents}</p>
                    </div>
                  </div>

                  {/* Share of enrolled students. */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Share of enrolled students</span>
                      <span className="text-sm font-bold text-gray-900">
                        {shareOfEnrolled.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-3 rounded-full transition-all bg-[#2D5016]"
                        style={{ width: `${Math.min(100, shareOfEnrolled)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!loading && strands.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No strand data for the current school years yet.
              {totalApplications === 0 && totalEnrolled === 0 ? (
                <span>
                  {' '}
                  Enrolled students appear under the <strong>ongoing</strong> school year; new applications
                  appear under the <strong>enrollment</strong> year (set in Admin → School Years).
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      
    </div>
  );
}