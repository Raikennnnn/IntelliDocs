import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  FileText,
  AlertCircle,
  Download,
  Eye,
  ArrowLeft,
  User,
  Users,
  GraduationCap,
  Upload,
  ClipboardCheck,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { apiFetch, formatApiError, parseApiJson } from "../../lib/api";
import { guessDocKind } from "../../lib/documentPreview";
import { SecureDocumentPreview } from "../../components/SecureDocumentPreview";
import {
  SecurityLevelsPanel,
  type SecurityLevels,
} from "../../components/SecurityLevelsPanel";
import { DocumentConcernChips } from "../../components/DocumentConcernChips";
import {
  ConcernScoringHelp,
  DocumentConcernFormula,
} from "../../components/ConcernComputationNote";
import {
  AiReviewScoreExplainer,
  buildOverallScoreBreakdown,
} from "../../components/AiReviewScoreExplainer";
import { computeWeightedVerificationScore } from "../../lib/documentVerificationWeights";
import {
  verificationScoreTextClass,
  concernScoreBadgeClasses,
  concernScoreSurfaceClasses,
  concernScoreTextClass,
} from "../../lib/verificationScoreColors";
import {
  CONCERN_MANUAL_THRESHOLD,
  CONCERN_STRICT_THRESHOLD,
  concernPolicyTier,
  concernRiskLabel,
  documentAverageConcernFromAi,
  documentConcernFromAi,
  levelConcernPercent,
  syntheticConcernPercent,
  tamperConcernPercent,
} from "../../lib/concernScore";
import {
  REJECTION_REASON_PRESETS,
  DOCUMENT_REJECTION_PRESETS,
} from "../../lib/rejectionReasons";
import { RejectionReasonFields } from "../../components/RejectionReasonFields";
import { cn } from "../../components/ui/utils";

function applicationReviewStatusBadgeClass(status: string): string {
  const s = status.toLowerCase().trim();
  if (s.includes("enrolled") || s === "approved") return "bg-green-600";
  if (s.includes("review")) return "bg-blue-600";
  if (s.includes("reject")) return "bg-red-600";
  return "bg-yellow-600";
}

type AiVerifyStatus = "verified" | "failed";
type AiDocType =
  | "form137"
  | "sf10"
  | "sf9"
  | "good_moral"
  | "birth_certificate"
  | "photo_2x2"
  | "other";

type AiVerifyResponse = {
  status: AiVerifyStatus;
  confidence: number; // 0..1 (verification score)
  ocr_confidence?: number; // 0..1 (readability)
  tamper_score?: number; // 0..1 (1=clean, 0=suspicious)
  tamper_signals?: string[];
  tamper_applicable?: boolean;
  synthetic_score?: number; // 0..1 (1=looks natural, 0=suspicious synthetic/digital)
  synthetic_signals?: string[];
  synthetic_applicable?: boolean;
  field_checks?: Array<{
    field: string;
    expected: string;
    detected?: string;
    ok: boolean;
    match_ratio?: number;
    concern_pct?: number;
    missing_tokens?: string[];
    x?: number;
    y?: number;
    w?: number;
    h?: number;
  }>;
  doc_checks?: Array<{
    field: string;
    ok: boolean;
    scan_method?: string;
    match_ratio?: number;
    note?: string;
  }>;
  seal_scan?: {
    detected?: boolean;
    confidence?: number;
    label?: string;
    signals?: string[];
    scan_method?: string;
  };
  image_width?: number;
  image_height?: number;
  requested_doc_type?: string;
  resolved_doc_type?: string;
  document_slot_mismatch?: boolean;
  document_slot_expected?: string;
  document_slot_detected?: string;
  v?: number;
  tamper_cells?: Array<{
    text: string;
    x: number;
    y: number;
    w: number;
    h: number;
    ela_var?: number;
    risk?: "high" | "warning";
  }>;
  tamper_fields?: Array<{
    field: string;
    text: string;
    x: number;
    y: number;
    w: number;
    h: number;
    var?: number;
    ratio?: number;
    risk?: "high" | "warning";
  }>;
  extracted_text?: string;
  word_count?: number;
  issues?: string[];
  quality?: { pass?: boolean; score?: number; message?: string; issues?: string[] };
  security_levels?: SecurityLevels;
};

