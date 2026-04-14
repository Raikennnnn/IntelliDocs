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
} from "lucide-react";
import { useStudentPortal } from "../../hooks/useStudentPortal";
import { cn } from "../../components/ui/utils";

/** Application-level label: show Enrolled when registrar approved (even if API sends raw "approved"). */
function applicationStatusLabel(status: string, statusCode: string): string {
  const code = statusCode.toLowerCase();
  if (code === "approved") return "Enrolled";
  const s = status.toLowerCase().trim();
  if (s === "approved" || s.includes("enrolled")) return "Enrolled";
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

export function ApplicationStatus() {
  const { data, loading, error } = useStudentPortal();

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
  const approved =
    statusCode === "approved" || statusText === "approved" || statusText.includes("enrolled");

  const appLabel = applicationStatusLabel(application.status, application.status_code || "");
  const payMode = String(application.mode_of_payment || "").toLowerCase();
  const showVoucherHint = approved && payMode && payMode !== "cash";
  const overviewHighlightClass = approved
    ? "bg-green-50 border border-green-200"
    : "bg-blue-50 border border-blue-200";
  const overviewTitleClass = approved ? "text-green-900" : "text-blue-900";
  const overviewSubClass = approved ? "text-green-800" : "text-blue-700";

  const documentRow = (rawStatus: string) => {
    const t = rawStatus.toLowerCase();
    if (t.includes("reject") || t.includes("tamper")) {
      return { label: rawStatus, pillClass: getStatusColor(rawStatus) };
    }
    if (approved) {
      return { label: "Verified", pillClass: getStatusColor("verified") };
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
          <CardDescription>Application ID: {application.id}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`flex items-center justify-between p-4 rounded-lg ${overviewHighlightClass}`}>
            <div className="flex items-center gap-3 min-w-0">
              {getStatusIcon(appLabel)}
              <div className="min-w-0">
                <p className={`font-semibold ${overviewTitleClass}`}>{appLabel}</p>
                <p className={`text-sm ${overviewSubClass}`}>Last updated: {application.lastUpdated}</p>
              </div>
            </div>
            <StatusPill className={getStatusColor(appLabel)}>{appLabel}</StatusPill>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Submitted Date</p>
              <p className="font-medium">{application.submittedDate}</p>
            </div>
            <div>
              <p className="text-gray-600">Last Updated</p>
              <p className="font-medium">{application.lastUpdated}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
          {application.documents.length === 0 ? (
            <p className="text-sm text-gray-600 py-4 text-center">
              No documents on file yet. Complete enrollment to upload requirements.
            </p>
          ) : (
            application.documents.map((doc, index) => {
              const row = documentRow(doc.status);
              return (
                <div
                  key={`${doc.name}-${index}`}
                  className="p-4 border rounded-lg hover:border-[#8B1538] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <FileText className="w-5 h-5 text-gray-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{doc.name}</p>
                        {doc.remarks ? <p className="text-sm text-gray-600 mt-1">{doc.remarks}</p> : null}
                      </div>
                    </div>
                    <StatusPill className={cn("shrink-0", row.pillClass)}>{row.label}</StatusPill>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {application.registrarRemarks ? (
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
