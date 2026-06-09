import type { SecurityLevels } from "../components/SecurityLevelsPanel";

/** AI verify payload shape (subset used for score display). */
export type AiScoreSource = {
  confidence?: number;
  security_levels?: SecurityLevels;
};

/** Document & enrollment mismatch level from security_levels (renumbered Level 1 when quality is upload-only). */
export function documentMatchLevel(ai: AiScoreSource | undefined | null) {
  const levels = ai?.security_levels?.levels;
  if (!levels?.length) return null;
  return (
    levels.find((l) => /document.*(match|mismatch)|enrollment (match|mismatch)/i.test(l.title)) ??
    levels.find((l) => l.level === 1 && !/image quality/i.test(l.title)) ??
    levels.find((l) => l.level === 2)
  );
}

/**
 * Single headline match % for weighted overall, badges, and explainer.
 * Prefers security_levels match score so it aligns with the Level panel summary.
 */
export function documentMatchPercent(ai: AiScoreSource | undefined | null): number | null {
  const matchLevel = documentMatchLevel(ai);
  if (matchLevel && typeof matchLevel.score === "number" && Number.isFinite(matchLevel.score)) {
    return Math.max(0, Math.min(100, Math.round(matchLevel.score)));
  }
  if (typeof ai?.confidence === "number" && Number.isFinite(ai.confidence)) {
    return Math.max(0, Math.min(100, Math.round(ai.confidence * 100)));
  }
  return null;
}
