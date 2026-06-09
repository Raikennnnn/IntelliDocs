import addressData from "../data/ncrAddressData.json";

export const NCR_MUNICIPALITIES: string[] = addressData.municipalities;

const barangaysByMunicipality: Record<string, string[]> =
  addressData.barangaysByMunicipality;

/** Match saved free-text municipality to a dropdown option. */
export function resolveNcrMunicipality(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (NCR_MUNICIPALITIES.includes(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  const exact = NCR_MUNICIPALITIES.find(
    (m) => m.toLowerCase() === lower,
  );
  if (exact) return exact;

  const partial = NCR_MUNICIPALITIES.find((m) => {
    const ml = m.toLowerCase();
    return ml.includes(lower) || lower.includes(ml.replace(/\s+city$/i, ""));
  });
  return partial ?? "";
}

export function getBarangaysForMunicipality(municipality: string): string[] {
  const key = resolveNcrMunicipality(municipality);
  if (!key) return [];
  return barangaysByMunicipality[key] ?? [];
}

export function resolveNcrBarangay(municipality: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const options = getBarangaysForMunicipality(municipality);
  if (options.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  return options.find((b) => b.toLowerCase() === lower) ?? "";
}

export function sanitizeAddressLabelInput(value: string): string {
  return value.replace(/[^A-Za-zñÑ0-9.\-'\s,/()#]/g, "").slice(0, 120);
}

/** Canonical NCR name when matched; otherwise keep the student's typed value. */
export function normalizeMunicipalityValue(value: string): string {
  const trimmed = sanitizeAddressLabelInput(value).trim();
  if (!trimmed) return "";
  return resolveNcrMunicipality(trimmed) || trimmed;
}

export function normalizeBarangayValue(municipality: string, value: string): string {
  const trimmed = sanitizeAddressLabelInput(value).trim();
  if (!trimmed) return "";
  return resolveNcrBarangay(municipality, trimmed) || trimmed;
}

export function hasValidAddressLabel(value: string): boolean {
  const trimmed = sanitizeAddressLabelInput(value).trim();
  return trimmed.length >= 2 && /[A-Za-zñÑ]/.test(trimmed);
}

export function isKnownNcrMunicipality(value: string): boolean {
  return !!resolveNcrMunicipality(value);
}
