import { writeFileSync } from "fs";
import { getBarangaysByMunicipality } from "@aivangogh/ph-address";

const CITY_CODES = [
  { label: "Caloocan City", code: null, manual: () => Array.from({ length: 188 }, (_, i) => `Barangay ${i + 1}`) },
  { label: "Las Piñas City", code: "1380200000" },
  { label: "Makati City", code: "1380300000" },
  { label: "Malabon City", code: "1380400000" },
  { label: "Mandaluyong City", code: "1380500000" },
  { label: "Manila", code: "1380100000" },
  { label: "Marikina City", code: "1380700000" },
  { label: "Muntinlupa City", code: "1380800000" },
  { label: "Navotas City", code: "1380900000" },
  { label: "Parañaque City", code: "1381000000" },
  { label: "Pasay City", code: "1381100000" },
  { label: "Pasig City", code: "1381200000" },
  {
    label: "Pateros",
    code: null,
    manual: () => [
      "Aguho",
      "Magtanggol",
      "Martires del 96",
      "Poblacion",
      "San Pedro",
      "San Roque",
      "Santa Ana",
      "Santo Rosario-Kanluran",
      "Santo Rosario-Silangan",
      "Tabacalera",
    ],
  },
  { label: "Quezon City", code: "1381300000" },
  { label: "San Juan City", code: "1381400000" },
  { label: "Taguig City", code: "1381500000" },
  { label: "Valenzuela City", code: "1381600000" },
];

const municipalities = [];
const barangaysByMunicipality = {};

for (const entry of CITY_CODES) {
  const { label, code, manual } = entry;
  const barangays = manual
    ? manual()
    : getBarangaysByMunicipality(code)
        .map((b) => b.name)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  if (barangays.length === 0) {
    console.warn(`No barangays for ${label} (${code})`);
    continue;
  }
  municipalities.push(label);
  barangaysByMunicipality[label] = barangays;
}

writeFileSync(
  new URL("../src/app/data/ncrAddressData.json", import.meta.url),
  JSON.stringify({ municipalities, barangaysByMunicipality }, null, 2),
);
console.log(`Wrote ${municipalities.length} NCR cities`);