/** Detect real file type from bytes so we don't feed JSON/HTML into <img>. */
function sniffBinaryKind(buf: ArrayBuffer): "jpeg" | "png" | "gif" | "webp" | "pdf" | "json" | "html" | "unknown" {
  const u = new Uint8Array(buf.byteLength ? buf.slice(0, 16) : new ArrayBuffer(0));
  if (u.length < 2) return "unknown";
  if (u[0] === 0x7b) return "json";
  if (u[0] === 0x3c) return "html";
  if (u.length >= 3 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return "jpeg";
  if (u.length >= 4 && u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return "png";
  if (u.length >= 6 && u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46) return "gif";
  if (u.length >= 4 && u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46) return "pdf";
  if (
    u.length >= 12 &&
    u[0] === 0x52 &&
    u[1] === 0x49 &&
    u[2] === 0x46 &&
    u[3] === 0x46 &&
    u[8] === 0x57 &&
    u[9] === 0x45 &&
    u[10] === 0x42 &&
    u[11] === 0x50
  ) {
    return "webp";
  }
  return "unknown";
}

/** Strip UTF-8 BOM or leading noise so JPEG/PNG magic is at offset 0 (fixes broken <img> when PHP emits BOM). */
function trimBinaryPayload(buf: ArrayBuffer): ArrayBuffer {
  const u = new Uint8Array(buf);
  if (u.length >= 3 && u[0] === 0xef && u[1] === 0xbb && u[2] === 0xbf) {
    return trimBinaryPayload(buf.slice(3));
  }
  for (let i = 0; i <= Math.min(u.length - 3, 512); i++) {
    if (u[i] === 0xff && u[i + 1] === 0xd8 && u[i + 2] === 0xff) {
      return i === 0 ? buf : buf.slice(i);
    }
  }
  for (let i = 0; i <= Math.min(u.length - 4, 512); i++) {
    if (u[i] === 0x89 && u[i + 1] === 0x50 && u[i + 2] === 0x4e && u[i + 3] === 0x47) {
      return i === 0 ? buf : buf.slice(i);
    }
  }
  for (let i = 0; i <= Math.min(u.length - 4, 512); i++) {
    if (u[i] === 0x25 && u[i + 1] === 0x50 && u[i + 2] === 0x44 && u[i + 3] === 0x46) {
      return i === 0 ? buf : buf.slice(i);
    }
  }
  return buf;
}

function mimeForSniff(s: ReturnType<typeof sniffBinaryKind>, fileName: string | undefined): string {
  switch (s) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    default: {
      const fn = (fileName || "").toLowerCase();
      if (fn.endsWith(".png")) return "image/png";
      if (fn.endsWith(".gif")) return "image/gif";
      if (fn.endsWith(".webp")) return "image/webp";
      if (fn.endsWith(".pdf")) return "application/pdf";
      if (/\.(jpe?g)$/.test(fn)) return "image/jpeg";
      return "application/octet-stream";
    }
  }
}

function weightedVerificationFromDocuments(
  documents: unknown,
  getPct: (doc: { id?: unknown; aiConfidence?: unknown }) => number | null,
) {
  return computeWeightedVerificationScore(documents, getPct);
}

function weightedVerificationFromAi(
  documents: unknown,
  aiResultsByDocId: Record<string, AiVerifyResponse>,
  aiDocStateById: Record<string, { state: "pending" | "running" | "done" | "error" }> = {},
) {
  return weightedVerificationFromDocuments(documents, (doc) => {
    const id = String((doc as { id?: unknown }).id ?? "");
    if (aiDocStateById[id]?.state === "running") return null;
    const fromDoc = (doc as { aiConfidence?: unknown }).aiConfidence;
    if (typeof fromDoc === "number" && Number.isFinite(fromDoc)) {
      return fromDoc;
    }
    const r = aiResultsByDocId[id];
    return documentAverageConcernFromAi(r);
  });
}

type AiReviewTier = "strict_manual" | "manual" | "light";

function getAiReviewTier(concernScore: number): {
  tier: AiReviewTier;
  title: string;
  body: string;
  accent: string;
} {
  switch (concernPolicyTier(concernScore)) {
    case "strict":
      return {
        tier: "strict_manual",
        title: "Strict manual verification required",
        body: `Overall concern is above ${CONCERN_STRICT_THRESHOLD}%. Please personally verify this applicant's documents and identity before approving the enrollment.`,
        accent: "border-red-200 bg-red-50/80 text-red-900",
      };
    case "manual":
      return {
        tier: "manual",
        title: "Manual registrar review required",
        body: `Overall concern is between ${CONCERN_MANUAL_THRESHOLD + 1}% and ${CONCERN_STRICT_THRESHOLD}%. Documents should be manually reviewed by the registrar before a final decision.`,
        accent: "border-amber-200 bg-amber-50/80 text-amber-950",
      };
    default:
      return {
        tier: "light",
        title: "Routine review",
        body: `Overall concern is ${CONCERN_MANUAL_THRESHOLD}% or lower. No extra manual checking is required beyond normal procedures; still confirm identity and completeness as needed.`,
        accent: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
      };
  }
}

function docCheckShortTitle(dt: AiDocType): string {
  switch (dt) {
    case "birth_certificate":
      return "PSA birth certificate";
    case "good_moral":
      return "Good moral certificate";
    case "sf9":
      return "SF9 / Report card";
    case "form137":
      return "SF10 / Form 137";
    default:
      return "Document";
  }
}

function enrollmentCrossCheckTitle(dt: AiDocType): string {
  switch (dt) {
    case "birth_certificate":
      return "Enrollment vs PSA (identity)";
    case "good_moral":
      return "Enrollment vs certificate";
    case "sf9":
    case "form137":
      return "Enrollment vs school record";
    default:
      return "Enrollment vs document";
  }
}

function resolveApplicationStudentName(app: any): string {
  const fromParts = [app?.givenName, app?.middleName, app?.lastName, app?.extensionName]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return String(app?.studentName || fromParts || "").trim();
}

function resolveApplicationVerifyFields(app: any) {
  return {
    name: resolveApplicationStudentName(app),
    lrn: String(app?.lrn || "").trim(),
    sex: String(app?.gender || "").trim(),
    schoolYear: String(app?.lastSchoolYearAttended || "").trim(),
    prevSchool: String(app?.previousSchoolAttended || "").trim(),
    dob: String(app?.birthDate || "").trim(),
    birthPlace: String(app?.birthPlace || "").trim(),
    gradeLevel: String(app?.gradeLevel || "").trim(),
    strand: String(app?.strand || "").trim(),
  };
}

const AI_VERIFY_PAYLOAD_VERSION = 49;

/** Good moral: grade level and strand are not enrollment cross-checks. */
const GOOD_MORAL_EXCLUDED_CROSS_FIELDS = new Set(["grade level", "strand / track"]);

/** Visual/document scans shown in cross-check but not enrollment MM %. */
const ENROLLMENT_MM_EXCLUDED_FIELDS = new Set(["signature"]);

type FieldCheckRow = NonNullable<AiVerifyResponse["field_checks"]>[number];

function isSignatureFieldCheck(fc: FieldCheckRow): boolean {
  return String(fc.field || "").trim().toLowerCase() === "signature";
}

function filterFieldChecksForDocType(docType: AiDocType, fieldChecks: FieldCheckRow[]): FieldCheckRow[] {
  let filtered = fieldChecks;
  if (docType !== "good_moral") {
    filtered = filtered.filter((fc) => !isSignatureFieldCheck(fc));
  }
  if (docType === "good_moral") {
    filtered = filtered.filter(
      (fc) => !GOOD_MORAL_EXCLUDED_CROSS_FIELDS.has(String(fc.field || "").trim().toLowerCase()),
    );
  }
  if (docType === "sf9" || docType === "form137") {
    filtered = filtered.filter(
      (fc) => String(fc.field || "").trim().toLowerCase() !== "grade level",
    );
  }
  return filtered;
}

function filterIssuesForDisplay(docType: AiDocType, issues: string[]): string[] {
  return issues.filter((issue) => {
    const lower = issue.toLowerCase();
    if (docType !== "good_moral" && lower.includes("signature")) return false;
    if (docType !== "birth_certificate" && docType !== "good_moral" && (lower.includes("seal") || lower.includes("logo"))) return false;
    return true;
  });
}

function filterIssuesForDocType(
  docType: AiDocType,
  issues: string[],
  fieldChecks: FieldCheckRow[] = [],
): string[] {
  if (docType !== "good_moral") return issues;
  const nameRow = fieldChecks.find((fc) => String(fc.field || "").trim().toLowerCase() === "name");
  const nameOk = nameRow?.ok === true;
  const nameDetected = String(nameRow?.detected || "").trim();
  return issues.filter((issue) => {
    const lower = issue.toLowerCase();
    if (lower.includes("grade level") || lower.includes("strand")) return false;
    if (
      nameOk &&
      nameDetected &&
      (lower.includes("not clearly found") || lower.includes("not clearly found in the certificate"))
    ) {
      return false;
    }
    return true;
  });
}

function singleFieldCheckConcernPct(fc: FieldCheckRow): number {
  if (fc.ok === true) return 0;
  if (fc.ok === null) return 0;
  if (typeof fc.concern_pct === "number" && Number.isFinite(fc.concern_pct)) {
    return Math.max(0, Math.min(100, Math.round(fc.concern_pct)));
  }
  if (typeof fc.match_ratio === "number" && Number.isFinite(fc.match_ratio)) {
    return Math.max(1, 100 - Math.round(fc.match_ratio * 100));
  }
  return 100;
}

function fieldCheckConcernLabel(fc: Pick<FieldCheckRow, "ok" | "match_ratio" | "concern_pct">): string {
  const concern = singleFieldCheckConcernPct(fc as FieldCheckRow);
  return `${concern}% concern`;
}

function isEnrollmentMmField(field: string): boolean {
  return !ENROLLMENT_MM_EXCLUDED_FIELDS.has(field.trim().toLowerCase());
}

function fieldCheckConcernPct(fieldChecks: FieldCheckRow[]): number {
  const failed = fieldChecks.filter((fc) => fc.ok === false && isEnrollmentMmField(String(fc.field || "")));
  if (!failed.length) return 0;
  const perField = failed.map(singleFieldCheckConcernPct);
  return Math.max(
    1,
    Math.min(100, Math.round(perField.reduce((sum, n) => sum + n, 0) / perField.length)),
  );
}

function rebuildMismatchSecurityLevel(
  security: AiVerifyResponse["security_levels"],
  fieldChecks: FieldCheckRow[],
  _docChecks: Array<{ field?: string; ok?: boolean }> = [],
): AiVerifyResponse["security_levels"] {
  const failed = fieldChecks.filter(
    (fc) => fc.ok === false && isEnrollmentMmField(String(fc.field || "")),
  );
  const concern = failed.length ? fieldCheckConcernPct(failed) : 0;
  const failedNames = failed.map((fc) => String(fc.field || "").trim()).filter(Boolean);
  const summaryFields = failedNames.slice(0, 6);
  const mismatchIssues = failedNames
    .map((n) => `Mismatch: ${n} does not match the student's enrollment.`)
    .slice(0, 8);
  const hasMismatch = failed.length > 0;
  const mismatchLevel = {
    level: 1,
    title: "Document & enrollment mismatch",
    pass: !hasMismatch,
    score: hasMismatch ? concern : 0,
    summary: hasMismatch
      ? `Mismatch concern ${concern}% — missing or mismatched: ${summaryFields.join(", ")}.`
      : "No document or enrollment mismatch — 0% concern.",
    issues: mismatchIssues,
  };

  if (!security?.levels?.length) {
    if (!hasMismatch) return security;
    return {
      levels: [mismatchLevel],
      overall_pass: false,
      alert_level: 1,
      highest_level_passed: 1,
      quality_enforced_at_upload: true,
    };
  }

  const levels = security.levels.map((lv) =>
    /mismatch|enrollment/i.test(lv.title)
      ? { ...lv, ...mismatchLevel, level: lv.level }
      : lv,
  );
  const tamperOk = levels.find((l) => /tamper|integrity/i.test(l.title))?.pass ?? true;
  return {
    ...security,
    levels,
    overall_pass: !hasMismatch && Boolean(tamperOk),
    alert_level: hasMismatch ? 1 : (security.alert_level ?? 0),
  };
}

function filterSecurityLevelsForDocType(
  docType: AiDocType,
  security: AiVerifyResponse["security_levels"],
  fieldChecks: FieldCheckRow[] = [],
  docChecks: Array<{ field?: string; ok?: boolean }> = [],
): AiVerifyResponse["security_levels"] {
  return rebuildMismatchSecurityLevel(security, fieldChecks, docChecks);
}

function aiResultForDisplay(
  docType: AiDocType,
  r: AiVerifyResponse | undefined | null,
): AiVerifyResponse | null {
  if (!r) return null;
  const field_checks = filterFieldChecksForDocType(
    docType,
    Array.isArray(r.field_checks) ? r.field_checks : [],
  );
  const doc_checks = (Array.isArray(r.doc_checks) ? r.doc_checks : []).filter((c) => {
    if (docType !== "good_moral" && isSignatureRelatedDocCheck(c)) return false;
    if (
      docType !== "birth_certificate" &&
      docType !== "good_moral" &&
      isVisualSealOrLogoCheck(c)
    ) {
      return false;
    }
    if (docType === "good_moral" && isRedundantAuthoritySignatureKeywordCheck(c)) return false;
    return true;
  });
  const issuesFiltered = filterIssuesForDisplay(
    docType,
    filterIssuesForDocType(
      docType,
      Array.isArray(r.issues) ? r.issues : [],
      field_checks,
    ),
  );
  const base =
    docType === "good_moral"
      ? {
          ...r,
          field_checks,
          doc_checks,
          issues: issuesFiltered,
        }
      : { ...r, field_checks, doc_checks, issues: issuesFiltered };
  return {
    ...base,
    seal_scan:
      docType === "birth_certificate" || docType === "good_moral"
        ? base.seal_scan
        : undefined,
    security_levels: filterSecurityLevelsForDocType(
      docType,
      base.security_levels,
      field_checks,
      doc_checks,
    ),
  };
}

function aiDocTypeFromResolved(resolved: string): AiDocType | null {
  const r = resolved.toLowerCase().trim();
  if (r === "birth_certificate" || r === "birthcert") return "birth_certificate";
  if (r === "good_moral" || r === "goodmoral") return "good_moral";
  if (r === "sf9" || r === "report_card") return "sf9";
  if (r === "sf10" || r === "form137" || r === "form157") return "form137";
  if (r === "photo_2x2" || r === "2x2" || r === "id_photo" || r === "photo") return "photo_2x2";
  return null;
}

function normalizeDocTypeFromLabel(label: string): AiDocType {
  const l = label.toLowerCase().trim();
  if (!l) return "other";
  if (l.includes("2x2") || (l.includes("picture") && l.includes("white"))) return "photo_2x2";
  if (l.includes("psa") || l.includes("birth")) return "birth_certificate";
  if (l.includes("good moral")) return "good_moral";
  if (l.includes("sf9") || l.includes("report card")) return "sf9";
  if (l.includes("form 137") || l.includes("form137") || l.includes("sf10")) return "form137";
  return "other";
}

function mapDocType(doc: { requirementLabel?: unknown; type?: unknown; name?: unknown; fileName?: unknown }): AiDocType {
  const label = String(doc?.requirementLabel ?? doc?.type ?? "").trim();
  if (label) return normalizeDocTypeFromLabel(label);
  const fallback = String(doc?.name ?? doc?.fileName ?? "").trim();
  return fallback ? normalizeDocTypeFromLabel(fallback) : "other";
}

function normalizeAiDocTypeKey(docType: string): string {
  const t = docType.toLowerCase().trim();
  if (t === "birthcert") return "birth_certificate";
  if (t === "sf10" || t === "form137" || t === "form157") return "form137";
  if (t === "report_card") return "sf9";
  if (t === "goodmoral") return "good_moral";
  return t || "other";
}

function isDocumentSlotMismatch(ai?: AiVerifyResponse | null): boolean {
  if (!ai) return false;
  if (ai.document_slot_mismatch === true) return true;
  const req = String(ai.requested_doc_type ?? "").trim();
  const res = String(ai.resolved_doc_type ?? "").trim();
  if (!req || !res) return false;
  return normalizeAiDocTypeKey(req) !== normalizeAiDocTypeKey(res);
}

function documentSlotMismatchMessage(ai?: AiVerifyResponse | null): string | null {
  if (!isDocumentSlotMismatch(ai)) return null;
  const expected =
    String(ai?.document_slot_expected ?? "").trim() ||
    docCheckShortTitle(
      (aiDocTypeFromResolved(String(ai?.requested_doc_type ?? "")) ??
        "other") as AiDocType,
    );
  const detected =
    String(ai?.document_slot_detected ?? "").trim() ||
    docCheckShortTitle(
      (aiDocTypeFromResolved(String(ai?.resolved_doc_type ?? "")) ??
        "other") as AiDocType,
    );
  return `Wrong document uploaded: this slot requires ${expected}, but the scan is a ${detected}. Ask the student to re-upload the correct file.`;
}

type EnrollmentCrossRow = {
  field: string;
  expected: string;
  detected?: string;
  ok: boolean | null;
  match_ratio?: number;
  concern_pct?: number;
};

/** Enrollment form fields that should be compared to OCR for each requirement type. */
function enrollmentCrossCheckPlan(docType: AiDocType, app: any): EnrollmentCrossRow[] {
  const f = resolveApplicationVerifyFields(app);
  const maybe = (field: string, expected: string): EnrollmentCrossRow | null =>
    expected.trim() ? { field, expected: expected.trim(), ok: null } : null;

  if (docType === "birth_certificate") {
    return [
      maybe("Name", f.name),
      maybe("Sex", f.sex),
      maybe("Date of birth", f.dob),
      maybe("Place of birth", f.birthPlace),
    ].filter(Boolean) as EnrollmentCrossRow[];
  }
  if (docType === "good_moral") {
    return [
      maybe("Name", f.name),
      maybe("Previous school", f.prevSchool),
      maybe("School year", f.schoolYear),
      { field: "Signature", expected: "Handwritten signature present", ok: null },
    ].filter(Boolean) as EnrollmentCrossRow[];
  }
  if (docType === "sf9" || docType === "form137") {
    return [
      maybe("Name", f.name),
      maybe("LRN", f.lrn),
      maybe("Sex", f.sex),
      maybe("School year", f.schoolYear),
      maybe("Previous school", f.prevSchool),
    ].filter(Boolean) as EnrollmentCrossRow[];
  }
  const nameRow = maybe("Name", f.name);
  return nameRow ? [nameRow] : [];
}

function applyEnrollmentCrossChecks(
  plan: EnrollmentCrossRow[],
  aiChecks: Array<{ field?: string; expected?: string; detected?: string; ok?: boolean; match_ratio?: number; concern_pct?: number }>,
): EnrollmentCrossRow[] {
  return plan.map((row) => {
    const hit = aiChecks.find(
      (c) => String(c.field || "").toLowerCase() === row.field.toLowerCase(),
    );
    if (!hit) return row;
    return {
      field: row.field,
      expected: String(hit.expected ?? row.expected),
      detected: hit.detected ? String(hit.detected) : "",
      ok: Boolean(hit.ok),
      match_ratio: typeof hit.match_ratio === "number" ? hit.match_ratio : undefined,
      concern_pct: typeof hit.concern_pct === "number" ? hit.concern_pct : undefined,
    };
  });
}

function summarizeEnrollmentCrossRows(rows: EnrollmentCrossRow[]) {
  const judged = rows.filter((r) => r.ok !== null);
  const okCount = judged.filter((r) => r.ok === true).length;
  const badCount = judged.filter((r) => r.ok === false).length;
  const pendingCount = rows.filter((r) => r.ok === null).length;
  const badBits = judged
    .filter((r) => r.ok === false)
    .map((r) => `${r.field} (${fieldCheckConcernLabel(r)})`);
  const okNames = judged.filter((r) => r.ok === true).map((r) => r.field);
  return { okCount, badCount, pendingCount, total: rows.length, badBits, okNames };
}

function isAiVerifyPayloadStale(docType: AiDocType, app: any, r?: AiVerifyResponse | null): boolean {
  if (!r) return true;
  const version = Number(r.v ?? 0);
  if (version > 0 && version < AI_VERIFY_PAYLOAD_VERSION) return true;
  if (!r.resolved_doc_type) return true;
  const effective = aiDocTypeFromResolved(String(r.resolved_doc_type ?? "")) ?? docType;
  if (
    (effective === "birth_certificate" || effective === "good_moral") &&
    !r.seal_scan &&
    !r.doc_checks?.some((c) => /seal|logo/i.test(String(c.field || "")))
  ) {
    return true;
  }
  if (effective === "good_moral" && Array.isArray(r.field_checks)) {
    const hasExcluded = r.field_checks.some((fc) =>
      GOOD_MORAL_EXCLUDED_CROSS_FIELDS.has(String(fc.field || "").trim().toLowerCase()),
    );
    if (hasExcluded) return true;
    const sig = r.field_checks.find((fc) => isSignatureFieldCheck(fc));
    if (!sig) return true;
    if (sig.ok === false && String(sig.scan_method || "").toLowerCase() !== "visual") return true;
  }
  const mismatchLv = r.security_levels?.levels?.find((lv) =>
    /mismatch|enrollment/i.test(lv.title),
  );
  const failedFields = filterFieldChecksForDocType(effective, r.field_checks ?? []).filter(
    (fc) => fc.ok === false,
  );
  if (mismatchLv?.pass && failedFields.length > 0) return true;
  if (Number(r.v ?? 0) > 0 && Number(r.v ?? 0) < AI_VERIFY_PAYLOAD_VERSION && failedFields.length > 0) {
    return true;
  }
  if (mismatchLv?.summary && failedFields.length > 1) {
    const listed = failedFields.filter((fc) =>
      mismatchLv.summary!.toLowerCase().includes(String(fc.field || "").toLowerCase()),
    );
    if (listed.length < failedFields.length) return true;
  }
  const planned = enrollmentCrossCheckPlan(effective, app).length;
  if (planned <= 0) return false;
  const got = filterFieldChecksForDocType(effective, r.field_checks ?? []).length;
  return got < Math.min(planned, 3);
}

function aiVerifyFromDocument(doc: { aiVerify?: AiVerifyResponse | null }): AiVerifyResponse | null {
  const payload = doc?.aiVerify;
  if (!payload || typeof payload !== "object") return null;
  return payload as AiVerifyResponse;
}

const DOC_AI_SETTLED_PREFIX = "intellidocs_doc_ai_settled_v1_";

function docAiSettledStorageKey(docId: string): string {
  return `${DOC_AI_SETTLED_PREFIX}${docId}`;
}

function isDocumentAiSettledInBrowser(docId: string): boolean {
  try {
    return sessionStorage.getItem(docAiSettledStorageKey(docId)) === "1";
  } catch {
    return false;
  }
}

function markDocumentAiSettledInBrowser(docId: string): void {
  try {
    sessionStorage.setItem(docAiSettledStorageKey(docId), "1");
  } catch {
    /* ignore quota / private mode */
  }
}

function clearDocumentAiSettledInBrowser(docId: string): void {
  try {
    sessionStorage.removeItem(docAiSettledStorageKey(docId));
  } catch {
    /* ignore */
  }
}

function documentAiStatus(doc: { aiStatus?: unknown; ai_status?: unknown }): string {
  return String(doc?.aiStatus ?? doc?.ai_status ?? "").toLowerCase().trim();
}

function documentAiIsPending(doc: { aiStatus?: unknown; ai_status?: unknown; aiConfidence?: unknown; aiVerify?: unknown }): boolean {
  if (doc?.aiVerify && typeof doc.aiVerify === "object") return false;
  if (typeof doc?.aiConfidence === "number" && Number.isFinite(doc.aiConfidence)) return false;
  const st = documentAiStatus(doc);
  return st === "" || st === "pending";
}

function documentAiIsSettled(docId: string, doc: any, app?: any): boolean {
  const envelope = aiVerifyFromDocument(doc);
  if (envelope) {
    const docType = mapDocType(doc);
    if (isAiVerifyPayloadStale(docType, app ?? null, envelope)) return false;
    return true;
  }
  if (isDocumentAiSettledInBrowser(docId)) return true;
  if (typeof doc?.aiConfidence === "number" && Number.isFinite(doc.aiConfidence)) return true;
  const st = documentAiStatus(doc);
  if (st === "processing" || st === "queued") return true;
  if (st && st !== "pending") return true;
  return hydrateAiResultFromDocument(doc, app) !== null;
}

function documentAiIsLocked(doc: { aiStatus?: unknown; ai_status?: unknown }): boolean {
  return !documentAiIsPending(doc);
}

function documentNeedsAutoAiRun(docId: string, doc: any, app?: any): boolean {
  if (!doc?.id) return false;
  if (guessDocKind(doc?.mimeType, doc?.fileName || doc?.name) !== "image") return false;
  if (documentAiIsSettled(docId, doc, app)) return false;
  const envelope = aiVerifyFromDocument(doc);
  if (envelope && isAiVerifyPayloadStale(mapDocType(doc), app ?? null, envelope)) return true;
  return documentAiIsPending(doc);
}

function hydrateAiResultFromDocument(doc: any, app?: any): AiVerifyResponse | null {
  const fromEnvelope = aiVerifyFromDocument(doc);
  if (fromEnvelope) {
    const docType = mapDocType(doc);
    if (isAiVerifyPayloadStale(docType, app ?? null, fromEnvelope)) {
      return null;
    }
    return aiResultForDisplay(docType, fromEnvelope) ?? fromEnvelope;
  }

  if (typeof doc?.aiConfidence === "number" && Number.isFinite(doc.aiConfidence)) {
    const st = documentAiStatus(doc);
    const verified =
      st.includes("verify") ||
      st === "approved" ||
      st === "pass" ||
      st === "" ||
      st === "failed" ||
      st === "tampered";
    return {
      v: AI_VERIFY_PAYLOAD_VERSION,
      status: verified ? "verified" : "failed",
      confidence: Math.max(0, Math.min(1, doc.aiConfidence / 100)),
    } as AiVerifyResponse;
  }

  if (!documentAiIsLocked(doc)) return null;

  const st = documentAiStatus(doc);
  const verified = st.includes("verify") || st === "approved" || st === "pass";
  return {
    v: AI_VERIFY_PAYLOAD_VERSION,
    status: verified ? "verified" : "failed",
    confidence: verified ? 1 : 0,
  } as AiVerifyResponse;
}

type DocCheckRow = { field: string; ok: boolean; scan_method?: string; match_ratio?: number; note?: string };

function isVisualSealOrLogoCheck(c: DocCheckRow): boolean {
  const field = String(c.field || "").toLowerCase();
  return (
    String(c.scan_method || "").toLowerCase() === "visual" ||
    /seal|logo/i.test(field)
  );
}

function isRedundantAuthoritySignatureKeywordCheck(c: DocCheckRow): boolean {
  return /authority\/signature keyword/i.test(String(c.field || ""));
}

function isSignatureRelatedDocCheck(c: DocCheckRow): boolean {
  const field = String(c.field || "").toLowerCase();
  return isRedundantAuthoritySignatureKeywordCheck(c) || /signature/i.test(field);
}

function splitDocChecksForDisplay(docChecks: DocCheckRow[]) {
  const visual = docChecks.filter(isVisualSealOrLogoCheck);
  const labels = docChecks.filter(
    (c) => !isVisualSealOrLogoCheck(c) && !isRedundantAuthoritySignatureKeywordCheck(c),
  );
  return { visual, labels };
}

type CheckDetailVisibility = {
  tamper: boolean;
  synthetic: boolean;
  sealLogo: boolean;
  labels: boolean;
  enrollment: boolean;
};

function checkDetailVisibility(docType: AiDocType): CheckDetailVisibility {
  switch (docType) {
    case "photo_2x2":
      return {
        tamper: true,
        synthetic: true,
        sealLogo: false,
        labels: false,
        enrollment: false,
      };
    case "birth_certificate":
      return {
        tamper: true,
        synthetic: true,
        sealLogo: true,
        labels: true,
        enrollment: true,
      };
    case "good_moral":
      return {
        tamper: true,
        synthetic: true,
        sealLogo: true,
        labels: true,
        enrollment: true,
      };
    case "sf9":
    case "form137":
      return {
        tamper: true,
        synthetic: true,
        sealLogo: false,
        labels: true,
        enrollment: true,
      };
    default:
      return {
        tamper: true,
        synthetic: true,
        sealLogo: false,
        labels: true,
        enrollment: true,
      };
  }
}

function checkDetailsIntro(docType: AiDocType): string {
  switch (docType) {
    case "photo_2x2":
      return "Tamper and synthetic checks for this 2×2 photo — no enrollment or label OCR on photos.";
    case "birth_certificate":
      return "PSA seal/logo, document labels, identity cross-check, and integrity signals.";
    case "good_moral":
      return "School seal/logo, certificate labels, enrollment cross-check, signature scan, and integrity signals.";
    case "sf9":
      return "Report card labels, enrollment cross-check, and integrity signals.";
    case "form137":
      return "Form 137 labels, enrollment cross-check, and integrity signals.";
    default:
      return "Supporting signals from OCR and rules — always confirm against the original file.";
  }
}

function summarizeDocChecks(docChecks: DocCheckRow[]) {
  const missing = docChecks.filter((c) => !c.ok);
  const pass = docChecks.length - missing.length;
  const shortLabel = (raw: string) => {
    const t = String(raw).replace(/\s+/g, " ").trim();
    return t.length > 48 ? `${t.slice(0, 46)}…` : t;
  };
  return {
    pass,
    total: docChecks.length,
    missingShort: missing.map((m) => shortLabel(m.field)),
  };
}

/** Shorten noisy OCR for enrollment cross-check display. */
function formatCrossCheckDetected(field: string, detected: string): string {
  let d = String(detected || "").replace(/\s+/g, " ").trim();
  if (!d) return "";
  const key = field.trim().toLowerCase();
  if (key === "name") {
    d = d
      .replace(/^THIS IS TO CERTIFY THAT\s+/i, "")
      .replace(/^CERTIF(?:Y|IES)\s+THAT\s+/i, "")
      .replace(/^CERTIFICATION\s+/i, "")
      .replace(/^TO WHOM IT MAY CONCERN[,:\s]*/i, "")
      .replace(/\s+OF\s+GRADE\s+\d+.*$/i, "")
      .replace(/\s+IS\s+A\s+.*$/i, "")
      .replace(/\s*-\s*(HUMSS|STEM|ABM|ICT|EIM|GAS|TVL|BPP|FBS).*$/i, "");
    const certMatch = d.match(
      /\b([A-Z][A-Za-z.'-]+(?:\s+(?:[A-Z]\.?|[A-Z][A-Za-z.'-]+)){1,5})\b/i,
    );
    if (certMatch && (d.length > 42 || /\bOF\s+GRADE\b/i.test(d))) {
      return certMatch[1].trim();
    }
  }
  if (d.length > 72) return `${d.slice(0, 70)}…`;
  return d;
}

