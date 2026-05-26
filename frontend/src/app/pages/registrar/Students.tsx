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
  status: string;
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
    try {
      const res = await apiFetch(`/api/registrar/students?user_id=${s.userId}`);
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Failed to load student (${res.status})`);
      }
      setDetail(json.student as Student);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load student detail");
      setDetail(s); // fall back to summary row
    } finally {
      setDetailLoading(false);
    }
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
                                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Enrolled
                                      </Badge>
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
                      </li>
                    ))}
                  </ul>
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
