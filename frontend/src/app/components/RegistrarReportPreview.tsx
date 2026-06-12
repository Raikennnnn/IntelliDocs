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
  const columns = data?.columns ?? [];
  const rows = (data?.rows ?? []).slice(0, PREVIEW_ROW_LIMIT);
  const generatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString()
    : new Date().toLocaleString();

  return (
    <div
      className={cn('fixed inset-0 z-[100] flex flex-col bg-gray-600/95 print:bg-white', className)}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} preview`}
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 print:hidden">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-gray-900 sm:text-lg">{title}</h2>
          <p className="text-xs text-gray-500 sm:text-sm">
            {schoolYear}
            {data?.rowCount != null ? ` · ${data.rowCount} row(s)` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-[#8B1538] hover:bg-[#6B1028]"
            disabled={loading || !data}
            onClick={onPrint}
          >
            <Printer className="mr-1.5 h-4 w-4" />
            Print / PDF
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            <X className="mr-1.5 h-4 w-4" />
            Close
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-6 sm:px-8 sm:py-8 print:bg-white print:p-0">
        {loading ? (
          <div className="flex h-full min-h-[40vh] items-center justify-center text-gray-200">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Loading report…
          </div>
        ) : (
          <article
            className="mx-auto w-full max-w-[8.5in] bg-white px-8 py-10 shadow-2xl sm:px-12 print:max-w-none print:shadow-none print:min-h-0"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            <header className="text-center">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt="School logo"
                  className="mx-auto mb-2 h-[72px] w-[72px] object-contain"
                />
              ) : null}
              <p className="m-0 text-xs leading-snug">{head.republicLine}</p>
              <p className="mt-1.5 text-[15px] font-bold uppercase tracking-wide">{head.schoolName}</p>
              <p className="mt-0.5 text-[11px]">{head.schoolAddress}</p>
            </header>

            <div className="relative my-4 h-0 border-t-2 border-blue-700">
              <span className="absolute -top-[5px] left-0 block h-2 w-2 rotate-45 bg-blue-700" />
              <span className="absolute -top-[5px] right-0 block h-2 w-2 rotate-45 bg-blue-700" />
            </div>

            <h1 className="text-center text-lg font-bold uppercase tracking-widest text-gray-900">
              {title}
            </h1>
            {schoolYear ? (
              <p className="mt-1 text-center text-[13px] font-semibold">{schoolYear}</p>
            ) : null}
            <p className="mb-4 mt-2 text-right text-[10px] text-gray-500">
              Generated {generatedAt}
            </p>

            {columns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr>
                      {columns.map((col, i) => (
                        <th
                          key={col}
                          className={cn(
                            'border border-black bg-white px-2 py-1.5 font-bold',
                            i === 0 ? 'text-left' : 'text-center',
                          )}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx}>
                        {columns.map((col, i) => (
                          <td
                            key={col}
                            className={cn(
                              'border border-black px-2 py-1.5 align-middle',
                              i === 0 ? 'text-left' : 'text-center',
                            )}
                          >
                            {row[col] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

            {data && (data.rowCount ?? 0) > PREVIEW_ROW_LIMIT ? (
              <p className="mt-4 text-center font-sans text-[10px] text-gray-500 print:hidden">
                Showing first {PREVIEW_ROW_LIMIT} rows. Export CSV for the full report.
              </p>
            ) : null}
          </article>
        )}
      </div>
    </div>
  );
}
