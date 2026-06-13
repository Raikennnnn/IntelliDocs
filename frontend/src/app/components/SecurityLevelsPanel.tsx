import { CheckCircle, XCircle, MinusCircle } from "lucide-react";
import { displayLevelSummary, levelConcernPercent } from "../lib/concernScore";
import {
  concernScoreBadgeClasses,
  concernScoreIconClass,
  concernScoreSurfaceClasses,
} from "../lib/verificationScoreColors";
import { cn } from "./ui/utils";

export type SecurityLevel = {
  level: number;
  title: string;
  pass: boolean;
  score: number;
  summary: string;
  issues?: string[];
};

export type SecurityLevels = {
  levels: SecurityLevel[];
  overall_pass: boolean;
  /** 0 = all clear; increases when a verification stage fails (1 = mismatch, 2 = tamper, …). */
  alert_level?: number;
  highest_level_passed: number;
  quality_enforced_at_upload?: boolean;
  /** 2×2 ID photos: image quality + AI tamper only (no enrollment mismatch). */
  photo_only_checks?: boolean;
};

type SecurityLevelsPanelProps = {
  security?: SecurityLevels | null;
  compact?: boolean;
  className?: string;
};

/** Image quality is enforced at upload — hide Level 1 unless this is a photo-only verification still showing quality. */
function verificationLevels(levels: SecurityLevel[], security?: SecurityLevels | null): SecurityLevel[] {
  if (security?.photo_only_checks) {
    if (security?.quality_enforced_at_upload !== false) {
      return levels.filter((lv) => !/image quality/i.test(lv.title));
    }
    return levels;
  }
  return levels.filter((lv) => !/image quality/i.test(lv.title));
}

function resolveAlertLevel(security: SecurityLevels | null | undefined, levels: SecurityLevel[]): number {
  if (typeof security?.alert_level === "number") {
    return Math.max(0, Math.min(levels.length, security.alert_level));
  }
  if (!levels.length) return 0;
  if (security?.overall_pass) return 0;
  let alert = 0;
  for (let i = 0; i < levels.length; i += 1) {
    if (!levels[i].pass) alert = i + 1;
  }
  return alert;
}

function displayLevelTitle(title: string, compact?: boolean): string {
  if (compact) {
    if (/image quality/i.test(title)) return "Quality";
    if (/ai tamper|authenticity/i.test(title)) return "AI check";
    if (/mismatch|enrollment.*match|document.*match/i.test(title)) return "Mismatch (MM)";
    if (/tamper|integrity/i.test(title)) return "Tamper (T)";
  }
  return title
    .replace(/Document & enrollment match/i, "Mismatch (MM)")
    .replace(/Document & enrollment mismatch/i, "Mismatch (MM)")
    .replace(/Tamper \/ integrity/i, "Tamper (T)")
    .replace(/Tamper check/i, "Tamper (T)");
}

export function SecurityLevelsPanel({ security, compact, className }: SecurityLevelsPanelProps) {
  const levels = security?.levels?.length ? verificationLevels(security.levels, security) : [];
  const photoOnly = security?.photo_only_checks === true;

  if (!levels.length) {
    return (
      <p className={cn("text-sm text-gray-500", className)}>
        {photoOnly
          ? "Verification levels will appear after AI runs (image quality → AI tamper check)."
          : "Verification levels will appear after AI runs (mismatch check → tamper check)."}
      </p>
    );
  }

  const totalLevels = levels.length;
  const uploadPreChecked =
    !photoOnly &&
    (security?.quality_enforced_at_upload !== false ||
      (security?.levels?.length ?? 0) > levels.length);
  const alertLevel = resolveAlertLevel(security, levels);

  const alertFooter = (() => {
    if (alertLevel === 0) {
      return uploadPreChecked
        ? "Security level: 0 — no issues detected (image quality checked at upload)."
        : "Security level: 0 — no issues detected.";
    }
    if (photoOnly) {
      if (alertLevel === 1) {
        return "Security level: 1 — image quality concern detected.";
      }
      return "Security level: 2 — AI tamper or synthetic-image concern detected.";
    }
    if (alertLevel === 1) {
      const mismatchOnly =
        levels.length >= 2 && levels[0] && !levels[0].pass && levels[1]?.pass;
      if (mismatchOnly) {
        return "Security level: 1 — document or enrollment mismatch detected.";
      }
      return "Security level: 1 — verification issue detected.";
    }
    if (alertLevel >= totalLevels) {
      return "Security level: 2 — tamper or integrity concern detected.";
    }
    return `Security level: ${alertLevel} — review required before approval.`;
  })();

  return (
    <div className={cn("space-y-2", className)}>
      {levels.map((lv) => {
        const concernPct = levelConcernPercent(lv);
        return (
        <div
          key={`${lv.level}-${lv.title}`}
          className={cn(
            "rounded-lg border px-3 py-2.5",
            concernScoreSurfaceClasses(concernPct),
            compact && "py-2",
          )}
        >
          <div className="flex items-start gap-2">
            {concernPct <= 0 ? (
              <CheckCircle
                className={cn("mt-0.5 h-4 w-4 shrink-0", concernScoreIconClass(concernPct))}
                aria-hidden
              />
            ) : (
              <XCircle
                className={cn("mt-0.5 h-4 w-4 shrink-0", concernScoreIconClass(concernPct))}
                aria-hidden
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Level {lv.level}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {displayLevelTitle(lv.title, compact)}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                    concernScoreBadgeClasses(concernPct),
                  )}
                >
                  {concernPct}%
                </span>
              </div>
              {!compact ? (
                <p className="mt-1 text-sm leading-snug text-gray-700">
                  {displayLevelSummary(lv, concernPct)}
                </p>
              ) : (
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-gray-600">
                  {displayLevelSummary(lv, concernPct)}
                </p>
              )}
              {!compact && lv.issues && lv.issues.length > 0 ? (
                <ul className="mt-1.5 list-inside list-disc text-xs text-gray-600">
                  {lv.issues.slice(0, 6).map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      );
      })}
      {!compact ? (
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <MinusCircle className="h-3.5 w-3.5" aria-hidden />
          {alertFooter}
        </p>
      ) : null}
    </div>
  );
}
