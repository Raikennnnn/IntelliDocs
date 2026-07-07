import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Download,
  FileSpreadsheet,
  Users,
  School,
  CheckCircle,
  BarChart3,
  ClipboardList,
  ShieldCheck,
  Calendar,
  Loader2,
  Eye,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { useSchoolYear } from '../../context/SchoolYearContext';
import { RegistrarReportPreview } from '../../components/RegistrarReportPreview';
import {
  downloadRegistrarReportExcel,
  fetchRegistrarReport,
  printRegistrarReport,
  printRegistrarReportFromData,
  type RegistrarReportJson,
  type RegistrarReportType,
} from '../../lib/registrarReports';

type ReportCard = {
  id: RegistrarReportType;
  title: string;
  description: string;
  icon: typeof Users;
  accent: string;
};

const REPORT_CARDS: ReportCard[] = [
  {
    id: 'applicants',
    title: 'Applicant List',
    description: 'Pending, under review, draft, and rejected applications for the selected school year',
    icon: ClipboardList,
    accent: 'text-blue-600 bg-blue-50',
  },
  {
    id: 'enrollment_summary',
    title: 'Enrollment Summary',
    description: 'Enrollment counts by strand and grade level with status breakdown',
    icon: BarChart3,
    accent: 'text-indigo-600 bg-indigo-50',
  },
  {
    id: 'document_verification',
    title: 'Document Verification Results',
    description: 'Per-document AI and registrar verification status for each student',
    icon: ShieldCheck,
    accent: 'text-purple-600 bg-purple-50',
  },
  {
    id: 'approval_records',
    title: 'Approval Records',
    description: 'Approved and enrolled students with approval dates and registrar remarks',
    icon: CheckCircle,
    accent: 'text-green-600 bg-green-50',
  },
  {
    id: 'rejection_records',
    title: 'Rejection Records',
    description: 'Rejected applications and documents with reasons and concern scores',
    icon: FileText,
    accent: 'text-red-600 bg-red-50',
  },
  {
    id: 'anomaly_summary',
    title: 'Anomaly Summary',
    description: 'AI-detected tampering, verification anomalies, and security events',
    icon: ShieldCheck,
    accent: 'text-amber-600 bg-amber-50',
  },
  {
    id: 'section_masterlist',
    title: 'Section Masterlist',
    description: 'Section rosters with strand, shift, and student assignments',
    icon: School,
    accent: 'text-emerald-600 bg-emerald-50',
  },
  {
    id: 'quota_summary',
    title: 'Quota Summary',
    description: 'Overall quota utilization and per-strand enrollment share',
    icon: Users,
    accent: 'text-orange-600 bg-orange-50',
  },
  {
    id: 'document_completion',
    title: 'Document Completion Report',
    description: 'Digital and physical document completion tracking per enrolled student',
    icon: FileText,
    accent: 'text-rose-600 bg-rose-50',
  },
];

type MonitoringSummary = {
  totalEnrolled: number;
  totalSections: number;
  quotaUtilization: number;
  documentCompletionRate: number;
  overallQuota: number;
  remainingSlots: number;
  verifiedDocuments: number;
  totalDocuments: number;
  pending: number;
  underReview: number;
};

const DEFAULT_SUMMARY: MonitoringSummary = {
  totalEnrolled: 0,
  totalSections: 0,
  quotaUtilization: 0,
  documentCompletionRate: 0,
  overallQuota: 4000,
  remainingSlots: 4000,
  verifiedDocuments: 0,
  totalDocuments: 0,
  pending: 0,
  underReview: 0,
};

