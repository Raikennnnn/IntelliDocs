import { useEffect } from 'react';
import { X, Printer, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import schoolLogo from '../../assets/logo.png';
import {
  DEFAULT_REPORT_LETTERHEAD,
  reportDisplayTitle,
  type ReportLetterhead,
} from '../lib/reportLetterhead';
import type { RegistrarReportJson } from '../lib/registrarReports';
import { ReportGroupedSections } from '../lib/reportGroupedLayout';
import { ReportResponsiveTable } from '../lib/reportResponsiveTable';

type RegistrarReportPreviewProps = {
  open: boolean;
  loading: boolean;
  data: RegistrarReportJson | null;
  onClose: () => void;
  onPrint?: () => void;
  letterhead?: Partial<ReportLetterhead>;
  className?: string;
};

const PREVIEW_ROW_LIMIT = 200;
const PREVIEW_GROUP_LIMIT = 100;

export function RegistrarReportPreview({
  open,
  loading,
  data,
  onClose,
  onPrint,
  letterhead,
  className,
}: RegistrarReportPreviewProps) {
  const head = { ...DEFAULT_REPORT_LETTERHEAD, ...letterhead };
  const logoSrc = head.schoolLogoUrl ?? schoolLogo;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const title = data?.title ? reportDisplayTitle(data.title) : 'Report preview';
  const schoolYear = data?.schoolYearLabel ?? '';
  const isGrouped = data?.layout === 'grouped' && (data?.groups?.length ?? 0) > 0;
  const groups = (data?.groups ?? []).slice(0, PREVIEW_GROUP_LIMIT);
  const columns = data?.columns ?? [];
  const rows = (data?.rows ?? []).slice(0, PREVIEW_ROW_LIMIT);
  const generatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString()
    : new Date().toLocaleString();
  const countLabel = isGrouped
    ? `${data?.groupCount ?? groups.length} student(s) · ${data?.rowCount ?? rows.length} document line(s)`
    : data?.rowCount != null
      ? `${data.rowCount} row(s)`
      : '';

  return (
    <div
      className={cn('fixed inset-0 z-[100] flex flex-col bg-gray-600/95 print:bg-white', className)}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} preview`}
    >
      <header className="flex shrink-0 flex-col gap-3 border-b border-gray-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 print:hidden">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-tight text-gray-900 sm:text-lg">{title}</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-gray-500 sm:text-sm">
            <span className="block sm:inline">{schoolYear}</span>
            {countLabel ? (
              <span className="block sm:inline sm:before:content-['·_'] sm:before:mx-1">{countLabel}</span>
            ) : null}
          </p>
        </div>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <Button
            type="button"
            size="sm"
            className="flex-1 bg-[#8B1538] hover:bg-[#6B1028] sm:flex-none"
            disabled={loading || !data}
            onClick={onPrint}
          >
            <Printer className="h-4 w-4 sm:mr-1.5" />
            Print / PDF
          </Button>
          <Button type="button" size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={onClose}>
            <X className="h-4 w-4 sm:mr-1.5" />
            Close
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-2 py-4 sm:px-6 sm:py-8 print:bg-white print:p-0">
        {loading ? (
          <div className="flex h-full min-h-[40vh] items-center justify-center text-gray-200">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Loading report…
          </div>
        ) : (
          <article
            className="mx-auto w-full max-w-[8.5in] bg-white px-4 py-6 shadow-2xl sm:px-8 sm:py-10 md:px-12 print:max-w-none print:min-h-0 print:shadow-none"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            <header className="text-center">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt="School logo"
                  className="mx-auto mb-2 h-14 w-14 object-contain sm:h-[72px] sm:w-[72px]"
                />
              ) : null}
              <p className="m-0 text-[10px] leading-snug sm:text-xs">{head.republicLine}</p>
              <p className="mt-1.5 text-sm font-bold uppercase tracking-wide sm:text-[15px]">{head.schoolName}</p>
              <p className="mt-0.5 text-[10px] sm:text-[11px]">{head.schoolAddress}</p>
            </header>

            <div className="relative my-4 h-0 border-t-2 border-blue-700">
              <span className="absolute -top-[5px] left-0 block h-2 w-2 rotate-45 bg-blue-700" />
              <span className="absolute -top-[5px] right-0 block h-2 w-2 rotate-45 bg-blue-700" />
            </div>

            <h1 className="text-center text-base font-bold uppercase tracking-wide text-gray-900 sm:text-lg sm:tracking-widest">
              {title}
            </h1>
            {schoolYear ? (
              <p className="mt-1 text-center text-[13px] font-semibold">{schoolYear}</p>
            ) : null}
            <p className="mb-4 mt-2 text-right text-[10px] text-gray-500">
              Generated {generatedAt}
            </p>

            {isGrouped ? (
              <ReportGroupedSections groups={groups} />
            ) : columns.length > 0 ? (
              <ReportResponsiveTable columns={columns} rows={rows} />
            ) : (
              <p className="py-16 text-center text-sm text-gray-500">
                No data for this report and school year.
              </p>
            )}

            <div className="mt-10 grid grid-cols-1 gap-8 text-xs sm:grid-cols-2 sm:gap-12">
              <div>
                <p className="mb-7">Prepared by:</p>
                <p className="inline-block min-w-[220px] border-t border-black pt-1 text-sm font-bold uppercase">
                  {head.preparedBy.name}
                </p>
                <p className="mt-0.5 text-[11px]">{head.preparedBy.title}</p>
                <p className="text-[11px]">{head.preparedBy.role}</p>
              </div>
              <div>
                <p className="mb-7">Noted by:</p>
                <p className="inline-block min-w-[220px] border-t border-black pt-1 text-sm font-bold uppercase">
                  {head.notedBy.name}
                </p>
                <p className="mt-0.5 text-[11px]">{head.notedBy.title}</p>
              </div>
            </div>

            {data && isGrouped && (data.groupCount ?? 0) > PREVIEW_GROUP_LIMIT ? (
              <p className="mt-4 text-center font-sans text-[10px] text-gray-500 print:hidden">
                Showing first {PREVIEW_GROUP_LIMIT} students. Export Excel for the full report.
              </p>
            ) : null}
            {data && !isGrouped && (data.rowCount ?? 0) > PREVIEW_ROW_LIMIT ? (
              <p className="mt-4 text-center font-sans text-[10px] text-gray-500 print:hidden">
                Showing first {PREVIEW_ROW_LIMIT} rows. Export Excel for the full report.
              </p>
            ) : null}
          </article>
        )}
      </div>
    </div>
  );
}
