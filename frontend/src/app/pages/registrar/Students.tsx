import { useEffect, useMemo, useState } from "react";
import {
  Users,
  ChevronDown,
  ChevronRight,
  Search,
  Mail,
  KeyRound,
  CheckCircle,
  Circle,
  AlertCircle,
  FileText,
  Loader2,
  GraduationCap,
  Eye,
  ClipboardCheck,
  Send,
  Layers,
  Sun,
  Moon,
  Calendar,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { apiFetch } from "../../lib/api";
import { useSchoolYear } from "../../context/SchoolYearContext";
import { SecureDocumentPreview } from "../../components/SecureDocumentPreview";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { toast } from "sonner";
import { normalizeStrandCode, STRAND_CODES, formatStrandDisplay } from "../../lib/strands";

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
  /** Display label — always Enrolled once the registrar approved. */
  status: string;
  /** Raw enrollments.status — legacy rows may still be `approved`. */
  enrollmentStatus?: string;
  /** True once every required physical document has been checked off. */
  physicalDocsComplete?: boolean;
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
  /** Current section letter on `students.section` (e.g. "A"). */
  currentSection?: string | null;
  /** Current class shift on `students.section_shift` ("morning" | "afternoon"). */
  currentShift?: "morning" | "afternoon" | null;
  /** Original shift the student picked on the enrollment form. */
  preferredShift?: "morning" | "afternoon" | null;
};

/** Canonical strands — keep in sync with api/registrar_sections.php SECTION_STRANDS. */
const REGISTRAR_STRANDS = [...STRAND_CODES];

