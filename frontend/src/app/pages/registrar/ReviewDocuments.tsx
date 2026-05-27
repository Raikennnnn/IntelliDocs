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
import { useEffect, useState } from "react";
import { useRef } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api";

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
    missing_tokens?: string[];
  }>;
  doc_checks?: Array<{
    field: string;
    ok: boolean;
  }>;
  image_width?: number;
  image_height?: number;
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
};

function guessDocKind(mimeType: string | undefined, fileName: string | undefined): "pdf" | "image" | "other" {
  const mt = (mimeType || "").toLowerCase();
  const fn = (fileName || "").toLowerCase();
  if (mt.includes("pdf") || fn.endsWith(".pdf")) return "pdf";
  if (mt.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|svg)$/.test(fn)) return "image";
  return "other";
}

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

/** Average of per-document AI confidence scores (same source as the Documents tab). */
function computeAggregateAiScore(documents: unknown): number | null {
  if (!Array.isArray(documents) || documents.length === 0) return null;
  const scores: number[] = [];
  for (const d of documents) {
    const n = Number((d as { aiConfidence?: unknown }).aiConfidence);
    if (!Number.isFinite(n)) continue;
    scores.push(n);
  }
  if (scores.length === 0) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg);
}

type AiReviewTier = "face_to_face" | "manual" | "light";

