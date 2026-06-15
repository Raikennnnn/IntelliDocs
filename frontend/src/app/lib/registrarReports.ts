import { apiFetch } from './api';
import { buildFormalReportDocumentHtml } from './formalReportDocument';
import type { ReportGroup } from './reportGroupedLayout';

export type RegistrarReportType =
  | 'applicants'
  | 'enrollment_summary'
  | 'document_verification'
  | 'approval_records'
  | 'rejection_records'
  | 'anomaly_summary'
  | 'section_masterlist'
  | 'quota_summary'
  | 'document_completion'
  | 'monitoring_summary';

export type RegistrarReportJson = {
  success?: boolean;
  title?: string;
  layout?: 'table' | 'grouped';
  columns?: string[];
  rows?: Array<Record<string, string>>;
  groups?: ReportGroup[];
  rowCount?: number;
  groupCount?: number;
  schoolYearLabel?: string;
  summary?: Record<string, unknown>;
  generatedAt?: string;
  filters?: {
    school_year_options?: string[];
    enrollment_school_year_current?: string | null;
  };
  error?: string;
};

function reportUrl(
  report: RegistrarReportType,
  schoolYear: string,
  format: 'json' | 'csv' | 'print',
): string {
  const params = new URLSearchParams({
    report,
    format,
    school_year: schoolYear,
  });
  return `/api/registrar/reports?${params.toString()}`;
}

function buildPrintHtml(data: RegistrarReportJson): string {
  return buildFormalReportDocumentHtml({
    title: data.title ?? 'Report',
    schoolYearLabel: data.schoolYearLabel ?? '',
    layout: data.layout,
    groups: data.groups,
    columns: data.columns ?? [],
    rows: data.rows ?? [],
    generatedAt: data.generatedAt
      ? new Date(data.generatedAt).toLocaleString()
      : undefined,
  });
}

export async function fetchRegistrarReport(
  report: RegistrarReportType,
  schoolYear: string,
): Promise<RegistrarReportJson> {
  const res = await apiFetch(reportUrl(report, schoolYear, 'json'));
  const text = await res.text();
  let json: RegistrarReportJson = {};
  try {
    json = JSON.parse(text) as RegistrarReportJson;
  } catch {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 160);
    throw new Error(
      snippet
        ? `Server returned an invalid report response: ${snippet}`
        : 'Server returned an invalid report response',
    );
  }
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Failed to load report (${res.status})`);
  }
  return json;
}

export async function downloadRegistrarReportCsv(
  report: RegistrarReportType,
  schoolYear: string,
  filenameHint: string,
): Promise<void> {
  const res = await apiFetch(reportUrl(report, schoolYear, 'csv'));
  if (!res.ok) {
    const text = await res.text();
    let json: { error?: string } = {};
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    throw new Error(json.error || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameHint}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function printRegistrarReport(
  report: RegistrarReportType,
  schoolYear: string,
): Promise<void> {
  const data = await fetchRegistrarReport(report, schoolYear);
  const html = buildPrintHtml(data);
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
  if (!win) {
    throw new Error('Pop-up blocked. Allow pop-ups to print this report.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
