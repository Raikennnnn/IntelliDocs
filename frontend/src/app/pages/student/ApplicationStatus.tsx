import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  MessageSquare,
  Loader2,
  ClipboardList,
  Circle,
  MapPin,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { useStudentPortal } from "../../hooks/useStudentPortal";
import { cn } from "../../components/ui/utils";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

/**
 * Application-level label. Once the registrar approves the enrollment form
 * the student is enrolled (legacy DB rows may still say `approved`).
 */
function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function applicationDisplayId(application: { id: string; display_id?: string }): string {
  if (application.display_id) return application.display_id;
  if (!application.id) return "—";
  return `APP-${new Date().getFullYear()}-${application.id.padStart(3, "0")}`;
}

function applicationStatusLabel(status: string, statusCode: string): string {
  const code = statusCode.toLowerCase();
  if (code === "approved" || code === "enrolled") return "Enrolled";
  const s = status.toLowerCase().trim();
  if (s.includes("enrolled") || s === "approved") return "Enrolled";
  return status;
}

function StatusPill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        className
      )}
    >
      {children}
    </span>
  );
}

/** One row of the student-facing physical-document checklist. Mirrors the
 *  GET /api/student/physical-docs response shape. */
type StudentPhysicalDocItem = {
  key: string;
  label: string;
  required: boolean;
  transfereeOnly: boolean;
  received: boolean;
  receivedAt: string | null;
};

type StudentPhysicalDocsState = {
  loading: boolean;
  error: string | null;
  enrollmentStatus: string | null;
  totalRequired: number;
  receivedCount: number;
  missingCount: number;
  items: StudentPhysicalDocItem[];
};

