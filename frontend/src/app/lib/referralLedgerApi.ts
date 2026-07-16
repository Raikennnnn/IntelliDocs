import { apiFetch } from "./api";

export type ReferralLedgerStats = {
  total: number;
  preissued: number;
  freebieEligible: number;
  freebieGiven: number;
  incentiveEligible: number;
  incentivePaid: number;
  voided: number;
};

export type ReferralLedgerClaim = {
  id: number;
  schoolYear: string;
  controlNumber: string;
  enrollmentId: number | null;
  applicationId: string;
  referredStudentName: string;
  referrerName: string;
  referrerContactNumber: string;
  referrerEmail: string;
  referrerType: string;
  referrerTypeLabel: string;
  referredFreebieStatus: string;
  referredFreebieStatusLabel: string;
  referrerIncentiveStatus: string;
  referrerIncentiveStatusLabel: string;
  claimedAt: string;
  referrerNotifiedAt: string;
  firstSemesterCompletedAt: string;
  voidReason: string;
  isPreissued: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReferralLedgerListResponse = {
  success: boolean;
  schoolYear: string;
  claims: ReferralLedgerClaim[];
  stats: ReferralLedgerStats;
  matched: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
  error?: string;
};

export type ReferralLedgerAction =
  | "preissue"
  | "mark_freebie_given"
  | "mark_first_semester_complete"
  | "mark_incentive_paid"
  | "void"
  | "resend_referrer_enrolled_email";

type ReferralLedgerActionResponse = {
  success: boolean;
  message?: string;
  error?: string;
  claim?: ReferralLedgerClaim;
  controlNumbers?: string[];
};

export const REFERRAL_PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

async function parseReferralJson<T extends { success?: boolean; error?: string }>(
  res: Response,
  fallbackError: string,
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error("Empty response from server. Please refresh and try again.");
  }
  let json: T;
  try {
    json = JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid response from server. Please refresh and try again.");
  }
  if (!res.ok || json.success === false) {
    throw new Error(json.error || fallbackError);
  }
  return json;
}

export async function fetchReferralLedger(params: {
  schoolYear?: string;
  search?: string;
  freebieStatus?: string;
  incentiveStatus?: string;
  limit?: number;
  page?: number;
}): Promise<ReferralLedgerListResponse> {
  const qs = new URLSearchParams();
  if (params.schoolYear) qs.set("school_year", params.schoolYear);
  if (params.search) qs.set("search", params.search);
  if (params.freebieStatus) qs.set("freebie_status", params.freebieStatus);
  if (params.incentiveStatus) qs.set("incentive_status", params.incentiveStatus);
  qs.set("limit", String(params.limit ?? 50));
  qs.set("page", String(params.page ?? 1));

  const res = await apiFetch(`/api/registrar/referral-ledger?${qs.toString()}`);
  return parseReferralJson<ReferralLedgerListResponse>(res, "Failed to load referral ledger");
}

export async function postReferralLedgerAction(
  action: ReferralLedgerAction,
  body: Record<string, unknown>,
): Promise<ReferralLedgerActionResponse> {
  const res = await apiFetch(`/api/registrar/referral-ledger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  return parseReferralJson<ReferralLedgerActionResponse>(res, "Referral ledger action failed");
}
