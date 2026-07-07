import { cn } from '../components/ui/utils';

export type ReportGroup = {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: Array<Record<string, string>>;
};

type ReportGroupedSectionsProps = {
  groups: ReportGroup[];
  className?: string;
  notesColumn?: string;
};

export function ReportGroupedSections({
  groups,
  className,
  notesColumn = 'Notes',
}: ReportGroupedSectionsProps) {
  if (groups.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-gray-500">
        No data for this report and school year.
      </p>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {groups.map((group, gi) => (
        <section key={`${group.title}-${gi}`} className="break-inside-avoid">
          <div className="border border-black bg-gray-50 px-3 py-2">
            <p className="text-[12px] font-bold uppercase tracking-wide text-gray-900">
              {group.title}
            </p>
            {group.subtitle ? (
              <p className="mt-0.5 text-[10px] text-gray-600">{group.subtitle}</p>
            ) : null}
          </div>
          {group.columns.length > 0 && group.rows.length > 0 ? (
            <div className="w-full">
              <table className="w-full table-fixed border-collapse text-[10px] leading-snug sm:text-[11px]">
              <thead>
                <tr>
                  {group.columns.map((col, i) => (
                    <th
                      key={col}
                      className={cn(
                        'break-words border border-black bg-white px-1.5 py-1.5 font-bold sm:px-2',
                        i === 0 ? 'text-left' : 'text-center',
                        col === notesColumn ? 'text-left' : '',
                      )}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, idx) => (
                  <tr key={idx}>
                    {group.columns.map((col, i) => (
                      <td
                        key={col}
                        className={cn(
                          'break-words border border-black px-1.5 py-1.5 align-top sm:px-2',
                          i === 0 ? 'text-left font-medium' : 'text-center',
                          col === notesColumn ? 'text-left text-[10px] leading-snug' : '',
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
            <p className="border border-t-0 border-black px-3 py-2 text-[10px] text-gray-500">
              No entries.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
