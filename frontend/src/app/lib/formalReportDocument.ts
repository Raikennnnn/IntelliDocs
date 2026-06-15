import {
  DEFAULT_REPORT_LETTERHEAD,
  reportDisplayTitle,
  type ReportLetterhead,
} from './reportLetterhead';
import type { ReportGroup } from './reportGroupedLayout';

export type FormalReportDocumentInput = {
  title: string;
  schoolYearLabel?: string;
  columns: string[];
  rows: Array<Record<string, string>>;
  layout?: 'table' | 'grouped';
  groups?: ReportGroup[];
  generatedAt?: string;
  letterhead?: Partial<ReportLetterhead>;
  rowLimit?: number;
  groupLimit?: number;
};

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formalReportDocumentStyles(): string {
  return `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Times New Roman", Times, serif;
      color: #111;
      background: #e5e7eb;
    }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 16px;
      background: #fff;
      border-bottom: 1px solid #d1d5db;
      font-family: Segoe UI, Arial, sans-serif;
    }
    .toolbar h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
    }
    .toolbar p {
      margin: 2px 0 0;
      font-size: 12px;
      color: #6b7280;
    }
    .toolbar-actions { display: flex; gap: 8px; }
    .toolbar button {
      border: 1px solid #d1d5db;
      background: #fff;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 13px;
      cursor: pointer;
    }
    .toolbar button.primary {
      background: #8B1538;
      border-color: #8B1538;
      color: #fff;
    }
    .preview-stage {
      min-height: calc(100vh - 52px);
      padding: 24px 16px 40px;
      overflow: auto;
    }
    .paper {
      width: 100%;
      max-width: 8.5in;
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 8px 30px rgba(0,0,0,.18);
      padding: 0.65in 0.7in 0.75in;
    }
    .letterhead { text-align: center; }
    .letterhead img {
      width: 72px;
      height: 72px;
      object-fit: contain;
      margin: 0 auto 8px;
      display: block;
    }
    .letterhead .line {
      margin: 0;
      font-size: 12px;
      line-height: 1.35;
    }
    .letterhead .school {
      margin: 6px 0 2px;
      font-size: 15px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .letterhead .address {
      margin: 0;
      font-size: 11px;
    }
    .divider {
      margin: 14px 0 18px;
      border: none;
      border-top: 2px solid #1d4ed8;
      position: relative;
      height: 0;
    }
    .divider::before,
    .divider::after {
      content: "";
      position: absolute;
      top: -5px;
      width: 8px;
      height: 8px;
      background: #1d4ed8;
      transform: rotate(45deg);
    }
    .divider::before { left: 0; }
    .divider::after { right: 0; }
    .report-title {
      text-align: center;
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .report-subtitle {
      text-align: center;
      margin: 0 0 18px;
      font-size: 13px;
      font-weight: 600;
    }
    .report-meta {
      text-align: right;
      font-size: 10px;
      color: #4b5563;
      margin: -8px 0 12px;
    }
    table.report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    table.report-table th,
    table.report-table td {
      border: 1px solid #111;
      padding: 5px 7px;
      vertical-align: middle;
      text-align: center;
    }
    table.report-table th {
      font-weight: 700;
      background: #fff;
    }
    table.report-table td.text-left,
    table.report-table th.text-left {
      text-align: left;
    }
    .report-group {
      margin-bottom: 22px;
      break-inside: avoid;
    }
    .report-group-header {
      border: 1px solid #111;
      background: #f9fafb;
      padding: 7px 10px;
    }
    .report-group-title {
      margin: 0;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .report-group-subtitle {
      margin: 2px 0 0;
      font-size: 10px;
      color: #4b5563;
    }
    .report-group table.report-table {
      margin-top: 0;
    }
    .report-group table.report-table td.notes {
      text-align: left;
      font-size: 10px;
      line-height: 1.35;
      max-width: 260px;
    }
    .empty-note {
      text-align: center;
      padding: 48px 16px;
      font-size: 13px;
      color: #6b7280;
    }
    .signatories {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-top: 42px;
      font-size: 12px;
    }
    .signatory .label { margin: 0 0 28px; }
    .signatory .name {
      margin: 0;
      font-weight: 700;
      text-transform: uppercase;
      border-top: 1px solid #111;
      padding-top: 4px;
      display: inline-block;
      min-width: 220px;
    }
    .signatory .title {
      margin: 2px 0 0;
      font-size: 11px;
    }
    .footnote {
      margin-top: 18px;
      font-size: 10px;
      color: #6b7280;
      text-align: center;
      font-family: Segoe UI, Arial, sans-serif;
    }
    @media print {
      body { background: #fff; }
      .toolbar, .footnote { display: none !important; }
      .preview-stage { padding: 0; overflow: visible; }
      .paper {
        width: auto;
        max-width: none;
        margin: 0;
        box-shadow: none;
        padding: 0.5in 0.55in;
      }
    }
  `;
}

