import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { FileText, Download, FileSpreadsheet, Users, School, CheckCircle, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';

export function Reports() {
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    totalEnrolled: 0,
    totalSections: 0,
    quotaUtilization: 0,
    documentCompletionRate: 0,
    overallQuota: 4000,
    remainingSlots: 4000,
    verifiedDocuments: 0,
    totalDocuments: 0,
  });
  const [strands, setStrands] = useState<Array<{ name: string; totalApplications: number; enrolledStudents: number }>>([]);

  useEffect(() => {
    const loadOverview = async () => {
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
          setError(json.error || `Failed to load reports (${res.status})`);
          return;
        }

        const s = json.summary ?? {};
        setSummary({
          totalEnrolled: Number(s.totalEnrolled ?? 0),
          totalSections: Number(s.totalSections ?? 0),
          quotaUtilization: Number(s.quotaUtilization ?? 0),
          documentCompletionRate: Number(s.documentCompletionRate ?? 0),
          overallQuota: Number(s.overallQuota ?? 4000),
          remainingSlots: Number(s.remainingSlots ?? 0),
          verifiedDocuments: Number(s.verifiedDocuments ?? 0),
          totalDocuments: Number(s.totalDocuments ?? 0),
        });
        setStrands(Array.isArray(json.strands) ? json.strands : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error');
      }
    };

    loadOverview();
  }, []);

  const handleExportPDF = (reportType: string) => {
    toast.success(`Exporting ${reportType} as PDF...`);
  };

  const handleExportExcel = (reportType: string) => {
    toast.success(`Exporting ${reportType} as Excel...`);
  };

  const strandSummary = useMemo(() => {
    if (strands.length === 0) return 'No strand data yet';
    return strands
      .slice(0, 3)
      .map((s) => `${s.name}: ${s.enrolledStudents}`)
      .join(' | ');
  }, [strands]);

  const reports = [
    {
      id: 1,
      title: 'Enrollment per Strand',
      description: 'Comprehensive enrollment report showing students per strand with quota analysis',
      icon: Users,
      color: 'blue',
      stats: { total: summary.totalEnrolled, byStrand: strandSummary }
    },
    {
      id: 2,
      title: 'Section Masterlist',
      description: 'Complete list of all sections with student rosters and adviser assignments',
      icon: School,
      color: 'green',
      stats: { total: `${summary.totalSections} Sections`, byStrand: strandSummary }
    },
    {
      id: 3,
      title: 'Quota Summary',
      description: 'Strand quota tracking with remaining slots and capacity utilization',
      icon: BarChart3,
      color: 'orange',
      stats: { quotaTotal: summary.overallQuota, enrolled: summary.totalEnrolled, remaining: summary.remainingSlots }
    },
    {
      id: 4,
      title: 'Document Completion Report',
      description: 'Student document submission status with completion tracking',
      icon: CheckCircle,
      color: 'purple',
      stats: {
        complete: summary.verifiedDocuments,
        incomplete: Math.max(0, summary.totalDocuments - summary.verifiedDocuments),
        rate: `${summary.documentCompletionRate.toFixed(1)}%`,
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Reports</h2>
        <p className="text-gray-600">Generate and export various registrar reports</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{summary.totalEnrolled}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Sections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#2D5016]">{summary.totalSections}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Quota Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{summary.quotaUtilization.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Document Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{summary.documentCompletionRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="border-2 hover:shadow-lg transition-all">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg bg-${report.color}-100 flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-6 h-6 text-${report.color}-600`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl text-gray-900">{report.title}</CardTitle>
                    <CardDescription className="mt-2">{report.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats Display */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Report Summary</p>
                  {typeof report.stats === 'object' && 'total' in report.stats && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{report.stats.total} Students</p>
                      <p className="text-xs text-gray-600">{report.stats.byStrand}</p>
                    </div>
                  )}
                  {typeof report.stats === 'object' && 'quotaTotal' in report.stats && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Quota: {report.stats.quotaTotal}</p>
                      <p className="text-xs text-gray-600">
                        Enrolled: {report.stats.enrolled} | Remaining: {report.stats.remaining}
                      </p>
                    </div>
                  )}
                  {typeof report.stats === 'object' && 'complete' in report.stats && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Completion Rate: {report.stats.rate}</p>
                      <p className="text-xs text-gray-600">
                        Complete: {report.stats.complete} | Incomplete: {report.stats.incomplete}
                      </p>
                    </div>
                  )}
                </div>

                {/* Export Buttons */}
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleExportPDF(report.title)}
                    className="flex-1 bg-[#8B1538] hover:bg-[#6B1028]"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Export PDF
                  </Button>
                  <Button 
                    onClick={() => handleExportExcel(report.title)}
                    className="flex-1 bg-[#2D5016] hover:bg-[#1D3010]"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export Excel
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional Report Options */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Report Generator</CardTitle>
          <CardDescription>Generate custom reports with specific filters and date ranges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Download className="w-6 h-6 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Bulk Export Available</p>
                <p className="text-sm text-blue-700">
                  Export all reports at once or customize your report parameters
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                Custom Report Settings
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Download className="w-4 h-4 mr-2" />
                Export All Reports
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