export function ApplicationStatus() {
  const { data, loading, error, refetch } = useStudentPortal();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // Student-facing physical document checklist. Lazy-fetched once the
  // status page mounts so an approved student immediately sees what they
  // still need to hand in at the registrar's office.
  const [physical, setPhysical] = useState<StudentPhysicalDocsState>({
    loading: true,
    error: null,
    enrollmentStatus: null,
    totalRequired: 0,
    receivedCount: 0,
    missingCount: 0,
    items: [],
  });

  useEffect(() => {
    let cancelled = false;
    const loadPhysicalDocs = async () => {
      setPhysical((p) => ({ ...p, loading: true, error: null }));
      try {
        const res = await apiFetch("/api/student/physical-docs");
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Could not load checklist. Please try again.');
        }
        setPhysical({
          loading: false,
          error: null,
          enrollmentStatus: json.enrollmentStatus ?? null,
          totalRequired: Number(json.totalRequired ?? 0),
          receivedCount: Number(json.receivedCount ?? 0),
          missingCount: Number(json.missingCount ?? 0),
          items: Array.isArray(json.items) ? (json.items as StudentPhysicalDocItem[]) : [],
        });
      } catch (e) {
        if (cancelled) return;
        setPhysical((p) => ({
          ...p,
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load checklist",
        }));
      }
    };

    const statusCode = String(data?.application?.status_code || "").toLowerCase();
    const statusText = String(data?.application?.status || "").toLowerCase().trim();
    const approvedForPhysical =
      statusCode === "approved" ||
      statusCode === "enrolled" ||
      statusText === "approved" ||
      statusText.includes("enrolled");

    if (!data || !approvedForPhysical) {
      setPhysical({
        loading: false,
        error: null,
        enrollmentStatus: null,
        totalRequired: 0,
        receivedCount: 0,
        missingCount: 0,
        items: [],
      });
      return () => {
        cancelled = true;
      };
    }

    loadPhysicalDocs();
    return () => {
      cancelled = true;
    };
  }, [data?.application?.status_code, data?.application?.id, data?.application?.status]);

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("enrolled") || s === "approved" || s.includes("verified"))
      return "bg-green-600 text-white border-transparent";
    if (s.includes("under review") || (s.includes("review") && !s.includes("pending")))
      return "bg-blue-600 text-white border-transparent";
    if (s.includes("pending")) return "bg-amber-500 text-white border-transparent";
    if (s.includes("reject")) return "bg-red-600 text-white border-transparent";
    return "bg-gray-600 text-white border-transparent";
  };

  const getStatusIcon = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("enrolled") || s === "approved" || s.includes("verified"))
      return <CheckCircle className="w-5 h-5 text-green-700 shrink-0" />;
    if (s.includes("under review") || (s.includes("review") && !s.includes("pending")))
      return <Clock className="w-5 h-5 text-blue-700 shrink-0" />;
    if (s.includes("pending")) return <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />;
    if (s.includes("reject")) return <XCircle className="w-5 h-5 text-red-700 shrink-0" />;
    return <Clock className="w-5 h-5 text-gray-600 shrink-0" />;
  };

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-gray-600 py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
        Loading application status…
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || "Could not load application data."}</AlertDescription>
      </Alert>
    );
  }

  const application = data.application;
  const statusCode = String(application.status_code || "").toLowerCase();
  const statusText = String(application.status || "").toLowerCase().trim();
  // `approved` covers both states where the registrar has greenlit the
  // application — whether physical docs are pending or already received.
  // Used for layout flags like "show the green banner / show the
  // physical-docs checklist".
  const approved =
    statusCode === "approved" || statusCode === "enrolled" || statusText === "approved" || statusText.includes("enrolled");
  const physicalDocsComplete =
    !physical.loading && physical.totalRequired > 0 && physical.missingCount === 0;

  const appLabel = applicationStatusLabel(application.status, application.status_code || "");
  const payMode = String(application.mode_of_payment || "").toLowerCase();
  const showVoucherHint = approved && payMode && payMode !== "cash";
  const isCancelled = statusCode === "cancelled";
  const canCancelApplication =
    !approved &&
    !isCancelled &&
    (statusCode === "draft" ||
      statusCode === "pending" ||
      statusCode === "rejected" ||
      statusText.includes("under review") ||
      statusText.includes("pending"));

  const handleCancelApplication = async () => {
    setCancelling(true);
    try {
      const res = await apiFetch("/api/student/enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_application" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Could not cancel application");
      }
      toast.success(json.message || "Application cancelled");
      setCancelOpen(false);
      await refetch();
      navigate("/student/enrollment");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel application");
    } finally {
      setCancelling(false);
    }
  };
  const overviewHighlightClass = approved
    ? "bg-green-50 border border-green-200"
    : "bg-blue-50 border border-blue-200";
  const overviewTitleClass = approved ? "text-green-900" : "text-blue-900";
  const overviewSubClass = approved ? "text-green-800" : "text-blue-700";

  /**
   * Decide what pill to show for one document row.
   * Priority (highest first):
   *  1. Explicit rejection / tamper from the AI keeps its raw label so the
   *     student sees exactly what went wrong.
   *  2. If the whole application is approved, every non-rejected document is
   *     shown as "Verified".
   *  3. If the registrar has manually marked this specific document as
   *     reviewed, show "Reviewed" — even when the AI status is still
   *     "pending". This is the fix for the "stuck on Pending" case after the
   *     registrar has gone through the document in the Documents tab.
   *  4. Otherwise fall back to the raw AI status.
   */
  const documentRow = (
    rawStatus: string,
    registrarReviewed?: boolean,
    carriedForward?: boolean
  ) => {
    const t = rawStatus.toLowerCase();
    if (t.includes("reject") || t.includes("tamper")) {
      return { label: rawStatus, pillClass: getStatusColor(rawStatus) };
    }
    if (approved) {
      return { label: "Verified", pillClass: getStatusColor("verified") };
    }
    if (registrarReviewed) {
      return {
        label: "Reviewed",
        pillClass: getStatusColor("verified"),
      };
    }
    if (
      t.includes("verify") ||
      t === "approved" ||
      t === "pass"
    ) {
      return {
        label: "Verified",
        pillClass: getStatusColor("verified"),
      };
    }
    if (carriedForward) {
      return {
        label: "On file from last year",
        pillClass: "bg-slate-100 text-slate-800 border-slate-300",
      };
    }
    return { label: rawStatus, pillClass: getStatusColor(rawStatus) };
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Application Status</h2>
        <p className="text-gray-600">Track your enrollment application progress</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application Overview</CardTitle>
          <CardDescription>Application ID: {applicationDisplayId(application)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`flex items-center justify-between p-4 rounded-lg ${overviewHighlightClass}`}>
            <div className="flex items-center gap-3 min-w-0">
              {getStatusIcon(appLabel)}
              <div className="min-w-0">
                <p className={`font-semibold ${overviewTitleClass}`}>{appLabel}</p>
                {/* "Approved" means the digital application is cleared but the
                    registrar still needs the original physical documents.
                    Calling that out here removes the ambiguity between an
                    approved-and-waiting student and a truly-enrolled one. */}
                {approved && !physicalDocsComplete && physical.missingCount > 0 ? (
                  <p className={`text-sm ${overviewSubClass}`}>
                    Your application is approved. Bring the original copies of your documents to the
                    registrar&apos;s office to complete your physical-document checklist.
                  </p>
                ) : approved && physicalDocsComplete ? (
                  <p className={`text-sm ${overviewSubClass}`}>
                    All required physical documents are on file with the registrar.
                  </p>
                ) : null}
                <p className={`text-sm ${overviewSubClass}`}>Last updated: {formatDateTime(application.lastUpdated)}</p>
              </div>
            </div>
            <StatusPill className={getStatusColor(appLabel)}>{appLabel}</StatusPill>
          </div>

          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-gray-600">Submitted Date</p>
              <p className="font-medium">{formatDateTime(application.submittedDate)}</p>
            </div>
            <div>
              <p className="text-gray-600">Last Updated</p>
              <p className="font-medium">{formatDateTime(application.lastUpdated)}</p>
            </div>
          </div>

          {isCancelled ? (
            <Alert>
              <AlertDescription>
                This application was cancelled. You may start a new enrollment application from the Enrollment page.
              </AlertDescription>
            </Alert>
          ) : null}

          {canCancelApplication ? (
            <div className="pt-2 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                className="text-red-700 border-red-200 hover:bg-red-50"
                onClick={() => setCancelOpen(true)}
              >
                Cancel application
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel enrollment application?</DialogTitle>
            <DialogDescription>
              This will withdraw your current application from registrar review. You can submit a new application later.
              Uploaded documents remain on file until you start fresh.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>
              Keep application
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancelApplication}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Yes, cancel application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showVoucherHint ? (
        <Alert className="border-[#8B1538]/30 bg-[#8B1538]/5">
          <AlertDescription className="text-gray-800">
            Your enrollment is complete. If you use a voucher (QVR, ESC, QVA, or ALS), enter your{" "}
            <strong>voucher number</strong> under <strong>Dashboard</strong> → Voucher number.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Document Verification Status</CardTitle>
          <CardDescription>
            Individual status of your submitted documents
            {approved ? " — your enrollment is on file." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(() => {
            const docs = Array.isArray(application.documents) ? application.documents : [];
            if (!docs.length) return null;
            // Once the registrar approves the application, individual document
            // rejections / resubmission notes are closed — the student should
            // not be asked to re-upload digital copies anymore.
            if (approved) return null;
            const needsResubmit = (d: any) => {
              const decision = String(d?.registrarDecision || d?.registrarDocDecision || "").toLowerCase();
              return decision === "reject" || decision === "rejected";
            };
            const rejected = docs.filter(needsResubmit);
            if (rejected.length === 0) return null;
            const allRejected = rejected.length === docs.length;
            return (
              <Alert
                className={cn(
                  "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                  allRejected ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50",
                )}
              >
                <AlertDescription className={allRejected ? "text-red-900" : "text-amber-900"}>
                  {allRejected ? (
                    <>
                      <strong>Rejected (documents)</strong> — all uploaded requirements were rejected. Please re-upload
                      the rejected documents to continue.
                    </>
                  ) : (
                    <>
                      <strong>Under review (needs resubmission)</strong> — {rejected.length}{" "}
                      document{rejected.length === 1 ? "" : "s"} need to be re-uploaded.
                    </>
                  )}
                </AlertDescription>
                <Link to="/student/enrollment?resubmit=1&step=4" className="shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    className={
                      allRejected
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-[#8B1538] text-white hover:bg-[#8B1538]/90"
                    }
                  >
                    Resubmit documents
                  </Button>
                </Link>
              </Alert>
            );
          })()}
          {application.documents.length === 0 ? (
            <p className="text-sm text-gray-600 py-4 text-center">
              No documents on file yet. Complete enrollment to upload requirements.
            </p>
          ) : (
            application.documents.map((doc, index) => {
              const row = documentRow(doc.status, doc.registrarReviewed, doc.carriedForward);
              const status = String(doc.status || "").toLowerCase();
              const remarks = String(doc.remarks || "").trim();
              // A document explicitly rejected by the registrar always wins,
              // even when AI status is still "verified" / "approved".
              // Exception: once the application is approved (or enrolled),
              // stale per-document rejection flags must not surface — the
              // registrar has already accepted the application as a whole.
              const decision = String(doc.registrarDecision || "").toLowerCase();
              const rejectionDetected =
                decision === "reject" ||
                decision === "rejected" ||
                status.includes("reject");
              const isRejectedDoc = !approved && rejectionDetected;
              return (
                <div
                  key={`${doc.name}-${index}`}
                  className={cn(
                    "p-4 border rounded-lg transition-colors",
                    isRejectedDoc ? "border-red-300 bg-red-50/40" : "hover:border-[#8B1538]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <FileText className="w-5 h-5 text-gray-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        {/* Primary line: the requirement label (e.g. "PSA Birth Certificate")
                            so the student instantly knows what this row is for. The actual
                            uploaded filename becomes a small subtitle below. */}
                        {(() => {
                          const label = (doc.requirementLabel ?? "").trim();
                          const fileName = (doc.name ?? "").trim();
                          const heading = label || fileName || "Document";
                          const showFileName = fileName && fileName !== heading;
                          return (
                            <>
                              <p className="font-medium text-gray-900">{heading}</p>
                              {showFileName ? (
                                <p className="text-xs text-gray-500 truncate" title={fileName}>
                                  File: {fileName}
                                </p>
                              ) : null}
                            </>
                          );
                        })()}
                        {/* Only surface the registrar's "please resubmit" note
                            while the application is still under review. After
                            approval the note refers to a closed workflow. */}
                        {remarks && !approved ? (
                          <p className="text-sm text-red-700 mt-1">
                            <strong>Registrar's note:</strong> {remarks}
                          </p>
                        ) : null}
                        {isRejectedDoc ? (
                          <div className="mt-2">
                            <Link to="/student/enrollment?resubmit=1&step=4">
                              <Button type="button" size="sm" className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white">
                                Resubmit this document
                              </Button>
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {isRejectedDoc ? (
                      <StatusPill className="shrink-0 bg-red-600 text-white border-transparent">
                        Resubmission required
                      </StatusPill>
                    ) : approved ? (
                      // Once approved, every document is shown as verified —
                      // the registrar accepted the application even if some
                      // uploads had earlier AI flags or resubmission notes.
                      <StatusPill className="shrink-0 bg-green-600 text-white border-transparent">
                        Verified
                      </StatusPill>
                    ) : (
                      <StatusPill className={cn("shrink-0", row.pillClass)}>{row.label || "Pending"}</StatusPill>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Physical-document checklist. Only shown for approved/enrolled
          students — for everyone else the backend returns an empty list
          and we skip the card entirely. */}
      {approved && physical.items.length > 0 ? (
        <Card id="physical-documents">
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 rounded-md bg-[#8B1538]/10 p-2 shrink-0">
                  <ClipboardList className="w-5 h-5 text-[#8B1538]" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-[#8B1538]">
                    {physicalDocsComplete ? "Physical Documents on File" : "Physical Documents to Bring"}
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    {physicalDocsComplete
                      ? "These are the original copies the registrar's office has on file for your enrollment."
                      : "Hand-deliver the original copies of these documents to the registrar's office to complete your enrollment."}
                  </CardDescription>
                </div>
              </div>
              <StatusPill
                className={cn(
                  "shrink-0",
                  physical.missingCount === 0
                    ? "bg-green-600 text-white border-transparent"
                    : "bg-amber-500 text-white border-transparent"
                )}
              >
                {physical.receivedCount} / {physical.totalRequired} received
              </StatusPill>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress bar so the student can see at-a-glance how close
                they are to fully enrolled. */}
            <div>
              <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    physical.missingCount === 0 ? "bg-green-500" : "bg-[#8B1538]"
                  )}
                  style={{
                    width: `${
                      physical.totalRequired === 0
                        ? 0
                        : Math.round((physical.receivedCount / physical.totalRequired) * 100)
                    }%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                {physical.missingCount === 0
                  ? "All required physical documents have been received."
                  : `${physical.missingCount} of ${physical.totalRequired} required document${
                      physical.totalRequired === 1 ? "" : "s"
                    } still to be submitted in person.`}
              </p>
            </div>

            {physicalDocsComplete ? (
              <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-green-700" />
                <p>
                  All required physical documents have been submitted to the registrar&apos;s office.
                </p>
              </div>
            ) : null}

            {!physicalDocsComplete && physical.missingCount > 0 ? (
              <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-blue-700" />
                <p>
                  Bring the original copies to the{" "}
                  <strong>Nuestra Senora De Guia Academy Registrar's Office</strong>{" "}
                  during office hours. The registrar will tick each item off your
                  checklist as you hand it over.
                </p>
              </div>
            ) : null}

            {/* Per-item rows. Missing items float to the top so the
                student sees what they still need to bring first. */}
            <ul className="space-y-2">
              {[...physical.items]
                .sort((a, b) => {
                  // Received items go to the bottom.
                  if (a.received !== b.received) return a.received ? 1 : -1;
                  return a.label.localeCompare(b.label);
                })
                .map((item) => (
                  <li
                    key={item.key}
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-md border px-3 py-2.5 transition-colors",
                      item.received
                        ? "border-green-200 bg-green-50/60"
                        : "border-gray-200 bg-white hover:border-[#8B1538]/40"
                    )}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {item.received ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            item.received ? "text-green-900" : "text-gray-900"
                          )}
                        >
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.required ? "Required" : "Optional"}
                          {item.transfereeOnly ? " · Transferees only" : ""}
                          {item.received && item.receivedAt
                            ? ` · Received ${new Date(item.receivedAt).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <StatusPill
                      className={cn(
                        "shrink-0",
                        item.received
                          ? "bg-green-600 text-white border-transparent"
                          : "bg-amber-500 text-white border-transparent"
                      )}
                    >
                      {item.received ? "Received" : "To submit"}
                    </StatusPill>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      ) : approved && physical.loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-gray-600 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading physical-document checklist…
          </CardContent>
        </Card>
      ) : approved && physical.error ? (
        <Alert variant="destructive">
          <AlertDescription>{physical.error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Hide stale registrar remarks once the application is approved —
          they refer to a closed review cycle. */}
      {application.registrarRemarks && !approved ? (
        <Card className="border-[#8B1538]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#8B1538]">
              <MessageSquare className="w-5 h-5" />
              Registrar&apos;s Remarks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 border border-[#8B1538] bg-red-50 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#8B1538] shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">{application.registrarRemarks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
