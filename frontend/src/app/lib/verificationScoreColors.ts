/**
 * Shared colors for verification / integrity percentages.
 * Matches registrar review tiers: <75% red, 75–89% orange, ≥90% green.
 */
import {
  concernPolicyTier,
  type ConcernPolicyTier,
} from "./concernScore";

export type VerificationScoreTier = "low" | "mid" | "high";

export function verificationScoreTier(pct: number): VerificationScoreTier {
  const n = Math.max(0, Math.min(100, Math.round(pct)));
  if (n >= 90) return "high";
  if (n >= 75) return "mid";
  return "low";
}

export function verificationScoreTextClass(pct: number): string {
  switch (verificationScoreTier(pct)) {
    case "high":
      return "text-green-600";
    case "mid":
      return "text-amber-600";
    default:
      return "text-red-600";
  }
}

/** Inline badge (e.g. "Passed · 78%") */
export function verificationScoreBadgeClasses(pct: number): string {
  switch (verificationScoreTier(pct)) {
    case "high":
      return "bg-emerald-100 text-emerald-800";
    case "mid":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-red-100 text-red-800";
  }
}

/** Card / panel background for score-based tiles (tamper, synthetic, etc.) */
export function verificationScoreSurfaceClasses(pct: number): string {
  switch (verificationScoreTier(pct)) {
    case "high":
      return "border-emerald-200 bg-emerald-50/80 text-emerald-950";
    case "mid":
      return "border-amber-200 bg-amber-50/80 text-amber-950";
    default:
      return "border-red-200 bg-red-50/80 text-red-950";
  }
}

/** Icon accent for pass/fail markers aligned to score tier */
export function verificationScoreIconClass(pct: number): string {
  switch (verificationScoreTier(pct)) {
    case "high":
      return "text-green-600";
    case "mid":
      return "text-amber-600";
    default:
      return "text-red-600";
  }
}

/** Concern % (0 = clean, higher = worse) — matches policy bands 0–10 / 11–25 / >25. */
function concernPolicyToScoreTier(tier: ConcernPolicyTier): VerificationScoreTier {
  switch (tier) {
    case "routine":
      return "high";
    case "manual":
      return "mid";
    default:
      return "low";
  }
}

export function concernScoreTier(pct: number): VerificationScoreTier {
  return concernPolicyToScoreTier(concernPolicyTier(pct));
}

export function concernScoreBadgeClasses(pct: number): string {
  switch (concernScoreTier(pct)) {
    case "high":
      return "bg-emerald-100 text-emerald-800";
    case "mid":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-red-100 text-red-800";
  }
}

export function concernScoreSurfaceClasses(pct: number): string {
  switch (concernScoreTier(pct)) {
    case "high":
      return "border-emerald-200 bg-emerald-50/80 text-emerald-950";
    case "mid":
      return "border-amber-200 bg-amber-50/80 text-amber-950";
    default:
      return "border-red-200 bg-red-50/80 text-red-950";
  }
}

export function concernScoreIconClass(pct: number): string {
  switch (concernScoreTier(pct)) {
    case "high":
      return "text-green-600";
    case "mid":
      return "text-amber-600";
    default:
      return "text-red-600";
  }
}

export function concernScoreTextClass(pct: number): string {
  return concernScoreIconClass(pct);
}
