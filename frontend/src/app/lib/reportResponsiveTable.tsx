import { cn } from '../components/ui/utils';

type ReportResponsiveTableProps = {
  columns: string[];
  rows: Array<Record<string, string>>;
  className?: string;
};

export function ReportResponsiveTable({ columns, rows, className }: ReportResponsiveTableProps) {
  if (columns.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-gray-500">
        No data for this report and school year.
      </p>
    );
  }

  const primaryCol = columns[0] ?? 'Student';

  return (
    <div className={className}>
      {/* Phone / small tablet: one card per row */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No rows to display.</p>
        ) : (
          rows.map((row, idx) => (
            <div
              key={idx}
              className="rounded-md border border-black bg-white p-3 text-[11px] shadow-sm"
            >
              <p className="border-b border-gray-200 pb-2 text-[12px] font-bold uppercase tracking-wide text-gray-900">
                {row[primaryCol] ?? '—'}
              </p>
              <dl className="mt-2 space-y-1.5">
                {columns.slice(1).map((col) => (
                  <div key={col} className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-gray-600">{col}</dt>
                    <dd className="text-right font-medium text-gray-900">{row[col] ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))
        )}
      </div>

      {/* Tablet / desktop: horizontal table with scroll on narrow widths */}
      <div className="-mx-1 hidden overflow-x-auto px-1 md:block">
        <table className="w-full min-w-[640px] border-collapse text-[11px]">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={col}
                  className={cn(
                    'whitespace-nowrap border border-black bg-white px-2 py-1.5 font-bold',
                    i === 0 ? 'sticky left-0 z-[1] text-left' : 'text-center',
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
                      'whitespace-nowrap border border-black px-2 py-1.5 align-middle',
                      i === 0 ? 'sticky left-0 z-[1] bg-white text-left font-medium' : 'text-center',
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
    </div>
  );
}
