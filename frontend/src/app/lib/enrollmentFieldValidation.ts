import { isValidLRN } from "../utils/studentNumberGenerator";

/** Letters, spaces, hyphens, apostrophes, periods (Filipino / Western names). */
const NAME_CHAR_PATTERN = /[^A-Za-zñÑ.\-'\s]/g;

const PERSON_NAME_FIELDS = new Set([
  "givenName",
  "middleName",
  "lastName",
  "motherGivenName",
  "motherMaidenMiddleName",
  "motherMaidenLastName",
  "fatherGivenName",
  "fatherMiddleName",
  "fatherLastName",
  "guardianGivenName",
  "guardianMiddleName",
  "guardianLastName",
  "referrerName",
]);

const PHONE_FIELDS = new Set([
  "contactNumber",
  "motherContactNumber",
  "fatherContactNumber",
  "guardianContactNumber",
  "referrerContactNumber",
]);

/** Occupation, relationship, and similar labels — letters only (no digits). */
const TEXT_ONLY_FIELDS = new Set([
  "motherOccupation",
  "fatherOccupation",
  "relationshipToGuardian",
  "referrerName",
  "previousSchoolAttended",
]);

const SECTION_LABEL_FIELDS = new Set(["sectionAtPreviousSchool"]);

const SCHOOL_YEAR_FIELDS = new Set(["lastSchoolYearAttended"]);

export function sanitizePersonNameInput(value: string): string {
  return value.replace(NAME_CHAR_PATTERN, "");
}

export function sanitizeMiddleInitialInput(value: string): string {
  return value.replace(/[^A-Za-zñÑ]/g, "").slice(0, 2);
}

/** Jr., Sr., III — letters and punctuation only, no digits. */
export function sanitizeExtensionNameInput(value: string): string {
  return value.replace(/[^A-Za-zñÑ.\s,]/g, "");
}

export function sanitizeDigitsOnly(value: string, maxLength?: number): string {
  const digits = value.replace(/\D/g, "");
  return maxLength !== undefined ? digits.slice(0, maxLength) : digits;
}

/** Text labels: occupations, relationships, school names, etc. */
export function sanitizeTextOnlyInput(value: string): string {
  return value.replace(/[^A-Za-zñÑ.\-'\s,/()&]/g, "");
}

/** Section labels may include short numbers (e.g. 10-A, 1). */
export function sanitizeSectionLabelInput(value: string): string {
  return value.replace(/[^A-Za-zñÑ0-9.\-\s]/g, "").slice(0, 40);
}

/** School year: digits and one hyphen (e.g. 2023-2024). Auto-formats 8 digits as YYYY-YYYY. */
export function sanitizeSchoolYearInput(value: string): string {
  const cleaned = value.replace(/[^\d-]/g, "");
  const digitsOnly = cleaned.replace(/-/g, "");

  if (!cleaned.includes("-")) {
    if (digitsOnly.length <= 4) {
      return digitsOnly.slice(0, 4);
    }
    const start = digitsOnly.slice(0, 4);
    const end = digitsOnly.slice(4, 8);
    return `${start}-${end}`;
  }

  const hyphenIdx = cleaned.indexOf("-");
  const start = cleaned.slice(0, hyphenIdx).replace(/\D/g, "").slice(0, 4);
  const end = cleaned
    .slice(hyphenIdx + 1)
    .replace(/\D/g, "")
    .slice(0, 4);

  if (end.length > 0) {
    return `${start}-${end}`;
  }
  if (start.length > 0) {
    return `${start}-`;
  }
  return start;
}

export function sanitizeEnrollmentFieldValue(field: string, value: string): string {
  if (field === "middleInitial") {
    return sanitizeMiddleInitialInput(value);
  }
  if (field === "extensionName") {
    return sanitizeExtensionNameInput(value);
  }
  if (PERSON_NAME_FIELDS.has(field)) {
    return sanitizePersonNameInput(value);
  }
  if (field === "lrn") {
    return sanitizeDigitsOnly(value, 12);
  }
  if (PHONE_FIELDS.has(field)) {
    return sanitizeDigitsOnly(value, 11);
  }
  if (TEXT_ONLY_FIELDS.has(field)) {
    return sanitizeTextOnlyInput(value);
  }
  if (SECTION_LABEL_FIELDS.has(field)) {
    return sanitizeSectionLabelInput(value);
  }
  if (SCHOOL_YEAR_FIELDS.has(field)) {
    return sanitizeSchoolYearInput(value);
  }
  return value;
}

export function isValidPhilippineMobileNumber(value: string): boolean {
  const digits = sanitizeDigitsOnly(value);
  return /^09\d{9}$/.test(digits);
}

export function isValidEnrollmentLrn(value: string): boolean {
  return isValidLRN(sanitizeDigitsOnly(value));
}

export function hasValidPersonName(value: string): boolean {
  const trimmed = sanitizePersonNameInput(value).trim();
  return trimmed.length > 0 && /[A-Za-zñÑ]/.test(trimmed);
}

/** First letter of middle name for the M.I. field (empty when none or N/A). */
export function middleInitialFromMiddleName(middleName: string): string {
  const trimmed = sanitizePersonNameInput(middleName).trim();
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase();
  if (upper === "NA" || upper === "NONE") return "";
  return sanitizeMiddleInitialInput(trimmed).slice(0, 1);
}

/** Non-empty text-only field with at least one letter (after sanitization). */
export function hasValidTextOnlyContent(value: string): boolean {
  const trimmed = sanitizeTextOnlyInput(value).trim();
  return trimmed.length > 0 && /[A-Za-zñÑ]/.test(trimmed);
}

/** Section: letter(s) required unless a single character/digit section code. */
export function hasValidSectionLabel(value: string): boolean {
  const trimmed = sanitizeSectionLabelInput(value).trim();
  if (!trimmed) return true;
  if (/^[A-Za-zñÑ0-9]{1,2}$/.test(trimmed)) return true;
  return /[A-Za-zñÑ]/.test(trimmed);
}

export function formatSchoolYearRange(startYear: number): string {
  return `${startYear}-${startYear + 1}`;
}

/** DepEd school-year start (June boundary). */
export function getSchoolYearStartYear(date = new Date()): number {
  return date.getMonth() >= 5 ? date.getFullYear() : date.getFullYear() - 1;
}

/**
 * Past school years for "last attended" (newest first).
 * Anchored to today's date — not the enrollment SY setting — so options stay in the past
 * and roll forward automatically each June.
 */
export function getSchoolYearAttendedOptions(opts?: {
  count?: number;
  extraYears?: string[];
  asOf?: Date;
}): string[] {
  const count = Math.max(1, opts?.count ?? 5);
  const asOf = opts?.asOf ?? new Date();
  const latestStart = getSchoolYearStartYear(asOf) - 1;
  const beginStart = Math.max(1990, latestStart - (count - 1));
  const generated: string[] = [];
  for (let y = beginStart; y <= latestStart; y++) {
    generated.push(formatSchoolYearRange(y));
  }
  const extra = (opts?.extraYears ?? [])
    .map((y) => sanitizeSchoolYearInput(y.trim()))
    .filter((y) => /^\d{4}(-\d{4})?$/.test(y));
  return [...new Set([...extra, ...generated])].sort((a, b) => {
    const ya = Number(a.split("-")[0]);
    const yb = Number(b.split("-")[0]);
    return yb - ya;
  });
}

export function isValidSchoolYearAttended(value: string): boolean {
  const trimmed = sanitizeSchoolYearInput(value).trim();
  if (!trimmed) return true;
  if (/^\d{4}$/.test(trimmed)) {
    const y = Number(trimmed);
    return y >= 1990 && y <= 2100;
  }
  const match = /^(\d{4})-(\d{4})$/.exec(trimmed);
  if (!match) return false;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return start >= 1990 && end <= 2100 && end === start + 1;
}

/** Display stored YYYY-MM-DD as MM/DD/YYYY for student-facing forms. */
export function formatBirthDateUsDisplay(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const [year, month, day] = ymd.split("-");
  return `${month}/${day}/${year}`;
}

/** Auto-format typed digits into MM/DD/YYYY while the student enters a birth date. */
export function sanitizeBirthDateUsInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Parse MM/DD/YYYY to canonical YYYY-MM-DD for API/DB storage. */
export function parseBirthDateUsToYmd(display: string): string | null {
  const match = display.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return null;
  }
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Strip invalid characters from all string fields before save. */
export function sanitizeEnrollmentFormData<T extends Record<string, unknown>>(data: T): T {
  const out = { ...data };
  for (const key of Object.keys(out)) {
    const val = out[key as keyof T];
    if (typeof val === "string") {
      (out as Record<string, string>)[key] = sanitizeEnrollmentFieldValue(key, val);
    }
  }
  return out;
}

export { PERSON_NAME_FIELDS, PHONE_FIELDS };
