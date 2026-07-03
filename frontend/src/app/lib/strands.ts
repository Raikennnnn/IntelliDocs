/** Canonical SHS strand codes stored in enrollments / sections. */
export const STRAND_CODES = [
  "ASSH",
  "BAE",
  "STEM",
  "TECHPRO - CP",
  "TECHPRO - IT",
  "TECHPRO - HT",
] as const;

export type StrandCode = (typeof STRAND_CODES)[number];

export type StrandTrack = "academic" | "techpro";

export interface StrandDefinition {
  code: StrandCode;
  label: string;
  fullName: string;
  track: StrandTrack;
  trackLabel: string;
}

export const STRANDS: StrandDefinition[] = [
  {
    code: "ASSH",
    label: "ASSH",
    fullName: "Arts, Social Sciences, and Humanities",
    track: "academic",
    trackLabel: "Academic Track",
  },
  {
    code: "BAE",
    label: "BAE",
    fullName: "Business and Entrepreneurship",
    track: "academic",
    trackLabel: "Academic Track",
  },
  {
    code: "STEM",
    label: "STEM",
    fullName: "Science, Technology, Engineering, and Mathematics (STEM)",
    track: "academic",
    trackLabel: "Academic Track",
  },
  {
    code: "TECHPRO - CP",
    label: "CP",
    fullName: "Computer Programming",
    track: "techpro",
    trackLabel: "TECHPRO",
  },
  {
    code: "TECHPRO - IT",
    label: "IT",
    fullName: "Industrial Technologies",
    track: "techpro",
    trackLabel: "TECHPRO",
  },
  {
    code: "TECHPRO - HT",
    label: "HT",
    fullName: "Hospitality and Tourism",
    track: "techpro",
    trackLabel: "TECHPRO",
  },
];

const STRAND_BY_CODE = new Map(STRANDS.map((s) => [s.code, s]));

/** Map legacy DB / form values to the current canonical code. */
const LEGACY_STRAND_ALIASES: Record<string, StrandCode> = {
  HUMSS: "ASSH",
  ABM: "BAE",
  STEM: "STEM",
  "TVL - ICT": "TECHPRO - CP",
  "TVL-ICT": "TECHPRO - CP",
  ICT: "TECHPRO - CP",
  "TVL - EIM": "TECHPRO - IT",
  "TVL-EIM": "TECHPRO - IT",
  EIM: "TECHPRO - IT",
  "TVL - BPP/FBS": "TECHPRO - HT",
  "TVL-BPP/FBS": "TECHPRO - HT",
  "BPP/FBS": "TECHPRO - HT",
  "BPP / FBS": "TECHPRO - HT",
};

export function normalizeStrandCode(raw: string | null | undefined): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  if (STRAND_BY_CODE.has(trimmed as StrandCode)) return trimmed;
  const key = trimmed.replace(/\s+/g, " ");
  const upper = key.toUpperCase();
  if (LEGACY_STRAND_ALIASES[upper]) return LEGACY_STRAND_ALIASES[upper];
  if (LEGACY_STRAND_ALIASES[key]) return LEGACY_STRAND_ALIASES[key];
  return trimmed;
}

export function getStrandDefinition(raw: string | null | undefined): StrandDefinition | null {
  const code = normalizeStrandCode(raw);
  return STRAND_BY_CODE.get(code as StrandCode) ?? null;
}

export function formatStrandLabel(raw: string | null | undefined): string {
  const def = getStrandDefinition(raw);
  if (def) return def.label;
  return String(raw ?? "").trim();
}

export function formatStrandFullName(raw: string | null | undefined): string {
  const def = getStrandDefinition(raw);
  if (def) return def.fullName;
  return String(raw ?? "").trim();
}

export function formatStrandDisplay(raw: string | null | undefined): string {
  const def = getStrandDefinition(raw);
  if (!def) return String(raw ?? "").trim();
  if (def.track === "techpro") {
    return `${def.trackLabel} — ${def.label} (${def.fullName})`;
  }
  return `${def.label} — ${def.fullName}`;
}

/** Compact title for section lists and filters (e.g. STEM, TECHPRO — IT, ASSH). */
export function formatStrandSectionTitle(raw: string | null | undefined): string {
  const def = getStrandDefinition(raw);
  if (!def) {
    const trimmed = String(raw ?? "").trim();
    return trimmed || "Unassigned";
  }
  if (def.track === "techpro") {
    return `${def.trackLabel} — ${def.label}`;
  }
  return def.label;
}

export function formatStrandListTitle(codes: string[]): string {
  return codes.map((code) => formatStrandSectionTitle(code)).join(", ");
}

/** Strands that default to boys-first section rosters. */
export const BOYS_FIRST_STRAND_CODES: StrandCode[] = ["TECHPRO - IT"];

export function isBoysFirstStrand(raw: string | null | undefined): boolean {
  const code = normalizeStrandCode(raw);
  return BOYS_FIRST_STRAND_CODES.includes(code as StrandCode);
}
