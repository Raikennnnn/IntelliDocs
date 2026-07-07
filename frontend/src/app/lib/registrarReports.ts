import * as XLSX from 'xlsx';
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

function reportUrl(report: RegistrarReportType, schoolYear: string): string {
  const params = new URLSearchParams({
    report,
    format: 'json',
    school_year: schoolYear,
  });
  return `/api/registrar/reports?${params.toString()}`;
}

function exportFilename(hint: string, extension: 'xlsx'): string {
  const safe = hint.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_|_$/g, '') || 'report';
  return `${safe}_${new Date().toISOString().slice(0, 10)}.${extension}`;
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

/** Print HTML in a hidden iframe — avoids pop-up blockers. */
function printHtmlInFrame(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Report print');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 500);
  };

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument ?? win?.document;
  if (!win || !doc) {
    iframe.remove();
    throw new Error('Could not open the print view. Please try again.');
  }

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    win.focus();
    win.print();
    cleanup();
  };

  if (doc.readyState === 'complete') {
    window.setTimeout(triggerPrint, 150);
  } else {
    iframe.addEventListener('load', () => window.setTimeout(triggerPrint, 150), { once: true });
  }
}

export async function fetchRegistrarReport(
  report: RegistrarReportType,
  schoolYear: string,
): Promise<RegistrarReportJson> {
  const res = await apiFetch(reportUrl(report, schoolYear));
  const text = await res.text();
  let json: RegistrarReportJson = {};
  try {
    json = JSON.parse(text) as RegistrarReportJson;
  } catch {
    throw new Error('Could not load report. Please try again.');
  }
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Could not load report. Please try again.');
  }
  return json;
}

export async function downloadRegistrarReportExcel(
  report: RegistrarReportType,
  schoolYear: string,
  filenameHint: string,
): Promise<void> {
  const data = await fetchRegistrarReport(report, schoolYear);
  const columns = data.columns ?? [];
  const rows = data.rows ?? [];

  const sheetRows: string[][] =
    columns.length > 0
      ? [columns, ...rows.map((row) => columns.map((col) => String(row[col] ?? '')))]
      : [['Message'], ['No data for this report and school year.']];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  const sheetName = (data.title ?? 'Report').slice(0, 31).replace(/[\\/?*[\]]/g, '');
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Report');
  XLSX.writeFile(workbook, exportFilename(filenameHint, 'xlsx'));
}

export async function printRegistrarReport(
  report: RegistrarReportType,
  schoolYear: string,
): Promise<void> {
  const data = await fetchRegistrarReport(report, schoolYear);
  printHtmlInFrame(buildPrintHtml(data));
}

/** Print report using the same formal document layout as the direct Print / PDF action. */
export function printRegistrarReportFromData(data: RegistrarReportJson): void {
  printHtmlInFrame(buildPrintHtml(data));
}

/** @deprecated Prefer printRegistrarReportFromData for WYSIWYG with preview. */
export function printRegistrarReportPreview(): void {
  window.print();
}
