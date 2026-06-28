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
  const label = String(
    doc?.requirementLabel ?? doc?.type ?? doc?.name ?? doc?.fileName ?? "",
  ).toLowerCase();
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

export type WeightedCategoryRow = {
  category: Exclude<VerificationDocCategory, "other">;
  label: string;
  pct: number;
  /** Display weight e.g. 25 for 25%. */
  weightPct: number;
  /** weight × document average concern (before rounding total). */
  contribution: number;
  docIds: string[];
  scored: boolean;
};

export function computeWeightedVerificationScore(
  documents: unknown,
  getPctForDoc: (doc: { id?: unknown }) => number | null,
): {
  aggregateScore: number;
  categoryRows: WeightedCategoryRow[];
  scoredCategories: number;
} | null {
  const arr = Array.isArray(documents) ? documents : [];
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

  if (byCategory.size === 0) return null;

  let aggregate = 0;
  const categoryRows: WeightedCategoryRow[] = [];

  for (const category of Object.keys(VERIFICATION_DOC_WEIGHTS) as Array<
    Exclude<VerificationDocCategory, "other">
  >) {
    const weight = VERIFICATION_DOC_WEIGHTS[category];
    const bucket = byCategory.get(category);
    const scored = Boolean(bucket?.pcts.length);
    const pct = scored
      ? Math.round(bucket!.pcts.reduce((a, b) => a + b, 0) / bucket!.pcts.length)
      : 0;
    const contribution = weight * pct;
    aggregate += contribution;
    categoryRows.push({
      category,
      label: scored ? bucket!.labels[0] : verificationCategoryLabel(category),
      pct,
      weightPct: Math.round(weight * 100),
      contribution,
      docIds: scored ? bucket!.ids : [],
      scored,
    });
  }

  return {
    aggregateScore: Math.round(aggregate),
    categoryRows,
    scoredCategories: byCategory.size,
  };
}
