import { apiFetch } from './api';

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
  columns?: string[];
  rows?: Array<Record<string, string>>;
  rowCount?: number;
  schoolYearLabel?: string;
  summary?: Record<string, unknown>;
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

function buildPrintHtml(
  title: string,
  subtitle: string,
  columns: string[],
  rows: Array<Record<string, string>>,
): string {
  const esc = (v: string) =>
    v
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const head = columns.map((c) => `<th>${esc(c)}</th>`).join('');
  const body = rows
    .map((row) => {
      const cells = columns.map((c) => `<td>${esc(String(row[c] ?? ''))}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;margin:24px;color:#111}
h1{font-size:20px;margin:0 0 4px} p.meta{font-size:12px;color:#555;margin:0 0 16px}
table{width:100%;border-collapse:collapse;font-size:11px}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f3f4f6} @media print{body{margin:12px} button{display:none}}
</style></head><body>
<h1>${esc(title)}</h1>
<p class="meta">${esc(subtitle)} · Generated ${esc(new Date().toLocaleString())}</p>
<button type="button" onclick="window.print()">Print</button>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
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
  const columns = data.columns ?? [];
  const rows = data.rows ?? [];
  const html = buildPrintHtml(
    data.title ?? 'Report',
    data.schoolYearLabel ?? '',
    columns,
    rows,
  );
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
  if (!win) {
    throw new Error('Pop-up blocked. Allow pop-ups to print this report.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
