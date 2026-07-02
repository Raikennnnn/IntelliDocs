import { apiFetch } from "./api";

export type ActivityLogType =
  | "login"
  | "upload"
  | "approval"
  | "rejection"
  | "user_management"
  | "system_config"
  | "security"
  | "view"
  | "remark"
  | "registration"
  | "other";

export type ActivityLogEntry = {
  id: string;
  action: string;
  description: string;
  user: string;
  role: string;
  ipAddress: string;
  timestamp: string;
  timestampLabel: string;
  type: ActivityLogType;
  relatedTo?: string | null;
  status?: string;
};

export type ActivityLogStats = {
  totalActions: number;
  logins: number;
  uploads: number;
  approvals: number;
  rejections: number;
  security: number;
  registrations?: number;
  remarks?: number;
  views?: number;
};

export type ActivityLogsResponse = {
  success: boolean;
  logs?: ActivityLogEntry[];
  total?: number;
  stats?: ActivityLogStats;
  error?: string;
  message?: string;
};

export async function fetchActivityLogs(
  scope: "admin" | "registrar",
  params: {
    search?: string;
    type?: string;
    range?: string;
    limit?: number;
  } = {},
): Promise<ActivityLogsResponse> {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.type && params.type !== "all") qs.set("type", params.type);
  if (params.range) qs.set("range", params.range);
  qs.set("limit", String(params.limit ?? 100));

  const res = await apiFetch(`/api/${scope}/activity-logs?${qs.toString()}`);
  const json = (await res.json()) as ActivityLogsResponse;
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Could not load activity logs. Please try again.');
  }
  return json;
}
