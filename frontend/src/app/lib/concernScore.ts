import type { SecurityLevel, SecurityLevels } from "../components/SecurityLevelsPanel";

export type DocumentConcernParts = {
  mismatchConcern: number;
  tamperConcern: number;
  /** Average of mismatch + tamper (0 = clean, 100 = serious concern). */
  documentAverage: number;
};

/** Policy thresholds on weighted concern (0 = clean, higher = worse). */
export const CONCERN_STRICT_THRESHOLD = 25;
export const CONCERN_MANUAL_THRESHOLD = 10;

/** 0 = clear; higher = more concern (inverse of integrity/naturalness scores). */
export function integrityToConcern(integrityPct: number): number {
  const n = Math.round(integrityPct);
  return Math.max(0, Math.min(100, 100 - n));
}

export function naturalnessToConcern(naturalPct: number): number {
  return integrityToConcern(naturalPct);
}

function parseDocumentMatchPercent(summary: string): number | null {
  const m = summary.match(/Document match (\d+)%/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseIntegrityPercent(summary: string): number | null {
  const m = summary.match(/Integrity (\d+)%/i);
  return m ? parseInt(m[1], 10) : null;
}

function isMismatchLevel(lv: SecurityLevel): boolean {
  return /document & enrollment|enrollment (mis)?match/i.test(lv.title);
}

function isTamperLevel(lv: SecurityLevel): boolean {
  return /tamper|integrity/i.test(lv.title);
}

/** Display score for a security level card (handles legacy integrity/match payloads). */
export function levelConcernPercent(lv: SecurityLevel): number {
  if (lv.pass) return 0;

  const summary = lv.summary || "";

  if (/0% concern/i.test(summary)) return 0;

  const docMatch = parseDocumentMatchPercent(summary);
  if (docMatch !== null || (isMismatchLevel(lv) && /Document match/i.test(summary))) {
    const matchPct = docMatch ?? lv.score;
    return Math.max(1, integrityToConcern(matchPct));
  }

  const enrollmentMatch = summary.match(/enrollment data match \((\d+)%\)/i);
  if (enrollmentMatch) {
    return Math.max(1, integrityToConcern(parseInt(enrollmentMatch[1], 10)));
  }

  const integrity = parseIntegrityPercent(summary);
  if (integrity !== null || (isTamperLevel(lv) && /Integrity/i.test(summary))) {
    const integrityPct = integrity ?? lv.score;
    return Math.max(1, integrityToConcern(integrityPct));
  }

  return Math.max(0, Math.min(100, Math.round(lv.score)));
}

/** Rewrite legacy match/integrity summaries into concern wording for the UI. */
export function displayLevelSummary(lv: SecurityLevel, concernPct: number): string {
  const summary = (lv.summary || "").trim();
  if (!summary) return summary;

  if (/concern/i.test(summary) && !/Document match \d+%/i.test(summary) && !/Integrity \d+%/i.test(summary)) {
    return summary;
  }

  if (concernPct <= 0) {
    if (isTamperLevel(lv)) {
      return "Tamper check clear — 0% concern.";
    }
    if (isMismatchLevel(lv)) {
      return "No document or enrollment mismatch — 0% concern.";
    }
  }

  const missing = summary.match(/Document match \d+% — missing: (.+?)\.?$/i);
  if (missing) {
    return `Mismatch concern ${concernPct}% — missing or mismatched: ${missing[1].replace(/\.$/, "")}.`;
  }

  if (/Document or enrollment data did not match/i.test(summary)) {
    return `Document or enrollment mismatch — ${concernPct}% concern.`;
  }

  const enrollmentMatch = summary.match(/enrollment data match \((\d+)%\)/i);
  if (enrollmentMatch) {
    return `Document or enrollment mismatch — ${concernPct}% concern.`;
  }

  if (/Integrity \d+% — no strong edit signals/i.test(summary)) {
    return "Tamper check clear — 0% concern.";
  }

  if (/minor flags only/i.test(summary)) {
    return "Minor integrity flags only — 0% concern; review preview if unsure.";
  }

  if (/Integrity \d+% — possible edits/i.test(summary)) {
    return `Possible edits detected — ${concernPct}% tamper concern; review highlighted areas.`;
  }

  if (/Integrity capped by synthetic/i.test(summary) && concernPct <= 0) {
    return "Tamper check clear — 0% concern.";
  }

  return summary;
}

type TamperSource = {
  tamper_score?: number;
  tamper_applicable?: boolean;
  security_levels?: { levels?: SecurityLevel[] };
};

export function tamperConcernPercent(r: TamperSource | null | undefined): number | null {
  if (!r || r.tamper_applicable === false) return null;

  const tamperLevel = r.security_levels?.levels?.find((l) => /tamper|integrity/i.test(l.title));
  if (tamperLevel) return levelConcernPercent(tamperLevel);

  if (typeof r.tamper_score !== "number") return null;
  const integrity = Math.max(0, Math.min(100, Math.round(r.tamper_score * 100)));
  if (r.tamper_score >= 0.5) return 0;
  return Math.max(1, integrityToConcern(integrity));
}

type SyntheticSource = {
  synthetic_score?: number;
  synthetic_applicable?: boolean;
};

export function syntheticConcernPercent(r: SyntheticSource | null | undefined): number | null {
  if (!r || r.synthetic_applicable === false) return null;
  if (typeof r.synthetic_score !== "number") return null;
  const natural = Math.max(0, Math.min(100, Math.round(r.synthetic_score * 100)));
  if (natural >= 75) return 0;
  return Math.max(1, naturalnessToConcern(natural));
}

export function concernRiskLabel(concernPct: number): "Clear" | "Check" | "Suspicious" {
  const n = Math.round(concernPct);
  if (n <= CONCERN_MANUAL_THRESHOLD) return "Clear";
  if (n <= 50) return "Check";
  return "Suspicious";
}

function verificationLevels(levels: SecurityLevel[]): SecurityLevel[] {
  return levels.filter((lv) => !/image quality/i.test(lv.title));
}

export function documentConcernFromSecurityLevels(
  security?: SecurityLevels | null,
): DocumentConcernParts | null {
  const levels = security?.levels?.length ? verificationLevels(security.levels) : [];
  if (!levels.length) return null;

  const mismatchLv =
    levels.find((l) => /document.*(match|mismatch)|enrollment/i.test(l.title)) ??
    levels.find((l) => l.level === 1);
  const tamperLv =
    levels.find((l) => /tamper|integrity/i.test(l.title)) ??
    levels.find((l) => l.level === 2);

  const concerns: number[] = [];
  let mismatchConcern = 0;
  let tamperConcern = 0;

  if (mismatchLv) {
    mismatchConcern = levelConcernPercent(mismatchLv);
    concerns.push(mismatchConcern);
  }
  if (tamperLv) {
    tamperConcern = levelConcernPercent(tamperLv);
    concerns.push(tamperConcern);
  }

  if (!concerns.length) return null;

  const documentAverage = Math.round(
    concerns.reduce((sum, n) => sum + n, 0) / concerns.length,
  );

  return { mismatchConcern, tamperConcern, documentAverage };
}

type AiConcernSource = {
  status?: string;
  confidence?: number;
  security_levels?: SecurityLevels;
  tamper_score?: number;
  tamper_applicable?: boolean;
};

/** Per-document score = average(MM concern, T concern). */
export function documentConcernFromAi(
  ai: AiConcernSource | null | undefined,
): DocumentConcernParts | null {
  const fromLevels = documentConcernFromSecurityLevels(ai?.security_levels);
  if (fromLevels) return fromLevels;
  if (!ai) return null;

  const tamper =
    tamperConcernPercent(ai) ??
    (ai.tamper_applicable === false ? 0 : null);

  let mismatch: number | null = null;
  if (typeof ai.confidence === "number" && Number.isFinite(ai.confidence)) {
    const matchPct = Math.round(ai.confidence * 100);
    const failed = ai.status === "failed" || matchPct < 62;
    mismatch = failed ? Math.max(1, integrityToConcern(matchPct)) : 0;
  }

  const parts = [mismatch, tamper].filter((n): n is number => n !== null);
  if (!parts.length) return null;

  const documentAverage = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  return {
    mismatchConcern: mismatch ?? 0,
    tamperConcern: tamper ?? 0,
    documentAverage,
  };
}

export function documentAverageConcernFromAi(
  ai: AiConcernSource | null | undefined,
): number | null {
  return documentConcernFromAi(ai)?.documentAverage ?? null;
}