type ReassignSectionOption = {
  id: number;
  name: string;
  strand: string;
  shift: "morning" | "afternoon";
  maxBoys: number;
  maxGirls: number;
  capacity: number;
  enrolledBoys: number;
  enrolledGirls: number;
  enrolledTotal: number;
  boysSeats: number;
  girlsSeats: number;
  hasSeatForGender: boolean;
  isCurrent: boolean;
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

type AutoReminderInfo = {
  intervalDays: number;
  lastSentAt: string | null;
  reminderCount: number;
  nextScheduledAt: string | null;
};

type PhysicalDocsState = {
  items: PhysicalDocItem[];
  enrollmentStatus: "approved" | "enrolled" | string;
  allRequiredChecked: boolean;
  physicalDocsComplete: boolean;
  canMarkComplete: boolean;
  loading: boolean;
  error: string | null;
  autoReminder: AutoReminderInfo | null;
};

type Features = { credentials: boolean };

function physicalDocsFromJson(json: any, prev?: PhysicalDocsState | null): Omit<PhysicalDocsState, "loading" | "error"> {
  return {
    items: Array.isArray(json.items) ? (json.items as PhysicalDocItem[]) : prev?.items ?? [],
    enrollmentStatus: String(json.enrollmentStatus ?? prev?.enrollmentStatus ?? "enrolled"),
    allRequiredChecked: Boolean(json.allRequiredChecked),
    physicalDocsComplete: Boolean(json.physicalDocsComplete ?? json.allRequiredChecked),
    canMarkComplete: Boolean(json.canMarkComplete),
    autoReminder: json.autoReminder
      ? {
          intervalDays: Number(json.autoReminder.intervalDays ?? 0),
          lastSentAt: json.autoReminder.lastSentAt ?? null,
          reminderCount: Number(json.autoReminder.reminderCount ?? 0),
          nextScheduledAt: json.autoReminder.nextScheduledAt ?? null,
        }
      : prev?.autoReminder ?? null,
  };
}

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

function cohortListSubtitle(cohort: "applicant" | "enrolled_grade_11" | "enrolled_grade_12"): string {
  if (cohort === "applicant") {
    return "Enrollment applications awaiting approval, grouped by strand and grade level.";
  }
  if (cohort === "enrolled_grade_12") {
    return "Enrolled Grade 12 students for the selected enrollment year, grouped by strand.";
  }
  return "Enrolled Grade 11 students for the selected enrollment year, grouped by strand.";
}

function cohortStatusBadgeClass(status: string): string {
  const s = status.toLowerCase().trim();
  if (s.includes("enrolled") || s === "approved") {
    return "bg-emerald-600 text-white hover:bg-emerald-700";
  }
  if (s.includes("reject")) {
    return "bg-red-600 text-white hover:bg-red-700";
  }
  if (s.includes("review")) {
    return "bg-blue-600 text-white hover:bg-blue-700";
  }
  if (s.includes("draft")) {
    return "bg-gray-500 text-white hover:bg-gray-600";
  }
  return "bg-amber-500 text-white hover:bg-amber-600";
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
    physicalDocsComplete: false,
    canMarkComplete: false,
    loading: false,
    error: null,
    autoReminder: null,
  });
  const [physicalSubmittingKey, setPhysicalSubmittingKey] = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  // Bulk "Send reminders to all students with missing docs" — single
  // click in the page header, bypasses the 3-day throttle so every
  // approved student gets a fresh nudge.
  const [bulkRemindingAll, setBulkRemindingAll] = useState(false);
  // Confirmation modal for the bulk action. We use a real centered
  // dialog instead of window.confirm so it matches the rest of the UI
  // and stays inside the app's theme.
  const [bulkRemindOpen, setBulkRemindOpen] = useState(false);
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
  const [viewerLightboxOpen, setViewerLightboxOpen] = useState(false);
  // Reassign-section dialog state. Loaded lazily when the registrar clicks
  // "Reassign" so we don't fetch the section list for every detail open.
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignLoading, setReassignLoading] = useState(false);
  const [reassignOptions, setReassignOptions] = useState<ReassignSectionOption[]>([]);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState<{ name: string; shift: "morning" | "afternoon" } | null>(null);
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [reassignForce, setReassignForce] = useState(false);

  const { enrollmentSchoolYearLabel, endedSchoolYears, schoolYears } = useSchoolYear();
  /** Independent of strand/grade grouping — controls which enrollment cohort is loaded. */
  const [enrollmentYearFilter, setEnrollmentYearFilter] = useState<"current" | "all" | string>("current");
  const [schoolYearOptions, setSchoolYearOptions] = useState<string[]>([]);
  const [strandFilter, setStrandFilter] = useState<string>("all");
  /** Separate DB cohort: applicants vs enrolled G11 vs enrolled G12. */
  const [listCohort, setListCohort] = useState<
    "applicant" | "enrolled_grade_11" | "enrolled_grade_12"
  >("enrolled_grade_11");
  const [cohortCounts, setCohortCounts] = useState({
    applicant: 0,
    enrolled_grade_11: 0,
    enrolled_grade_12: 0,
  });

  const apiSchoolYearParam = useMemo(() => {
    if (enrollmentYearFilter === "all") return "all";
    if (enrollmentYearFilter === "current") {
      return enrollmentSchoolYearLabel ? enrollmentSchoolYearLabel : "current";
    }
    return enrollmentYearFilter;
  }, [enrollmentYearFilter, enrollmentSchoolYearLabel]);

  const appliedEnrollmentYearLabel = useMemo(() => {
    if (enrollmentYearFilter === "all") return "All enrollment years";
    if (enrollmentYearFilter === "current") {
      return enrollmentSchoolYearLabel
        ? `SY ${enrollmentSchoolYearLabel} (active enrollment)`
        : "Active enrollment year";
    }
    return `SY ${enrollmentYearFilter}`;
  }, [enrollmentYearFilter, enrollmentSchoolYearLabel]);

  const mergeSchoolYearOptions = (incoming: string[]) => {
    const merged = new Set<string>(incoming);
    for (const sy of schoolYears) {
      const y = (sy.year ?? "").trim();
      if (y) merged.add(y);
    }
    if (enrollmentSchoolYearLabel) {
      merged.add(enrollmentSchoolYearLabel);
    }
    return Array.from(merged).sort((a, b) => b.localeCompare(a));
  };

  const selectablePastYears = useMemo(
    () =>
      schoolYearOptions.filter(
        (y) => !enrollmentSchoolYearLabel || y !== enrollmentSchoolYearLabel,
      ),
    [schoolYearOptions, enrollmentSchoolYearLabel],
  );

  useEffect(() => {
    setSchoolYearOptions((prev) =>
      mergeSchoolYearOptions([
        ...prev,
        ...schoolYears.map((sy) => sy.year).filter(Boolean),
        ...(enrollmentSchoolYearLabel ? [enrollmentSchoolYearLabel] : []),
      ]),
    );
  }, [schoolYears, enrollmentSchoolYearLabel]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("cohort", listCohort);
        if (apiSchoolYearParam) {
          params.set("school_year", apiSchoolYearParam);
        }
        const res = await apiFetch(
          `/api/registrar/cohorts?${params.toString()}`,
        );
        const text = await res.text();
        let json: any = {};
        try { json = JSON.parse(text); } catch { /* fall through */ }
        if (!res.ok || !json?.success) {
          const msg =
            json?.message ||
            json?.error ||
            json?.error || 'Could not load students. Please try again.';
          throw new Error(msg);
        }
        if (cancelled) return;
        const cohortRows = Array.isArray(json.students) ? json.students : [];
        const mapped: Student[] = cohortRows.map((row: Record<string, unknown>) => ({
          userId: Number(row.userId ?? 0),
          enrollmentId: Number(row.enrollmentId ?? 0),
          applicationId: `APP-${new Date().getFullYear()}-${String(row.enrollmentId ?? "").padStart(3, "0")}`,
          fullName: String(row.fullName ?? ""),
          email: String(row.email ?? ""),
          schoolUsername:
            row.schoolUsername != null ? String(row.schoolUsername) : null,
          mustChangePassword: false,
          lastLoginAt: null,
          status: String(row.status ?? ""),
          enrollmentStatus: String(row.enrollmentStatus ?? ""),
          strand: String(row.strand ?? ""),
          gradeLevel: String(row.gradeLevel ?? ""),
          schoolYear: String(row.schoolYear ?? ""),
          physicalDocsComplete: Boolean(row.physicalDocsComplete),
        }));
        setStudents(mapped);
        setFeatures({
          credentials: Boolean(json.features?.credentials),
        });
        if (json.counts) {
          setCohortCounts({
            applicant: Number(json.counts.applicant ?? 0),
            enrolled_grade_11: Number(json.counts.enrolled_grade_11 ?? 0),
            enrolled_grade_12: Number(json.counts.enrolled_grade_12 ?? 0),
          });
        }
        const apiYearOptions = Array.isArray(json.filters?.school_year_options)
          ? (json.filters.school_year_options as string[])
          : [];
        const fromRows = mapped
          .map((s) => (s.schoolYear ?? "").trim())
          .filter(Boolean);
        setSchoolYearOptions((prev) =>
          mergeSchoolYearOptions([...prev, ...apiYearOptions, ...fromRows]),
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load students");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiSchoolYearParam, listCohort]);

  useEffect(() => {
    setStrandFilter("all");
  }, [apiSchoolYearParam, listCohort]);

  const strandSelectOptions = useMemo(() => {
    const set = new Set<string>(REGISTRAR_STRANDS);
    for (const s of students) {
      const st = (s.strand || "").trim();
      if (st) set.add(st);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const hasActiveListFilters = strandFilter !== "all";

  const listCohortLabel =
    listCohort === "applicant"
      ? "Applicants"
      : listCohort === "enrolled_grade_12"
        ? "Enrolled — Grade 12"
        : "Enrolled — Grade 11";

  // Filtered + grouped: Strand → Grade Level → students
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = students;
    if (strandFilter !== "all") {
      const want = strandFilter.toLowerCase();
      filtered = filtered.filter(
        (s) => (s.strand || "Unassigned").toLowerCase() === want,
      );
    }
    if (q) {
      filtered = filtered.filter((s) =>
        [s.fullName, s.email, s.schoolUsername || "", s.applicationId]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

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
  }, [students, search, strandFilter]);

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
      canMarkComplete: false,
      loading: false,
      error: null,
      autoReminder: null,
    });
    try {
      const detailParams = new URLSearchParams({ user_id: String(s.userId) });
      if (s.enrollmentId > 0) {
        detailParams.set("enrollment_id", String(s.enrollmentId));
      }
      if (apiSchoolYearParam) {
        detailParams.set("school_year", apiSchoolYearParam);
      }
      const res = await apiFetch(`/api/registrar/students?${detailParams.toString()}`);
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Could not load student details. Please try again.');
      }
      const fetched = json.student as Student;
      setDetail(fetched);
      if (json.features && typeof json.features.credentials === "boolean") {
        setFeatures({ credentials: json.features.credentials });
      }
      const status = (fetched.enrollmentStatus || "").toLowerCase();
      const enrollmentIdForPhysical = s.enrollmentId > 0 ? s.enrollmentId : fetched.enrollmentId;
      if (status === "approved" || status === "enrolled") {
        loadPhysicalDocs(enrollmentIdForPhysical, fetched.userId);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load student detail");
      setDetail(s); // fall back to summary row
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadPhysicalDocs(enrollmentId: number, userId?: number) {
    if (!enrollmentId) return;
    setPhysical((p) => ({ ...p, loading: true, error: null }));
    try {
      const res = await apiFetch(`/api/registrar/physical-docs?enrollment_id=${enrollmentId}`);
      const text = await res.text();
      let json: any = {};
      try { json = JSON.parse(text); } catch { /* keep empty */ }
      if (!res.ok || !json?.success) {
        // Humanise common backend error codes so the panel doesn't show
        // raw tokens like "schema_not_migrated".
        const code = (json?.error as string | undefined) || "";
        const friendly =
          code === "schema_not_migrated"
            ? (json?.message as string | undefined) ||
              "The physical-docs checklist hasn't been set up on this database yet. Please run the database migration or ask an admin to enable it."
            : code === "enrollment_not_approved"
              ? "This student's application hasn't been approved yet, so the physical-docs checklist isn't available."
              : code === "Enrollment not found"
                ? "Couldn't find this enrollment record."
                : code ||
                  (json?.message as string | undefined) ||
                  json?.error || 'Could not load checklist. Please try again.';
        throw new Error(friendly);
      }
      setPhysical({
        ...physicalDocsFromJson(json),
        loading: false,
        error: null,
      });
      const complete = Boolean(json.physicalDocsComplete ?? json.allRequiredChecked);
      if (complete) {
        setDetail((d) => (d ? { ...d, physicalDocsComplete: true } : d));
        if (userId) {
          setStudents((rows) =>
            rows.map((r) =>
              r.userId === userId && r.enrollmentId === enrollmentId
                ? { ...r, physicalDocsComplete: true }
                : r
            )
          );
        }
      }
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
    if (physical.physicalDocsComplete) return; // checklist locked once complete
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
        throw new Error(json?.error || 'Could not update status. Please try again.');
      }
      // Snap to authoritative server state.
      setPhysical((p) => ({
        ...p,
        ...physicalDocsFromJson(json, p),
      }));
      const complete = Boolean(json.physicalDocsComplete ?? json.allRequiredChecked);
      setDetail((d) => (d ? { ...d, physicalDocsComplete: complete } : d));
      setStudents((rows) =>
        rows.map((r) =>
          r.userId === detail.userId && r.enrollmentId === detail.enrollmentId
            ? { ...r, physicalDocsComplete: complete }
            : r
        )
      );
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

  async function markComplete() {
    if (!detail) return;
    if (!physical.canMarkComplete) return;
    if (markingComplete) return;

    setMarkingComplete(true);
    try {
      const res = await apiFetch("/api/registrar/physical-docs", {
        method: "POST",
        body: JSON.stringify({
          action: "mark_complete",
          enrollment_id: detail.enrollmentId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Could not mark as complete. Please try again.');
      }
      setPhysical((p) => ({
        ...p,
        ...physicalDocsFromJson(json, p),
      }));
      setDetail((d) => (d ? { ...d, physicalDocsComplete: true } : d));
      setStudents((rows) =>
        rows.map((r) =>
          r.userId === detail.userId && r.enrollmentId === detail.enrollmentId
            ? { ...r, physicalDocsComplete: true }
            : r
        )
      );
      toast.success(`Physical documents marked complete for ${displayName(detail)}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark complete");
    } finally {
      setMarkingComplete(false);
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
        // Refresh the auto-reminder bookkeeping so the panel shows the
        // bumped "last sent" / "next scheduled" values without a reload.
        if (json.autoReminder) {
          setPhysical((p) => ({
            ...p,
            autoReminder: {
              intervalDays: Number(json.autoReminder.intervalDays ?? 0),
              lastSentAt: json.autoReminder.lastSentAt ?? null,
              reminderCount: Number(json.autoReminder.reminderCount ?? 0),
              nextScheduledAt: json.autoReminder.nextScheduledAt ?? null,
            },
          }));
        }
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
   * Bulk-fire a reminder to every approved student who still has missing
   * physical documents. Bypasses the 3-day throttle so it always emails
   * everyone — used by the "Send reminders to all" header button.
   *
   * The confirmation step is handled by `bulkRemindOpen` + the centered
   * Dialog below; this function is invoked by the dialog's "Send to all"
   * button so it doesn't need to prompt itself.
   */
  async function bulkRemindAllMissing() {
    if (bulkRemindingAll) return;
    setBulkRemindingAll(true);
    try {
      const res = await apiFetch("/api/registrar/physical-docs", {
        method: "POST",
        body: JSON.stringify({ action: "auto_remind_sweep", force: true }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Could not send reminders. Please try again.');
      }
      const s = json.summary || {};
      const sent = Number(s.sent ?? 0);
      const eligible = Number(s.eligible ?? 0);
      const errors = Number(s.errors ?? 0);
      const skipped = Number(s.skipped ?? 0);

      if (eligible === 0) {
        toast.message("No approved students found to remind.");
      } else if (sent === 0 && errors === 0) {
        toast.message(
          `Checked ${eligible} student${eligible === 1 ? "" : "s"} — everyone already has every required document checked. Nothing to send.`
        );
      } else {
        const parts: string[] = [`${sent} reminder${sent === 1 ? "" : "s"} sent`];
        if (skipped > 0) parts.push(`${skipped} skipped (no missing docs)`);
        if (errors > 0) parts.push(`${errors} failed`);
        toast.success(parts.join(" · "));
      }

      // If the currently-open student got a fresh reminder, refresh their
      // panel so the auto-reminder card reflects the new "last sent"
      // timestamp.
      if (detail?.enrollmentId) {
        loadPhysicalDocs(detail.enrollmentId, detail.userId);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk reminder failed");
    } finally {
      setBulkRemindingAll(false);
      setBulkRemindOpen(false);
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
    // Keep `viewerObjectUrl` pointing at the prior blob (if any) until the
    // new bytes are ready. The `viewerLoading` flag hides the <img> branch
    // in the meantime, so the registrar sees a spinner — never an empty
    // src that some browsers cache as a permanent failure.

    try {
      const res = await apiFetch(`/api/document-file?id=${doc.id}`);
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(json?.error || 'Could not load document. Please try again.');
      }
      // Sniff the bytes once before deciding how to render them.
      const buf = await res.arrayBuffer();
      const kind = sniffDocKind(buf, doc.fileName, doc.mimeType);

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
          fr.onerror = () => reject(new Error("FileReader failed to read the document bytes"));
          fr.onload = () => {
            const result = fr.result;
            if (typeof result === "string" && result.startsWith("data:")) {
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
    setViewerLightboxOpen(false);
    setViewerLoading(false);
    setViewerError(null);
    setViewerKind("other");
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
        throw new Error(json?.error || 'Could not send message. Please try again.');
      }
      toast.success("Welcome reminder email sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send reminder email");
    } finally {
      setResending(false);
    }
  }

  async function openReassignDialog() {
    if (!detail) return;
    setReassignOpen(true);
    setReassignError(null);
    setReassignOptions([]);
    setReassignTarget(
      detail.currentSection && detail.currentShift
        ? { name: detail.currentSection, shift: detail.currentShift }
        : null,
    );
    setReassignForce(false);
    setReassignLoading(true);
    try {
      const res = await apiFetch(`/api/registrar/student-section?user_id=${detail.userId}`);
      const json = (await res.json()) as
        | { success: true; sections: ReassignSectionOption[]; student: { currentSection?: string | null; currentShift?: "morning" | "afternoon" | null } }
        | { success: false; error?: string };
      if (!res.ok || !json.success) {
        setReassignError(("error" in json && json.error) || 'Could not load sections. Please try again.');
        return;
      }
      setReassignOptions(Array.isArray(json.sections) ? json.sections : []);
      if (json.student?.currentSection && json.student?.currentShift) {
        setReassignTarget({ name: json.student.currentSection, shift: json.student.currentShift });
      }
    } catch (e) {
      setReassignError(e instanceof Error ? e.message : "Network error");
    } finally {
      setReassignLoading(false);
    }
  }

  async function submitReassign() {
    if (!detail || !reassignTarget) return;
    if (reassignSubmitting) return;
    setReassignSubmitting(true);
    try {
      const res = await apiFetch("/api/registrar/student-section", {
        method: "POST",
        body: JSON.stringify({
          user_id: detail.userId,
          section: reassignTarget.name,
          shift: reassignTarget.shift,
          force: reassignForce,
        }),
      });
      const json = (await res.json()) as
        | { success: true; student: { currentSection: string; currentShift: "morning" | "afternoon" } }
        | { success: false; error?: string; message?: string };
      if (!res.ok || !json.success) {
        // 409/no_seat → surface an override hint inline rather than as a hard error.
        if (res.status === 409 && "error" in json && json.error === "no_seat") {
          toast.error(json.message || "Target section is full. Tick \"Override capacity\" to force the move.");
          setReassignForce(true);
          return;
        }
        toast.error(("error" in json && (json.message || json.error)) || 'Could not reassign student. Please try again.');
        return;
      }
      toast.success(
        `Moved to section "${json.student.currentSection}" (${json.student.currentShift} shift).`,
      );
      // Reflect locally so the detail sheet updates without a refetch.
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              currentSection: json.student.currentSection,
              currentShift: json.student.currentShift,
            }
          : prev,
      );
      setReassignOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reassign");
    } finally {
      setReassignSubmitting(false);
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
                  : code === 'schema_not_migrated'
                    ? 'This feature is not available yet.'
                    : 'Could not issue credentials. Please try again.';
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
          <p className="text-sm text-gray-600">{cohortListSubtitle(listCohort)}</p>
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
          {/* Bulk reminder — opens a centered confirmation modal that, on
              confirm, emails every approved student with outstanding
              physical-document requirements. */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setBulkRemindOpen(true)}
            disabled={bulkRemindingAll || listCohort === "applicant"}
            className="whitespace-nowrap border-[#8B1538]/30 text-[#8B1538] hover:bg-[#8B1538]/5 hover:text-[#8B1538]"
            title="Email every approved student who still has missing physical documents"
          >
            {bulkRemindingAll ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send reminders to all
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="min-w-0">
            <label
              htmlFor="registrar-list-cohort"
              className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              Student list
            </label>
            <select
              id="registrar-list-cohort"
              value={listCohort}
              onChange={(e) =>
                setListCohort(
                  e.target.value as
                    | "applicant"
                    | "enrolled_grade_11"
                    | "enrolled_grade_12",
                )
              }
              className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
            >
              <option value="enrolled_grade_11">
                Enrolled — Grade 11 ({cohortCounts.enrolled_grade_11})
              </option>
              <option value="enrolled_grade_12">
                Enrolled — Grade 12 ({cohortCounts.enrolled_grade_12})
              </option>
              <option value="applicant">
                Applicants only ({cohortCounts.applicant})
              </option>
            </select>
          </div>
          <div className="min-w-0">
            <label
              htmlFor="registrar-enrollment-year"
              className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              Enrollment year
            </label>
            <select
              id="registrar-enrollment-year"
              value={enrollmentYearFilter}
              onChange={(e) => setEnrollmentYearFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
            >
              {enrollmentSchoolYearLabel && (
                <option value="current">
                  Active enrollment ({enrollmentSchoolYearLabel})
                </option>
              )}
              {!enrollmentSchoolYearLabel && (
                <option value="current">Active enrollment year</option>
              )}
              <option value="all">All enrollment years</option>
              {selectablePastYears.map((y) => (
                <option key={y} value={y}>
                  SY {y}
                  {endedSchoolYears.includes(y) ? " (ended)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label
              htmlFor="registrar-strand-filter"
              className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              Strand
            </label>
            <select
              id="registrar-strand-filter"
              value={strandFilter}
              onChange={(e) => setStrandFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
            >
              <option value="all">All strands</option>
              {strandSelectOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            {listCohortLabel} · {appliedEnrollmentYearLabel}
          </p>
          {hasActiveListFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-gray-600"
              onClick={() => {
                setStrandFilter("all");
              }}
            >
              Clear strand filter
            </Button>
          )}
        </div>
      </Card>

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
            {search
              ? "No matches for your search."
              : hasActiveListFilters
                ? "No students match the selected strand."
                : enrollmentYearFilter === "all"
                  ? "No approved or enrolled students on file."
                  : `No students for ${appliedEnrollmentYearLabel}. Try another enrollment year.`}
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
                                    <div className="col-span-6 md:col-span-3 flex flex-wrap gap-1.5">
                                      <Badge className={cohortStatusBadgeClass(s.status || "Pending")}>
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        {s.status || "Pending"}
                                      </Badge>
                                      {listCohort !== "applicant" && s.physicalDocsComplete ? (
                                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                                          <CheckCircle className="w-3 h-3 mr-1" />
                                          All physical docs submitted
                                        </Badge>
                                      ) : listCohort !== "applicant" && !s.physicalDocsComplete ? (
                                        <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                                          <ClipboardCheck className="w-3 h-3 mr-1" />
                                          Physical docs pending
                                        </Badge>
                                      ) : null}
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

      <Dialog
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
              canMarkComplete: false,
              loading: false,
              error: null,
              autoReminder: null,
            });
          }
        }}
      >
        <DialogContent
          className="!max-w-6xl !w-[95vw] !max-h-[92vh] flex flex-col !p-0 !gap-0 bg-gray-50 mx-auto"
        >
          <DialogHeader className="px-6 pt-6 pb-3 bg-white border-b border-gray-200 shrink-0">
            <DialogTitle className="text-center text-lg tracking-wide uppercase">
              {detail ? displayName(detail) : "Student detail"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {detail ? `${detail.applicationId} · ${detail.strand} · Grade ${detail.gradeLevel}` : ""}
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex-1 p-10 text-center text-gray-600 overflow-y-auto">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
              Loading…
            </div>
          ) : (
            <div className="flex-1 px-6 pt-5 pb-6 space-y-5 overflow-y-auto">
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

              {/* Class section + shift */}
              <Section title="Section & class shift">
                <KV
                  label="Current section"
                  value={
                    detail.currentSection
                      ? `${detail.strand} – ${detail.currentSection}`
                      : "Unassigned"
                  }
                />
                <KVNode label="Current shift">
                  {detail.currentShift === "afternoon" ? (
                    <Badge variant="outline" className="border-indigo-300 bg-indigo-50 text-indigo-800">
                      <Moon className="h-3 w-3 mr-1" />
                      Afternoon
                    </Badge>
                  ) : detail.currentShift === "morning" ? (
                    <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-800">
                      <Sun className="h-3 w-3 mr-1" />
                      Morning
                    </Badge>
                  ) : (
                    <span className="text-gray-400 italic">Not set</span>
                  )}
                </KVNode>
                <KV
                  label="Requested shift"
                  value={
                    detail.preferredShift
                      ? `${detail.preferredShift.charAt(0).toUpperCase()}${detail.preferredShift.slice(1)} (from enrollment form)`
                      : null
                  }
                />
                <SectionBody className="bg-gray-50/60">
                  {detail.preferredShift && detail.currentShift && detail.preferredShift !== detail.currentShift ? (
                    <p className="text-xs text-amber-800 mb-3 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>
                        Student requested the <span className="font-semibold">{detail.preferredShift}</span> shift but is
                        currently placed in the <span className="font-semibold">{detail.currentShift}</span> shift.
                      </span>
                    </p>
                  ) : null}
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={openReassignDialog}
                    >
                      <Layers className="w-4 h-4 mr-2" />
                      Reassign section / shift
                    </Button>
                  </div>
                </SectionBody>
              </Section>

              {/* Credentials */}
              <Section title="Credentials & access">
                {!features.credentials ? (
                  <SectionBody>
                    <p className="text-sm text-gray-600 italic text-center">
                      Credentials feature not yet enabled in this environment.
                    </p>
                  </SectionBody>
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
                    <SectionBody className="bg-gray-50/60">
                      <div className="flex justify-center">
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
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Re-sends the school username and a reminder of the temporary password format
                        (date of birth, mm-dd-yyyy). Does not reset the password.
                      </p>
                    </SectionBody>
                  </>
                ) : (
                  <SectionBody className="space-y-3">
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
                    <div className="flex justify-center pt-1">
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
                    </div>
                    {!detail.email && (
                      <p className="text-xs text-amber-700 text-center">
                        A personal email is required before credentials can be issued.
                      </p>
                    )}
                  </SectionBody>
                )}
              </Section>

              {/* Documents */}
              <Section title="Submitted documents">
                <SectionBody>
                {!detail.documents || detail.documents.length === 0 ? (
                  <p className="text-sm text-gray-500 italic text-center py-2">No documents on file.</p>
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
                            {(() => {
                              // Combine the AI verdict and the registrar's
                              // manual review into a single pill so the
                              // status reads cleanly:
                              //   • Registrar reviewed → Verified (green)
                              //     — the registrar's word is final, so a
                              //     reviewed document is accepted whether
                              //     or not AI confirmed it. We also add a
                              //     small CheckCircle to indicate it's a
                              //     manual approval, and (when AI flagged
                              //     it) keep that context as a tooltip so
                              //     the registrar can still see the AI
                              //     warning on hover.
                              //   • Otherwise → fall back to AI verdict
                              //     (Verified / Flagged / Under Review).
                              const reviewed = doc.registrarReviewed;
                              const cls = reviewed || doc.aiStatus === "Verified"
                                ? "bg-green-600 text-white"
                                : doc.aiStatus === "Flagged"
                                  ? "bg-red-600 text-white"
                                  : "bg-yellow-600 text-white";
                              const label = reviewed
                                ? "Verified"
                                : doc.aiStatus;
                              const title = reviewed && doc.aiStatus === "Flagged"
                                ? "Verified by registrar (AI flagged this document)"
                                : reviewed
                                  ? "Verified by registrar"
                                  : `AI status: ${doc.aiStatus}`;
                              return (
                                <Badge className={cls} title={title}>
                                  {reviewed ? <CheckCircle className="w-3 h-3 mr-1" /> : null}
                                  {label}
                                </Badge>
                              );
                            })()}
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
                </SectionBody>
              </Section>

              {/* Physical document checklist (approved students only). The
                  checklist is locked once the registrar marks the student
                  as enrolled — flipping the boolean back is intentionally
                  not exposed here to keep the workflow one-way under
                  normal use. */}
              <Section title="Physical document checklist">
                {physical.loading ? (
                  <SectionBody>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600 py-6">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading checklist…
                    </div>
                  </SectionBody>
                ) : physical.error ? (
                  <SectionBody>
                    <Alert variant="destructive">
                      <AlertDescription>{physical.error}</AlertDescription>
                    </Alert>
                  </SectionBody>
                ) : physical.items.length === 0 ? (
                  <SectionBody>
                    <p className="text-sm text-gray-500 italic text-center py-4">
                      No checklist items configured for this enrollment.
                    </p>
                  </SectionBody>
                ) : (
                  (() => {
                    const requiredItems = physical.items.filter((i) => i.required);
                    const receivedCount = requiredItems.filter((i) => i.received).length;
                    const totalRequired = requiredItems.length;
                    const progressPct =
                      totalRequired > 0
                        ? Math.round((receivedCount / totalRequired) * 100)
                        : 0;
                    const physicalComplete = physical.physicalDocsComplete || physical.allRequiredChecked;
                    return (
                      <SectionBody>
                        {/* Progress summary card */}
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4 text-center">
                          <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                            Physical documents received
                          </p>
                          <p className="text-2xl font-bold text-gray-900 mt-1">
                            {receivedCount}
                            <span className="text-gray-400 text-lg font-medium"> / {totalRequired}</span>
                            <span className="ml-2 text-sm font-medium text-gray-500">({progressPct}%)</span>
                          </p>
                          <div className="mt-3 h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                physicalComplete
                                  ? "bg-emerald-500"
                                  : receivedCount > 0
                                    ? "bg-[#8B1538]"
                                    : "bg-gray-300"
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-600 mt-3">
                            {physicalComplete
                              ? "All required physical documents have been submitted and recorded."
                              : "Tick each row as the student hands over the physical copy. The checklist completes automatically once every required document is received."}
                          </p>
                        </div>

                        {/* Auto-reminder status card. Tells the registrar that
                            the system is already nudging the student via email
                            on a fixed cadence, so they don't have to remember
                            to do it manually. */}
                        {!physicalComplete && physical.autoReminder ? (
                          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 mb-4">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 shrink-0 rounded-full bg-blue-100 p-1.5">
                                <Send className="w-4 h-4 text-blue-700" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-blue-900">
                                  Automatic email reminders are on
                                </p>
                                <p className="text-xs text-blue-800/90 mt-0.5">
                                  The system emails this student every{" "}
                                  {physical.autoReminder.intervalDays} day
                                  {physical.autoReminder.intervalDays === 1 ? "" : "s"} until every
                                  required physical document is received.
                                </p>
                                <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                  <div>
                                    <dt className="text-blue-700/80 uppercase tracking-wide font-medium">
                                      Reminders sent
                                    </dt>
                                    <dd className="text-blue-900 font-semibold mt-0.5">
                                      {physical.autoReminder.reminderCount}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-blue-700/80 uppercase tracking-wide font-medium">
                                      Last reminder
                                    </dt>
                                    <dd className="text-blue-900 font-semibold mt-0.5">
                                      {physical.autoReminder.lastSentAt
                                        ? formatDateTime(physical.autoReminder.lastSentAt)
                                        : "Not yet sent"}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-blue-700/80 uppercase tracking-wide font-medium">
                                      Next auto-reminder
                                    </dt>
                                    <dd className="text-blue-900 font-semibold mt-0.5">
                                      {physical.autoReminder.nextScheduledAt
                                        ? formatDateTime(physical.autoReminder.nextScheduledAt)
                                        : "On next page load"}
                                    </dd>
                                  </div>
                                </dl>
                                {!detail.email ? (
                                  <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                    No personal email on file — auto-reminders cannot be delivered until one is added.
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* Records-style checklist table */}
                        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50 hover:bg-gray-50">
                                <TableHead className="w-12 text-center text-gray-600 font-semibold">
                                  #
                                </TableHead>
                                <TableHead className="text-gray-600 font-semibold">
                                  Document
                                </TableHead>
                                <TableHead className="w-32 text-center text-gray-600 font-semibold">
                                  Status
                                </TableHead>
                                <TableHead className="w-40 text-gray-600 font-semibold whitespace-nowrap">
                                  Date received
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {physical.items.map((item, idx) => {
                                const submitting = physicalSubmittingKey === item.key;
                                const locked = physicalComplete || submitting;
                                return (
                                  <TableRow
                                    key={item.key}
                                    className={`cursor-pointer transition-colors ${
                                      item.received
                                        ? "bg-emerald-50/60 hover:bg-emerald-50"
                                        : "bg-white hover:bg-gray-50"
                                    } ${locked ? "cursor-not-allowed" : ""}`}
                                    onClick={() => !locked && togglePhysicalDoc(item)}
                                  >
                                    <TableCell className="text-center text-sm text-gray-500 font-medium">
                                      {idx + 1}
                                    </TableCell>
                                    <TableCell className="py-3">
                                      <div className="flex items-start gap-2">
                                        <input
                                          type="checkbox"
                                          checked={item.received}
                                          disabled={locked}
                                          onChange={() => togglePhysicalDoc(item)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#8B1538] focus:ring-[#8B1538] shrink-0"
                                          aria-label={item.label}
                                        />
                                        <div className="min-w-0">
                                          <p
                                            className={`text-sm font-medium ${
                                              item.received ? "text-emerald-900" : "text-gray-900"
                                            }`}
                                          >
                                            {item.label}
                                          </p>
                                          <div className="flex items-center gap-1.5 mt-0.5">
                                            {!item.required ? (
                                              <span className="text-xs text-gray-500">Optional</span>
                                            ) : (
                                              <span className="text-xs text-gray-500">Required</span>
                                            )}
                                            {item.transfereeOnly ? (
                                              <span className="text-xs text-amber-700">
                                                · Transferees only
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {submitting ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-gray-400 inline" />
                                      ) : item.received ? (
                                        <Badge className="bg-emerald-600 text-white">
                                          <CheckCircle className="w-3 h-3 mr-1" />
                                          Received
                                        </Badge>
                                      ) : (
                                        <Badge
                                          variant="outline"
                                          className="border-gray-300 text-gray-600 bg-white"
                                        >
                                          <Circle className="w-3 h-3 mr-1" />
                                          Pending
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                                      {item.received && item.receivedAt
                                        ? formatDateTime(item.receivedAt)
                                        : "—"}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Centered action footer */}
                        <div className="mt-5 flex flex-col items-center gap-2">
                          {physicalComplete ? (
                            <Badge className="bg-emerald-600 text-white px-3 py-1.5 text-sm">
                              <CheckCircle className="w-4 h-4 mr-1.5" />
                              Physical documents complete
                            </Badge>
                          ) : physical.canMarkComplete ? (
                            <Button
                              type="button"
                              onClick={markComplete}
                              disabled={markingComplete}
                              className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white px-6"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              {markingComplete ? "Saving…" : "Mark complete"}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={sendPhysicalReminder}
                            disabled={
                              sendingReminder ||
                              physicalComplete ||
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
                            {sendingReminder ? "Sending…" : "Send reminder now"}
                          </Button>
                        </div>
                      </SectionBody>
                    );
                  })()
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
        </DialogContent>
      </Dialog>

      {/* Reassign section + shift dialog */}
      <Dialog
        open={reassignOpen}
        onOpenChange={(open) => {
          if (!open && !reassignSubmitting) setReassignOpen(false);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reassign section &amp; shift</DialogTitle>
            <DialogDescription>
              Move {detail ? displayName(detail) : "this student"} to a different section in{" "}
              <span className="font-medium">{detail?.strand || "their strand"}</span>. Sections
              with no remaining seat for their gender are disabled — tick{" "}
              <span className="font-mono">Override capacity</span> below if you need to force the
              move.
            </DialogDescription>
          </DialogHeader>

          {reassignLoading ? (
            <div className="flex items-center gap-2 text-gray-600 py-6 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading available sections…
            </div>
          ) : reassignError ? (
            <Alert className="border-red-300 bg-red-50">
              <AlertCircle className="w-4 h-4 text-red-700" />
              <AlertDescription className="text-red-900">{reassignError}</AlertDescription>
            </Alert>
          ) : reassignOptions.length === 0 ? (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <AlertDescription className="text-amber-900">
                No sections exist yet for {detail?.strand || "this strand"}. Create one on the
                Sections page first.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
              {(["morning", "afternoon"] as const).map((shift) => {
                const list = reassignOptions.filter((s) => s.shift === shift);
                if (list.length === 0) {
                  return (
                    <div key={shift}>
                      <div className="flex items-center gap-2 mb-2">
                        {shift === "morning" ? (
                          <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-800">
                            <Sun className="w-3 h-3 mr-1" />
                            Morning
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-indigo-300 bg-indigo-50 text-indigo-800">
                            <Moon className="w-3 h-3 mr-1" />
                            Afternoon
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 italic">
                        No {shift} sections yet.
                      </p>
                    </div>
                  );
                }
                return (
                  <div key={shift}>
                    <div className="flex items-center gap-2 mb-2">
                      {shift === "morning" ? (
                        <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-800">
                          <Sun className="w-3 h-3 mr-1" />
                          Morning
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-indigo-300 bg-indigo-50 text-indigo-800">
                          <Moon className="w-3 h-3 mr-1" />
                          Afternoon
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">
                        {list.length} section{list.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {list.map((opt) => {
                        const isSelected =
                          reassignTarget?.name === opt.name && reassignTarget?.shift === opt.shift;
                        const disabled = !opt.hasSeatForGender && !opt.isCurrent && !reassignForce;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => setReassignTarget({ name: opt.name, shift: opt.shift })}
                            className={`w-full text-left rounded-md border p-3 transition-colors ${
                              isSelected
                                ? "border-[#8B1538] bg-[#8B1538]/5"
                                : disabled
                                  ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                                  : "border-gray-200 hover:border-[#8B1538]/40"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                  {opt.strand} – {opt.name}
                                  {opt.isCurrent ? (
                                    <span className="ml-2 text-xs text-gray-500 font-normal">
                                      (current)
                                    </span>
                                  ) : null}
                                </p>
                                <p className="text-xs text-gray-600">
                                  Boys {opt.enrolledBoys}/{opt.maxBoys} · Girls{" "}
                                  {opt.enrolledGirls}/{opt.maxGirls} · Total {opt.enrolledTotal}/
                                  {opt.capacity}
                                </p>
                              </div>
                              {!opt.hasSeatForGender ? (
                                <Badge variant="outline" className="border-red-300 bg-red-50 text-red-800 shrink-0">
                                  Full
                                </Badge>
                              ) : opt.enrolledTotal >= opt.capacity ? (
                                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 shrink-0">
                                  Tight
                                </Badge>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!reassignLoading && reassignOptions.length > 0 ? (
            <label className="flex items-start gap-2 text-xs text-gray-700 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 accent-[#8B1538]"
                checked={reassignForce}
                onChange={(e) => setReassignForce(e.target.checked)}
              />
              <span>
                <span className="font-semibold">Override capacity</span> — allow the move even when
                the target section has no remaining seat for this student's gender. Use sparingly.
              </span>
            </label>
          ) : null}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setReassignOpen(false)}
              disabled={reassignSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitReassign}
              disabled={
                reassignSubmitting ||
                !reassignTarget ||
                (detail?.currentSection === reassignTarget?.name &&
                  detail?.currentShift === reassignTarget?.shift)
              }
              className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
            >
              {reassignSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 mr-2" />
                  Save placement
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
        <DialogContent
          className={`!max-w-6xl !w-[95vw] !max-h-[92vh] flex flex-col !p-0 !gap-0 sm:!max-w-6xl${
            viewerLightboxOpen
              ? " [&>button.absolute]:pointer-events-none [&>button.absolute]:invisible"
              : ""
          }`}
          onInteractOutside={(e) => {
            if (viewerLightboxOpen) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (viewerLightboxOpen) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (viewerLightboxOpen) e.preventDefault();
          }}
        >
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

          <div className="flex-1 min-h-0 p-4 bg-gray-50">
            <SecureDocumentPreview
              url={viewerObjectUrl}
              kind={viewerKind}
              alt={viewerDoc?.fileName || "Document preview"}
              loading={viewerLoading}
              error={viewerError}
              onLightboxOpenChange={setViewerLightboxOpen}
              fitHeightClass="h-[min(480px,65vh)]"
              unavailableFallback={
                <p className="text-center text-sm text-gray-600">
                  Preview is not available for this file type. Use the registrar review screen
                  to download the file.
                </p>
              }
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Centered confirmation modal for the bulk "Send reminders to all"
          action. Replaces the previous browser-native window.confirm so
          the experience matches the rest of the registrar UI. */}
      <Dialog
        open={bulkRemindOpen}
        onOpenChange={(open) => {
          // Don't allow closing the dialog while the request is in
          // flight — the action is non-cancellable once it hits the
          // backend and we want the user to see the result toast first.
          if (!bulkRemindingAll) setBulkRemindOpen(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#8B1538]/10">
              <Send className="w-6 h-6 text-[#8B1538]" />
            </div>
            <DialogTitle className="text-center text-lg">
              Send reminders to all approved students?
            </DialogTitle>
            <DialogDescription className="text-center text-gray-600">
              Every approved student who still has unchecked physical-document
              requirements will receive a reminder email right now.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">Heads up</p>
            <p className="text-xs mt-1 text-amber-800/90">
              This bypasses the 3-day auto-reminder window, so students who were
              emailed in the last few days will be emailed again.
            </p>
          </div>

          <div className="mt-2 flex flex-col-reverse sm:flex-row sm:justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkRemindOpen(false)}
              disabled={bulkRemindingAll}
              className="sm:min-w-[120px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={bulkRemindAllMissing}
              disabled={bulkRemindingAll}
              className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white sm:min-w-[180px]"
            >
              {bulkRemindingAll ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send to all
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Records-style panel used throughout the registrar's student detail
 * sheet. Renders as a centered card with a colored title bar on top and
 * a white body with subtle dividers between rows — mirrors the way a
 * physical student record sheet is laid out so the registrar reads it
 * the same way they'd read a folder.
 *
 * Children that are <KV /> rows get hairline dividers between them
 * automatically (the wrapping <dl /> uses `divide-y`). Sections that
 * embed richer content (badges, tables, action buttons) still drop in
 * without extra wrappers.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-[#8B1538] to-[#8B1538]/85 px-4 py-2.5 border-b border-[#8B1538]/40">
        <h3 className="text-xs font-semibold text-white uppercase tracking-[0.08em] text-center">
          {title}
        </h3>
      </div>
      <dl className="divide-y divide-gray-100">{children}</dl>
    </div>
  );
}

/**
 * One label/value row inside a <Section />. Renders as a description-list
 * row with the label in the left third and the value in the right two
 * thirds. Hovering the row gives a subtle highlight so the registrar can
 * track which field they're reading.
 */
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
  const isEmpty = display === "—";
  return (
    <div className="grid grid-cols-1 gap-1 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 sm:grid-cols-3 sm:gap-3">
      <dt className="font-medium text-gray-600 sm:col-span-1">{label}</dt>
      <dd
        className={
          "sm:col-span-2 " +
          (isEmpty ? "text-gray-400 italic " : "text-gray-900 ") +
          (mono ? "font-mono " : "") +
          (multiline ? "whitespace-pre-wrap break-words" : "break-words sm:truncate")
        }
        title={multiline ? undefined : display}
      >
        {display}
      </dd>
    </div>
  );
}

/**
 * Same row layout as <KV /> but accepts a ReactNode value, used for rows
 * whose value contains a badge or other rich content (e.g. the "Current
 * shift" row in the Section & class shift panel).
 */
function KVNode({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 sm:grid-cols-3 sm:gap-3">
      <dt className="font-medium text-gray-600 sm:col-span-1">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-2 text-gray-900 sm:col-span-2">
        {children}
      </dd>
    </div>
  );
}

/**
 * Free-form padded body for sections that aren't pure KV rows (action
 * footers, helper notes, embedded tables / lists). Keeps consistent
 * 16px horizontal padding with KV rows so the visual rhythm stays even.
 */
function SectionBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-4 py-3 ${className}`}>{children}</div>;
}
