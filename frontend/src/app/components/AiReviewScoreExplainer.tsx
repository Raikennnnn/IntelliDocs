import { ChevronDown } from "lucide-react";

import { cn } from "./ui/utils";

import type { SecurityLevels } from "./SecurityLevelsPanel";

import {
  verificationCategoryLabel,
  type WeightedCategoryRow,
} from "../lib/documentVerificationWeights";
import {
  CONCERN_MANUAL_THRESHOLD,
  CONCERN_STRICT_THRESHOLD,
  documentConcernFromAi,
} from "../lib/concernScore";
import {
  concernScoreBadgeClasses,
  concernScoreSurfaceClasses,
  concernScoreTextClass,
} from "../lib/verificationScoreColors";

type AiResultForExplainer = {
  status?: string;
  confidence?: number;
  ocr_confidence?: number;
  tamper_score?: number;
  doc_checks?: Array<{ field: string; ok: boolean }>;
  field_checks?: Array<{ field: string; ok: boolean }>;
  issues?: string[];
  security_levels?: SecurityLevels;
};

export type DocScoreRow = {
  id: string;
  label: string;
  pct: number;
  mismatchPct: number;
  tamperPct: number;
  reasons: string[];
  fromAi: boolean;
  weightPct?: number;
  contribution?: number;
};

export type OverallScoreBreakdown = {
  aggregateScore: number;
  rows: DocScoreRow[];
  categoryRows: WeightedCategoryRow[];
  aiRunning: boolean;
  totalDocuments: number;
  scoredDocuments: number;
};

function docDisplayLabel(d: {
  requirementLabel?: string;
  fileName?: string;
  name?: string;
}): string {
  const raw = String(d.requirementLabel || d.fileName || d.name || "Document")
    .replace(/\s+/g, " ")
    .trim();
  return raw.length > 36 ? `${raw.slice(0, 34)}…` : raw;
}

function plainReasonsForDoc(ai: AiResultForExplainer | undefined, concernPct: number): string[] {
  if (!ai) return ["AI has not finished checking this file yet."];

  const reasons: string[] = [];
  const parts = documentConcernFromAi(ai);
  const levels = ai.security_levels?.levels;

  if (levels?.length) {
    const matchLevel =
      levels.find((l) => /document.*(match|mismatch)|enrollment (match|mismatch)/i.test(l.title)) ??
      levels.find((l) => l.level === 1);
    const integrityLevel =
      levels.find((l) => /tamper|integrity/i.test(l.title)) ??
      levels.find((l) => l.level === 2);

    if (matchLevel && !matchLevel.pass) {
      reasons.push("Mismatch between enrollment form and document content.");
    }
    if (integrityLevel && !integrityLevel.pass) {
      reasons.push("Possible edits detected on the scan.");
    }
    if (reasons.length === 0) {
      reasons.push("Mismatch and tamper checks are clear (0% concern on both).");
    }
    return reasons.slice(0, 3);
  }

  if (concernPct > CONCERN_STRICT_THRESHOLD || ai.status === "failed") {
    reasons.push("Document or enrollment checks raised high concern.");
  }
  if (parts && parts.mismatchConcern > CONCERN_MANUAL_THRESHOLD) {
    reasons.push(`Mismatch concern ${parts.mismatchConcern}%.`);
  }
  if (parts && parts.tamperConcern > CONCERN_MANUAL_THRESHOLD) {
    reasons.push(`Tamper concern ${parts.tamperConcern}%.`);
  }
  if (reasons.length === 0) reasons.push("Mismatch and tamper concern are low.");

  return reasons.slice(0, 3);
}

export function buildOverallScoreBreakdown(
  documents: unknown,
  aiResultsByDocId: Record<string, AiResultForExplainer>,
  aiRunning: boolean,
  aggregateScore: number,
  categoryRows: WeightedCategoryRow[],
): OverallScoreBreakdown | null {
  const arr = Array.isArray(documents) ? documents : [];
  const totalDocuments = arr.length;
  const rows: DocScoreRow[] = [];

  for (const d of arr) {
    const doc = d as {
      id?: unknown;
      requirementLabel?: string;
      fileName?: string;
      name?: string;
    };
    const id = String(doc.id ?? "");
    const ai = aiResultsByDocId[id];
    const parts = documentConcernFromAi(ai);
    if (!parts) continue;

    const catRow = categoryRows.find((c) => c.docIds.includes(id));

    rows.push({
      id,
      label: docDisplayLabel(doc),
      pct: parts.documentAverage,
      mismatchPct: parts.mismatchConcern,
      tamperPct: parts.tamperConcern,
      reasons: plainReasonsForDoc(ai, parts.documentAverage),
      fromAi: true,
      weightPct: catRow?.weightPct,
      contribution: catRow ? Math.round(catRow.contribution * 10) / 10 : undefined,
    });
  }

  if (rows.length === 0) return null;

  return {
    aggregateScore,
    rows: [...rows].sort((a, b) => b.pct - a.pct),
    categoryRows,
    aiRunning,
    totalDocuments,
    scoredDocuments: rows.length,
  };
}

type AiReviewScoreExplainerProps = {
  breakdown: OverallScoreBreakdown;
  className?: string;
};

function ScorePctBadge({ pct, scored = true }: { pct: number; scored?: boolean }) {
  if (!scored) {
    return <span className="text-gray-400 font-semibold tabular-nums">—</span>;
  }
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        concernScoreBadgeClasses(pct),
      )}
    >
      {pct}%
    </span>
  );
}

