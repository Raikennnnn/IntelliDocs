import { Info } from "lucide-react";

import { cn } from "./ui/utils";

type ConcernComputationNoteProps = {
  mismatchPct: number;
  tamperPct: number;
  averagePct: number;
  className?: string;
};

/** One-line formula: how this file's avg concern was derived. */
export function DocumentConcernFormula({
  mismatchPct,
  tamperPct,
  averagePct,
  className,
}: ConcernComputationNoteProps) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] leading-snug text-gray-500 tabular-nums",
        className,
      )}
      title="Document score = average of mismatch (MM) and tamper (T) concern. 0% = clean."
    >
      Avg {averagePct}% = (MM {mismatchPct}% + T {tamperPct}%) ÷ 2
    </p>
  );
}

/** Collapsible note for the Documents tab toolbar. */
export function ConcernScoringHelp({ className }: { className?: string }) {
  return (
    <details className={cn("group text-xs text-gray-600", className)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium text-gray-700 marker:content-none hover:text-[#8B1538] [&::-webkit-details-marker]:hidden">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        How scores are computed
      </summary>
      <div className="mt-2 max-w-xl rounded-md border border-gray-200 bg-gray-50/90 px-3 py-2 leading-relaxed">
        <p>
          <strong className="font-medium text-gray-800">Per file:</strong>{" "}
          <span className="font-mono tabular-nums">Avg = (MM + T) ÷ 2</span>
        </p>
        <p className="mt-1">
          <strong className="font-medium text-gray-800">MM</strong> — enrollment form vs document
          (name, PSA fields, school record).{" "}
          <strong className="font-medium text-gray-800">T</strong> — edit / tamper signals on the
          scan.
        </p>
        <p className="mt-1 text-gray-500">
          0% = no concern · higher % = more to review. Image quality is checked at upload only.
        </p>
      </div>
    </details>
  );
}
