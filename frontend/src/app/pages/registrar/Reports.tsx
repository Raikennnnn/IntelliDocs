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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { useSchoolYear } from '../../context/SchoolYearContext';
import {
  downloadRegistrarReportCsv,
  fetchRegistrarReport,
  printRegistrarReport,
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
  const { enrollmentSchoolYearLabel, endedSchoolYears } = useSchoolYear();
  const [schoolYearFilter, setSchoolYearFilter] = useState<string>('current');
  const [schoolYearOptions, setSchoolYearOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MonitoringSummary>(DEFAULT_SUMMARY);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<RegistrarReportJson | null>(null);

  const apiSchoolYearParam = useMemo(() => {
    if (schoolYearFilter === 'all') return 'all';
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
    try {
      const json = await fetchRegistrarReport(report, apiSchoolYearParam);
      setPreviewData(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to preview report');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const runExport = async (
    report: RegistrarReportType,
    mode: 'csv' | 'print',
    label: string,
  ) => {
    const key = `${report}-${mode}`;
    setExportingId(key);
    try {
      if (mode === 'csv') {
        await downloadRegistrarReportCsv(report, apiSchoolYearParam, report);
        toast.success(`${label} exported as CSV`);
      } else {
        await printRegistrarReport(report, apiSchoolYearParam);
        toast.success(`${label} opened for printing`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExportingId(null);
    }
  };

  const exportAllCsv = async () => {
    setExportingId('bulk-csv');
    try {
      for (const card of REPORT_CARDS) {
        await downloadRegistrarReportCsv(card.id, apiSchoolYearParam, card.id);
      }
      toast.success('All reports exported as CSV files');
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
          {enrollmentSchoolYearLabel && (
            <option value="current">Active enrollment ({enrollmentSchoolYearLabel})</option>
          )}
          {!enrollmentSchoolYearLabel && <option value="current">Active enrollment year</option>}
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          const busyCsv = exportingId === `${report.id}-csv`;
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openPreview(report.id)}
                  >
                    <Eye className="w-4 h-4 mr-1.5" />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#8B1538] hover:bg-[#6B1028]"
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
                    className="bg-[#2D5016] hover:bg-[#1D3010]"
                    disabled={busyCsv}
                    onClick={() => runExport(report.id, 'csv', report.title)}
                  >
                    {busyCsv ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                    )}
                    Export CSV
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
          <CardDescription>Download every report type for the selected school year as CSV files.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            disabled={exportingId === 'bulk-csv'}
            onClick={exportAllCsv}
          >
            {exportingId === 'bulk-csv' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export All Reports (CSV)
          </Button>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewData?.title ?? 'Report preview'}</DialogTitle>
            <DialogDescription>
              {previewData?.schoolYearLabel ?? ''}
              {previewData?.rowCount != null ? ` · ${previewData.rowCount} row(s)` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-md">
            {previewLoading ? (
              <div className="p-8 text-center text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                Loading report…
              </div>
            ) : previewData && (previewData.columns?.length ?? 0) > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    {previewData.columns!.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap text-xs">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(previewData.rows ?? []).slice(0, 200).map((row, idx) => (
                    <TableRow key={idx}>
                      {previewData.columns!.map((col) => (
                        <TableCell key={col} className="text-xs max-w-[200px] truncate">
                          {row[col] ?? ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-gray-500">No data for this report and school year.</div>
            )}
          </div>
          {previewData && (previewData.rowCount ?? 0) > 200 && (
            <p className="text-xs text-gray-500">Showing first 200 rows. Export CSV for the full report.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
