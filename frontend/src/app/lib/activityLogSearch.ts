/** Client-side filter for loaded activity / security log rows (max ~100). */
function normalizeLogSearchText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function matchesLogSearch(
  search: string,
  parts: Array<string | number | null | undefined>,
): boolean {
  const q = normalizeLogSearchText(search);
  if (!q) return true;
  const haystack = normalizeLogSearchText(
    parts.map((part) => String(part ?? "").trim()).filter(Boolean).join(" "),
  );
  const terms = q.split(" ").filter(Boolean);
  return terms.every((term) => haystack.includes(term));
}

export type SecurityLogRow = {
  user: string;
  user_id: number | null;
  action: string;
  module: string;
  status: string;
  ip_address: string;
  timestamp: string;
};

export function filterSecurityLogs<T extends SecurityLogRow>(logs: T[], search: string): T[] {
  const q = search.trim();
  if (!q) return logs;
  return logs.filter((log) =>
    matchesLogSearch(q, [
      log.user,
      log.user_id,
      log.action,
      log.module,
      log.status,
      log.ip_address,
      log.timestamp,
    ]),
  );
}

export type ActivityLogRow = {
  action: string;
  description: string;
  user: string;
  role: string;
  ipAddress: string;
  timestamp: string;
  timestampLabel: string;
  relatedTo?: string | null;
  rawAction?: string;
  status?: string;
};

export function filterActivityTimelineLogs<T extends ActivityLogRow>(
  logs: T[],
  search: string,
): T[] {
  const q = search.trim();
  if (!q) return logs;
  return logs.filter((log) =>
    matchesLogSearch(q, [
      log.action,
      log.description,
      log.user,
      log.role,
      log.ipAddress,
      log.timestamp,
      log.timestampLabel,
      log.relatedTo,
      log.rawAction,
      log.status,
    ]),
  );
}