export function AiReviewScoreExplainer({ breakdown, className }: AiReviewScoreExplainerProps) {
  const { aggregateScore, rows, categoryRows, aiRunning, totalDocuments, scoredDocuments } =
    breakdown;
  const n = rows.length;
  const highestConcern = rows[0];
  const lowestConcern = rows[rows.length - 1];

  const weightedSum = categoryRows.reduce((a, c) => a + c.contribution, 0);

  return (
    <div className={cn("text-sm text-gray-700", className)}>
      <p className="leading-snug text-gray-600">
        Based on{" "}
        <span className="font-medium text-gray-800">
          {scoredDocuments} of {totalDocuments} document{totalDocuments === 1 ? "" : "s"}
        </span>
        {highestConcern && lowestConcern && n > 1 ? (
          <>
            {" "}
            — highest concern <span className="font-medium">{highestConcern.label}</span> (
            <span
              className={cn(
                "font-semibold tabular-nums",
                concernScoreTextClass(highestConcern.pct),
              )}
            >
              {highestConcern.pct}%
            </span>
            ), lowest <span className="font-medium">{lowestConcern.label}</span> (
            <span
              className={cn(
                "font-semibold tabular-nums",
                concernScoreTextClass(lowestConcern.pct),
              )}
            >
              {lowestConcern.pct}%
            </span>
            ).
          </>
        ) : null}
        {aiRunning || scoredDocuments < totalDocuments ? " Some files are still being checked." : null}
      </p>

      <details className="group mt-2 rounded-lg border border-gray-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-[#8B1538] marker:content-none hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
          <span>View how we calculated this score</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
        </summary>

        <div className="space-y-4 border-t border-gray-100 px-3 py-3">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Step 1 — Weighted overall concern
            </h4>
            <p className="mt-1 leading-relaxed">
              Each document score is the <strong>average of mismatch (MM) and tamper (T)</strong>{" "}
              concern (0% = clean, 100% = serious problem). The overall score is the weighted sum
              of those averages. Missing types count as 0 until AI finishes.
            </p>
            <ul className="mt-2 list-inside list-disc text-xs leading-relaxed text-gray-600">
              <li>SF10 / Form 137 — 25%</li>
              <li>SF9 / Report card — 25%</li>
              <li>PSA birth certificate — 25%</li>
              <li>Good moral — 20%</li>
              <li>2×2 ID photo — 5%</li>
            </ul>
            <p className="mt-2 rounded-md bg-gray-50 px-2 py-1.5 font-mono text-xs tabular-nums text-gray-800">
              {categoryRows.map((c, i) => (
                <span key={c.category}>
                  {i > 0 ? " + " : ""}
                  {(c.weightPct / 100).toFixed(2)}×
                  <span
                    className={cn(
                      "font-semibold",
                      c.scored ? concernScoreTextClass(c.pct) : "text-gray-400",
                    )}
                  >
                    {c.scored ? c.pct : 0}
                  </span>
                </span>
              ))}{" "}
              ≈{" "}
              <span className={concernScoreTextClass(Math.round(weightedSum))}>
                {Math.round(weightedSum * 10) / 10}
              </span>{" "}
              → <ScorePctBadge pct={aggregateScore} />
            </p>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Step 2 — By document type (priority)
            </h4>
            <ul className="mt-2 space-y-2">
              {categoryRows.map((c) => (
                <li
                  key={c.category}
                  className={cn(
                    "rounded-md border px-2.5 py-2",
                    c.scored
                      ? concernScoreSurfaceClasses(c.pct)
                      : "border-gray-100 bg-gray-50/80",
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-gray-900">
                      {verificationCategoryLabel(c.category)}
                      <span className="ml-1 text-xs font-normal text-gray-500">
                        ({c.weightPct}% weight)
                      </span>
                    </span>
                    <ScorePctBadge pct={c.pct} scored={c.scored} />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {c.scored ? (
                      <>
                        Contributes <strong>{Math.round(c.contribution * 10) / 10}</strong> to
                        overall
                        {c.label ? ` · ${c.label}` : ""}
                      </>
                    ) : (
                      "Not scored yet — counts as 0 until AI finishes."
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Step 3 — Each uploaded file
            </h4>
            <ul className="mt-2 space-y-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className={cn("rounded-md border px-2.5 py-2", concernScoreSurfaceClasses(r.pct))}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-gray-900">{r.label}</span>
                    <ScorePctBadge pct={r.pct} />
                  </div>
                  <p className="text-xs text-gray-600">
                    MM {r.mismatchPct}% + T {r.tamperPct}% → avg{" "}
                    <strong>{r.pct}%</strong>
                    {typeof r.weightPct === "number"
                      ? ` · weight ${r.weightPct}%`
                      : ""}
                    {typeof r.contribution === "number"
                      ? ` · adds ${r.contribution} to overall`
                      : ""}
                  </p>
                  <ul className="mt-1 list-inside list-disc text-xs leading-snug text-gray-600">
                    {r.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              What MM and T mean
            </h4>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed text-gray-600">
              <li>
                <strong>MM — Mismatch:</strong> enrollment form vs document (name, PSA fields, school
                record fields, etc.). 0% = no mismatch.
              </li>
              <li>
                <strong>T — Tamper:</strong> signs of editing or manipulation on the scan. 0% = no
                tamper concern. Blur/lighting is checked at upload only.
              </li>
            </ul>
            <p className="mt-2 text-xs text-gray-500">
              This is automated guidance only — always use <strong>View</strong> on the Documents tab
              for the final check.
            </p>
          </section>
        </div>
      </details>
    </div>
  );
}
