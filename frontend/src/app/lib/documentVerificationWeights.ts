/** Document categories used for weighted overall concern score (0 = clean, 100 = worst). */
export type VerificationDocCategory =
  | "form137"
  | "sf9"
  | "birth_certificate"
  | "good_moral"
  | "photo_2x2"
  | "other";

/** Fixed priority weights (sum = 1.0). */
export const VERIFICATION_DOC_WEIGHTS: Record<
  Exclude<VerificationDocCategory, "other">,
  number
> = {
  form137: 0.25,
  sf9: 0.25,
  birth_certificate: 0.25,
  good_moral: 0.2,
  photo_2x2: 0.05,
};

/** Optional at enrollment — omitted from weighted totals only when not uploaded. */
export const OPTIONAL_VERIFICATION_CATEGORIES: ReadonlyArray<
  Exclude<VerificationDocCategory, "other">
> = ["form137"];

/** Max verification coverage when optional SF10 is not uploaded. */
export const MAX_VERIFICATION_WITHOUT_OPTIONAL_PCT = Math.round(
  (Object.entries(VERIFICATION_DOC_WEIGHTS) as Array<
    [Exclude<VerificationDocCategory, "other">, number]
  >)
    .filter(([cat]) => !OPTIONAL_VERIFICATION_CATEGORIES.includes(cat))
    .reduce((sum, [, w]) => sum + w, 0) * 100,
);

export const MAX_VERIFICATION_WITH_ALL_PCT = 100;

const WEIGHTED_CATEGORIES = Object.keys(VERIFICATION_DOC_WEIGHTS) as Array<
  Exclude<VerificationDocCategory, "other">
>;

const CATEGORY_LABELS: Record<Exclude<VerificationDocCategory, "other">, string> = {
  form137: "SF10 / Form 137",
  sf9: "SF9 / Report card",
  birth_certificate: "PSA birth certificate",
  good_moral: "Good moral certificate",
  photo_2x2: "2×2 ID photo",
};

export function verificationCategoryLabel(
  category: Exclude<VerificationDocCategory, "other">,
): string {
  return CATEGORY_LABELS[category];
}

