import { formatStrandDisplay } from "./strands";

const EMPTY = "—";

/** Uppercase enrollment field text for display (student + registrar). */
export function displayEnrollmentText(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return EMPTY;
  return trimmed.toUpperCase();
}

/**
 * Grade label without doubled "Grade" prefix (e.g. stored "Grade 10" → "GRADE 10").
 */
export function formatGradeLevelDisplay(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return EMPTY;
  const level = trimmed.replace(/^grade\s+/i, "").trim();
  if (!level) return EMPTY;
  return `GRADE ${level}`.toUpperCase();
}

/** Strand code/label formatted for display, uppercased. */
export function displayStrandText(raw: string | null | undefined): string {
  return displayEnrollmentText(formatStrandDisplay(raw));
}

/** Join name parts and uppercase for display. */
export function displayFullName(...parts: Array<string | null | undefined>): string {
  const joined = parts.map((p) => String(p ?? "").trim()).filter(Boolean).join(" ");
  return displayEnrollmentText(joined || null);
}