function buildTableHtml(columns: string[], rows: Array<Record<string, string>>, notesColumn = 'Notes'): string {
  const headCells = columns
    .map((col, i) => {
      const cls = i === 0 || col === notesColumn ? ' class="text-left"' : '';
      return `<th${cls}>${esc(col)}</th>`;
    })
    .join('');

  const bodyRows = rows
    .map((row) => {
      const cells = columns
        .map((col, i) => {
          const cls =
            i === 0 ? ' class="text-left"' : col === notesColumn ? ' class="notes"' : '';
          return `<td${cls}>${esc(String(row[col] ?? ''))}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<table class="report-table"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function buildGroupedHtml(groups: ReportGroup[], groupLimit?: number): string {
  const limited = groupLimit != null ? groups.slice(0, groupLimit) : groups;
  if (limited.length === 0) {
    return `<div class="empty-note">No data for this report and school year.</div>`;
  }

  return limited
    .map((group) => {
      const subtitle = group.subtitle?.trim()
        ? `<p class="report-group-subtitle">${esc(group.subtitle)}</p>`
        : '';
      const table =
        group.columns.length > 0 && group.rows.length > 0
          ? buildTableHtml(group.columns, group.rows)
          : `<p class="empty-note" style="padding:12px;margin:0;border:1px solid #111;border-top:none;">No entries.</p>`;
      return `<section class="report-group">
        <div class="report-group-header">
          <p class="report-group-title">${esc(group.title)}</p>
          ${subtitle}
        </div>
        ${table}
      </section>`;
    })
    .join('');
}

export function buildFormalReportDocumentHtml(input: FormalReportDocumentInput): string {
  const head = { ...DEFAULT_REPORT_LETTERHEAD, ...input.letterhead };
  const displayTitle = reportDisplayTitle(input.title);
  const schoolYear =
    input.schoolYearLabel?.trim() ||
    (input.title.includes(' — ') ? input.title.split(' — ').slice(1).join(' — ').trim() : '');
  const generatedAt = input.generatedAt ?? new Date().toLocaleString();
  const layout = input.layout ?? 'table';
  const groups = input.groups ?? [];
  const columns = input.columns ?? [];
  const rows = (input.rows ?? []).slice(0, input.rowLimit ?? 500);
  const isGrouped = layout === 'grouped' && groups.length > 0;

  const tableHtml = isGrouped
    ? buildGroupedHtml(groups, input.groupLimit)
    : columns.length > 0
      ? buildTableHtml(columns, rows)
      : `<div class="empty-note">No data for this report and school year.</div>`;

  const countLabel = isGrouped
    ? `${groups.length} student(s) · ${input.rows?.length ?? 0} line(s)`
    : `${rows.length} row(s)`;

  const rowNote =
    !isGrouped && input.rowLimit != null && (input.rows?.length ?? 0) > input.rowLimit
      ? `<p class="footnote">Showing first ${input.rowLimit} rows. Export CSV for the full report.</p>`
      : isGrouped && input.groupLimit != null && groups.length > input.groupLimit
        ? `<p class="footnote">Showing first ${input.groupLimit} students. Export CSV for the full report.</p>`
        : '';

  const logoHtml = head.schoolLogoUrl
    ? `<img src="${esc(head.schoolLogoUrl)}" alt="School logo" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(displayTitle)}</title>
  <style>${formalReportDocumentStyles()}</style>
</head>
<body>
  <div class="toolbar">
    <div>
      <h2>${esc(displayTitle)}</h2>
      <p>${esc(schoolYear)} · ${esc(countLabel)}</p>
    </div>
    <div class="toolbar-actions">
      <button type="button" class="primary" onclick="window.print()">Print / Save PDF</button>
      <button type="button" onclick="window.close()">Close</button>
    </div>
  </div>
  <div class="preview-stage">
    <article class="paper">
      <header class="letterhead">
        ${logoHtml}
        <p class="line">${esc(head.republicLine)}</p>
        <p class="school">${esc(head.schoolName)}</p>
        <p class="address">${esc(head.schoolAddress)}</p>
      </header>
      <hr class="divider" />
      <h1 class="report-title">${esc(displayTitle)}</h1>
      ${schoolYear ? `<p class="report-subtitle">${esc(schoolYear)}</p>` : ''}
      <p class="report-meta">Generated ${esc(generatedAt)}</p>
      ${tableHtml}
      <div class="signatories">
        <div class="signatory">
          <p class="label">Prepared by:</p>
          <p class="name">${esc(head.preparedBy.name)}</p>
          <p class="title">${esc(head.preparedBy.title)}</p>
          <p class="title">${esc(head.preparedBy.role)}</p>
        </div>
        <div class="signatory">
          <p class="label">Noted by:</p>
          <p class="name">${esc(head.notedBy.name)}</p>
          <p class="title">${esc(head.notedBy.title)}</p>
        </div>
      </div>
      ${rowNote}
    </article>
  </div>
</body>
</html>`;
}