/** One-line explanation for the Documents tab (plain language). */
function documentAiSummaryLine(opts: {
  ai?: AiVerifyResponse;
  isPhoto: boolean;
  concernPct: number | null;
  aiState?: "pending" | "running" | "done" | "error";
  clearedOnFile?: boolean;
}): string {
  const { ai, isPhoto, concernPct, aiState, clearedOnFile } = opts;
  if (aiState === "running") return "AI is checking this file…";
  if (aiState === "error") return "AI check did not finish — open View and verify manually.";
  if (clearedOnFile && concernPct === null) {
    return "Previously verified on file. Re-run AI only if you need a fresh score.";
  }
  if (concernPct === null) return "Not scored yet. Click Re-run AI above after uploads finish.";

  if (concernPct > CONCERN_STRICT_THRESHOLD || ai?.status === "failed") {
    return "High concern — open View and verify before approving.";
  }
  if (concernPct > CONCERN_MANUAL_THRESHOLD) {
    return "Moderate concern — a quick manual check is recommended.";
  }
  if (isPhoto) {
    return "Low concern — image quality and AI tamper checks look clear.";
  }
  return "Low concern — mismatch and tamper checks look clear.";
}

function summarizeFieldChecks(fieldChecks: NonNullable<AiVerifyResponse["field_checks"]>) {
  const bad = fieldChecks.filter((c) => !c.ok);
  const okCount = fieldChecks.length - bad.length;
  const badBits = bad.map((c) => `${String(c.field)} (${fieldCheckConcernLabel(c)})`);
  const okNames = fieldChecks.filter((c) => c.ok).map((c) => String(c.field));
  return { okCount, badCount: bad.length, total: fieldChecks.length, badBits, okNames };
}