export function Reports() {
  const { enrollmentSchoolYearLabel, ongoingSchoolYearLabel, endedSchoolYears } = useSchoolYear();
  const [schoolYearFilter, setSchoolYearFilter] = useState<string>('ongoing');
  const [schoolYearOptions, setSchoolYearOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MonitoringSummary>(DEFAULT_SUMMARY);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<RegistrarReportJson | null>(null);
  const [previewReportId, setPreviewReportId] = useState<RegistrarReportType | null>(null);

  const apiSchoolYearParam = useMemo(() => {
    if (schoolYearFilter === 'all') return 'all';
    if (schoolYearFilter === 'ongoing') return 'ongoing';
    if (schoolYearFilter === 'current') {
      return enrollmentSchoolYearLabel || 'current';
    }
    return schoolYearFilter;
  }, [schoolYearFilter, enrollmentSchoolYearLabel]);

  const loadMonitoring = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchRegistrarReport('monitoring_summary', apiSchoolYearParam);
      const s = (json.summary ?? {}) as Record<string, unknown>;
      setSummary({
        totalEnrolled: Number(s.totalEnrolled ?? 0),
        totalSections: Number(s.totalSections ?? 0),
        quotaUtilization: Number(s.quotaUtilization ?? 0),
        documentCompletionRate: Number(s.documentCompletionRate ?? 0),
        overallQuota: Number(s.overallQuota ?? 4000),
        remainingSlots: Number(s.remainingSlots ?? 0),
        verifiedDocuments: Number(s.verifiedDocuments ?? 0),
        totalDocuments: Number(s.totalDocuments ?? 0),
        pending: Number(s.pending ?? 0),
        underReview: Number(s.underReview ?? 0),
      });
      const opts = Array.isArray(json.filters?.school_year_options)
        ? json.filters!.school_year_options!
        : [];
      setSchoolYearOptions(opts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [apiSchoolYearParam]);

  useEffect(() => {
    loadMonitoring();
  }, [loadMonitoring]);

  const openPreview = async (report: RegistrarReportType) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewData(null);
    setPreviewReportId(report);
    try {
      const json = await fetchRegistrarReport(report, apiSchoolYearParam);
      setPreviewData(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to preview report');
      setPreviewOpen(false);
      setPreviewReportId(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewData(null);
    setPreviewReportId(null);
  };

  const printPreview = () => {
    if (!previewData) return;
    try {
      printRegistrarReportFromData(previewData);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open print view');
    }
  };

  const runExport = async (
    report: RegistrarReportType,
    mode: 'excel' | 'print',
    label: string,
  ) => {
    const key = `${report}-${mode}`;
    setExportingId(key);
    try {
      if (mode === 'excel') {
        await downloadRegistrarReportExcel(report, apiSchoolYearParam, report);
        toast.success(`${label} exported as Excel`);
      } else {
        await printRegistrarReport(report, apiSchoolYearParam);
        toast.success(`${label} — use your browser print dialog to print or save as PDF`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExportingId(null);
    }
  };

  const exportAllExcel = async () => {
    setExportingId('bulk-excel');
    try {
      for (const card of REPORT_CARDS) {
        await downloadRegistrarReportExcel(card.id, apiSchoolYearParam, card.id);
      }
      toast.success('All reports exported as Excel files');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk export failed');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Reports & Monitoring</h2>
        <p className="text-gray-600">
          Generate enrollment-related reports — applicant lists, summaries, document verification,
          and approval records — in printable and exportable formats.
        </p>
      </div>

      <Card className="p-4">
        <label
          htmlFor="reports-school-year"
          className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5"
        >
          <Calendar className="w-3.5 h-3.5" />
          Report school year
        </label>
        <select
          id="reports-school-year"
          value={schoolYearFilter}
          onChange={(e) => setSchoolYearFilter(e.target.value)}
          className="w-full max-w-md h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
        >
          {ongoingSchoolYearLabel && (
            <option value="ongoing">Ongoing academic year ({ongoingSchoolYearLabel})</option>
          )}
          {!ongoingSchoolYearLabel && <option value="ongoing">Ongoing academic year</option>}
          {enrollmentSchoolYearLabel && (
            <option value="current">Enrollment intake ({enrollmentSchoolYearLabel})</option>
          )}
          {!enrollmentSchoolYearLabel && <option value="current">Enrollment intake year</option>}
          <option value="all">All school years</option>
          {schoolYearOptions.map((y) => (
            <option key={y} value={y}>
              SY {y}
              {endedSchoolYears.includes(y) ? ' (ended)' : ''}
            </option>
          ))}
        </select>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Enrolled', value: summary.totalEnrolled, color: 'text-blue-600' },
          { label: 'In Review Queue', value: summary.pending + summary.underReview, color: 'text-amber-600' },
          { label: 'Quota Utilization', value: `${summary.quotaUtilization.toFixed(1)}%`, color: 'text-orange-600' },
          { label: 'Docs Verified', value: `${summary.documentCompletionRate.toFixed(1)}%`, color: 'text-purple-600' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${stat.color}`}>
                {loading ? <Loader2 className="w-6 h-6 animate-spin inline" /> : stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {REPORT_CARDS.map((report) => {
          const Icon = report.icon;
          const busyExcel = exportingId === `${report.id}-excel`;
          const busyPrint = exportingId === `${report.id}-print`;
          return (
            <Card key={report.id} className="border hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${report.accent}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg text-gray-900">{report.title}</CardTitle>
                    <CardDescription className="mt-1">{report.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => openPreview(report.id)}
                  >
                    <Eye className="w-4 h-4 mr-1.5" />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full bg-[#8B1538] hover:bg-[#6B1028] sm:w-auto"
                    disabled={busyPrint}
                    onClick={() => runExport(report.id, 'print', report.title)}
                  >
                    {busyPrint ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Printer className="w-4 h-4 mr-1.5" />
                    )}
                    Print / PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full bg-[#2D5016] hover:bg-[#1D3010] sm:w-auto"
                    disabled={busyExcel}
                    onClick={() => runExport(report.id, 'excel', report.title)}
                  >
                    {busyExcel ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                    )}
                    Export Excel
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Export</CardTitle>
          <CardDescription>Download every report type for the selected school year as Excel files.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            disabled={exportingId === 'bulk-excel'}
            onClick={exportAllExcel}
          >
            {exportingId === 'bulk-excel' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export All Reports (Excel)
          </Button>
        </CardContent>
      </Card>

      <RegistrarReportPreview
        open={previewOpen}
        loading={previewLoading}
        data={previewData}
        onClose={closePreview}
        onPrint={printPreview}
      />
    </div>
  );
}
