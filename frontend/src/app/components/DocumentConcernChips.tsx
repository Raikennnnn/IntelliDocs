import { cn } from "./ui/utils";
import { concernScoreBadgeClasses, concernScoreTextClass } from "../lib/verificationScoreColors";

type DocumentConcernChipsProps = {
  concernPct: number | null;
  mismatchPct?: number | null;
  tamperPct?: number | null;
  /** 2×2 photos use AI authenticity only — no enrollment mismatch (MM). */
  photoOnly?: boolean;
  size?: "sm" | "md";
  className?: string;
};

function Chip({
  label,
  value,
  size,
}: {
  label: string;
  value: number;
  size: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-gray-200/80 bg-white/90 tabular-nums",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
      )}
      title={`${label}: ${value}% concern (0% = clean)`}
    >
      <span className="font-medium text-gray-500">{label}</span>
      <span className={cn("font-semibold", concernScoreTextClass(value))}>{value}%</span>
    </span>
  );
}

export function DocumentConcernChips({
  concernPct,
  mismatchPct,
  tamperPct,
  photoOnly = false,
  size = "sm",
  className,
}: DocumentConcernChipsProps) {
  if (concernPct === null) return null;

  const showDocumentParts =
    !photoOnly && typeof mismatchPct === "number" && typeof tamperPct === "number";
  const showPhotoAi = photoOnly && typeof tamperPct === "number";

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md font-semibold tabular-nums",
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
          concernScoreBadgeClasses(concernPct),
        )}
        title={
          photoOnly
            ? "Average concern from image quality (at upload) and AI authenticity"
            : "Average of mismatch and tamper concern"
        }
      >
        <span className="font-medium opacity-80">Avg</span>
        {concernPct}%
      </span>
      {showDocumentParts ? (
        <>
          <Chip label="MM" value={mismatchPct} size={size} />
          <Chip label="T" value={tamperPct} size={size} />
        </>
      ) : null}
      {showPhotoAi ? (
        <Chip label="AI" value={tamperPct} size={size} />
      ) : null}
    </div>
  );
}
