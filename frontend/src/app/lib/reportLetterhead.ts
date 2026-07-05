/** Institution letterhead shown on registrar report previews and printouts. */
export type ReportLetterhead = {
  /** Optional school logo — not DepEd / government seals. */
  schoolLogoUrl?: string;
  republicLine: string;
  schoolName: string;
  schoolAddress: string;
  preparedBy: {
    name: string;
    title: string;
    role: string;
  };
  notedBy: {
    name: string;
    title: string;
  };
};

export const DEFAULT_REPORT_LETTERHEAD: ReportLetterhead = {
  schoolLogoUrl: '/report-assets/school-logo.png',
  republicLine: 'Republic of the Philippines',
  schoolName: 'Nuestra Señora De Guia Academy of Marikina – Main',
  schoolAddress:
    '96 Soliven St., Greenheights Subd., Ph. 3, Nangka, Marikina City, Philippines',
  preparedBy: {
    name: 'REGISTRAR OFFICE',
    title: 'Registrar',
    role: 'NSDGA Report Coordinator',
  },
  notedBy: {
    name: 'SCHOOL HEAD',
    title: 'School Head',
  },
};

/** Strip trailing school-year suffix from API report titles. */
export function reportDisplayTitle(rawTitle: string): string {
  const t = rawTitle.trim();
  const idx = t.indexOf(' — ');
  return idx > 0 ? t.slice(0, idx).trim() : t;
}