function getAiReviewTier(score: number): {
  tier: AiReviewTier;
  title: string;
  body: string;
  accent: string;
} {
  if (score < 75) {
    return {
      tier: "face_to_face",
      title: "Face-to-face verification required",
      body: "Overall AI score is below 75%. Per policy, this applicant must pass face-to-face verification before enrollment can proceed.",
      accent: "border-red-200 bg-red-50/80 text-red-900",
    };
  }
  if (score < 90) {
    return {
      tier: "manual",
      title: "Manual registrar review required",
      body: "Overall AI score is between 75% and 89%. Documents should be manually reviewed by the registrar before a final decision.",
      accent: "border-amber-200 bg-amber-50/80 text-amber-950",
    };
  }
  return {
    tier: "light",
    title: "Routine review",
    body: "Overall AI score is 90% or higher. Manual document checking is not required beyond normal procedures; still confirm identity and completeness as needed.",
    accent: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
  };
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

function summarizeDocChecks(docChecks: Array<{ field: string; ok: boolean }>) {
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

function summarizeFieldChecks(fieldChecks: NonNullable<AiVerifyResponse["field_checks"]>) {
  const bad = fieldChecks.filter((c) => !c.ok);
  const okCount = fieldChecks.length - bad.length;
  const badBits = bad.map((c) => {
    const n = String(c.field);
    if (typeof c.match_ratio === "number" && Number.isFinite(c.match_ratio)) {
      return `${n} (${Math.round(c.match_ratio * 100)}%)`;
    }
    return n;
  });
  const okNames = fieldChecks.filter((c) => c.ok).map((c) => String(c.field));
  return { okCount, badCount: bad.length, total: fieldChecks.length, badBits, okNames };
}

export function ReviewDocuments() {
  const params = useParams();
  const applicationId = params.applicationId;
  const [remarks, setRemarks] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [previewDisplayKind, setPreviewDisplayKind] = useState<"pdf" | "image" | "other" | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewImgRef = useRef<HTMLImageElement | null>(null);
  const [previewImgBox, setPreviewImgBox] = useState<{ w: number; h: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [application, setApplication] = useState<any | null>(null);
  const [aiResultsByDocId, setAiResultsByDocId] = useState<Record<string, AiVerifyResponse>>({});
  const [aiRunning, setAiRunning] = useState(false);
  const [aiServiceError, setAiServiceError] = useState<string | null>(null);
  const [aiDocStateById, setAiDocStateById] = useState<
    Record<string, { state: "pending" | "running" | "done" | "error"; error?: string }>
  >({});
  // Bumped by the "Re-run AI" button to trigger the verification effect again.
  const [aiRerunNonce, setAiRerunNonce] = useState(0);
  // Tracks an in-flight approve/reject so we can disable the buttons against double-submits.
  const [decisionSubmitting, setDecisionSubmitting] = useState<null | "approve" | "reject">(null);
  // Open confirmation dialog for the approve / reject decision. The big
  // buttons in the review tab now open this dialog instead of firing the
  // action directly, so an accidental click never commits a final decision.
  // The dialog itself contains the remarks textarea (rejection only).
  const [decisionDialog, setDecisionDialog] = useState<null | "approve" | "reject">(null);
  // Tracks per-document review-toggle in-flight; document id (string) → boolean.
  const [reviewSubmittingByDocId, setReviewSubmittingByDocId] = useState<Record<string, boolean>>({});

  const mapDocType = (doc: any): AiDocType => {
    const label = String(doc?.requirementLabel ?? doc?.type ?? doc?.name ?? doc?.fileName ?? "").toLowerCase();
    if (label.includes("2x2") || (label.includes("picture") && label.includes("white"))) return "photo_2x2";
    if (label.includes("form 137") || label.includes("form137") || label.includes("sf10")) return "form137";
    if (label.includes("sf9") || label.includes("report card")) return "sf9";
    if (label.includes("good moral")) return "good_moral";
    if (label.includes("birth")) return "birth_certificate";
    return "other";
  };

  const aiBadge = (r: AiVerifyResponse | undefined) => {
    if (!r) return null;
    if (r.status === "verified") return <Badge className="bg-emerald-600">AI Verified</Badge>;
    return <Badge className="bg-rose-600">AI Failed</Badge>;
  };

  const aiProgressBadge = (docId: string) => {
    const st = aiDocStateById[docId]?.state;
    if (!st || st === "pending") return <Badge className="bg-slate-500">AI Pending</Badge>;
    if (st === "running") return <Badge className="bg-indigo-600">AI Running</Badge>;
    if (st === "error") return <Badge className="bg-amber-600">AI Error</Badge>;
    return null;
  };

  const aiConfidencePercent = (r: AiVerifyResponse | undefined): number | null => {
    if (!r) return null;
    const p = Math.round(Number(r.confidence) * 100);
    return Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : null;
  };

  const tamperPercent = (r: AiVerifyResponse | undefined): number | null => {
    if (!r || typeof r.tamper_score !== "number") return null;
    const p = Math.round(Number(r.tamper_score) * 100);
    return Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : null;
  };

  const syntheticPercent = (r: AiVerifyResponse | undefined): number | null => {
    if (!r || typeof r.synthetic_score !== "number") return null;
    const p = Math.round(Number(r.synthetic_score) * 100);
    return Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : null;
  };

  const tamperBadge = (r: AiVerifyResponse | undefined) => {
    const p = tamperPercent(r);
    if (p === null) return null;
    if (r?.tamper_applicable === false) return null;
    if (p < 35) return <Badge className="bg-rose-600">Tamper: High risk</Badge>;
    if (p < 65) return <Badge className="bg-amber-600">Tamper: Warning</Badge>;
    return <Badge className="bg-emerald-600">Tamper: Low risk</Badge>;
  };

  const syntheticBadge = (r: AiVerifyResponse | undefined) => {
    const p = syntheticPercent(r);
    if (p === null) return null;
    if (r?.synthetic_applicable === false) return null;
    // Lower score => more suspicious
    if (p < 55) return <Badge className="bg-fuchsia-700">Synthetic: Suspicious</Badge>;
    if (p < 75) return <Badge className="bg-indigo-700">Synthetic: Check</Badge>;
    return <Badge className="bg-slate-700">Synthetic: Low</Badge>;
  };

  const summarizeTamper = (r: AiVerifyResponse | undefined): { title: string; body: string; tone: string } | null => {
    if (!r) return null;
    if (r.tamper_applicable === false) {
      return { title: "Tamper check: Not applicable", body: "This requirement is a photo-only upload.", tone: "border-gray-200 bg-gray-50 text-gray-700" };
    }

    const cells = Array.isArray((r as any)?.tamper_cells) ? ((r as any).tamper_cells as any[]) : [];
    const fields = Array.isArray((r as any)?.tamper_fields) ? ((r as any).tamper_fields as any[]) : [];

    const hasHigh =
      cells.some((c) => c?.risk === "high") || fields.some((f) => f?.risk === "high");
    const hasWarn =
      cells.some((c) => c?.risk === "warning") || fields.some((f) => f?.risk === "warning");

    const risk = hasHigh ? "High risk" : hasWarn ? "Warning" : "Low risk";
    const tone = hasHigh
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : hasWarn
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-emerald-200 bg-emerald-50 text-emerald-950";

    const parts: string[] = [];
    if (cells.length > 0) parts.push(`${cells.length} suspicious grade cell(s)`);
    if (fields.length > 0) parts.push(`${fields.length} suspicious field(s)`);
    const what = parts.length ? parts.join(" and ") : "no suspicious areas detected";

    // tamper_score 0..1: higher = fewer edit/manipulation signals (automated heuristic).
    const pct = tamperPercent(r);
    const pctText =
      pct === null ? "" : ` Integrity ${pct}/100 — higher means fewer edit/manipulation signals.`;

    let body = `Result: ${what}.${pctText}`;
    if (hasHigh) body += " Recommend manual verification and compare to original source.";
    else if (hasWarn) body += " Recommend a quick manual check of highlighted areas.";

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
      setApplication(data.application ?? null);
      setRemarks(String(data.application?.registrarRemarks ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load application");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
        toast.error(data.error || `Failed to approve (${res.status})`);
        return;
      }
      toast.success(data.message || `Application ${application.id} approved`);
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
        toast.error(data.error || `Failed to reject (${res.status})`);
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
      toast.error(data.error || `Failed to save remarks (${res.status})`);
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
        toast.error(data.error || `Failed to update review status (${res.status})`);
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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-600";
    if (confidence >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getTamperColor = (tamperPct: number) => {
    // tamper_pct: 0..100 where higher is better (cleaner)
    if (tamperPct >= 75) return "text-emerald-700";
    if (tamperPct >= 50) return "text-amber-700";
    return "text-rose-700";
  };

  const aggregateAiScore = application ? computeAggregateAiScore(
    (application.documents ?? []).map((d: any) => {
      const key = String(d?.id ?? "");
      const r = aiResultsByDocId[key];
      const pct = aiConfidencePercent(r);
      return { ...d, aiConfidence: pct ?? d.aiConfidence };
    })
  ) : null;
  const aiTier = aggregateAiScore !== null ? getAiReviewTier(aggregateAiScore) : null;

  const handleViewDocument = (doc: any) => {
    if (!application) return;
    const key = String(doc?.id ?? "");
    const ai = aiResultsByDocId[key];
    const pct = aiConfidencePercent(ai);
    setSelectedDocument({
      ...doc,
      aiConfidence: pct ?? doc.aiConfidence,
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
    const ai = aiResultsByDocId[key];
    const pct = aiConfidencePercent(ai);
    const aiErr = aiDocStateById[key]?.state === "error" ? aiDocStateById[key]?.error : null;
    setSelectedDocument((prev: any) => {
      if (!prev || String(prev.id) !== key) return prev;
      const next = {
        ...prev,
        aiConfidence: pct ?? prev.aiConfidence,
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

        if (display === "image" && !mime.startsWith("image/")) {
          display = "other";
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

  // Automatically run AI verification for image documents when the application loads.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!application?.documents || !Array.isArray(application.documents) || application.documents.length === 0) return;
      const docs = application.documents as any[];
      const toVerify = docs.filter((d) => d?.id && guessDocKind(d?.mimeType, d?.fileName || d?.name) === "image");
      if (toVerify.length === 0) return;

      setAiRunning(true);
      try {
        setAiServiceError(null);

        for (const doc of toVerify) {
          if (cancelled) return;
          const id = String(doc.id);
          if (aiResultsByDocId[id]) continue;

          try {
            if (!cancelled) {
              setAiDocStateById((prev) => ({ ...prev, [id]: { state: "running" } }));
            }
            const docType = mapDocType(doc);
            const expectedName = String(application?.studentName || "").trim();
            const expectedLrn = String((application as any)?.lrn || "").trim();
            const expectedSex = String((application as any)?.gender || "").trim();
            const expectedSchoolYear = String((application as any)?.lastSchoolYearAttended || "").trim();
            const expectedPrevSchool = String((application as any)?.previousSchoolAttended || "").trim();
            const ac = new AbortController();
            const timeoutMs = 45000;
            const t = window.setTimeout(() => ac.abort(), timeoutMs);
            const aiRes = await apiFetch(
              `/api/ai/verify-document?id=${encodeURIComponent(String(doc.id))}` +
                `&doc_type=${encodeURIComponent(docType)}` +
                (expectedName ? `&expected_name=${encodeURIComponent(expectedName)}` : "") +
                (expectedLrn ? `&expected_lrn=${encodeURIComponent(expectedLrn)}` : "") +
                (expectedSex ? `&expected_sex=${encodeURIComponent(expectedSex)}` : "") +
                (expectedSchoolYear ? `&expected_school_year=${encodeURIComponent(expectedSchoolYear)}` : "") +
                (expectedPrevSchool ? `&expected_prev_school=${encodeURIComponent(expectedPrevSchool)}` : ""),
              { signal: ac.signal },
            );
            window.clearTimeout(t);
            const parsed = (await aiRes.json()) as
              | { success: true; result: AiVerifyResponse }
              | { success: false; error?: string; detail?: any };
            if (!aiRes.ok || !parsed || (parsed as any).success !== true) {
              const msg = (parsed as any)?.error || `AI verify failed (${aiRes.status})`;
              if (!cancelled) setAiDocStateById((prev) => ({ ...prev, [id]: { state: "error", error: msg } }));
              continue;
            }
            const data = (parsed as any).result as AiVerifyResponse;
            if (!data || typeof (data as any).confidence !== "number") {
              if (!cancelled) setAiDocStateById((prev) => ({ ...prev, [id]: { state: "error", error: "AI returned an invalid response" } }));
              continue;
            }
            if (!cancelled) {
              setAiResultsByDocId((prev) => ({ ...prev, [id]: data as AiVerifyResponse }));
              setAiDocStateById((prev) => ({ ...prev, [id]: { state: "done" } }));
            }
          } catch (e) {
            // Keep verifying the rest, but surface the real reason for this doc.
            let msg = "Unexpected error running AI";
            if (e && typeof e === "object") {
              const anyE = e as any;
              if (typeof anyE?.name === "string" && anyE.name === "AbortError") {
                msg = "AI verification timed out (45s)";
              } else if (typeof anyE?.message === "string" && anyE.message.trim()) {
                msg = anyE.message.trim();
              } else if (typeof anyE?.toString === "function") {
                const s = String(anyE.toString());
                if (s.trim()) msg = s.trim();
              }
            }
            if (!cancelled) setAiDocStateById((prev) => ({ ...prev, [id]: { state: "error", error: msg } }));
            continue;
          }
        }
      } finally {
        if (!cancelled) setAiRunning(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // Intentionally depend on applicationId + application.documents snapshot only.
    // aiRerunNonce is bumped by the "Re-run AI" button to force a re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, application?.documents, aiRerunNonce]);

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
      <div className="flex items-center gap-4">
        <Link to="/registrar/applications">
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
            <ArrowLeft className="w-3 h-3 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold text-gray-900">
            Review Application
          </h2>
          <p className="text-gray-600">Application ID: {application.id}</p>
        </div>
        <Badge className={
          application.status === "Approved" ? "bg-green-600" :
          application.status === "Under Review" ? "bg-blue-600" :
          application.status === "Rejected" ? "bg-red-600" :
          "bg-yellow-600"
        }>
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
          <div className="border-b bg-gray-50">
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent rounded-none">
              <TabsTrigger 
                value="personal" 
                className="data-[state=active]:bg-[#2D5016] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#2D5016] px-6 py-3"
              >
                <User className="w-4 h-4 mr-2" />
                Personal Information
              </TabsTrigger>
              <TabsTrigger 
                value="family" 
                className="data-[state=active]:bg-[#8B1538] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#8B1538] px-6 py-3"
              >
                <Users className="w-4 h-4 mr-2" />
                Parent/Guardian Information
              </TabsTrigger>
              <TabsTrigger 
                value="academic" 
                className="data-[state=active]:bg-[#2D5016] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#2D5016] px-6 py-3"
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                Academic Background
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="data-[state=active]:bg-[#8B1538] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#8B1538] px-6 py-3"
              >
                <Upload className="w-4 h-4 mr-2" />
                Documents Upload
              </TabsTrigger>
              <TabsTrigger 
                value="review" 
                className="data-[state=active]:bg-[#2D5016] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#2D5016] px-6 py-3"
              >
                <ClipboardCheck className="w-4 h-4 mr-2" />
                Review & Decision
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Personal Information Tab */}
          <TabsContent value="personal" className="p-6 space-y-6">
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
          <TabsContent value="family" className="p-6 space-y-6">
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
          <TabsContent value="academic" className="p-6 space-y-6">
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
          <TabsContent value="documents" className="p-6">
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
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-gray-600">
                  {aiRunning ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Running AI verification…
                    </span>
                  ) : aiServiceError ? (
                    <span className="text-rose-700">
                      AI unavailable: {aiServiceError} (start `ai/app.py` on port 5000)
                    </span>
                  ) : (
                    <span>AI verification runs automatically for image documents.</span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAiResultsByDocId({});
                    setAiDocStateById({});
                    setAiServiceError(null);
                    setAiRerunNonce((n) => n + 1);
                  }}
                  disabled={aiRunning}
                >
                  Re-run AI
                </Button>
              </div>
              {(application.documents ?? []).map((doc: any, index: number) => (
                (() => {
                  const key = String(doc?.id ?? "");
                  const docType = mapDocType(doc);
                  const isPhoto = docType === "photo_2x2";
                  const ai = aiResultsByDocId[key];
                  const aiPct = aiConfidencePercent(ai);
                  const displayAiConfidence = aiPct; // only show real AI confidence when available
                  return (
                <div
                  key={doc.id ?? index}
                  className="p-4 border rounded-lg hover:border-[#8B1538] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <FileText className="w-5 h-5 text-gray-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#8B1538] uppercase tracking-wide mb-1">
                          {(doc.requirementLabel || 'Document').replace(/\s+/g, ' ').trim()}
                        </p>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <p className="font-medium text-gray-900 truncate" title={doc.fileName || doc.name}>
                            {doc.fileName || doc.name}
                          </p>
                          <Badge className={getDocumentStatusColor(doc.status)}>
                            {doc.status}
                          </Badge>
                          {doc.registrarReviewed ? (
                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Reviewed
                            </Badge>
                          ) : null}
                          {aiBadge(ai)}
                          {!ai ? aiProgressBadge(key) : null}
                          {!isPhoto && ai ? tamperBadge(ai) : null}
                          {!isPhoto && ai ? syntheticBadge(ai) : null}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                          <div className="inline-flex items-center gap-2">
                            <span className="text-gray-500">AI Confidence</span>
                            <span
                              className={`px-2 py-0.5 rounded-md border text-xs font-semibold tabular-nums ${
                                displayAiConfidence === null
                                  ? "text-gray-500 border-gray-200 bg-gray-50"
                                  : `${getConfidenceColor(displayAiConfidence)} border-gray-200 bg-white`
                              }`}
                            >
                              {displayAiConfidence === null ? "—" : `${displayAiConfidence}%`}
                            </span>
                          </div>

                          <div className="inline-flex items-center gap-2">
                            <span className="text-gray-500">Tamper score</span>
                            {(() => {
                              if (isPhoto) {
                                return (
                                  <span className="px-2 py-0.5 rounded-md border text-xs font-semibold tabular-nums text-gray-500 border-gray-200 bg-gray-50">
                                    N/A
                                  </span>
                                );
                              }
                              const p = tamperPercent(ai);
                              const cls =
                                p === null
                                  ? "text-gray-500 border-gray-200 bg-gray-50"
                                  : `${getTamperColor(p)} border-gray-200 bg-white`;
                              return (
                                <span className={`px-2 py-0.5 rounded-md border text-xs font-semibold tabular-nums ${cls}`}>
                                  {p === null ? "—" : `${p}%`}
                                </span>
                              );
                            })()}
                          </div>

                          <div className="inline-flex items-center gap-2">
                            <span className="text-gray-500">Uploaded</span>
                            <span className="tabular-nums">{doc.uploadedDate}</span>
                          </div>
                        </div>
                        {doc.status === "Flagged" && (
                          <Alert className="mt-3 border-red-300 bg-red-50">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-700">
                              This document has been flagged by AI. Please review
                              carefully for authenticity issues.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDocument(doc)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => downloadDocument(doc)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
                  );
                })()
              ))}
            </div>
          </TabsContent>

          {/* Review & Decision Tab */}
          <TabsContent value="review" className="p-6 space-y-6">
            {/* Note: registrar remarks moved into the Reject confirmation
                dialog (see below). Approve does not need remarks; reject
                does, and the dialog enforces that requirement. This keeps
                the review tab focused on the AI summary and decision
                buttons rather than a textarea that's only relevant to one
                of the two outcomes. */}

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8B1538]/10">
                  <Sparkles className="h-5 w-5 text-[#8B1538]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">AI review summary</h3>
                    <p className="text-sm text-gray-600">
                      Overall score is the average of AI confidence on submitted documents (same values as the Documents tab).
                    </p>
                  </div>
                  {aggregateAiScore !== null && aiTier ? (
                    <>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm text-gray-600">Overall AI score</span>
                        <span
                          className={`text-2xl font-bold tabular-nums ${getConfidenceColor(aggregateAiScore)}`}
                        >
                          {aggregateAiScore}%
                        </span>
                      </div>
                      <div className={`rounded-md border p-3 text-sm ${aiTier.accent}`}>
                        <p className="font-semibold">{aiTier.title}</p>
                        <p className="mt-1 leading-relaxed">{aiTier.body}</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        Thresholds: below 75% → face-to-face; 75–89% → manual registrar review; 90% and up → no
                        extra manual checking required.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">
                      No document AI scores are available yet. Uploads and AI processing will appear on the
                      Documents tab first; then this summary will show an overall score and guidance.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Application Decision</h3>
              {application.status === "Approved" || application.status === "Rejected" ? (
                <div
                  className={
                    "rounded-lg border p-4 flex items-start gap-3 " +
                    (application.status === "Approved"
                      ? "border-green-300 bg-green-50"
                      : "border-red-300 bg-red-50")
                  }
                >
                  {application.status === "Approved" ? (
                    <CheckCircle className="w-5 h-5 text-green-700 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-700 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p
                      className={
                        "font-semibold " +
                        (application.status === "Approved" ? "text-green-800" : "text-red-800")
                      }
                    >
                      Application {application.status.toLowerCase()}
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
                ? "This will issue school credentials and email them to the student. The decision is final."
                : "This will close the application as rejected. Please write a short reason — the student will see it in their portal."}
            </DialogDescription>
          </DialogHeader>

          {decisionDialog === "reject" && (
            <div className="space-y-2">
              <Label htmlFor="reject-remarks">
                Reason for rejection <span className="text-red-500" aria-hidden="true">*</span>
              </Label>
              <textarea
                id="reject-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Missing PSA birth certificate; please re-upload a clearer copy."
                className="w-full min-h-[120px] px-3 py-2 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
              />
              {!remarks.trim() && (
                <p className="text-xs text-gray-500">
                  Remarks are required when rejecting an application.
                </p>
              )}
            </div>
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
              <Button
                className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
                onClick={handleApprove}
                disabled={decisionSubmitting !== null}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {decisionSubmitting === "approve" ? "Approving…" : "Confirm approval"}
              </Button>
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
          if (!open) setSelectedDocument(null);
        }}
      >
        <DialogContent className="flex h-[92vh] max-h-[92vh] w-[min(96vw,1440px)] max-w-[min(96vw,1440px)] flex-col gap-3 overflow-hidden p-5 sm:max-w-[min(96vw,1440px)] sm:p-6">
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
                      {(selectedDocument.requirementLabel || 'Document requirement').replace(/\s+/g, ' ').trim()}
                    </p>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">
                        {selectedDocument.fileName || selectedDocument.name}
                      </h3>
                      <Badge className={getDocumentStatusColor(selectedDocument.status)}>
                        {selectedDocument.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-2">
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
                          {selectedDocument.strand} - Grade {selectedDocument.gradeLevel}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Verification score</p>
                        <p className={`font-semibold ${getConfidenceColor(selectedDocument.aiConfidence)}`}>
                          {selectedDocument.aiConfidence}%
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const id = String(selectedDocument.id ?? "");
                      const r = aiResultsByDocId[id];
                      if (!r || typeof r.ocr_confidence !== "number") return null;
                      const pct = Math.round(r.ocr_confidence * 100);
                      return (
                        <div className="text-xs text-gray-600">
                          OCR readability: <span className="font-semibold">{pct}%</span>
                        </div>
                      );
                    })()}
                    {(() => {
                      const id = String(selectedDocument.id ?? "");
                      const reviewed = !!selectedDocument.registrarReviewed;
                      const submitting = !!reviewSubmittingByDocId[id];
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
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
                <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain pr-1 md:max-h-[calc(92vh-12rem)]">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(() => {
                      const id = String(selectedDocument.id ?? "");
                      const isPhoto = mapDocType(selectedDocument) === "photo_2x2";
                      if (isPhoto) return null;
                      const r = aiResultsByDocId[id];
                      const pct = tamperPercent(r);
                      if (pct === null) return null;
                      const signals = Array.isArray(r?.tamper_signals) ? r?.tamper_signals : [];
                      const cells = Array.isArray((r as any)?.tamper_cells) ? ((r as any).tamper_cells as any[]) : [];
                      const fields = Array.isArray((r as any)?.tamper_fields) ? ((r as any).tamper_fields as any[]) : [];
                      const summary = summarizeTamper(r);
                      return (
                        <div className="h-full">
                          {summary && (
                            <div className={`rounded-md border p-4 text-sm ${summary.tone}`}>
                              <p className="font-semibold">{summary.title}</p>
                              <p className="mt-1 leading-relaxed">{summary.body}</p>
                            </div>
                          )}

                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm font-medium text-gray-800">
                              View tamper details
                            </summary>
                            <div className="mt-2 space-y-3">
                              {signals.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-gray-800">Signals</p>
                                  <ul className="list-disc list-inside text-sm text-gray-700 mt-1 space-y-1">
                                    {signals.map((s, idx) => (
                                      <li key={idx}>{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {cells.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-gray-800">Suspicious cells (SF9)</p>
                                  <ul className="list-disc list-inside text-sm text-gray-700 mt-1 space-y-1">
                                    {cells.slice(0, 8).map((c, idx) => (
                                      <li key={idx}>
                                        Value <span className="font-semibold">{String(c.text)}</span>{" "}
                                        {c.risk ? `(${String(c.risk)})` : ""}{" "}
                                        {typeof c.ela_var === "number" ? `• ELA var: ${c.ela_var}` : ""}{" "}
                                        {typeof c.ratio === "number" ? `• ratio: ${c.ratio}` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                  {cells.length > 8 && (
                                    <p className="text-xs text-gray-500 mt-1">Showing 8 of {cells.length}.</p>
                                  )}
                                </div>
                              )}
                              {fields.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-gray-800">Suspicious fields</p>
                                  <ul className="list-disc list-inside text-sm text-gray-700 mt-1 space-y-1">
                                    {fields.slice(0, 8).map((f, idx) => (
                                      <li key={idx}>
                                        <span className="font-semibold">{String(f.field)}</span>:{" "}
                                        <span className="font-medium">{String(f.text)}</span>{" "}
                                        {f.risk ? `(${String(f.risk)})` : ""}{" "}
                                        {typeof f.ratio === "number" ? `• ratio: ${f.ratio}` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                  {fields.length > 8 && (
                                    <p className="text-xs text-gray-500 mt-1">Showing 8 of {fields.length}.</p>
                                  )}
                                </div>
                              )}
                              <p className="text-xs text-gray-500">
                                Tip: highlighted boxes are drawn on the preview image on the right.
                              </p>
                            </div>
                          </details>
                        </div>
                      );
                    })()}

                    {(() => {
                      const id = String(selectedDocument.id ?? "");
                      const isPhoto = mapDocType(selectedDocument) === "photo_2x2";
                      if (isPhoto) return null;
                      const r = aiResultsByDocId[id];
                      if (!r || r.synthetic_applicable === false) return null;
                      const pct = syntheticPercent(r);
                      if (pct === null) return null;
                      const signals = Array.isArray(r?.synthetic_signals) ? r?.synthetic_signals : [];
                      const risk =
                        pct < 55 ? "Suspicious" : pct < 75 ? "Check" : "Low";
                      const tone =
                        pct < 55
                          ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-950"
                          : pct < 75
                            ? "border-indigo-200 bg-indigo-50 text-indigo-950"
                            : "border-slate-200 bg-slate-50 text-slate-800";
                      return (
                        <div className="h-full">
                          <div className={`h-full rounded-md border p-4 text-sm ${tone}`}>
                            <p className="font-semibold">Synthetic check: {risk}</p>
                            <p className="mt-1 leading-relaxed">
                              Score: {pct}%. This is a heuristic hint (not a definitive AI-generated detector).
                            </p>
                            {signals.length > 0 ? (
                              <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                                {signals.slice(0, 5).map((s, idx) => (
                                  <li key={idx}>{s}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                    {(() => {
                      const id = String(selectedDocument.id ?? "");
                      const r = aiResultsByDocId[id];
                      const isPhoto = mapDocType(selectedDocument) === "photo_2x2";
                      if (isPhoto) return null;

                      const issues = Array.isArray(selectedDocument.issues) ? selectedDocument.issues : [];
                      const docChecks = Array.isArray(r?.doc_checks) ? r.doc_checks : [];
                      const fieldChecks = Array.isArray(r?.field_checks) ? r.field_checks : [];
                      if (issues.length === 0 && docChecks.length === 0 && fieldChecks.length === 0) return null;

                      const docType = mapDocType(selectedDocument);
                      const docTitle = docCheckShortTitle(docType);
                      const docSummary = docChecks.length ? summarizeDocChecks(docChecks) : null;
                      const cross = fieldChecks.length ? summarizeFieldChecks(fieldChecks) : null;

                      return (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-base text-gray-800">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-semibold text-gray-900">Verification summary</p>
                            <span className="text-xs text-gray-500">{docTitle}</span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-gray-500">
                            OCR and rule checks only — confirm against the original file when in doubt.
                          </p>

                          <div className="mt-4 space-y-4">
                            {docSummary ? (
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                  Labels on scan
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="Label check results">
                                  {docChecks.map((c, idx) => (
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
                                    Every label ({docChecks.length})
                                  </summary>
                                  <ul className="mt-2 space-y-1.5 border-l border-gray-200 pl-3">
                                    {docChecks.map((c, idx) => (
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
                              </div>
                            ) : null}

                            {cross ? (
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                  Enrollment vs document
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="Enrollment cross-check results">
                                  {fieldChecks.map((c, idx) => (
                                    <span
                                      key={idx}
                                      title={`${String(c.field)}: ${c.ok ? "match" : "mismatch"}`}
                                      className={`inline-block h-4 w-4 shrink-0 rounded-full ${c.ok ? "bg-emerald-600" : "bg-rose-600"}`}
                                    />
                                  ))}
                                </div>
                                <p className="mt-2 leading-snug text-gray-800">
                                  <span className="font-medium">{cross.okCount}</span> matched
                                  <span className="text-gray-400"> · </span>
                                  <span className="font-medium text-rose-800">{cross.badCount}</span> need review
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
                                <details className="mt-2 text-xs text-gray-600">
                                  <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-900">
                                    Every enrollment field ({fieldChecks.length})
                                  </summary>
                                  <ul className="mt-2 space-y-1.5 border-l border-gray-200 pl-3">
                                    {fieldChecks.map((c, idx) => (
                                      <li key={idx} className="flex items-start gap-2 leading-snug">
                                        <span
                                          className={`mt-2 inline-block h-4 w-4 shrink-0 rounded-full ${c.ok ? "bg-emerald-600" : "bg-rose-600"}`}
                                          aria-hidden
                                        />
                                        <span className="min-w-0 text-gray-800">
                                          <span className="font-medium">{String(c.field)}</span>
                                          <span className={c.ok ? " text-emerald-800" : " text-rose-800"}>
                                            {" "}
                                            {c.ok ? "match" : "mismatch"}
                                            {typeof c.match_ratio === "number" && Number.isFinite(c.match_ratio)
                                              ? ` (${Math.round(c.match_ratio * 100)}%)`
                                              : ""}
                                          </span>
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              </div>
                            ) : null}

                            {issues.length > 0 ? (
                              <details className="group rounded-md border border-gray-200 bg-white">
                                <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-gray-700 marker:content-none [&::-webkit-details-marker]:hidden hover:bg-gray-50">
                                  <span className="inline-flex items-center gap-2">
                                    Full AI messages
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
                            ) : null}
                          </div>
                        </div>
                      );
                    })()}
                    {String(selectedDocument.extractedText || "").trim().length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-800 mb-1">Extracted text (OCR)</p>
                        <div className="max-h-40 overflow-auto rounded-md border bg-white p-3 text-xs text-gray-700 whitespace-pre-wrap">
                          {String(selectedDocument.extractedText).trim()}
                        </div>
                      </div>
                    )}
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
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-gray-50 p-4 md:max-h-[calc(92vh-12rem)]">
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
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain rounded-lg border bg-white">
                  {previewLoading && (
                    <div className="flex flex-col items-center gap-2 py-12 text-gray-600">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="text-sm">Loading preview…</span>
                    </div>
                  )}
                  {!previewLoading && previewError && (
                    <Alert variant="destructive" className="m-4 border-red-200">
                      <AlertDescription>{previewError}</AlertDescription>
                    </Alert>
                  )}
                  {!previewLoading && !previewError && previewObjectUrl && (() => {
                    const kind =
                      previewDisplayKind ??
                      guessDocKind(selectedDocument.mimeType, selectedDocument.fileName || selectedDocument.name);
                    if (kind === "pdf") {
                      return (
                        <iframe
                          title="Document preview"
                          src={previewObjectUrl}
                          className="min-h-[480px] h-[70vh] w-full border-0 bg-gray-100"
                        />
                      );
                    }
                    if (kind === "image") {
                      const id = String(selectedDocument.id ?? "");
                      const r = aiResultsByDocId[id];
                      const cells = Array.isArray(r?.tamper_cells) ? r?.tamper_cells : [];
                      const fields = Array.isArray((r as any)?.tamper_fields) ? ((r as any).tamper_fields as any[]) : [];
                      const natW = typeof r?.image_width === "number" ? r.image_width : null;
                      const natH = typeof r?.image_height === "number" ? r.image_height : null;
                      const hasAny = cells.length > 0 || fields.length > 0;
                      const canOverlay = hasAny && natW && natH && previewImgBox;
                      const sx = canOverlay ? previewImgBox!.w / natW! : 1;
                      const sy = canOverlay ? previewImgBox!.h / natH! : 1;
                      return (
                        <div className="relative w-full">
                          <img
                            ref={previewImgRef}
                            src={previewObjectUrl}
                            alt={selectedDocument.fileName || selectedDocument.name}
                            className="block w-full h-auto"
                            onLoad={() => {
                              const img = previewImgRef.current;
                              if (!img) return;
                              const r = img.getBoundingClientRect();
                              if (r.width > 0 && r.height > 0) setPreviewImgBox({ w: r.width, h: r.height });
                            }}
                          />
                          {canOverlay && (
                            <div className="absolute inset-0 pointer-events-none">
                              {cells.map((c, idx) => {
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
                                    title={`Suspicious field (${f.field}): ${f.text}`}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div className="p-8 text-center text-sm text-gray-600">
                        <p className="mb-3">Preview is not available for this file type.</p>
                        <Button type="button" variant="outline" onClick={() => downloadDocument(selectedDocument)}>
                          <Download className="w-4 h-4 mr-2" />
                          Download to open
                        </Button>
                      </div>
                    );
                  })()}
                </div>
                <p className="mt-2 shrink-0 text-xs text-gray-500">
                  Preview loads securely for registrar accounts. Use Download to save a copy.
                </p>
              </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}