export function resolveVerificationDocCategory(doc: {
  requirementLabel?: string;
  type?: string;
  name?: string;
  fileName?: string;
}): VerificationDocCategory {
  const slotLabel = String(doc?.requirementLabel ?? doc?.type ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (slotLabel) return resolveVerificationDocCategoryFromLabel(slotLabel);

  const fallback = String(doc?.name ?? doc?.fileName ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return fallback ? resolveVerificationDocCategoryFromLabel(fallback) : "other";
}

function resolveVerificationDocCategoryFromLabel(label: string): VerificationDocCategory {
  if (label.includes("2x2") || (label.includes("picture") && label.includes("white"))) {
    return "photo_2x2";
  }
  if (label.includes("form 137") || label.includes("form137") || label.includes("sf10")) {
    return "form137";
  }
  if (label.includes("sf9") || label.includes("report card")) {
    return "sf9";
  }
  if (label.includes("transcript") || /\btor\b/.test(label)) {
    return "sf9";
  }
  if (label.includes("good moral")) {
    return "good_moral";
  }
  if (label.includes("birth")) {
    return "birth_certificate";
  }
  return "other";
}

export function isOptionalVerificationCategory(
  category: Exclude<VerificationDocCategory, "other">,
): boolean {
  return OPTIONAL_VERIFICATION_CATEGORIES.includes(category);
}

export type WeightedCategoryRow = {
  category: Exclude<VerificationDocCategory, "other">;
  label: string;
  pct: number;
  /** Display weight e.g. 25 for 25%. */
  weightPct: number;
  /** weight × document average concern (before rounding total). */
  contribution: number;
  /** weight × pass % (100 − concern) for scored uploads. */
  verificationContribution: number;
  docIds: string[];
  scored: boolean;
  /** At least one file was uploaded for this category. */
  uploaded: boolean;
  /** Optional category not uploaded — excluded from overall weighted score. */
  excludedFromOverall: boolean;
  /** Optional category (SF10) — may be omitted at enrollment. */
  optional: boolean;
};

/** Categories with at least one uploaded file in the application. */
export function uploadedVerificationCategories(
  documents: unknown,
): Set<Exclude<VerificationDocCategory, "other">> {
  const arr = Array.isArray(documents) ? documents : [];
  const uploaded = new Set<Exclude<VerificationDocCategory, "other">>();
  for (const d of arr) {
    const cat = resolveVerificationDocCategory(
      d as {
        requirementLabel?: string;
        type?: string;
        name?: string;
        fileName?: string;
      },
    );
    if (cat !== "other") uploaded.add(cat);
  }
  return uploaded;
}

export function countUploadedVerificationDocuments(documents: unknown): number {
  return uploadedVerificationCategories(documents).size;
}

export function computeWeightedVerificationScore(
  documents: unknown,
  getPctForDoc: (doc: { id?: unknown }) => number | null,
): {
  /** Weighted concern (0 = clean, higher = worse). */
  aggregateScore: number;
  /** Weighted verification pass % (higher = better; max 75% without SF10, 100% with SF10). */
  aggregateVerificationScore: number;
  categoryRows: WeightedCategoryRow[];
  scoredCategories: number;
  /** Uploaded categories that count toward the overall weighted score. */
  scoringCategories: number;
  uploadedCategories: number;
  activeWeightPct: number;
  maxVerificationPct: number;
} | null {
  const arr = Array.isArray(documents) ? documents : [];
  const uploaded = uploadedVerificationCategories(documents);
  const byCategory = new Map<
    Exclude<VerificationDocCategory, "other">,
    { pcts: number[]; labels: string[]; ids: string[] }
  >();

  for (const d of arr) {
    const doc = d as {
      id?: unknown;
      requirementLabel?: string;
      type?: string;
      name?: string;
      fileName?: string;
    };
    const cat = resolveVerificationDocCategory(doc);
    if (cat === "other") continue;
    const pct = getPctForDoc(doc);
    if (pct === null) continue;
    const bucket = byCategory.get(cat) ?? { pcts: [], labels: [], ids: [] };
    bucket.pcts.push(pct);
    const rawLabel = String(
      doc.requirementLabel || doc.fileName || doc.name || verificationCategoryLabel(cat),
    )
      .replace(/\s+/g, " ")
      .trim();
    bucket.labels.push(rawLabel.length > 36 ? `${rawLabel.slice(0, 34)}…` : rawLabel);
    bucket.ids.push(String(doc.id ?? ""));
    byCategory.set(cat, bucket);
  }

  if (uploaded.size === 0) return null;

  let aggregateConcern = 0;
  let aggregateVerification = 0;
  let activeWeight = 0;
  let scoringCategories = 0;
  const categoryRows: WeightedCategoryRow[] = [];

  for (const category of WEIGHTED_CATEGORIES) {
    const weight = VERIFICATION_DOC_WEIGHTS[category];
    const hasUpload = uploaded.has(category);
    const optional = isOptionalVerificationCategory(category);
    const excludedFromOverall = optional && !hasUpload;
    const bucket = byCategory.get(category);
    const scored = Boolean(bucket?.pcts.length);
    const pct = scored
      ? Math.round(bucket!.pcts.reduce((a, b) => a + b, 0) / bucket!.pcts.length)
      : 0;
    const appliesToScore = hasUpload;
    const contribution = appliesToScore && scored ? weight * pct : 0;
    const passPct = scored ? Math.max(0, 100 - pct) : 0;
    const verificationContribution = appliesToScore && scored ? weight * passPct : 0;

    if (appliesToScore) {
      activeWeight += weight;
      scoringCategories += 1;
    }
    aggregateConcern += contribution;
    aggregateVerification += verificationContribution;

    categoryRows.push({
      category,
      label: scored ? bucket!.labels[0] : verificationCategoryLabel(category),
      pct,
      weightPct: Math.round(weight * 100),
      contribution,
      verificationContribution,
      docIds: scored ? bucket!.ids : [],
      scored,
      uploaded: hasUpload,
      excludedFromOverall,
      optional,
    });
  }

  if (byCategory.size === 0) return null;

  const maxVerificationPct = Math.round(activeWeight * 100);

  return {
    aggregateScore: Math.round(aggregateConcern),
    aggregateVerificationScore: Math.round(aggregateVerification),
    categoryRows,
    scoredCategories: byCategory.size,
    scoringCategories,
    uploadedCategories: uploaded.size,
    activeWeightPct: maxVerificationPct,
    maxVerificationPct,
  };
}
