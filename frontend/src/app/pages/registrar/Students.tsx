import { useEffect, useMemo, useState } from "react";
import {
  Users,
  ChevronDown,
  ChevronRight,
  Search,
  Mail,
  KeyRound,
  CheckCircle,
  AlertCircle,
  FileText,
  Loader2,
  GraduationCap,
  Eye,
  ClipboardCheck,
  Send,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { toast } from "sonner";

type Student = {
  userId: number;
  enrollmentId: number;
  applicationId: string;
  fullName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  extensionName?: string;
  email: string;
  schoolUsername: string | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  /** Display label ("Pending physical docs" or "Enrolled"). */
  status: string;
  /** Raw enrollments.status — "approved" or "enrolled". Drives badges and
   *  controls whether the physical-doc checklist is editable. */
  enrollmentStatus?: string;
  strand: string;
  gradeLevel: string;
  schoolYear?: string;
  submittedDate?: string;
  approvedDate?: string;
  registrarRemarks?: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
  address?: string;
  religion?: string;
  previousSchool?: string;
  lastSchoolYearAttended?: string;
  documents?: Array<{
    id: number;
    type: string;
    fileName: string;
    mimeType: string;
    aiStatus: string;
    registrarReviewed: boolean;
    uploadedAt: string | null;
  }>;
};

/** One row of the registrar's physical-document checklist for an
 *  approved enrollment. The shape mirrors the GET /api/registrar/physical-docs
 *  response in api/registrar_physical_docs.php. */
type PhysicalDocItem = {
  id: number | null;
  key: string;
  label: string;
  required: boolean;
  transfereeOnly: boolean;
  received: boolean;
  receivedAt: string | null;
  receivedBy: number | null;
  notes: string | null;
};

type PhysicalDocsState = {
  items: PhysicalDocItem[];
  enrollmentStatus: "approved" | "enrolled" | string;
  allRequiredChecked: boolean;
  canMarkEnrolled: boolean;
  loading: boolean;
  error: string | null;
};

type Features = { credentials: boolean };

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayName(s: { fullName?: string; firstName?: string; middleName?: string; lastName?: string; extensionName?: string }) {
  const fn = (s.fullName || "").trim();
  if (fn) return fn;
  const parts = [s.firstName, s.middleName, s.lastName, s.extensionName]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  return parts.join(" ") || "Unnamed student";
}

export function Students() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [features, setFeatures] = useState<Features>({ credentials: false });
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [openStudentId, setOpenStudentId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<Student | null>(null);
  const [resending, setResending] = useState(false);
  const [issuing, setIssuing] = useState(false);
  // Physical-document checklist for the currently-open student. Lazy-loaded
  // once the side panel opens for an approved/enrolled student so we don't
  // pay the round-trip for unopened rows.
  const [physical, setPhysical] = useState<PhysicalDocsState>({
    items: [],
    enrollmentStatus: "approved",
    allRequiredChecked: false,
    canMarkEnrolled: false,
    loading: false,
    error: null,
  });
  const [physicalSubmittingKey, setPhysicalSubmittingKey] = useState<string | null>(null);
  const [markingEnrolled, setMarkingEnrolled] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  // In-app document viewer state. We open a dialog inside this page rather
  // than dropping the file in a fresh browser tab — keeps the registrar in
  // context and lets us add scroll + zoom controls for image documents.
  const [viewerDoc, setViewerDoc] = useState<
    | { id: number; fileName?: string; mimeType?: string; type?: string }
    | null
  >(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerObjectUrl, setViewerObjectUrl] = useState<string | null>(null);
  const [viewerKind, setViewerKind] = useState<"image" | "pdf" | "other">("other");
  // Image-only zoom factor (1 = 100%). PDFs use the iframe's built-in
  // zoom controls so we leave this slider hidden for PDF previews.
  const [viewerZoom, setViewerZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/api/registrar/students");
        const text = await res.text();
        let json: any = {};
        try { json = JSON.parse(text); } catch { /* fall through */ }
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || `Failed to load students (${res.status})`);
        }
        if (cancelled) return;
        setStudents(Array.isArray(json.students) ? (json.students as Student[]) : []);
        setFeatures({ credentials: !!json.features?.credentials });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load students");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Filtered + grouped: Strand → Grade Level → students
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? students.filter((s) =>
          [s.fullName, s.email, s.schoolUsername || "", s.applicationId]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : students;

    const byStrand: Record<string, Record<string, Student[]>> = {};
    for (const s of filtered) {
      const strand = s.strand || "Unassigned";
      const grade = s.gradeLevel ? `Grade ${s.gradeLevel}` : "Unassigned";
      if (!byStrand[strand]) byStrand[strand] = {};
      if (!byStrand[strand][grade]) byStrand[strand][grade] = [];
      byStrand[strand][grade].push(s);
    }
    // Sort strand keys, then grade keys (numerically when possible).
    const strandOrder = Object.keys(byStrand).sort((a, b) => a.localeCompare(b));
    const result: Array<{
      strand: string;
      total: number;
      grades: Array<{ grade: string; students: Student[] }>;
    }> = [];
    for (const strand of strandOrder) {
      const gradeMap = byStrand[strand];
      const gradeKeys = Object.keys(gradeMap).sort((a, b) => {
        const na = parseInt(a.replace(/\D+/g, ""), 10);
        const nb = parseInt(b.replace(/\D+/g, ""), 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });
      const grades = gradeKeys.map((g) => ({ grade: g, students: gradeMap[g] }));
      const total = grades.reduce((acc, g) => acc + g.students.length, 0);
      result.push({ strand, total, grades });
    }
    return result;
  }, [students, search]);

  async function openStudent(s: Student) {
    setOpenStudentId(s.userId);
    setDetail(null);
    setDetailLoading(true);
    // Reset the physical-docs panel for the new student. Don't fetch yet —
    // we wait until the student detail comes back so we know the
    // enrollmentId, and we only fetch when the student is approved/enrolled
    // (the endpoint returns 409 otherwise).
    setPhysical({
      items: [],
      enrollmentStatus: "approved",
      allRequiredChecked: false,
      canMarkEnrolled: false,
      loading: false,
      error: null,
    });
    try {
      const res = await apiFetch(`/api/registrar/students?user_id=${s.userId}`);
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Failed to load student (${res.status})`);
      }
      const fetched = json.student as Student;
      setDetail(fetched);
      // The Students page only lists approved/enrolled students, so any
      // student we open is eligible for the checklist. Belt-and-suspenders:
      // bail if for some reason the row's enrollmentStatus is something
      // unexpected (legacy data, manual DB tweaks, etc.).
      const status = (fetched.enrollmentStatus || "").toLowerCase();
      if (status === "approved" || status === "enrolled") {
        loadPhysicalDocs(fetched.enrollmentId);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load student detail");
      setDetail(s); // fall back to summary row
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadPhysicalDocs(enrollmentId: number) {
    if (!enrollmentId) return;
    setPhysical((p) => ({ ...p, loading: true, error: null }));
    try {
      const res = await apiFetch(`/api/registrar/physical-docs?enrollment_id=${enrollmentId}`);
      const text = await res.text();
      let json: any = {};
      try { json = JSON.parse(text); } catch { /* keep empty */ }
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Failed to load checklist (${res.status})`);
      }
      setPhysical({
        items: Array.isArray(json.items) ? (json.items as PhysicalDocItem[]) : [],
        enrollmentStatus: String(json.enrollmentStatus ?? "approved"),
        allRequiredChecked: Boolean(json.allRequiredChecked),
        canMarkEnrolled: Boolean(json.canMarkEnrolled),
        loading: false,
        error: null,
      });
    } catch (e) {
      setPhysical((p) => ({
        ...p,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load checklist",
      }));
    }
  }

  async function togglePhysicalDoc(item: PhysicalDocItem) {
    if (!detail) return;
    if (physical.enrollmentStatus === "enrolled") return; // checklist locked
    if (physicalSubmittingKey !== null) return;
    setPhysicalSubmittingKey(item.key);
    // Optimistic update so the checkbox feels responsive — if the request
    // fails we replace state with the authoritative server response below.
    const optimistic = !item.received;
    setPhysical((p) => ({
      ...p,
      items: p.items.map((it) =>
        it.key === item.key ? { ...it, received: optimistic } : it
      ),
    }));
    try {
      const res = await apiFetch("/api/registrar/physical-docs", {
        method: "POST",
        body: JSON.stringify({
          action: "toggle",
          enrollment_id: detail.enrollmentId,
          requirement_key: item.key,
          received: optimistic,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Toggle failed (${res.status})`);
      }
      // Snap to authoritative server state.
      setPhysical((p) => ({
        ...p,
        items: Array.isArray(json.items) ? (json.items as PhysicalDocItem[]) : p.items,
        enrollmentStatus: String(json.enrollmentStatus ?? p.enrollmentStatus),
        allRequiredChecked: Boolean(json.allRequiredChecked),
        canMarkEnrolled: Boolean(json.canMarkEnrolled),
      }));
    } catch (e) {
      // Roll back the optimistic flip and surface the error.
      setPhysical((p) => ({
        ...p,
        items: p.items.map((it) =>
          it.key === item.key ? { ...it, received: item.received } : it
        ),
      }));
      toast.error(e instanceof Error ? e.message : "Failed to toggle");
    } finally {
      setPhysicalSubmittingKey(null);
    }
  }

  async function markEnrolled() {
    if (!detail) return;
    if (!physical.canMarkEnrolled) return;
    if (markingEnrolled) return;

    const ok = window.confirm(
      `Mark ${displayName(detail)} as fully enrolled?\n\n` +
        "Confirms every required physical document has been received. " +
        "The student's status will change from \"Pending physical docs\" to \"Enrolled\". " +
        "You can still edit the checklist by reverting status from the database, but normal use is one-way."
    );
    if (!ok) return;

    setMarkingEnrolled(true);
    try {
      const res = await apiFetch("/api/registrar/physical-docs", {
        method: "POST",
        body: JSON.stringify({
          action: "mark_enrolled",
          enrollment_id: detail.enrollmentId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Failed to mark enrolled (${res.status})`);
      }
      setPhysical((p) => ({
        ...p,
        items: Array.isArray(json.items) ? (json.items as PhysicalDocItem[]) : p.items,
        enrollmentStatus: String(json.enrollmentStatus ?? "enrolled"),
        allRequiredChecked: Boolean(json.allRequiredChecked),
        canMarkEnrolled: Boolean(json.canMarkEnrolled),
      }));
      // Reflect the new status in the detail panel + the row in the list
      // so the badge updates without a page reload.
      setDetail((d) => (d ? { ...d, enrollmentStatus: "enrolled", status: "Enrolled" } : d));
      setStudents((rows) =>
        rows.map((r) =>
          r.userId === detail.userId
            ? { ...r, enrollmentStatus: "enrolled", status: "Enrolled" }
            : r
        )
      );
      toast.success(`${displayName(detail)} is now fully enrolled.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark enrolled");
    } finally {
      setMarkingEnrolled(false);
    }
  }

  async function sendPhysicalReminder() {
    if (!detail) return;
    const missing = physical.items.filter((i) => i.required && !i.received).map((i) => i.label);
    if (missing.length === 0) {
      toast.message("Nothing to remind — all required documents are checked.");
      return;
    }
    if (!detail.email) {
      toast.error("Student does not have a personal email on file.");
      return;
    }
    const ok = window.confirm(
      `Email ${detail.email} a reminder for ${missing.length} missing document${
        missing.length === 1 ? "" : "s"
      }?\n\n- ${missing.join("\n- ")}`
    );
    if (!ok) return;

    setSendingReminder(true);
    try {
      const res = await apiFetch("/api/registrar/physical-docs", {
        method: "POST",
        body: JSON.stringify({
          action: "send_reminder",
          enrollment_id: detail.enrollmentId,
        }),
      });
      const json = await res.json();
      if (json?.delivery === "sent") {
        toast.success(`Reminder sent to ${detail.email}.`);
      } else {
        const msg = json?.error || "Failed to deliver reminder";
        toast.error(msg);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send reminder");
    } finally {
      setSendingReminder(false);
    }
  }

  /**
   * Lightweight binary sniff so we don't render a JSON error page or HTML
   * via <img>. Reads the first few bytes and returns a coarse kind. Mirrors
   * (a small subset of) the helper in pages/registrar/ReviewDocuments.tsx —
   * duplicated here intentionally so this page does not depend on that
   * file's internals.
   */
  function sniffDocKind(buf: ArrayBuffer, fileName?: string, mimeType?: string): "image" | "pdf" | "other" {
    const u = new Uint8Array(buf.byteLength ? buf.slice(0, 8) : new ArrayBuffer(0));
    if (u.length >= 4) {
      // %PDF
      if (u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46) return "pdf";
      // PNG
      if (u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return "image";
      // JPEG
      if (u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return "image";
      // GIF8
      if (u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x38) return "image";
      // WEBP (RIFF....WEBP)
      if (u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46) return "image";
    }
    // Fallback to mime/extension when the first bytes are inconclusive.
    const mt = (mimeType || "").toLowerCase();
    if (mt.startsWith("image/")) return "image";
    if (mt === "application/pdf") return "pdf";
    const ext = (fileName || "").toLowerCase().split(".").pop() || "";
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext)) return "image";
    if (ext === "pdf") return "pdf";
    return "other";
  }

  /**
   * Fetch a submitted document via the authenticated /api/document-file
   * endpoint and open it in the in-app viewer dialog. We can't use a plain
   * `<a href>` because the endpoint requires the X-User-Id header that
   * apiFetch adds; a normal anchor would 401.
   */
  async function viewDocument(doc: { id: number; fileName?: string; mimeType?: string; type?: string }) {
    if (!doc?.id) {
      toast.error("Document is not available for preview");
      return;
    }
    // Snapshot any prior URL so we can revoke it AFTER the new one is in
    // place, not before. Revoking-then-setting created a render where the
    // <img> briefly saw an empty src; some browsers cache that empty
    // request and refuse to redraw when src is updated milliseconds later,
    // showing a broken-image icon even though the bytes are valid.
    const previousUrl = viewerObjectUrl;
    setViewerDoc({ id: doc.id, fileName: doc.fileName, mimeType: doc.mimeType, type: doc.type });
    setViewerLoading(true);
    setViewerError(null);
    setViewerKind("other");
    setViewerZoom(1);
    // Keep `viewerObjectUrl` pointing at the prior blob (if any) until the
    // new bytes are ready. The `viewerLoading` flag hides the <img> branch
    // in the meantime, so the registrar sees a spinner — never an empty
    // src that some browsers cache as a permanent failure.

    try {
      const res = await apiFetch(`/api/document-file?id=${doc.id}`);
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Failed to load document (${res.status}) ${errText}`.trim());
      }
      // Sniff the bytes once before deciding how to render them.
      const buf = await res.arrayBuffer();
      const kind = sniffDocKind(buf, doc.fileName, doc.mimeType);
      // eslint-disable-next-line no-console
      console.log("[viewDocument]", {
        id: doc.id,
        bufBytes: buf.byteLength,
        sniffedKind: kind,
        mimeFromDb: doc.mimeType,
      });

      // Render strategy:
      // - Images: use FileReader.readAsDataURL — the browser's canonical
      //   "bytes -> data: URL" path. We tried base64 via btoa() and blob:
      //   URLs first; both had edge cases (Latin-1 chunking, blob URL
      //   revocation timing). FileReader is boring and reliable.
      // - PDFs: keep the blob: URL so the iframe gets Chrome's built-in
      //   PDF viewer with paging/zoom controls.
      let url: string;
      if (kind === "image") {
        const mime = doc.mimeType || "image/png";
        const blob = new Blob([buf], { type: mime });
        url = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onerror = () => {
            // eslint-disable-next-line no-console
            console.error("[viewDocument] FileReader onerror", fr.error);
            reject(new Error("FileReader failed to read the document bytes"));
          };
          fr.onload = () => {
            const result = fr.result;
            if (typeof result === "string" && result.startsWith("data:")) {
              // eslint-disable-next-line no-console
              console.log("[viewDocument] data URL ready, length=", result.length);
              resolve(result);
            } else {
              reject(new Error("FileReader did not return a data URL"));
            }
          };
          fr.readAsDataURL(blob);
        });
      } else {
        const blobType =
          kind === "pdf"
            ? "application/pdf"
            : (doc.mimeType || "application/octet-stream");
        const blob = new Blob([buf], { type: blobType });
        url = URL.createObjectURL(blob);
      }

      // Set the kind first, then the URL on the next microtask so React
      // commits both in the same render cycle. Otherwise the JSX could
      // briefly evaluate (kind=other, url=blob:...) and render the
      // "preview not available" branch before the kind catches up.
      setViewerKind(kind);
      setViewerObjectUrl(url);
      // Now revoke the previously-displayed blob URL (if any). Doing it
      // here, after the new URL is committed, prevents the brief gap
      // where the <img> would see neither URL. Data: URLs do not need
      // revoking; only blob:s do.
      if (previousUrl && previousUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previousUrl);
      }
    } catch (e) {
      // Restore the prior URL if the fetch failed, so the dialog isn't
      // stuck on an empty preview.
      if (previousUrl && previousUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previousUrl);
      }
      setViewerError(e instanceof Error ? e.message : "Failed to load document");
    } finally {
      setViewerLoading(false);
    }
  }

  function closeViewer() {
    setViewerDoc(null);
    setViewerLoading(false);
    setViewerError(null);
    setViewerKind("other");
    setViewerZoom(1);
    setViewerObjectUrl((prev) => {
      // Only blob: URLs need revoking. Data URLs are GC'd with the string
      // itself so attempting URL.revokeObjectURL on them is harmless but
      // pointless. Branching keeps the intent explicit.
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
  }

  async function resendWelcome() {
    if (!detail) return;
    if (!features.credentials || !detail.schoolUsername) return;
    setResending(true);
    try {
      const res = await apiFetch("/api/registrar/students", {
        method: "POST",
        body: JSON.stringify({ action: "resend_welcome", user_id: detail.userId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Failed to send (${res.status})`);
      }
      toast.success("Welcome reminder email sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send reminder email");
    } finally {
      setResending(false);
    }
  }

  async function issueCredentials() {
    if (!detail) return;
    if (!features.credentials || detail.schoolUsername) return;
    if (issuing) return;

    // The temporary password is the student's date of birth in mm-dd-yyyy
    // format. Make that explicit in the confirm so the registrar can warn
    // the student verbally if the welcome email bounces.
    const ok = window.confirm(
      `Issue credentials for ${displayName(detail)}?\n\n` +
        `A school username will be generated and a welcome email sent to ${detail.email}. ` +
        `The temporary password is the student's date of birth (mm-dd-yyyy). ` +
        `They will be required to change it on first login.`
    );
    if (!ok) return;

    setIssuing(true);
    try {
      const res = await apiFetch("/api/registrar/application", {
        method: "POST",
        body: JSON.stringify({
          action: "issue_credentials",
          enrollment_id: detail.enrollmentId,
        }),
      });
      const text = await res.text();
      let json: any = {};
      try { json = JSON.parse(text); } catch { /* keep empty */ }

      if (!res.ok || !json?.success) {
        const code = (json?.error as string) || `http_${res.status}`;
        const message =
          code === "missing_birth_date"
            ? "Cannot issue credentials: date of birth is missing on the enrollment form."
            : code === "invalid_name"
              ? "Cannot issue credentials: the student's name is missing or has no usable letters."
              : code === "credentials_already_issued"
                ? "Credentials have already been issued for this student."
                : code === "enrollment_not_approved"
                  ? "Approve the application first, then issue credentials."
                  : code === "schema_not_migrated"
                    ? "Credentials feature is not enabled in this environment yet."
                    : `Failed to issue credentials (${code}).`;
        toast.error(message);
        return;
      }

      const username = json.school_username as string | undefined;
      const delivery = json.email_delivery as "sent" | "failed" | undefined;
      if (delivery === "sent") {
        toast.success(
          `Credentials issued. Welcome email sent to ${detail.email}.${
            username ? ` Username: ${username}` : ""
          }`
        );
      } else {
        toast.warning(
          `Credentials issued (username ${username ?? "—"}), but the welcome email could not be delivered. Use "Resend welcome email" once the inbox is reachable.`
        );
      }

      // Refresh the open student so the panel flips to the issued state.
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              schoolUsername: username ?? prev.schoolUsername,
              mustChangePassword: true,
            }
          : prev
      );
      // Also patch the row in the list so the badge/state stays consistent.
      setStudents((rows) =>
        rows.map((r) =>
          r.userId === detail.userId
            ? { ...r, schoolUsername: username ?? r.schoolUsername, mustChangePassword: true }
            : r
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to issue credentials");
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Students</h1>
          <p className="text-sm text-gray-600">Approved enrollees, grouped by strand and grade level.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name, email, or username"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {!features.credentials && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-900">
            School credentials feature is not yet enabled in this environment. Student records and documents
            are still visible. Run <code>database_migration_credentials.sql</code> to enable username and
            welcome-email tools.
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card className="p-12 text-center text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
          Loading students…
        </Card>
      ) : error ? (
        <Alert className="border-red-300 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-700" />
          <AlertDescription className="text-red-900">{error}</AlertDescription>
        </Alert>
      ) : grouped.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">No students yet.</p>
          <p className="text-sm text-gray-500 mt-1">
            {search ? "No matches for your search." : "Students appear here once their applications are approved."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => {
            const strandKey = group.strand;
            const strandCollapsed = !!collapsedGroups[strandKey];
            return (
              <Card key={strandKey} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCollapsedGroups((prev) => ({ ...prev, [strandKey]: !prev[strandKey] }))}
                  className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {strandCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="font-semibold text-[#8B1538]">{strandKey}</span>
                    <Badge variant="outline" className="border-gray-300 text-gray-600">
                      {group.total} student{group.total === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </button>
                {!strandCollapsed && (
                  <div className="divide-y">
                    {group.grades.map(({ grade, students: gradeStudents }) => {
                      const groupKey = `${strandKey}::${grade}`;
                      const gradeCollapsed = !!collapsedGroups[groupKey];
                      return (
                        <div key={groupKey}>
                          <button
                            type="button"
                            onClick={() => setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                            className="w-full flex items-center justify-between px-5 py-2 bg-white hover:bg-gray-50 text-left"
                          >
                            <div className="flex items-center gap-2 text-sm">
                              {gradeCollapsed ? (
                                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                              )}
                              <GraduationCap className="w-3.5 h-3.5 text-gray-500" />
                              <span className="font-medium text-gray-800">{grade}</span>
                              <span className="text-xs text-gray-500">({gradeStudents.length})</span>
                            </div>
                          </button>
                          {!gradeCollapsed && (
                            <ul className="divide-y border-t bg-white">
                              {gradeStudents.map((s) => (
                                <li key={s.userId}>
                                  <div className="grid grid-cols-12 items-center gap-3 px-5 py-3 hover:bg-[#8B1538]/5 transition-colors">
                                    <div className="col-span-12 md:col-span-5 min-w-0">
                                      <p className="font-medium text-gray-900 truncate">{displayName(s)}</p>
                                      <p className="text-xs text-gray-500 truncate">{s.email || "no email"}</p>
                                    </div>
                                    <div className="col-span-6 md:col-span-3">
                                      {(s.enrollmentStatus || "approved").toLowerCase() === "enrolled" ? (
                                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                                          <CheckCircle className="w-3 h-3 mr-1" />
                                          Enrolled
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                                          <ClipboardCheck className="w-3 h-3 mr-1" />
                                          Pending physical docs
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="col-span-6 md:col-span-3 text-sm tabular-nums text-gray-700">
                                      {s.schoolUsername ? (
                                        <span className="inline-flex items-center gap-1.5">
                                          <KeyRound className="w-3.5 h-3.5 text-gray-500" />
                                          <span className="font-mono">{s.schoolUsername}</span>
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">—</span>
                                      )}
                                    </div>
                                    <div className="col-span-12 md:col-span-1 flex justify-end">
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => openStudent(s)}
                                        className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
                                      >
                                        <Eye className="w-4 h-4 mr-1.5" />
                                        View
                                      </Button>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Sheet
        open={openStudentId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOpenStudentId(null);
            setDetail(null);
            // Reset checklist state so the next student opens fresh.
            setPhysical({
              items: [],
              enrollmentStatus: "approved",
              allRequiredChecked: false,
              canMarkEnrolled: false,
              loading: false,
              error: null,
            });
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle>{detail ? displayName(detail) : "Student detail"}</SheetTitle>
            <SheetDescription>
              {detail ? `${detail.applicationId} · ${detail.strand} · Grade ${detail.gradeLevel}` : ""}
            </SheetDescription>
          </SheetHeader>

          {detailLoading || !detail ? (
            <div className="p-6 text-center text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
              Loading…
            </div>
          ) : (
            <div className="px-4 pb-6 space-y-5">
              {/* Personal */}
              <Section title="Personal information">
                <KV label="Full name" value={displayName(detail)} />
                <KV label="Personal email" value={detail.email} mono />
                <KV label="Phone" value={detail.phone} />
                <KV label="Date of birth" value={formatDate(detail.dateOfBirth)} />
                <KV label="Gender" value={detail.gender} />
                <KV label="Religion" value={detail.religion} />
                <KV label="Address" value={detail.address} multiline />
              </Section>

              {/* Academic */}
              <Section title="Academic">
                <KV label="Strand" value={detail.strand} />
                <KV label="Grade level" value={detail.gradeLevel} />
                <KV label="School year" value={detail.schoolYear} />
                <KV label="Previous school" value={detail.previousSchool} />
                <KV label="Last school year attended" value={detail.lastSchoolYearAttended} />
              </Section>

              {/* Credentials */}
              <Section title="Credentials & access">
                {!features.credentials ? (
                  <p className="text-sm text-gray-600 italic">
                    Credentials feature not yet enabled in this environment.
                  </p>
                ) : detail.schoolUsername ? (
                  <>
                    <KV
                      label="School username"
                      value={detail.schoolUsername}
                      mono
                    />
                    <KV
                      label="Password change required"
                      value={detail.mustChangePassword ? "Yes (first login pending)" : "No"}
                    />
                    <KV label="Last login" value={formatDateTime(detail.lastLoginAt)} />
                    <div className="pt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={resendWelcome}
                        disabled={resending}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        {resending ? "Sending…" : "Resend welcome email"}
                      </Button>
                      <p className="text-xs text-gray-500 mt-1.5">
                        Re-sends the school username and a reminder of the temporary password format
                        (date of birth, mm-dd-yyyy). Does not reset the password.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-sm text-gray-700">
                      <KeyRound className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
                      <p>
                        No school account has been issued yet for this student. Issuing will
                        generate a school username from the student's name, set their
                        temporary password to their date of birth (mm-dd-yyyy), and email
                        the credentials to{" "}
                        <span className="font-medium">{detail.email || "the student's personal email"}</span>.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={issueCredentials}
                      disabled={issuing || !detail.email}
                      className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
                    >
                      <KeyRound className="w-4 h-4 mr-2" />
                      {issuing ? "Issuing…" : "Issue credentials"}
                    </Button>
                    {!detail.email && (
                      <p className="text-xs text-amber-700">
                        A personal email is required before credentials can be issued.
                      </p>
                    )}
                  </div>
                )}
              </Section>

              {/* Documents */}
              <Section title="Submitted documents">
                {!detail.documents || detail.documents.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No documents on file.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-start gap-3 p-3 border rounded-md bg-white"
                      >
                        <FileText className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-900 truncate" title={doc.fileName}>
                              {doc.fileName}
                            </p>
                            <Badge
                              className={
                                doc.aiStatus === "Verified"
                                  ? "bg-green-600 text-white"
                                  : doc.aiStatus === "Flagged"
                                    ? "bg-red-600 text-white"
                                    : "bg-yellow-600 text-white"
                              }
                            >
                              {doc.aiStatus}
                            </Badge>
                            {doc.registrarReviewed && (
                              <Badge className="bg-emerald-600 text-white">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Reviewed
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {(doc.type || "Document").replace(/\s+/g, " ")} · uploaded {formatDate(doc.uploadedAt)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => viewDocument(doc)}
                          disabled={viewerLoading && viewerDoc?.id === doc.id}
                          title="Preview the file the student uploaded online"
                        >
                          {viewerLoading && viewerDoc?.id === doc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                          <span className="ml-1.5 hidden sm:inline">View</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Physical document checklist (approved students only). The
                  checklist is locked once the registrar marks the student
                  as enrolled — flipping the boolean back is intentionally
                  not exposed here to keep the workflow one-way under
                  normal use. */}
              <Section title="Physical document checklist">
                {physical.loading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading checklist…
                  </div>
                ) : physical.error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{physical.error}</AlertDescription>
                  </Alert>
                ) : physical.items.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    No checklist items configured for this enrollment.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-gray-600 mb-2">
                      Tick each item as the student hands over the physical copy. Once every
                      required item is checked, you can mark the student as fully enrolled.
                    </p>
                    <ul className="space-y-2">
                      {physical.items.map((item) => {
                        const submitting = physicalSubmittingKey === item.key;
                        const locked =
                          physical.enrollmentStatus === "enrolled" || submitting;
                        return (
                          <li
                            key={item.key}
                            className={`flex items-start gap-3 p-2 rounded-md border ${
                              item.received
                                ? "border-emerald-200 bg-emerald-50"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.received}
                              disabled={locked}
                              onChange={() => togglePhysicalDoc(item)}
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#8B1538] focus:ring-[#8B1538]"
                              aria-label={item.label}
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-sm ${
                                  item.received ? "text-emerald-900 line-through" : "text-gray-900"
                                }`}
                              >
                                {item.label}
                                {!item.required && (
                                  <span className="ml-2 text-xs text-gray-500">(optional)</span>
                                )}
                              </p>
                              {item.received && item.receivedAt && (
                                <p className="text-xs text-emerald-700/80 mt-0.5">
                                  Received {formatDateTime(item.receivedAt)}
                                </p>
                              )}
                            </div>
                            {submitting && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                          </li>
                        );
                      })}
                    </ul>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {physical.enrollmentStatus === "enrolled" ? (
                        <Badge className="bg-emerald-600 text-white">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Fully enrolled
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={markEnrolled}
                          disabled={!physical.canMarkEnrolled || markingEnrolled}
                          className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white disabled:bg-[#2D5016]/40 disabled:hover:bg-[#2D5016]/40"
                          title={
                            physical.canMarkEnrolled
                              ? undefined
                              : "Tick every required physical document first."
                          }
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {markingEnrolled ? "Marking…" : "Mark as enrolled"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={sendPhysicalReminder}
                        disabled={
                          sendingReminder ||
                          physical.enrollmentStatus === "enrolled" ||
                          physical.allRequiredChecked ||
                          !detail.email
                        }
                        title={
                          physical.allRequiredChecked
                            ? "Nothing to remind — all required documents are checked."
                            : !detail.email
                              ? "No personal email on file."
                              : undefined
                        }
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {sendingReminder ? "Sending…" : "Email missing-doc reminder"}
                      </Button>
                    </div>
                  </>
                )}
              </Section>

              {/* Activity / decision */}
              <Section title="Activity & decision history">
                <KV label="Application submitted" value={formatDateTime(detail.submittedDate)} />
                <KV label="Approved on" value={formatDateTime(detail.approvedDate)} />
                <KV
                  label="Registrar remarks"
                  value={detail.registrarRemarks || "—"}
                  multiline
                />
                <KV label="Last login (school portal)" value={formatDateTime(detail.lastLoginAt)} />
              </Section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Document viewer dialog. Shown when the registrar clicks View on a
          submitted-document row. The container scrolls naturally and image
          documents get an explicit zoom slider; PDFs use the browser's
          built-in viewer (which already provides zoom + scroll). */}
      <Dialog
        open={viewerDoc !== null}
        onOpenChange={(open) => {
          if (!open) closeViewer();
        }}
      >
        <DialogContent className="!max-w-5xl !w-[95vw] !max-h-[92vh] flex flex-col !p-0 !gap-0 sm:!max-w-5xl">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-base font-semibold truncate">
              {viewerDoc?.fileName || "Document"}
            </DialogTitle>
            {viewerDoc?.type && (
              <DialogDescription className="text-xs text-gray-500">
                {viewerDoc.type}
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Toolbar: zoom controls only meaningful for image documents.
              For PDFs we leave it minimal since the iframe ships its own. */}
          {viewerKind === "image" && !viewerLoading && !viewerError && viewerObjectUrl && (
            <div className="px-6 py-2 border-b bg-gray-50 flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setViewerZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                disabled={viewerZoom <= 0.5}
                aria-label="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.05}
                value={viewerZoom}
                onChange={(e) => setViewerZoom(Number(e.target.value))}
                className="flex-1 max-w-xs accent-[#8B1538]"
                aria-label="Zoom level"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setViewerZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                disabled={viewerZoom >= 3}
                aria-label="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <span className="text-xs text-gray-600 tabular-nums w-14 text-right">
                {Math.round(viewerZoom * 100)}%
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setViewerZoom(1)}
                disabled={viewerZoom === 1}
              >
                Reset
              </Button>
            </div>
          )}

          {/* Scrollable preview area. overflow-auto lets the registrar pan
              an image that has been zoomed past the dialog width. */}
          <div className="flex-1 min-h-0 overflow-auto bg-gray-100">
            {viewerLoading && (
              <div className="flex flex-col items-center gap-2 py-16 text-gray-600">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm">Loading preview…</span>
              </div>
            )}

            {!viewerLoading && viewerError && (
              <Alert variant="destructive" className="m-6">
                <AlertDescription>{viewerError}</AlertDescription>
              </Alert>
            )}

            {!viewerLoading && !viewerError && viewerObjectUrl && viewerKind === "image" && (
              <div className="flex items-start justify-center p-4">
                {/* Width is driven by zoom; we never set a height so the
                    aspect ratio is preserved. The parent's overflow-auto
                    provides scroll bars when the image exceeds the dialog. */}
                <img
                  key={viewerObjectUrl}
                  src={viewerObjectUrl}
                  alt={viewerDoc?.fileName || "Document preview"}
                  style={{ width: `${viewerZoom * 100}%`, maxWidth: "none" }}
                  className="block bg-white shadow-sm rounded"
                  draggable={false}
                  onLoad={() => {
                    // eslint-disable-next-line no-console
                    console.log("[viewDocument] <img> loaded successfully");
                  }}
                  onError={(e) => {
                    // eslint-disable-next-line no-console
                    console.error("[viewDocument] <img> onError fired", e, {
                      srcLen: viewerObjectUrl?.length,
                      srcPrefix: viewerObjectUrl?.slice(0, 40),
                    });
                    setViewerError("Could not render this image. Try reopening the View dialog.");
                  }}
                />
              </div>
            )}

            {!viewerLoading && !viewerError && viewerObjectUrl && viewerKind === "pdf" && (
              <iframe
                title={viewerDoc?.fileName || "Document preview"}
                src={viewerObjectUrl}
                className="w-full h-full min-h-[70vh] border-0 bg-white"
              />
            )}

            {!viewerLoading && !viewerError && viewerObjectUrl && viewerKind === "other" && (
              <div className="p-12 text-center text-sm text-gray-600">
                Preview is not available for this file type. Use the registrar review screen
                to download the file.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-gray-50/50 p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function KV({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
  multiline?: boolean;
}) {
  const display =
    value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <span className="text-gray-500 col-span-1">{label}</span>
      <span
        className={
          "col-span-2 text-gray-900 " +
          (mono ? "font-mono " : "") +
          (multiline ? "whitespace-pre-wrap break-words" : "truncate")
        }
        title={multiline ? undefined : display}
      >
        {display}
      </span>
    </div>
  );
}
