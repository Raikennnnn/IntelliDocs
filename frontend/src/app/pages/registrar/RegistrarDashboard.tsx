import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';

type StrandRow = {
  name: string;
  totalApplications: number;
  enrolledStudents: number;
};

export function RegistrarDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strands, setStrands] = useState<StrandRow[]>([]);
  const [summary, setSummary] = useState({
    overallQuota: 4000,
    totalApplications: 0,
    totalEnrolled: 0,
    remainingSlots: 4000,
  });

  useEffect(() => {
    const loadOverview = async () => {
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
    };

    loadOverview();
  }, []);

  const overallQuota = summary.overallQuota;
  const totalEnrolled = summary.totalEnrolled;
  const totalApplications = summary.totalApplications;

  const strandMeta = useMemo(() => ({
    STEM: { fullName: 'Science, Technology, Engineering and Mathematics', bg: 'bg-blue-100', icon: 'text-blue-600' },
    HUMSS: { fullName: 'Humanities and Social Sciences', bg: 'bg-green-100', icon: 'text-green-600' },
    ABM: { fullName: 'Accountancy, Business and Management', bg: 'bg-purple-100', icon: 'text-purple-600' },
    'TVL-ICT': { fullName: 'Information and Communications Technology', bg: 'bg-cyan-100', icon: 'text-cyan-600' },
    'TVL-EIM': { fullName: 'Electrical Installation and Maintenance', bg: 'bg-orange-100', icon: 'text-orange-600' },
    'TVL-BPP/FBS': { fullName: 'Bread and Pastry Production / Food & Beverage Services', bg: 'bg-pink-100', icon: 'text-pink-600' },
    Unspecified: { fullName: 'No strand specified', bg: 'bg-gray-100', icon: 'text-gray-600' },
  }), []);

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-600';
    if (percentage >= 75) return 'bg-orange-500';
    return 'bg-[#2D5016]';
  };

  const getStatusColor = (remaining: number) => {
    if (remaining <= 5) return 'text-red-600';
    if (remaining <= 15) return 'text-orange-600';
    return 'text-[#2D5016]';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Registrar Dashboard</h2>
        <p className="text-gray-600">Student Information System Overview</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Overall Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {strands.map((strand) => {
            const remainingSlots = Math.max(0, overallQuota - strand.enrolledStudents);
            const percentageFilled = overallQuota > 0 ? (strand.enrolledStudents / overallQuota) * 100 : 0;
            const meta = strandMeta[strand.name as keyof typeof strandMeta] ?? strandMeta.Unspecified;
            
            return (
              <Card key={strand.name} className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold text-[#8B1538]">
                        {strand.name}
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">{meta.fullName}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-full ${meta.bg} flex items-center justify-center`}>
                      <Users className={`w-6 h-6 ${meta.icon}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Total Applications</p>
                      <p className="text-2xl font-bold text-gray-900">{strand.totalApplications}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Enrolled Students</p>
                      <p className="text-2xl font-bold text-[#2D5016]">{strand.enrolledStudents}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Quota</p>
                      <p className="text-2xl font-bold text-blue-900">{overallQuota}</p>
                    </div>
                    <div className={`${remainingSlots <= 5 ? 'bg-red-50' : remainingSlots <= 15 ? 'bg-orange-50' : 'bg-gray-50'} p-3 rounded-lg`}>
                      <p className="text-xs text-gray-600 mb-1">Remaining Slots</p>
                      <p className={`text-2xl font-bold ${getStatusColor(remainingSlots)}`}>
                        {remainingSlots}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Capacity</span>
                      <span className="text-sm font-bold text-gray-900">
                        {percentageFilled.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-3 rounded-full transition-all ${getProgressColor(percentageFilled)}`}
                        style={{ width: `${percentageFilled}%` }}
                      />
                    </div>
                    {percentageFilled >= 90 && (
                      <p className="text-xs text-red-600 font-medium mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Nearly full - Limited slots remaining
                      </p>
                    )}
                    {percentageFilled >= 75 && percentageFilled < 90 && (
                      <p className="text-xs text-orange-600 font-medium mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Approaching capacity
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!loading && strands.length === 0 && (
            <div className="text-gray-500 text-sm">No strand data available yet.</div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      
    </div>
  );
}