export function ReviewDocuments() {
  const params = useParams();
  const applicationId = params.applicationId;
  const [remarks, setRemarks] = useState("");
  const [rejectReasonPreset, setRejectReasonPreset] = useState<string>("other");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [previewDisplayKind, setPreviewDisplayKind] = useState<"pdf" | "image" | "other" | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewImgRef = useRef<HTMLImageElement | null>(null);
  const [previewImgBox, setPreviewImgBox] = useState<{ w: number; h: number } | null>(null);
  const [previewLightboxOpen, setPreviewLightboxOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [application, setApplication] = useState<any | null>(null);
  const [aiResultsByDocId, setAiResultsByDocId] = useState<Record<string, AiVerifyResponse>>({});
  const [aiRunning, setAiRunning] = useState(false);
  const [aiServiceError, setAiServiceError] = useState<string | null>(null);
  const [aiDocStateById, setAiDocStateById] = useState<
    Record<string, { state: "pending" | "running" | "done" | "error"; error?: string }>
  >({});
  // Tracks an in-flight approve/reject so we can disable the buttons against double-submits.
  const [decisionSubmitting, setDecisionSubmitting] = useState<null | "approve" | "reject">(null);
  // Open confirmation dialog for the approve / reject decision. The big
  // buttons in the review tab now open this dialog instead of firing the
  // action directly, so an accidental click never commits a final decision.
  // The dialog itself contains the remarks textarea (rejection only).
  const [decisionDialog, setDecisionDialog] = useState<null | "approve" | "reject">(null);
  // When overall concern exceeds the strict threshold, the approve dialog forces
  // the registrar to tick this checkbox before confirm is enabled.
  const [lowScoreOverrideAck, setLowScoreOverrideAck] = useState(false);
  // Tracks per-document review-toggle in-flight; document id (string) → boolean.
  const [reviewSubmittingByDocId, setReviewSubmittingByDocId] = useState<Record<string, boolean>>({});
  const [docDecisionDialogOpen, setDocDecisionDialogOpen] = useState(false);
  const [docDecisionRemarks, setDocDecisionRemarks] = useState("");
  const [docRejectReasonPreset, setDocRejectReasonPreset] = useState<string>("other");
  const [docDecisionSubmitting, setDocDecisionSubmitting] = useState(false);

  const resolveEffectiveDocType = (doc: any, ai?: AiVerifyResponse | null): AiDocType => {
    const fromAi = aiDocTypeFromResolved(String(ai?.resolved_doc_type ?? ""));
    if (fromAi) return fromAi;
    return mapDocType(doc);
  };

  /** PSA identity fields — always sent so content-detected birth certs get full checks. */
  const buildIdentityVerifyQuery = (app: any): string => {
    const q = (key: string, value: string) =>
      value.trim() ? `&${key}=${encodeURIComponent(value.trim())}` : "";
    const { name, sex, dob, birthPlace } = resolveApplicationVerifyFields(app);
    return (
      q("expected_name", name) +
      q("expected_sex", sex) +
      q("expected_dob", dob) +
      q("expected_birth_place", birthPlace)
    );
  };

  /** Only send enrollment fields the AI should compare for this document type. */
  const buildExpectedVerifyQuery = (docType: AiDocType, app: any): string => {
    const q = (key: string, value: string) =>
      value.trim() ? `&${key}=${encodeURIComponent(value.trim())}` : "";
    const {
      name,
      lrn,
      sex,
      schoolYear,
      prevSchool,
      dob,
      birthPlace,
      gradeLevel,
      strand,
    } = resolveApplicationVerifyFields(app);
    const identity = buildIdentityVerifyQuery(app);

    if (docType === "birth_certificate") {
      return identity;
    }
    if (docType === "good_moral") {
      return (
        q("expected_name", name) +
        q("expected_prev_school", prevSchool) +
        q("expected_school_year", schoolYear) +
        identity
      );
    }
    if (docType === "sf9" || docType === "form137") {
      return (
        q("expected_name", name) +
        q("expected_lrn", lrn) +
        q("expected_sex", sex) +
        q("expected_school_year", schoolYear) +
        q("expected_prev_school", prevSchool) +
        identity
      );
    }
    return q("expected_name", name) + identity;
  };

  const documentConcernPercent = (r: AiVerifyResponse | undefined): number | null =>
    documentAverageConcernFromAi(r);

  const tamperPercent = (r: AiVerifyResponse | undefined): number | null => tamperConcernPercent(r);

  const syntheticPercent = (r: AiVerifyResponse | undefined): number | null => syntheticConcernPercent(r);

  const tamperPercentForDoc = (
    r: AiVerifyResponse | undefined,
    docType: AiDocType,
  ): number | null => {
    const direct = tamperPercent(r);
    if (direct !== null) return direct;
    if (docType !== "photo_2x2" || !r) return null;
    const aiLv = r.security_levels?.levels?.find((l) =>
      /ai tamper|authenticity/i.test(l.title),
    );
    if (aiLv) return levelConcernPercent(aiLv);
    if (typeof r.tamper_score === "number" && Number.isFinite(r.tamper_score)) {
      return r.tamper_score >= 0.5 ? 0 : Math.max(1, Math.round((1 - r.tamper_score) * 100));
    }
    return null;
  };

  const syntheticPercentForDoc = (
    r: AiVerifyResponse | undefined,
    docType: AiDocType,
  ): number | null => {
    const direct = syntheticPercent(r);
    if (direct !== null) return direct;
    if (docType !== "photo_2x2" || !r) return null;
    const aiLv = r.security_levels?.levels?.find((l) =>
      /ai tamper|authenticity/i.test(l.title),
    );
    if (aiLv) return levelConcernPercent(aiLv);
    if (typeof r.synthetic_score === "number" && Number.isFinite(r.synthetic_score)) {
      return syntheticConcernPercent(r);
    }
    return null;
  };

  const summarizeTamper = (
    r: AiVerifyResponse | undefined,
    docType: AiDocType,
  ): { title: string; body: string; tone: string } | null => {
    if (!r) return null;
    const isPhoto = docType === "photo_2x2";
    if (r.tamper_applicable === false && !isPhoto) {
      return {
        title: "Tamper check: Not applicable",
        body: "Tamper scan is not run for this document type.",
        tone: "border-gray-200 bg-gray-50 text-gray-700",
      };
    }

    const cells = Array.isArray(r?.tamper_cells) ? r.tamper_cells : [];
    const fields = Array.isArray(r?.tamper_fields) ? r.tamper_fields : [];

    const hasHigh =
      cells.some((c) => c?.risk === "high") || fields.some((f) => f?.risk === "high");
    const hasWarn =
      cells.some((c) => c?.risk === "warning") || fields.some((f) => f?.risk === "warning");

    const concernPct = tamperPercentForDoc(r, docType) ?? 0;
    const risk =
      concernPct <= 10 ? "Clear" : hasHigh ? "High concern" : hasWarn ? "Review" : concernRiskLabel(concernPct);
    const tone = concernScoreSurfaceClasses(concernPct);

    const parts: string[] = [];
    if (!isPhoto) {
      if (cells.length > 0) parts.push(`${cells.length} suspicious grade cell(s)`);
      if (fields.length > 0) parts.push(`${fields.length} suspicious field(s)`);
    } else {
      const actionable = fields.filter(
        (f) => String(f?.risk || "").toLowerCase() in { high: 1, warning: 1 },
      );
      const portraitOnly =
        fields.length > 0 &&
        actionable.length === 0 &&
        fields.some((f) => String(f?.field || "").toLowerCase() === "portrait");
      if (actionable.length > 0) {
        parts.push(`${actionable.length} suspicious region(s)`);
      } else if (portraitOnly) {
        parts.push("portrait area scanned — no edit hotspots");
      }
    }
    const what = parts.length
      ? parts.join(" and ")
      : isPhoto
        ? "no manipulation signals on this photo"
        : "no suspicious areas detected";

    let body = `Result: ${what}.`;
    if (hasHigh) {
      body += isPhoto
        ? " Review the portrait for possible edits or AI generation."
        : " Recommend manual verification and compare to original source.";
    } else if (hasWarn) {
      body += " Recommend a quick manual check of highlighted areas.";
    }

    return { title: `Tamper check: ${risk}`, body, tone };
  };
  
  const loadApplication = async () => {
    if (!applicationId) return;
    try {
      setError(null);
      const response = await apiFetch(`/api/registrar/application?application_id=${encodeURIComponent(applicationId)}`);
      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server returned an invalid response");
      }
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to load application (${response.status})`);
      }
      const app = data.application ?? null;
      setApplication(app);
      setRemarks(String(app?.registrarRemarks ?? ""));

      const seeded: Record<string, AiVerifyResponse> = {};
      const doneStates: Record<string, { state: "done" }> = {};
      for (const doc of Array.isArray(app?.documents) ? app.documents : []) {
        if (!doc?.id) continue;
        const id = String(doc.id);
        const docType = mapDocType(doc);
        const fromEnvelope = aiVerifyFromDocument(doc);
        if (fromEnvelope && isAiVerifyPayloadStale(docType, app, fromEnvelope)) {
          clearDocumentAiSettledInBrowser(id);
          continue;
        }
        const hydrated = hydrateAiResultFromDocument(doc, app);
        if (hydrated) {
          seeded[id] = hydrated;
          doneStates[id] = { state: "done" };
        }
      }
      if (Object.keys(seeded).length > 0) {
        setAiResultsByDocId(seeded);
        setAiDocStateById(doneStates);
      } else {
        setAiResultsByDocId({});
        setAiDocStateById({});
      }

      if (app?.isAlreadyEnrolled && app?.status !== "Rejected") {
        setDecisionDialog(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load application");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadApplication();
    // Load once. Polling is intentionally disabled because AI verification (EasyOCR)
    // is CPU-heavy and would re-trigger work too often.
  }, [applicationId]);

  const handleApprove = async () => {
    if (!application?.enrollmentId) return;
    if (decisionSubmitting !== null) return;
    setDecisionSubmitting("approve");
    try {
      const res = await apiFetch('/api/registrar/application', {
        method: 'POST',
        body: JSON.stringify({
          action: 'approve',
          enrollment_id: application.enrollmentId,
          remarks,
        }),
      });
      const text = await res.text();
      const data = JSON.parse(text);
      if (!res.ok || !data.success) {
        const err = String(data.error || "");
        if (err === "credentials_already_issued") {
          toast.error(
            "This student already has school credentials and is enrolled. They should appear under Students, not Applications."
          );
        } else {
          toast.error(formatApiError(data, `Failed to approve (${res.status})`));
        }
        return;
      }
      if (data.already_enrolled) {
        toast.message(data.message || "Student is already enrolled.");
      } else {
        toast.success(data.message || `Application approved — ${application.id} is now enrolled`);
      }

      // Show how the student was placed into a section so the registrar
      // has immediate feedback (auto-filled vs. needs manual placement,
      // and whether they got their preferred shift).
      const sa = (data as {
        section_assignment?: {
          assigned?: boolean;
          section?: string | null;
          shift?: string | null;
          preferred_shift?: string | null;
          shift_fallback?: boolean;
          auto_created?: boolean;
          warning?: string | null;
        };
      }).section_assignment;
      if (sa) {
        const shiftLabel = sa.shift === 'afternoon' ? 'afternoon' : 'morning';
        const preferredLabel = sa.preferred_shift === 'afternoon' ? 'afternoon' : 'morning';
        if (sa.assigned && sa.section) {
          if (sa.auto_created) {
            toast.success(
              `Auto-assigned to a newly created section "${sa.section}" (${shiftLabel} shift). The previous sections were full.`,
            );
          } else {
            toast.success(`Auto-assigned to section "${sa.section}" (${shiftLabel} shift).`);
          }
          if (sa.shift_fallback) {
            toast.warning(
              `Student preferred the ${preferredLabel} shift, but all ${preferredLabel} sections were full. Placed in the ${shiftLabel} shift instead — reassign on the Sections page if needed.`,
            );
          }
        } else if (sa.warning === 'eim_female_manual_placement') {
          toast.warning('Female applicant for EIM was not auto-placed. Please assign her section manually from the Sections page.');
        } else if (sa.warning) {
          toast.warning('Section auto-assignment was skipped. Please assign this student to a section manually.');
        }
      }

      setDecisionDialog(null);
      loadApplication();
    } finally {
      setDecisionSubmitting(null);
    }
  };

  const handleReject = async () => {
    if (!remarks.trim()) {
      toast.error("Please provide remarks for rejection");
      return;
    }
    if (!application?.enrollmentId) return;
    if (decisionSubmitting !== null) return;
    setDecisionSubmitting("reject");
    try {
      const res = await apiFetch('/api/registrar/application', {
        method: 'POST',
        body: JSON.stringify({
          action: 'reject',
          enrollment_id: application.enrollmentId,
          remarks,
        }),
      });
      const text = await res.text();
      const data = JSON.parse(text);
      if (!res.ok || !data.success) {
        toast.error(formatApiError(data, `Failed to reject (${res.status})`));
        return;
      }
      toast.success(data.message || `Application ${application.id} rejected`);
      setDecisionDialog(null);
      loadApplication();
    } finally {
      setDecisionSubmitting(null);
    }
  };

  const handleSaveRemarks = async () => {
    if (!application?.enrollmentId) return;
    const res = await apiFetch('/api/registrar/application', {
      method: 'POST',
      body: JSON.stringify({
        action: 'save_remarks',
        enrollment_id: application.enrollmentId,
        remarks,
      }),
    });
    const text = await res.text();
    const data = JSON.parse(text);
    if (!res.ok || !data.success) {
      toast.error(formatApiError(data, `Failed to save remarks (${res.status})`));
      return;
    }
    toast.success(data.message || "Remarks saved successfully");
  };

  /**
   * Toggle the registrar's manual "reviewed" flag on a document. Independent of AI status.
   * Optimistic: flips the in-memory document immediately, rolls back on server error.
   */
  const toggleDocumentReviewed = async (documentId: number | string, nextReviewed: boolean) => {
    const idStr = String(documentId);
    if (reviewSubmittingByDocId[idStr]) return;
    setReviewSubmittingByDocId((prev) => ({ ...prev, [idStr]: true }));

    // Optimistic local update so the UI feels instant.
    const previous = application;
    setApplication((prev: any) => {
      if (!prev || !Array.isArray(prev.documents)) return prev;
      return {
        ...prev,
        documents: prev.documents.map((d: any) =>
          String(d.id) === idStr ? { ...d, registrarReviewed: nextReviewed } : d,
        ),
        documentsReviewed:
          (prev.documentsReviewed ?? 0) + (nextReviewed ? 1 : -1),
      };
    });
    setSelectedDocument((sel: any) =>
      sel && String(sel.id) === idStr ? { ...sel, registrarReviewed: nextReviewed } : sel,
    );

    try {
      const res = await apiFetch('/api/registrar/document-review', {
        method: 'POST',
        body: JSON.stringify({ document_id: Number(documentId), reviewed: nextReviewed }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Roll back optimistic update.
        setApplication(previous);
        setSelectedDocument((sel: any) =>
          sel && String(sel.id) === idStr ? { ...sel, registrarReviewed: !nextReviewed } : sel,
        );
        toast.error(formatApiError(data, `Failed to update review status (${res.status})`));
        return;
      }
      toast.success(nextReviewed ? "Marked as reviewed" : "Reviewed flag cleared");
    } catch (e) {
      setApplication(previous);
      setSelectedDocument((sel: any) =>
        sel && String(sel.id) === idStr ? { ...sel, registrarReviewed: !nextReviewed } : sel,
      );
      toast.error(e instanceof Error ? e.message : "Failed to update review status");
    } finally {
      setReviewSubmittingByDocId((prev) => {
        const next = { ...prev };
        delete next[idStr];
        return next;
      });
    }
  };

  const rejectDocumentAndRequireResubmission = async (documentId: number | string, remarks: string) => {
    const trimmed = String(remarks || "").trim();
    if (!trimmed) {
      toast.error("Please provide a reason so the student knows what to resubmit.");
      return;
    }
    if (docDecisionSubmitting) return;
    setDocDecisionSubmitting(true);
    try {
      const res = await apiFetch("/api/registrar/document-decision", {
        method: "POST",
        body: JSON.stringify({
          document_id: Number(documentId),
          action: "reject",
          remarks: trimmed,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.success) {
        const code =
          data?.error === "remarks_required"
            ? "Reason is required"
            : formatApiError(data, `Failed to reject document (${res.status})`);
        toast.error(code);
        return;
      }

      // Update selected doc + application docs list so UI reflects immediately.
      setSelectedDocument((prev: any) => {
        if (!prev || String(prev.id) !== String(documentId)) return prev;
        return {
          ...prev,
          status: "Flagged",
          registrarReviewed: false,
          registrarDocDecision: "rejected",
          registrarDocRemarks: trimmed,
          issues: Array.isArray(prev.issues) ? prev.issues : [],
        };
      });
      setApplication((prev: any) => {
        if (!prev) return prev;
        const docs = Array.isArray(prev.documents) ? prev.documents : [];
        const nextDocs = docs.map((d: any) => {
          if (String(d?.id) !== String(documentId)) return d;
          return {
            ...d,
            status: "Flagged",
            registrarReviewed: false,
            registrarDocDecision: "rejected",
            registrarDocRemarks: trimmed,
          };
        });
        return { ...prev, documents: nextDocs };
      });

      // The backend tries to dispatch a "please resubmit" email to the
      // student right after a rejection; surface the outcome so the
      // registrar knows whether the student was notified automatically or
      // still needs a manual heads-up.
      const emailSent = Boolean(data?.email_sent);
      toast.success(
        emailSent
          ? "Document rejected. The student has been emailed to resubmit this requirement."
          : "Document rejected. Email could not be sent automatically — please follow up with the student.",
        { duration: emailSent ? 5000 : 8000 }
      );
      setDocDecisionDialogOpen(false);
      setDocDecisionRemarks("");
      setDocRejectReasonPreset("other");
    } catch (e: any) {
      toast.error(e?.message || "Failed to reject document");
    } finally {
      setDocDecisionSubmitting(false);
    }
  };

  const getDocumentStatusColor = (status: string) => {
    switch (status) {
      case "Verified":
        return "bg-green-600";
      case "Flagged":
        return "bg-red-600";
      case "Under Review":
        return "bg-yellow-600";
      default:
        return "bg-gray-600";
    }
  };

  const documentsForAi = application
    ? (application.documents ?? []).map((d: any) => {
        const key = String(d?.id ?? "");
        const docType = mapDocType(d);
        if (aiDocStateById[key]?.state === "running") {
          return { ...d, aiConfidence: null };
        }
        const r = aiResultForDisplay(docType, aiResultsByDocId[key]) ?? aiResultsByDocId[key];
        const pct = documentConcernPercent(r);
        return { ...d, aiConfidence: pct };
      })
    : [];
  const weightedVerification =
    documentsForAi.length > 0
      ? weightedVerificationFromAi(documentsForAi, aiResultsByDocId, aiDocStateById)
      : null;
  const aggregateConcern = weightedVerification?.aggregateScore ?? null;
  const aiTier = aggregateConcern !== null ? getAiReviewTier(aggregateConcern) : null;
  const activeConcernPolicy =
    aggregateConcern !== null ? concernPolicyTier(aggregateConcern) : null;
  const aiScoreBreakdown =
    weightedVerification !== null
      ? buildOverallScoreBreakdown(
          documentsForAi,
          aiResultsByDocId,
          aiRunning,
          weightedVerification.aggregateScore,
          weightedVerification.categoryRows,
        )
      : null;

  const handleViewDocument = (doc: any) => {
    if (!application) return;
    const key = String(doc?.id ?? "");
    const docType = mapDocType(doc);
    const ai = aiResultForDisplay(docType, aiResultsByDocId[key]) ?? aiResultsByDocId[key];
    const pct = documentConcernPercent(ai);
    setSelectedDocument({
      ...doc,
      aiConfidence: pct,
      issues: ai?.issues ?? doc.issues,
      extractedText: ai?.extracted_text ?? doc.extractedText,
      aiStatus: ai?.status ?? doc.aiStatus,
      aiError: aiDocStateById[key]?.state === "error" ? aiDocStateById[key]?.error : null,
      studentName: application.studentName,
      applicationId: application.id,
      strand: application.strand,
      gradeLevel: application.gradeLevel,
    });
    setIsDocumentDialogOpen(true);
  };

  // If AI finishes after the dialog opens, refresh dialog fields live.
  useEffect(() => {
    if (!isDocumentDialogOpen || !selectedDocument?.id) return;
    const key = String(selectedDocument.id);
    const docType = mapDocType(selectedDocument);
    const ai = aiResultForDisplay(docType, aiResultsByDocId[key]) ?? aiResultsByDocId[key];
    const pct = documentConcernPercent(ai);
    const aiErr = aiDocStateById[key]?.state === "error" ? aiDocStateById[key]?.error : null;
    setSelectedDocument((prev: any) => {
      if (!prev || String(prev.id) !== key) return prev;
      const next = {
        ...prev,
        aiConfidence: pct,
        issues: ai?.issues ?? prev.issues,
        extractedText: ai?.extracted_text ?? prev.extractedText,
        aiStatus: ai?.status ?? prev.aiStatus,
        aiError: aiErr ?? prev.aiError,
      };
      return next;
    });
  }, [aiResultsByDocId, aiDocStateById, isDocumentDialogOpen, selectedDocument?.id]);

  const downloadDocument = async (doc: { id?: number; fileName?: string; name?: string }) => {
    if (!doc?.id) {
      toast.error("Document is not available for download");
      return;
    }
    try {
      const res = await apiFetch(`/api/document-file?id=${doc.id}&disposition=attachment`);
      if (!res.ok) {
        const errText = await res.text();
        toast.error(errText || `Download failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (doc.fileName || doc.name || "document").replace(/[\\/]/g, "_");
      a.rel = "noopener";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  useEffect(() => {
    if (!isDocumentDialogOpen || !selectedDocument?.id) {
      setPreviewObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPreviewDisplayKind(null);
      setPreviewError(null);
      setPreviewLoading(false);
      setPreviewImgBox(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    (async () => {
      try {
        const res = await apiFetch(`/api/document-file?id=${selectedDocument.id}`);
        const headerCt = (res.headers.get("content-type") || "").toLowerCase();
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        if (!res.ok) {
          let msg = `Could not load preview (${res.status})`;
          try {
            const t = new TextDecoder().decode(buf.slice(0, 2000));
            const j = JSON.parse(t) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }

        const sniff = sniffBinaryKind(buf);
        if (sniff === "json") {
          const t = new TextDecoder().decode(buf.slice(0, 4000));
          let msg = "Could not load file";
          try {
            const j = JSON.parse(t) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
        if (sniff === "html") {
          throw new Error(
            "Server returned HTML instead of the file. Check PHP errors or that the file exists under uploads/documents.",
          );
        }

        const payload = trimBinaryPayload(buf);
        const sniff2 = sniffBinaryKind(payload);

        const fn = String(selectedDocument.fileName || selectedDocument.name || "");
        let mime = headerCt.split(";")[0].trim();
        if (
          sniff2 === "jpeg" ||
          sniff2 === "png" ||
          sniff2 === "gif" ||
          sniff2 === "webp" ||
          sniff2 === "pdf"
        ) {
          mime = mimeForSniff(sniff2, fn);
        } else if (!mime || mime === "application/octet-stream" || mime === "text/plain") {
          mime = mimeForSniff(sniff2, fn);
        }

        const blob = new Blob([payload], { type: mime });

        let display: "pdf" | "image" | "other" = "other";
        if (sniff2 === "pdf" || mime.includes("pdf")) display = "pdf";
        else if (
          sniff2 === "jpeg" ||
          sniff2 === "png" ||
          sniff2 === "gif" ||
          sniff2 === "webp" ||
          mime.startsWith("image/")
        ) {
          display = "image";
        } else if (guessDocKind(selectedDocument.mimeType, fn) === "image") {
          display = "image";
        } else if (guessDocKind(selectedDocument.mimeType, fn) === "pdf") {
          display = "pdf";
        }

        const url = URL.createObjectURL(blob);
        setPreviewObjectUrl(url);
        setPreviewDisplayKind(display);
      } catch (e) {
        if (!cancelled) {
          setPreviewError(e instanceof Error ? e.message : "Could not load preview");
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDocumentDialogOpen, selectedDocument?.id]);

  // Track rendered image size to scale overlay rectangles.
  useEffect(() => {
    if (!isDocumentDialogOpen) return;
    const img = previewImgRef.current;
    if (!img) return;
    const update = () => {
      const r = img.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setPreviewImgBox({ w: r.width, h: r.height });
    };
    update();
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => update());
      ro.observe(img);
    } catch {
      // ignore
    }
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      if (ro) ro.disconnect();
    };
  }, [isDocumentDialogOpen, previewObjectUrl, previewDisplayKind]);

  useEffect(() => {
    setAiResultsByDocId({});
    setAiDocStateById({});
  }, [applicationId]);

  const runVerifyForDoc = useCallback(
    async (doc: any, opts: { rerun?: boolean; applicationSnapshot: any }): Promise<boolean> => {
      const app = opts.applicationSnapshot;
      if (!doc?.id || !app) return false;
      const id = String(doc.id);
      const docType = mapDocType(doc);
      try {
        if (opts.rerun) {
          setAiResultsByDocId((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
        setAiDocStateById((prev) => ({ ...prev, [id]: { state: "running" } }));
        const rerunQs = opts.rerun ? "&rerun=1" : "";
        const aiRes = await apiFetch(
          `/api/ai/verify-document?id=${encodeURIComponent(String(doc.id))}` +
            `&doc_type=${encodeURIComponent(docType)}` +
            buildExpectedVerifyQuery(docType, app) +
            rerunQs,
        );
        const parsed = await parseApiJson<
          | { success: true; result: AiVerifyResponse; cached?: boolean }
          | { success: false; error?: string; detail?: unknown }
        >(aiRes);
        if (!parsed.ok) {
          setAiDocStateById((prev) => ({ ...prev, [id]: { state: "error", error: parsed.error } }));
          return false;
        }
        const body = parsed.data;
        if (!aiRes.ok || !body || (body as { success?: boolean }).success !== true) {
          const msg =
            (body as { error?: string })?.error || `AI verify failed (${parsed.status})`;
          setAiDocStateById((prev) => ({ ...prev, [id]: { state: "error", error: msg } }));
          return false;
        }
        if ((body as { processing?: boolean }).processing) {
          setAiDocStateById((prev) => ({ ...prev, [id]: { state: "done" } }));
          return true;
        }
        const data = (body as { result?: AiVerifyResponse }).result as AiVerifyResponse;
        if (!data || typeof (data as { confidence?: unknown }).confidence !== "number") {
          setAiDocStateById((prev) => ({
            ...prev,
            [id]: { state: "error", error: "AI returned an invalid response" },
          }));
          return false;
        }
        const effectiveDocType = resolveEffectiveDocType(doc, data);
        setAiResultsByDocId((prev) => ({
          ...prev,
          [id]: aiResultForDisplay(effectiveDocType, data) ?? data,
        }));
        setAiDocStateById((prev) => ({ ...prev, [id]: { state: "done" } }));
        markDocumentAiSettledInBrowser(id);
        return true;
      } catch (e) {
        let msg = "Unexpected error running AI";
        if (e && typeof e === "object") {
          const anyE = e as { message?: string; toString?: () => string };
          if (typeof anyE?.message === "string" && anyE.message.trim()) {
            msg = anyE.message.trim();
          } else if (typeof anyE?.toString === "function") {
            const s = String(anyE.toString());
            if (s.trim()) msg = s.trim();
          }
        }
        setAiDocStateById((prev) => ({ ...prev, [id]: { state: "error", error: msg } }));
        return false;
      }
    },
    [],
  );

  const pendingImageDocIds = useMemo(() => {
    if (!Array.isArray(application?.documents)) return "";
    return (application.documents as any[])
      .filter((d) => d?.id && documentNeedsAutoAiRun(String(d.id), d, application))
      .map((d) => String(d.id))
      .sort()
      .join(",");
  }, [application?.documents, application]);

  const handleRerunAi = useCallback(async () => {
    if (!application?.documents?.length) return;
    const docs = (application.documents as any[]).filter(
      (d) => d?.id && guessDocKind(d?.mimeType, d?.fileName || d?.name) === "image",
    );
    if (docs.length === 0) return;
    setAiServiceError(null);
    setAiRunning(true);
    const rerunIds = docs.map((d) => String(d.id));
    setAiResultsByDocId((prev) => {
      const next = { ...prev };
      for (const id of rerunIds) delete next[id];
      return next;
    });
    setAiDocStateById((prev) => {
      const next = { ...prev };
      for (const id of rerunIds) next[id] = { state: "running" };
      return next;
    });
    let okCount = 0;
    try {
      for (const doc of docs) {
        const id = String(doc.id);
        clearDocumentAiSettledInBrowser(id);
        const ok = await runVerifyForDoc(doc, { rerun: true, applicationSnapshot: application });
        if (ok) okCount++;
      }
      if (okCount > 0) {
        await loadApplication();
        toast.success(
          okCount === docs.length
            ? "AI re-run finished for all documents."
            : `AI re-run finished for ${okCount} of ${docs.length} documents.`,
        );
      } else {
        toast.error("AI re-run did not complete. Check the AI service and try again.");
      }
    } finally {
      setAiRunning(false);
    }
  }, [application, runVerifyForDoc, loadApplication]);

  // Auto-score only documents that have never been verified (DB + browser session).
  useEffect(() => {
    if (loading || !pendingImageDocIds || !application) return;
    const pendingIds = pendingImageDocIds.split(",").filter(Boolean);
    const docs = (application.documents as any[]).filter((d) =>
      pendingIds.includes(String(d.id)),
    );
    if (docs.length === 0) return;

    let cancelled = false;
    const run = async () => {
      setAiRunning(true);
      try {
        setAiServiceError(null);
        for (const doc of docs) {
          if (cancelled) return;
          const id = String(doc.id);
          if (documentAiIsSettled(id, doc, application)) continue;
          await runVerifyForDoc(doc, { applicationSnapshot: application });
        }
      } finally {
        if (!cancelled) setAiRunning(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [applicationId, pendingImageDocIds, application, runVerifyForDoc, loading]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-600 py-12">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading application...
      </div>
    );
  }

  if (error || !application) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Application not found'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3 sm:items-center sm:gap-4">
        <Link to="/registrar/applications">
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
            <ArrowLeft className="w-3 h-3 mr-1" />
            Back
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">
            Review Application
          </h2>
          <p className="truncate text-sm text-gray-600 sm:text-base">Application ID: {application.id}</p>
        </div>
        <Badge className={cn(applicationReviewStatusBadgeClass(application.status), "shrink-0")}>
          {application.status}
        </Badge>
      </div>

      {/* Enrollment Status Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Student Type</p>
              <p className="font-medium capitalize">{application.enrollmentStatus}</p>
            </div>
            <div>
              <p className="text-gray-600">Submitted Date</p>
              <p className="font-medium">{application.submittedDate}</p>
            </div>
            <div>
              <p className="text-gray-600">Grade Level</p>
              <p className="font-medium">Grade {application.gradeLevel}</p>
            </div>
            <div>
              <p className="text-gray-600">Strand</p>
              <p className="font-medium">{application.strand}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Interface */}
      <Card>
        <Tabs defaultValue="personal" className="w-full">
          <div className="border-b bg-gray-50 overflow-x-auto overscroll-x-contain">
            <TabsList className="inline-flex h-auto w-max min-w-full justify-start rounded-none bg-transparent p-0">
              <TabsTrigger 
                value="personal" 
                className="shrink-0 rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-[#2D5016] data-[state=active]:bg-[#2D5016] data-[state=active]:text-white sm:px-6 sm:py-3"
              >
                <User className="mr-1.5 h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Personal Information</span>
                <span className="sm:hidden">Personal</span>
              </TabsTrigger>
              <TabsTrigger 
                value="family" 
                className="shrink-0 rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-[#8B1538] data-[state=active]:bg-[#8B1538] data-[state=active]:text-white sm:px-6 sm:py-3"
              >
                <Users className="mr-1.5 h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Parent/Guardian Information</span>
                <span className="sm:hidden">Family</span>
              </TabsTrigger>
              <TabsTrigger 
                value="academic" 
                className="shrink-0 rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-[#2D5016] data-[state=active]:bg-[#2D5016] data-[state=active]:text-white sm:px-6 sm:py-3"
              >
                <GraduationCap className="mr-1.5 h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Academic Background</span>
                <span className="sm:hidden">Academic</span>
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="shrink-0 rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-[#8B1538] data-[state=active]:bg-[#8B1538] data-[state=active]:text-white sm:px-6 sm:py-3"
              >
                <Upload className="mr-1.5 h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Documents Upload</span>
                <span className="sm:hidden">Documents</span>
              </TabsTrigger>
              <TabsTrigger 
                value="review" 
                className="shrink-0 rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-[#2D5016] data-[state=active]:bg-[#2D5016] data-[state=active]:text-white sm:px-6 sm:py-3"
              >
                <ClipboardCheck className="mr-1.5 h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Review & Decision</span>
                <span className="sm:hidden">Review</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Personal Information Tab */}
          <TabsContent value="personal" className="space-y-6 p-4 sm:p-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">First Name</p>
                  <p className="font-medium">{application.givenName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Middle Name</p>
                  <p className="font-medium">{application.middleName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-600">Last Name</p>
                  <p className="font-medium">{application.lastName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Extension Name</p>
                  <p className="font-medium">{application.extensionName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-600">Gender</p>
                  <p className="font-medium">{application.gender}</p>
                </div>
                <div>
                  <p className="text-gray-600">LRN</p>
                  <p className="font-medium">{application.lrn}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Contact Number</p>
                  <p className="font-medium">{application.contactNumber}</p>
                </div>
                <div>
                  <p className="text-gray-600">Email Address</p>
                  <p className="font-medium">{application.email}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Block/Lot/House No.</p>
                  <p className="font-medium">{application.blockLotHouseNo}</p>
                </div>
                <div>
                  <p className="text-gray-600">Street</p>
                  <p className="font-medium">{application.street}</p>
                </div>
                <div>
                  <p className="text-gray-600">Compound/Subdivision/Village</p>
                  <p className="font-medium">{application.compoundSubdivisionVillage}</p>
                </div>
                <div>
                  <p className="text-gray-600">Barangay</p>
                  <p className="font-medium">{application.barangay}</p>
                </div>
                <div>
                  <p className="text-gray-600">Municipality/City</p>
                  <p className="font-medium">{application.municipality}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Birth Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Date of Birth</p>
                  <p className="font-medium">{application.birthDate}</p>
                </div>
                <div>
                  <p className="text-gray-600">Place of Birth</p>
                  <p className="font-medium">{application.birthPlace}</p>
                </div>
                <div>
                  <p className="text-gray-600">Religion</p>
                  <p className="font-medium">{application.religion}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Parent/Guardian Information Tab */}
          <TabsContent value="family" className="space-y-6 p-4 sm:p-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Mother's Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Given Name</p>
                  <p className="font-medium">{application.motherGivenName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Maiden Middle Name</p>
                  <p className="font-medium">{application.motherMaidenMiddleName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Maiden Last Name</p>
                  <p className="font-medium">{application.motherMaidenLastName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Contact Number</p>
                  <p className="font-medium">{application.motherContactNumber}</p>
                </div>
                <div>
                  <p className="text-gray-600">Occupation</p>
                  <p className="font-medium">{application.motherOccupation}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Father's Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Given Name</p>
                  <p className="font-medium">{application.fatherGivenName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Middle Name</p>
                  <p className="font-medium">{application.fatherMiddleName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Last Name</p>
                  <p className="font-medium">{application.fatherLastName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Contact Number</p>
                  <p className="font-medium">{application.fatherContactNumber}</p>
                </div>
                <div>
                  <p className="text-gray-600">Occupation</p>
                  <p className="font-medium">{application.fatherOccupation}</p>
                </div>
              </div>
            </div>

            {application.hasGuardian && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Guardian Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Given Name</p>
                    <p className="font-medium">{application.guardianGivenName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Middle Name</p>
                    <p className="font-medium">{application.guardianMiddleName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Last Name</p>
                    <p className="font-medium">{application.guardianLastName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Contact Number</p>
                    <p className="font-medium">{application.guardianContactNumber}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Relationship</p>
                    <p className="font-medium">{application.relationshipToGuardian}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-4">Emergency Contact</h3>
              <div className="text-sm">
                <p className="text-gray-600">Primary Emergency Contact</p>
                <p className="font-medium capitalize">{application.emergencyContact}</p>
              </div>
            </div>
          </TabsContent>

          {/* Academic Background Tab */}
          <TabsContent value="academic" className="space-y-6 p-4 sm:p-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Academic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Grade Level</p>
                  <p className="font-medium">Grade {application.gradeLevel}</p>
                </div>
                <div>
                  <p className="text-gray-600">Strand</p>
                  <p className="font-medium">{application.strand}</p>
                </div>
                <div>
                  <p className="text-gray-600">Preferred Schedule</p>
                  <p className="font-medium">{application.preferredSchedule}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Enrollment History</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Previous School Attended</p>
                  <p className="font-medium">{application.previousSchoolAttended}</p>
                </div>
                <div>
                  <p className="text-gray-600">School Type</p>
                  <p className="font-medium capitalize">{application.schoolType}</p>
                </div>
                <div>
                  <p className="text-gray-600">Grade Level at Previous School</p>
                  <p className="font-medium">Grade {application.gradeLevelAtPreviousSchool}</p>
                </div>
                <div>
                  <p className="text-gray-600">Section at Previous School</p>
                  <p className="font-medium">{application.sectionAtPreviousSchool}</p>
                </div>
                <div>
                  <p className="text-gray-600">Last School Year Attended</p>
                  <p className="font-medium">{application.lastSchoolYearAttended}</p>
                </div>
              </div>
            </div>

            {application.hasReferralCode && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Bring a Friend Promo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Referral Card Control Number</p>
                    <p className="font-medium">{application.referralCardControlNumber}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Referrer Name</p>
                    <p className="font-medium">{application.referrerName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Referrer Contact Number</p>
                    <p className="font-medium">{application.referrerContactNumber}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-4">Payment Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Mode of Payment</p>
                  <p className="font-medium">{application.modeOfPayment}</p>
                </div>
                {application.voucherNo && (
                  <div>
                    <p className="text-gray-600">Voucher Number</p>
                    <p className="font-medium">{application.voucherNo}</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Documents Upload Tab */}
          <TabsContent value="documents" className="p-4 sm:p-6">
            <div className="space-y-3">
              {(() => {
                const docs = (application.documents ?? []) as any[];
                const total = docs.length;
                const reviewed = docs.filter((d) => d?.registrarReviewed).length;
                if (total === 0) return null;
                const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
                return (
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium text-gray-800">Registrar review progress</span>
                      <span className="text-gray-700 font-semibold tabular-nums">
                        {reviewed}/{total} reviewed
                      </span>
                    </div>
                    <div className="bg-white rounded-full h-2 overflow-hidden border">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                        </div>
                  </div>
                );
              })()}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                <div className="min-w-0 text-sm text-gray-600">
                  {aiServiceError ? (
                    <span className="text-rose-700">
                      AI service unavailable — {aiServiceError}. Start{" "}
                      <code className="rounded bg-rose-50 px-1 text-xs">ai/app.py</code> on port 5000.
                    </span>
                  ) : (
                    <span>
                      Each file is scored on <strong className="font-medium text-gray-800">mismatch (MM)</strong>{" "}
                      and <strong className="font-medium text-gray-800">tamper (T)</strong>. Image quality is
                      checked at upload.
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    void handleRerunAi();
                  }}
                  disabled={aiRunning}
                >
                  {aiRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Re-running AI…
                    </>
                  ) : (
                    "Re-run AI"
                  )}
                </Button>
              </div>
              <ConcernScoringHelp />
              {(application.documents ?? []).map((doc: any, index: number) => (
                (() => {
                  const key = String(doc?.id ?? "");
                  const docType = mapDocType(doc);
                  const isPhoto = docType === "photo_2x2";
                  const aiState = aiDocStateById[key]?.state;
                  const aiChecking = aiState === "running";
                  const rawAi = aiChecking ? undefined : aiResultsByDocId[key];
                  const ai = aiResultForDisplay(docType, rawAi) ?? rawAi;
                  const aiPct = documentConcernPercent(ai);
                  const resubmitRequired =
                    String(doc?.registrarDocDecision || "").toLowerCase() === "rejected" ||
                    String(doc?.status || "").toLowerCase() === "flagged" ||
                    String(doc?.aiStatus || "").toLowerCase() === "rejected";
                  const registrarCleared =
                    Boolean(doc?.registrarReviewed) ||
                    String(doc?.status || "").toLowerCase() === "verified";
                  const needsReview =
                    !registrarCleared &&
                    aiPct !== null &&
                    (aiPct > CONCERN_STRICT_THRESHOLD || ai?.status === "failed");
                  const passesChecks =
                    registrarCleared ||
                    (aiPct !== null &&
                      ai?.status === "verified" &&
                      aiPct <= CONCERN_STRICT_THRESHOLD);
                  const concernParts = documentConcernFromAi(ai);
                  return (
                <div
                  key={doc.id ?? index}
                  className={cn(
                    "rounded-lg border p-4 transition-colors hover:border-[#8B1538]/60",
                    needsReview && !registrarCleared
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-gray-200 bg-white",
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#8B1538]">
                            {(doc.requirementLabel || "Document").replace(/\s+/g, " ").trim()}
                          </p>
                          <p
                            className="truncate font-medium text-gray-900"
                            title={doc.fileName || doc.name}
                          >
                            {doc.fileName || doc.name}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {resubmitRequired ? (
                            <Badge className="bg-red-600 text-white">Resubmission required</Badge>
                          ) : registrarCleared ? (
                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              {doc.registrarReviewed ? "You reviewed" : "Verified"}
                            </Badge>
                          ) : aiChecking ? (
                            <Badge className="bg-indigo-600 text-white">AI checking…</Badge>
                          ) : documentAiStatus(doc) === "processing" && aiPct === null ? (
                            <Badge className="bg-indigo-600 text-white">AI checking…</Badge>
                          ) : aiState === "error" ? (
                            <Badge className="bg-amber-600 text-white">AI error</Badge>
                          ) : aiPct === null ? (
                            <Badge variant="outline" className="border-gray-300 text-gray-600">
                              Awaiting AI
                            </Badge>
                          ) : passesChecks ? (
                            <Badge className="bg-emerald-600 text-white">Clear</Badge>
                          ) : needsReview ? (
                            <Badge className="bg-amber-600 text-white">Needs review</Badge>
                          ) : (
                            <Badge variant="outline" className="border-gray-300">Scored</Badge>
                          )}
                        </div>
                        {aiPct !== null && !isPhoto && !aiChecking ? (
                          <DocumentConcernChips
                            concernPct={aiPct}
                            mismatchPct={concernParts?.mismatchConcern ?? null}
                            tamperPct={concernParts?.tamperConcern ?? null}
                          />
                        ) : null}
                        {aiPct !== null && concernParts && !aiChecking ? (
                          <DocumentConcernFormula
                            mismatchPct={concernParts.mismatchConcern}
                            tamperPct={concernParts.tamperConcern}
                            averagePct={concernParts.documentAverage}
                          />
                        ) : null}
                        {aiChecking ? (
                          <p className="text-sm leading-snug text-indigo-700">
                            Recalculating scores — this may take a few minutes for SF10 and certificates.
                          </p>
                        ) : ai?.security_levels ? (
                          <SecurityLevelsPanel security={ai.security_levels} compact />
                        ) : (
                          <p className="text-sm leading-snug text-gray-600">
                            {documentAiSummaryLine({
                              ai,
                              isPhoto,
                              concernPct: aiPct,
                              aiState,
                              clearedOnFile: registrarCleared,
                            })}
                          </p>
                        )}
                        {doc.uploadedDate ? (
                          <p className="text-xs text-gray-400">Uploaded {doc.uploadedDate}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex w-full shrink-0 flex-row flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 sm:w-auto sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                      {aiPct !== null && !aiChecking ? (
                        <span
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-lg font-bold tabular-nums",
                            concernScoreBadgeClasses(aiPct),
                          )}
                          title="Document average concern"
                        >
                          {aiPct}%
                        </span>
                      ) : aiChecking ? (
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-label="AI checking" />
                      ) : null}
                      <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                        <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => handleViewDocument(doc)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => downloadDocument(doc)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                  );
                })()
              ))}
            </div>
          </TabsContent>

          {/* Review & Decision Tab */}
          <TabsContent value="review" className="space-y-6 p-4 sm:p-6">
            {/* Note: registrar remarks moved into the Reject confirmation
                dialog (see below). Approve does not need remarks; reject
                does, and the dialog enforces that requirement. This keeps
                the review tab focused on the AI summary and decision
                buttons rather than a textarea that's only relevant to one
                of the two outcomes. */}

            <div
              className={cn(
                "overflow-hidden rounded-xl border shadow-sm",
                aggregateConcern !== null
                  ? concernScoreSurfaceClasses(aggregateConcern)
                  : "border-gray-200 bg-white",
              )}
            >
              <div className="border-b border-black/5 bg-white/60 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8B1538]/10">
                      <Sparkles className="h-5 w-5 text-[#8B1538]" aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">AI review summary</h3>
                      <p className="mt-0.5 text-sm text-gray-600">
                        Per file: average of <strong className="font-medium">MM</strong> +{" "}
                        <strong className="font-medium">T</strong>. Overall = weighted mean (0% = clean).
                      </p>
                    </div>
                  </div>
                  {aggregateConcern !== null ? (
                    <div className="text-right">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Overall concern
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-3xl font-bold tabular-nums leading-none",
                          concernScoreTextClass(aggregateConcern),
                        )}
                      >
                        {aggregateConcern}%
                      </p>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-gray-600">
                  {[
                    ["SF10", "25%"],
                    ["SF9", "25%"],
                    ["PSA", "25%"],
                    ["Good moral", "20%"],
                    ["2×2 photo", "5%"],
                  ].map(([label, weight]) => (
                    <span
                      key={label}
                      className="rounded-full border border-gray-200 bg-white/80 px-2 py-0.5"
                    >
                      {label} <span className="font-semibold text-gray-800">{weight}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-4 px-5 py-4">
                {aggregateConcern !== null && aiTier ? (
                  <>
                    {aiScoreBreakdown ? (
                      <AiReviewScoreExplainer breakdown={aiScoreBreakdown} />
                    ) : null}
                    <div className={cn("rounded-lg border p-3.5 text-sm", aiTier.accent)}>
                      <p className="font-semibold">{aiTier.title}</p>
                      <p className="mt-1 leading-relaxed">{aiTier.body}</p>
                    </div>
                    <div className="grid gap-2 text-xs text-gray-600 sm:grid-cols-3">
                      <div
                        className={cn(
                          "rounded-md border border-emerald-200 bg-emerald-50/80 px-2.5 py-2",
                          activeConcernPolicy === "routine" &&
                            "ring-2 ring-emerald-500 ring-offset-1",
                        )}
                      >
                        <span className="font-semibold text-emerald-800">0–{CONCERN_MANUAL_THRESHOLD}%</span>
                        <p className="mt-0.5">Routine review</p>
                      </div>
                      <div
                        className={cn(
                          "rounded-md border border-amber-200 bg-amber-50/80 px-2.5 py-2",
                          activeConcernPolicy === "manual" && "ring-2 ring-amber-500 ring-offset-1",
                        )}
                      >
                        <span className="font-semibold text-amber-900">
                          {CONCERN_MANUAL_THRESHOLD + 1}–{CONCERN_STRICT_THRESHOLD}%
                        </span>
                        <p className="mt-0.5">Manual registrar review</p>
                      </div>
                      <div
                        className={cn(
                          "rounded-md border border-red-200 bg-red-50/80 px-2.5 py-2",
                          activeConcernPolicy === "strict" && "ring-2 ring-red-500 ring-offset-1",
                        )}
                      >
                        <span className="font-semibold text-red-800">&gt;{CONCERN_STRICT_THRESHOLD}%</span>
                        <p className="mt-0.5">Strict verification</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">
                    No AI scores yet. Open the <strong className="font-medium">Documents</strong> tab — scores
                    appear here after AI finishes checking uploads.
                  </p>
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Application Decision</h3>
              {application.status === "Enrolled" ||
              application.status === "Approved" ||
              (application as { isAlreadyEnrolled?: boolean }).isAlreadyEnrolled ||
              application.status === "Rejected" ? (
                <div
                  className={
                    "rounded-lg border p-4 flex items-start gap-3 " +
                    (application.status === "Rejected"
                      ? "border-red-300 bg-red-50"
                      : "border-green-300 bg-green-50")
                  }
                >
                  {application.status === "Rejected" ? (
                    <XCircle className="w-5 h-5 text-red-700 mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-700 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p
                      className={
                        "font-semibold " +
                        (application.status === "Rejected" ? "text-red-800" : "text-green-800")
                      }
                    >
                      {application.status === "Rejected"
                        ? "Application rejected"
                        : "Student is already enrolled"}
                    </p>
                    {application.registrarRemarks ? (
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                        <span className="font-medium">Remarks:</span> {application.registrarRemarks}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-600 mt-1 italic">
                        No remarks were recorded with this decision.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                (() => {
                  const docs = (application.documents ?? []) as any[];
                  const totalDocs = docs.length;
                  const reviewedDocs = docs.filter((d) => d?.registrarReviewed).length;
                  const allReviewed = totalDocs > 0 && reviewedDocs === totalDocs;
                  const blocked = !allReviewed;
                  const remaining = Math.max(0, totalDocs - reviewedDocs);
                  return (
                    <>
                      <Alert className={"mb-4 " + (blocked ? "border-amber-300 bg-amber-50" : "")}>
                        <AlertCircle className={"h-4 w-4 " + (blocked ? "text-amber-700" : "")} />
                        <AlertDescription className={blocked ? "text-amber-900" : ""}>
                          {totalDocs === 0 ? (
                            "No documents uploaded yet. The applicant must upload required documents before a decision can be made."
                          ) : blocked ? (
                            <>
                              <span className="font-medium">
                                Review {remaining} more document{remaining === 1 ? "" : "s"} before approving or rejecting.
                              </span>{" "}
                              Open each document with View and click <span className="font-semibold">Mark as reviewed</span>.{" "}
                              Progress: {reviewedDocs}/{totalDocs}.
                            </>
                          ) : (
                            "All documents have been reviewed. You can now approve or reject the application."
                          )}
                </AlertDescription>
              </Alert>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                          className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white disabled:hover:bg-transparent disabled:hover:text-red-600"
                          onClick={() => setDecisionDialog("reject")}
                          disabled={decisionSubmitting !== null || blocked}
                          title={blocked ? `Review all ${totalDocs} document${totalDocs === 1 ? "" : "s"} first` : undefined}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                          {decisionSubmitting === "reject" ? "Rejecting…" : "Reject Application"}
                </Button>
                <Button
                          className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white disabled:bg-[#2D5016]/40 disabled:hover:bg-[#2D5016]/40"
                          onClick={() => setDecisionDialog("approve")}
                          disabled={decisionSubmitting !== null || blocked}
                          title={blocked ? `Review all ${totalDocs} document${totalDocs === 1 ? "" : "s"} first` : undefined}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                          {decisionSubmitting === "approve" ? "Approving…" : "Approve Application"}
                </Button>
              </div>
                    </>
                  );
                })()
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Approve / Reject confirmation dialog. The big buttons in the
          review tab open this rather than firing the decision directly,
          which prevents an accidental click from committing a final
          outcome. The dialog also hosts the rejection-only Remarks
          textarea so we don't show it during normal viewing. */}
      <Dialog
        open={decisionDialog !== null}
        onOpenChange={(open) => {
          if (!open && decisionSubmitting === null) {
            setDecisionDialog(null);
            setLowScoreOverrideAck(false);
          } else if (open) {
            setLowScoreOverrideAck(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionDialog === "approve"
                ? "Approve this application?"
                : "Reject this application?"}
            </DialogTitle>
            <DialogDescription>
              {decisionDialog === "approve"
                ? "This will enroll the student, issue school credentials, and email them to the student. The decision is final."
                : "This will close the application as rejected. Please write a short reason — the student will see it in their portal."}
            </DialogDescription>
          </DialogHeader>

          {decisionDialog === "approve" && aggregateConcern !== null && aggregateConcern > CONCERN_STRICT_THRESHOLD && (
            <div className="space-y-3 rounded-md border border-red-300 bg-red-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-700 mt-0.5" aria-hidden />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-900">
                    Overall concern is {aggregateConcern}% — above the {CONCERN_STRICT_THRESHOLD}% policy threshold
                  </p>
                  <p className="text-sm text-red-900/90 leading-relaxed">
                    Concern this high usually means mismatch or tamper signals on the
                    documents. Please make sure you have personally reviewed each
                    file and verified the applicant's information before approving.
                  </p>
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm text-red-900 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-red-700"
                  checked={lowScoreOverrideAck}
                  onChange={(e) => setLowScoreOverrideAck(e.target.checked)}
                />
                <span>
                  I have manually reviewed this applicant's documents and confirm
                  I want to approve the enrollment despite the high concern score.
                </span>
              </label>
            </div>
          )}

          {decisionDialog === "approve" &&
            aggregateConcern !== null &&
            aggregateConcern > CONCERN_MANUAL_THRESHOLD &&
            aggregateConcern <= CONCERN_STRICT_THRESHOLD && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" aria-hidden />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-900">
                    Overall concern is {aggregateConcern}% — manual review recommended
                  </p>
                  <p className="text-sm text-amber-900/90 leading-relaxed">
                    This falls in the manual review band ({CONCERN_MANUAL_THRESHOLD + 1}%–
                    {CONCERN_STRICT_THRESHOLD}%). Please confirm you have personally reviewed
                    the flagged documents before approving.
                  </p>
                </div>
              </div>
            </div>
          )}

          {decisionDialog === "reject" && (
            <RejectionReasonFields
              presets={REJECTION_REASON_PRESETS}
              presetValue={rejectReasonPreset}
              onPresetChange={setRejectReasonPreset}
              remarks={remarks}
              onRemarksChange={setRemarks}
              remarksLabel="Reason for rejection"
              presetId="reject-reason-preset"
              remarksId="reject-remarks"
              placeholder="e.g. Missing PSA birth certificate; please re-upload a clearer copy."
              requiredHint="Remarks are required when rejecting an application."
            />
          )}

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setDecisionDialog(null)}
              disabled={decisionSubmitting !== null}
            >
              Cancel
            </Button>
            {decisionDialog === "approve" ? (
              (() => {
                const belowThreshold =
                  aggregateConcern !== null && aggregateConcern > CONCERN_STRICT_THRESHOLD;
                const approveDisabled =
                  decisionSubmitting !== null || (belowThreshold && !lowScoreOverrideAck);
                return (
                  <Button
                    className={
                      belowThreshold
                        ? "bg-red-700 hover:bg-red-700/90 text-white disabled:bg-red-700/40 disabled:hover:bg-red-700/40"
                        : "bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
                    }
                    onClick={handleApprove}
                    disabled={approveDisabled}
                    title={
                      belowThreshold && !lowScoreOverrideAck
                        ? "Tick the manual review confirmation above to continue"
                        : undefined
                    }
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {decisionSubmitting === "approve"
                      ? "Approving…"
                      : belowThreshold
                        ? "Approve anyway"
                        : "Confirm approval"}
                  </Button>
                );
              })()
            ) : (
              <Button
                className="bg-red-600 hover:bg-red-600/90 text-white"
                onClick={handleReject}
                disabled={decisionSubmitting !== null || !remarks.trim()}
              >
                <XCircle className="w-4 h-4 mr-2" />
                {decisionSubmitting === "reject" ? "Rejecting…" : "Confirm rejection"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document View Dialog */}
      <Dialog
        open={isDocumentDialogOpen}
        onOpenChange={(open) => {
          setIsDocumentDialogOpen(open);
          if (!open) {
            setSelectedDocument(null);
            setPreviewLightboxOpen(false);
          }
        }}
      >
        <DialogContent
          className={cn(
            // Override DialogContent defaults (sm:max-w-lg) so the modal uses full intended width.
            "!fixed !top-[2vh] !left-1/2 !-translate-x-1/2 !translate-y-0",
            "!flex !h-[min(96dvh,940px)] !max-h-[min(96dvh,940px)]",
            "!w-[min(98vw,1280px)] !max-w-[min(98vw,1280px)] sm:!max-w-[min(98vw,1280px)]",
            "flex-col gap-3 overflow-hidden p-4 sm:p-5 md:p-6",
            "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100",
            previewLightboxOpen &&
              "[&>button.absolute]:pointer-events-none [&>button.absolute]:invisible",
          )}
          onInteractOutside={(e) => {
            if (previewLightboxOpen) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (previewLightboxOpen) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (previewLightboxOpen) e.preventDefault();
          }}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>Document Verification Details</DialogTitle>
            <DialogDescription>
              Review AI verification results and detected issues
            </DialogDescription>
          </DialogHeader>
          {selectedDocument && (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              <div className="border rounded-lg p-4">
                <div className="flex items-start gap-3 flex-1">
                  {selectedDocument.status === "Verified" ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : selectedDocument.status === "Under Review" ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-[#8B1538] uppercase tracking-wide mb-1">
                      Required: {(selectedDocument.requirementLabel || 'Document requirement').replace(/\s+/g, ' ').trim()}
                    </p>
                    {(() => {
                      const id = String(selectedDocument.id ?? "");
                      const raw = aiResultsByDocId[id];
                      const slotMsg = documentSlotMismatchMessage(raw);
                      const effective = resolveEffectiveDocType(selectedDocument, raw);
                      if (!slotMsg) {
                        if (raw?.resolved_doc_type && effective !== mapDocType(selectedDocument)) {
                          return (
                            <p className="mb-2 text-xs text-gray-600">
                              Detected on scan:{" "}
                              <span className="font-medium text-gray-800">
                                {docCheckShortTitle(effective)}
                              </span>
                            </p>
                          );
                        }
                        return null;
                      }
                      return (
                        <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
                          <p className="font-semibold">Wrong document in this slot</p>
                          <p className="mt-1 text-xs leading-relaxed">{slotMsg}</p>
                        </div>
                      );
                    })()}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">
                        {selectedDocument.fileName || selectedDocument.name}
                      </h3>
                      <Badge className={getDocumentStatusColor(selectedDocument.status)}>
                        {selectedDocument.status}
                      </Badge>
                    </div>
                    <div className="mb-3 grid grid-cols-1 gap-4 text-sm text-gray-600 sm:grid-cols-2 md:grid-cols-3">
                      <div>
                        <p className="text-xs text-gray-500">Student</p>
                        <p className="font-medium">{selectedDocument.studentName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Application ID</p>
                        <p className="font-medium">{selectedDocument.applicationId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Strand / Grade</p>
                        <p className="font-medium">
                          {selectedDocument.strand} — Grade {selectedDocument.gradeLevel}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const id = String(selectedDocument.id ?? "");
                      const raw = aiResultsByDocId[id];
                      const docType = resolveEffectiveDocType(selectedDocument, raw);
                      const r = aiResultForDisplay(docType, raw);
                      const parts = documentConcernFromAi(r);
                      const avg =
                        typeof selectedDocument.aiConfidence === "number"
                          ? selectedDocument.aiConfidence
                          : null;
                      if (avg === null) {
                        return (
                          <p className="mb-2 text-sm font-medium text-gray-500">AI score pending</p>
                        );
                      }
                      return (
                        <DocumentConcernChips
                          className="mb-2"
                          size="md"
                          concernPct={avg}
                          mismatchPct={parts?.mismatchConcern ?? null}
                          tamperPct={parts?.tamperConcern ?? null}
                        />
                      );
                    })()}
                    {(() => {
                      const id = String(selectedDocument.id ?? "");
                      const r = aiResultsByDocId[id];
                      if (!r || typeof r.ocr_confidence !== "number") return null;
                      const pct = Math.round(r.ocr_confidence * 100);
                      return (
                        <div className="text-xs text-gray-600">
                          OCR readability:{" "}
                          <span className={cn("font-semibold tabular-nums", verificationScoreTextClass(pct))}>
                            {pct}%
                          </span>
                        </div>
                      );
                    })()}
                    {(() => {
                      const id = String(selectedDocument.id ?? "");
                      const reviewed = !!selectedDocument.registrarReviewed;
                      const submitting = !!reviewSubmittingByDocId[id];
                      const rejected = String(selectedDocument.registrarDocDecision || "").toLowerCase() === "rejected";
                      const docRemarks = String(selectedDocument.registrarDocRemarks || "").trim();
                      return (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {reviewed ? (
                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Reviewed by registrar
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-gray-300 text-gray-600">
                              Not yet reviewed
                            </Badge>
                          )}
                          {rejected ? (
                            <Badge className="bg-red-600 text-white hover:bg-red-700">
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Re-upload required
                            </Badge>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant={reviewed ? "outline" : "default"}
                            disabled={submitting || !selectedDocument.id}
                            onClick={() => toggleDocumentReviewed(selectedDocument.id, !reviewed)}
                            className={reviewed ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {submitting
                              ? reviewed
                                ? "Removing…"
                                : "Marking…"
                              : reviewed
                                ? "Mark as unreviewed"
                                : "Mark as reviewed"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={!selectedDocument.id || docDecisionSubmitting}
                            onClick={() => {
                              setDocDecisionDialogOpen(true);
                              setDocDecisionRemarks(docRemarks);
                              setDocRejectReasonPreset("other");
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            {docDecisionSubmitting ? "Rejecting…" : "Reject (require re-upload)"}
                          </Button>
                          {rejected && docRemarks ? (
                            <p className="w-full text-xs text-gray-600">
                              Reason shown to student: <span className="font-medium">{docRemarks}</span>
                            </p>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-5">
                <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain pr-0.5 lg:max-h-none">
                  {(() => {
                    const id = String(selectedDocument.id ?? "");
                    const raw = aiResultsByDocId[id];
                    const docType = resolveEffectiveDocType(selectedDocument, raw);
                    const r = aiResultForDisplay(docType, raw);
                    if (r?.security_levels) {
                      return (
                        <div className="rounded-lg border border-gray-200 bg-white p-4">
                          <h4 className="mb-1 text-sm font-semibold text-gray-900">AI checks</h4>
                          <p className="mb-3 text-xs text-gray-500">
                            {docType === "photo_2x2"
                              ? "Image quality and AI authenticity for this 2×2 photo."
                              : "Mismatch compares enrollment data to the scan. Tamper looks for edit signals."}
                          </p>
                          <SecurityLevelsPanel security={r.security_levels} />
                        </div>
                      );
                    }
                    return (
                      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-4 text-sm text-gray-600">
                        Run AI on the Documents tab to load mismatch and tamper checks for this file.
                      </div>
                    );
                  })()}
                  {(() => {
                    const id = String(selectedDocument.id ?? "");
                    const raw = aiResultsByDocId[id];
                    const docType = resolveEffectiveDocType(selectedDocument, raw);
                    const r = aiResultForDisplay(docType, raw);
                    const visibility = checkDetailVisibility(docType);

                    const fieldChecks = Array.isArray(r?.field_checks) ? r.field_checks : [];
                    const issues = filterIssuesForDocType(
                      docType,
                      Array.isArray(r?.issues)
                        ? r.issues
                        : Array.isArray(selectedDocument.issues)
                          ? selectedDocument.issues
                          : [],
                      fieldChecks,
                    );
                    const allDocChecks = Array.isArray(r?.doc_checks) ? r.doc_checks : [];
                    const { visual: visualDocChecks, labels: labelDocChecks } =
                      splitDocChecksForDisplay(allDocChecks);
                    const sealScan = r?.seal_scan;
                    const tamperPct = tamperPercentForDoc(r, docType);
                    const tamperSummary = summarizeTamper(r, docType);
                    const showTamper = visibility.tamper && tamperPct !== null && tamperSummary;
                    const syntheticPct = syntheticPercentForDoc(r, docType);
                    const showSynthetic =
                      visibility.synthetic && Boolean(r && syntheticPct !== null);
                    const docTitle = docCheckShortTitle(docType);
                    const docSummary =
                      visibility.labels && labelDocChecks.length
                        ? summarizeDocChecks(labelDocChecks)
                        : null;
                    const sealSummary =
                      visibility.sealLogo && (visualDocChecks.length > 0 || sealScan)
                        ? summarizeDocChecks(
                            visualDocChecks.length
                              ? visualDocChecks
                              : [
                                  {
                                    field: String(sealScan?.label || "Seal/logo (visual)"),
                                    ok: Boolean(sealScan?.detected),
                                    note: (sealScan?.signals || []).join("; "),
                                  },
                                ],
                          )
                        : null;
                    const crossPlan = application
                      ? enrollmentCrossCheckPlan(docType, application)
                      : [];
                    const crossRows = applyEnrollmentCrossChecks(crossPlan, fieldChecks);
                    const cross =
                      visibility.enrollment && crossRows.length
                        ? summarizeEnrollmentCrossRows(crossRows)
                        : null;

                    if (
                      !showTamper &&
                      !showSynthetic &&
                      !docSummary &&
                      !sealSummary &&
                      !cross &&
                      issues.length === 0
                    ) {
                      return null;
                    }

                    const tamperSignals = Array.isArray(r?.tamper_signals) ? r.tamper_signals : [];
                    const tamperCells = Array.isArray((r as any)?.tamper_cells)
                      ? ((r as any).tamper_cells as any[])
                      : [];
                    const tamperFields = Array.isArray((r as any)?.tamper_fields)
                      ? ((r as any).tamper_fields as any[])
                      : [];
                    const syntheticSignals = Array.isArray(r?.synthetic_signals) ? r.synthetic_signals : [];
                    const syntheticRisk =
                      syntheticPct !== null ? concernRiskLabel(syntheticPct) : "Clear";
                    const syntheticTone =
                      syntheticPct !== null
                        ? concernScoreSurfaceClasses(syntheticPct)
                        : "border-slate-200 bg-white text-slate-800";

                    const tileClass =
                      "flex min-h-[9.5rem] flex-col rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-800 shadow-sm";

                    return (
                      <div className="space-y-3 text-sm text-gray-800">
                        <div className="px-0.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-base font-semibold text-gray-900">Check details</p>
                            <span className="text-xs text-gray-500">{docTitle}</span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-gray-500">
                            {checkDetailsIntro(docType)}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {showTamper && tamperSummary ? (
                          <section
                            className={cn(tileClass, tamperSummary.tone)}
                            aria-labelledby="ai-tamper-heading"
                          >
                            <h3
                              id="ai-tamper-heading"
                              className="text-[11px] font-semibold uppercase tracking-wide text-gray-600"
                            >
                              Tamper check
                            </h3>
                            <div className="mt-2 flex flex-1 flex-col">
                              <p className="font-semibold">{tamperSummary.title}</p>
                              <p className="mt-1 flex-1 leading-relaxed">{tamperSummary.body}</p>
                              {tamperPct !== null ? (
                                <p className="mt-1 text-sm">
                                  Tamper concern:{" "}
                                  <span
                                    className={cn(
                                      "font-semibold tabular-nums",
                                      concernScoreTextClass(tamperPct),
                                    )}
                                  >
                                    {tamperPct}%
                                  </span>
                                  <span className="text-gray-600">
                                    {" "}
                                    — 0% is clean; higher means more edit/manipulation concern.
                                  </span>
                                </p>
                              ) : null}
                            </div>
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-900">
                                View tamper details
                              </summary>
                              <div className="mt-2 space-y-3 text-sm text-gray-700">
                                {tamperSignals.length > 0 && (
                                  <div>
                                    <p className="font-medium text-gray-800">Signals</p>
                                    <ul className="mt-1 list-inside list-disc space-y-1">
                                      {tamperSignals.map((s, idx) => (
                                        <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                                {tamperCells.length > 0 && (
                                  <div>
                                    <p className="font-medium text-gray-800">Suspicious cells (SF9)</p>
                                    <ul className="mt-1 list-inside list-disc space-y-1">
                                      {tamperCells.slice(0, 8).map((c, idx) => (
                                        <li key={idx}>
                                          Value <span className="font-semibold">{String(c.text)}</span>{" "}
                                          {c.risk ? `(${String(c.risk)})` : ""}{" "}
                                          {typeof c.ela_var === "number" ? `• ELA var: ${c.ela_var}` : ""}{" "}
                                          {typeof c.ratio === "number" ? `• ratio: ${c.ratio}` : ""}
                                        </li>
                                      ))}
                                    </ul>
                                    {tamperCells.length > 8 && (
                                      <p className="mt-1 text-xs text-gray-500">
                                        Showing 8 of {tamperCells.length}.
                                      </p>
                                    )}
                  </div>
                                )}
                                {tamperFields.length > 0 && (
                                  <div>
                                    <p className="font-medium text-gray-800">Suspicious fields</p>
                                    <ul className="mt-1 list-inside list-disc space-y-1">
                                      {tamperFields.slice(0, 8).map((f, idx) => (
                                        <li key={idx}>
                                          <span className="font-semibold">{String(f.field)}</span>:{" "}
                                          <span className="font-medium">{String(f.text)}</span>{" "}
                                          {f.risk ? `(${String(f.risk)})` : ""}{" "}
                                          {typeof f.ratio === "number" ? `• ratio: ${f.ratio}` : ""}
                                        </li>
                                      ))}
                                    </ul>
                                    {tamperFields.length > 8 && (
                                      <p className="mt-1 text-xs text-gray-500">
                                        Showing 8 of {tamperFields.length}.
                                      </p>
                                    )}
                </div>
                                )}
                                <p className="text-xs text-gray-500">
                                  Tip: highlighted boxes are drawn on the preview image on the right.
                                </p>
              </div>
                            </details>
                          </section>
                        ) : null}

                        {showSynthetic && syntheticPct !== null ? (
                          <section
                            className={cn(tileClass, syntheticTone)}
                            aria-labelledby="ai-synthetic-heading"
                          >
                            <h3
                              id="ai-synthetic-heading"
                              className="text-[11px] font-semibold uppercase tracking-wide text-gray-600"
                            >
                              {docType === "photo_2x2" ? "AI / synthetic check" : "Synthetic check"}
                            </h3>
                            <div className="mt-2 flex flex-1 flex-col">
                              <p className="font-semibold">
                                {docType === "photo_2x2" ? "AI authenticity" : "Synthetic check"}: {syntheticRisk}
                              </p>
                              <p className="mt-1 flex-1 leading-relaxed">
                                Concern:{" "}
                                <span
                                  className={cn(
                                    "font-semibold tabular-nums",
                                    concernScoreTextClass(syntheticPct),
                                  )}
                                >
                                  {syntheticPct}%
                                </span>
                                . 0% is clean.
                                {docType === "photo_2x2"
                                  ? " Flags possible AI-generated or heavily edited portraits."
                                  : " Heuristic hint only (not a definitive AI-generated detector)."}
                              </p>
                              {syntheticSignals.length > 0 ? (
                                <ul className="mt-2 list-inside list-disc space-y-1">
                                  {syntheticSignals.slice(0, 5).map((s, idx) => (
                                    <li key={idx}>{s}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          </section>
                        ) : null}

                        {sealSummary ? (
                          <section className={tileClass} aria-labelledby="ai-seal-heading">
                            <h3
                              id="ai-seal-heading"
                              className="text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                            >
                              Seal / logo check
                            </h3>
                            <p className="mt-1 text-xs text-gray-500">
                              Visual scan for an official seal or school emblem in the document header.
                            </p>
                            <div
                              className="mt-2 flex flex-wrap items-center gap-2"
                              aria-label="Seal and logo check results"
                            >
                              {(visualDocChecks.length ? visualDocChecks : [{ field: sealScan?.label || "Seal/logo", ok: Boolean(sealScan?.detected) }]).map(
                                (c, idx) => (
                                  <span
                                    key={idx}
                                    title={String(c.field)}
                                    className={`inline-block h-4 w-4 shrink-0 rounded-full ${c.ok ? "bg-emerald-600" : "bg-rose-600"}`}
                                  />
                                ),
                              )}
                            </div>
                            <p className="mt-2 leading-snug">
                              <span className="font-medium text-gray-900">
                                {sealSummary.pass}/{sealSummary.total} passed
                              </span>
                              {sealSummary.pass < sealSummary.total ? (
                                <>
                                  <span className="text-gray-400"> · </span>
                                  <span className="text-rose-800">
                                    {sealSummary.missingShort.join(" · ")}
                                  </span>
                                </>
                              ) : (
                                <span className="text-emerald-700"> · Seal or logo detected</span>
                              )}
                            </p>
                            {(visualDocChecks[0]?.note || (sealScan?.signals?.length ?? 0) > 0) && (
                              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-gray-600">
                                {(visualDocChecks[0]?.note
                                  ? [visualDocChecks[0].note]
                                  : sealScan?.signals || []
                                )
                                  .slice(0, 4)
                                  .map((s, idx) => (
                                    <li key={idx}>{s}</li>
                                  ))}
                              </ul>
                            )}
                          </section>
                        ) : null}

                        {docSummary ? (
                          <section className={tileClass} aria-labelledby="ai-labels-heading">
                            <h3
                              id="ai-labels-heading"
                              className="text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                            >
                              {docType === "birth_certificate"
                                ? "PSA labels on scan"
                                : docType === "good_moral"
                                  ? "Certificate labels on scan"
                                  : "Labels on scan"}
                            </h3>
                            <div
                              className="mt-2 flex flex-wrap items-center gap-2"
                              aria-label="Label check results"
                            >
                              {labelDocChecks.map((c, idx) => (
                                <span
                                  key={idx}
                                  title={String(c.field)}
                                  className={`inline-block h-4 w-4 shrink-0 rounded-full ${c.ok ? "bg-emerald-600" : "bg-rose-600"}`}
                                />
                              ))}
                </div>
                            <p className="mt-2 leading-snug">
                              <span className="font-medium text-gray-900">
                                {docSummary.pass}/{docSummary.total} found
                              </span>
                              {docSummary.missingShort.length > 0 ? (
                                <>
                                  <span className="text-gray-400"> · </span>
                                  <span className="text-gray-700">
                                    Missing: {docSummary.missingShort.slice(0, 4).join(" · ")}
                                    {docSummary.missingShort.length > 4
                                      ? ` (+${docSummary.missingShort.length - 4} more)`
                                      : ""}
                                  </span>
                                </>
                              ) : (
                                <span className="text-emerald-700"> · All listed labels detected</span>
                              )}
                            </p>
                            <details className="mt-2 text-xs text-gray-600">
                              <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-900">
                                Every label ({labelDocChecks.length})
                              </summary>
                              <ul className="mt-2 space-y-1.5 border-l border-gray-200 pl-3">
                                {labelDocChecks.map((c, idx) => (
                                  <li key={idx} className="flex items-start gap-2 leading-snug">
                                    <span
                                      className={`mt-2 inline-block h-4 w-4 shrink-0 rounded-full ${c.ok ? "bg-emerald-600" : "bg-rose-600"}`}
                                      aria-hidden
                                    />
                                    <span className="text-gray-800">{String(c.field)}</span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          </section>
                        ) : null}

                        {cross && crossRows.length > 0 ? (
                          <section className={tileClass} aria-labelledby="ai-enrollment-heading">
                            <h3
                              id="ai-enrollment-heading"
                              className="text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                            >
                              {enrollmentCrossCheckTitle(docType)}
                            </h3>
                            <p className="mt-1 text-xs text-gray-500">
                              {docType === "good_moral"
                                ? "Enrollment fields plus a visual signature scan on the document — re-run AI after updates."
                                : "Compared against the student\u2019s enrollment form — re-run AI after form updates."}
                            </p>
                            <div
                              className="mt-2 flex flex-wrap items-center gap-2"
                              aria-label="Enrollment cross-check results"
                            >
                              {crossRows.map((c, idx) => (
                                <span
                                  key={idx}
                                  title={
                                    c.ok === null
                                      ? `${c.field}: awaiting AI check`
                                      : `${c.field}: ${c.ok ? "match" : "mismatch"}`
                                  }
                                  className={`inline-block h-4 w-4 shrink-0 rounded-full ${
                                    c.ok === null
                                      ? "bg-gray-300"
                                      : c.ok
                                        ? "bg-emerald-600"
                                        : "bg-rose-600"
                                  }`}
                                />
                              ))}
              </div>
                            <p className="mt-2 leading-snug text-gray-800">
                              <span className="font-medium">{cross.okCount}</span> matched
                              <span className="text-gray-400"> · </span>
                              <span className="font-medium text-rose-800">{cross.badCount}</span>{" "}
                              {String(selectedDocument?.registrarDocDecision || "").toLowerCase() === "rejected"
                                ? "need resubmission"
                                : "need review"}
                              {cross.pendingCount > 0 ? (
                                <>
                                  <span className="text-gray-400"> · </span>
                                  <span className="font-medium text-gray-600">{cross.pendingCount}</span> pending AI
                                </>
                              ) : null}
                              {cross.badBits.length > 0 ? (
                                <>
                                  <span className="text-gray-400">: </span>
                                  {cross.badBits.join(" · ")}
                                </>
                              ) : null}
                            </p>
                            {cross.okNames.length > 0 && cross.badCount > 0 ? (
                              <p className="mt-1 text-xs text-emerald-800">
                                Matched: {cross.okNames.join(" · ")}
                              </p>
                            ) : null}
                            <details className="mt-2 text-xs text-gray-600" open>
                              <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-900">
                                Every enrollment field ({crossRows.length})
                              </summary>
                              <ul className="mt-2 space-y-1.5 border-l border-gray-200 pl-3">
                                {crossRows.map((c, idx) => (
                                  <li key={idx} className="flex items-start gap-2 leading-snug">
                                    <span
                                      className={`mt-2 inline-block h-4 w-4 shrink-0 rounded-full ${
                                        c.ok === null
                                          ? "bg-gray-300"
                                          : c.ok
                                            ? "bg-emerald-600"
                                            : "bg-rose-600"
                                      }`}
                                      aria-hidden
                                    />
                                      <span className="min-w-0 text-gray-800">
                                      <span className="font-medium">{String(c.field)}</span>
                                      <span
                                        className={
                                          c.ok === null
                                            ? " text-gray-600"
                                            : c.ok
                                              ? " text-emerald-800"
                                              : " text-rose-800"
                                        }
                                      >
                                        {" "}
                                        {c.ok === null
                                          ? "pending AI check"
                                          : String(c.field).toLowerCase() === "signature"
                                            ? c.ok
                                              ? "detected on scan"
                                              : "not detected on scan"
                                            : c.ok
                                              ? "match"
                                              : "mismatch"}
                                        {" "}
                                        · {fieldCheckConcernLabel(c)}
                                      </span>
                                      <span className="block text-gray-600">
                                        Form: {String(c.expected).trim()}
                                        {String(c.detected || "").trim()
                                          ? ` · Document: ${formatCrossCheckDetected(String(c.field), String(c.detected))}`
                                          : ""}
                                      </span>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          </section>
                        ) : null}

                        {issues.length > 0 ? (
                          <section
                            className={cn(tileClass, "min-h-0 sm:col-span-2")}
                            aria-labelledby="ai-messages-heading"
                          >
                            <h3
                              id="ai-messages-heading"
                              className="text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                            >
                              Full AI messages
                            </h3>
                            <details className="group mt-2 rounded-md border border-gray-100 bg-gray-50/80">
                              <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-gray-700 marker:content-none hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                                <span className="inline-flex items-center gap-2">
                                  View all messages
                                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                    {issues.length}
                                  </span>
                                </span>
                              </summary>
                              <ul className="space-y-1.5 border-t border-gray-100 px-3 py-2 text-sm leading-snug text-red-800">
                                {issues.map((issue: string, idx: number) => (
                                  <li key={idx} className="pl-0">
                                    {issue.replace(/^(Mismatch:\s*)/i, "").trim()}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          </section>
                        ) : null}
                        </div>
                      </div>
                    );
                  })()}
                    {String(selectedDocument.aiError || "").trim().length > 0 && (
                      <Alert className="mt-3 border-amber-300 bg-amber-50">
                        <AlertDescription className="text-amber-900">
                          AI error: {String(selectedDocument.aiError).trim()}
                        </AlertDescription>
                      </Alert>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Verified: {selectedDocument.uploadedDate}
                    </p>
                </div>

              {/* Document Preview — fetched with apiFetch so X-User-Id is sent (img src alone cannot) */}
              <div className="flex min-h-[280px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-gray-50 p-4 lg:min-h-0">
                <div className="mb-3 flex shrink-0 items-center justify-between">
                  <h4 className="text-base font-semibold text-gray-900">Uploaded Document</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadDocument(selectedDocument)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
                {(() => {
                  const kind =
                    previewDisplayKind ??
                    guessDocKind(selectedDocument.mimeType, selectedDocument.fileName || selectedDocument.name);
                  const id = String(selectedDocument.id ?? "");
                  const raw = aiResultsByDocId[id];
                  const docType = resolveEffectiveDocType(selectedDocument, raw);
                  const r = aiResultForDisplay(docType, raw);
                  const cells = Array.isArray(r?.tamper_cells) ? r?.tamper_cells : [];
                  const fields = Array.isArray((r as any)?.tamper_fields) ? ((r as any).tamper_fields as any[]) : [];
                  const fieldChecksAll = Array.isArray(r?.field_checks) ? r.field_checks : [];
                  const mismatches = filterFieldChecksForDocType(docType, fieldChecksAll).filter(
                    (fc) =>
                      fc &&
                      String(fc.field || "").toLowerCase() !== "signature" &&
                      fc.ok === false &&
                      typeof fc.x === "number" &&
                      typeof fc.y === "number" &&
                      typeof fc.w === "number" &&
                      typeof fc.h === "number",
                  );
                  const natW = typeof r?.image_width === "number" ? r.image_width : null;
                  const natH = typeof r?.image_height === "number" ? r.image_height : null;
                  const hasAny =
                    cells.length > 0 || fields.length > 0 || mismatches.length > 0;
                  const canOverlay = hasAny && natW && natH && previewImgBox;
                  const sx = canOverlay ? previewImgBox!.w / natW! : 1;
                  const sy = canOverlay ? previewImgBox!.h / natH! : 1;
                  const imageOverlay =
                    canOverlay && kind === "image" && previewImgBox ? (
                      <div
                        className="pointer-events-none absolute left-1/2 top-1/2"
                        style={{
                          width: previewImgBox.w,
                          height: previewImgBox.h,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        {cells.filter((c) => String(c.risk || "").toLowerCase() === "high").map((c, idx) => {
                          const risk = c.risk || "warning";
                          const color =
                            risk === "high"
                              ? "border-rose-600 bg-rose-500/10"
                              : "border-amber-500 bg-amber-400/10";
                          return (
                            <div
                              key={idx}
                              className={`absolute rounded-sm border-2 ${color}`}
                              style={{
                                left: `${c.x * sx}px`,
                                top: `${c.y * sy}px`,
                                width: `${c.w * sx}px`,
                                height: `${c.h * sy}px`,
                              }}
                              title={`Suspicious cell: ${c.text}`}
                            />
                          );
                        })}
                        {fields.map((f, idx) => {
                          const risk = f.risk || "warning";
                          const color =
                            risk === "high"
                              ? "border-fuchsia-600 bg-fuchsia-500/10"
                              : risk === "info"
                                ? "border-blue-400 bg-blue-400/10"
                                : "border-sky-500 bg-sky-400/10";
                          return (
                            <div
                              key={`f-${idx}`}
                              className={`absolute rounded-sm border-2 ${color}`}
                              style={{
                                left: `${f.x * sx}px`,
                                top: `${f.y * sy}px`,
                                width: `${f.w * sx}px`,
                                height: `${f.h * sy}px`,
                              }}
                              title={
                                f.field === "Portrait"
                                  ? "Portrait area scanned for edits"
                                  : `Suspicious field (${f.field}): ${f.text}`
                              }
                            />
                          );
                        })}
                        {mismatches.map((m, idx) => {
                          const detected = String(m.detected || "").trim();
                          const detectedLabel = detected ? `, saw "${detected}"` : "";
                          return (
                            <div
                              key={`m-${idx}`}
                              className="absolute rounded-full border-[3px] border-blue-600 bg-blue-500/10"
                              style={{
                                left: `${m.x * sx}px`,
                                top: `${m.y * sy}px`,
                                width: `${m.w * sx}px`,
                                height: `${m.h * sy}px`,
                                boxShadow: "0 0 0 1px rgba(255,255,255,0.85) inset",
                              }}
                              title={`Mismatch (${String(m.field)}): expected "${String(m.expected)}"${detectedLabel}`}
                            >
                              <span
                                className="absolute -top-5 left-0 whitespace-nowrap rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow"
                              >
                                {String(m.field)} mismatch
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null;

                  return (
                    <div className="min-h-0 flex-1">
                    <SecureDocumentPreview
                      url={previewObjectUrl}
                      kind={kind}
                      alt={selectedDocument.fileName || selectedDocument.name}
                      loading={previewLoading}
                      error={previewError}
                      fitHeightClass="h-[min(560px,58vh)] min-h-[280px]"
                      onLightboxOpenChange={setPreviewLightboxOpen}
                      imageRef={previewImgRef}
                      onImageLoad={() => {
                        const img = previewImgRef.current;
                        if (!img) return;
                        const rect = img.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                          setPreviewImgBox({ w: rect.width, h: rect.height });
                        }
                      }}
                      imageOverlay={imageOverlay}
                      unavailableFallback={
                        <div className="text-center text-sm text-gray-600">
                          <p className="mb-3">Preview is not available for this file type.</p>
                          <Button type="button" variant="outline" onClick={() => downloadDocument(selectedDocument)}>
                            <Download className="w-4 h-4 mr-2" />
                            Download to open
                          </Button>
                        </div>
                      }
                    />
                    </div>
                  );
                })()}
                <p className="mt-2 shrink-0 text-xs text-gray-500">
                  Preview loads securely for registrar accounts. Use Download to save a copy.
                </p>
              </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={docDecisionDialogOpen} onOpenChange={setDocDecisionDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Reject this document?</DialogTitle>
            <DialogDescription>
              This will mark the document as <span className="font-semibold">Re-upload required</span>. The student will
              see your reason and must submit a new file for this requirement.
            </DialogDescription>
          </DialogHeader>
          <RejectionReasonFields
            presets={DOCUMENT_REJECTION_PRESETS}
            presetValue={docRejectReasonPreset}
            onPresetChange={setDocRejectReasonPreset}
            remarks={docDecisionRemarks}
            onRemarksChange={setDocDecisionRemarks}
            remarksLabel="Reason"
            presetId="doc-reject-reason-preset"
            remarksId="doc-reject-remarks"
            placeholder="Example: Please re-upload a clearer copy. The form keyword and school year header are not readable."
            requiredHint="Reason is required."
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={docDecisionSubmitting}
              onClick={() => setDocDecisionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={docDecisionSubmitting || !String(docDecisionRemarks).trim() || !selectedDocument?.id}
              onClick={() => rejectDocumentAndRequireResubmission(selectedDocument.id, docDecisionRemarks)}
            >
              {docDecisionSubmitting ? "Rejecting…" : "Confirm reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}