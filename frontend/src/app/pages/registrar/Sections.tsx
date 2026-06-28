import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  Plus,
  Trash2,
  Users,
  Loader2,
  AlertCircle,
  Info,
  Layers,
  Sun,
  Moon,
  List,
  Download,
  Calendar,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { useSchoolYear } from "../../context/SchoolYearContext";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { cn } from "../../components/ui/utils";

/** Class shift values mirrored from the backend ENUM. */
type SectionShift = "morning" | "afternoon";

type SectionGradeLevel = "11" | "12";

const GRADE_LEVELS: SectionGradeLevel[] = ["11", "12"];

function gradeLabel(grade: string): string {
  return `Grade ${grade}`;
}

/** Shape returned by GET /api/registrar/sections. */
type Section = {
  id: number;
  name: string;
  strand: string;
  shift: SectionShift;
  gradeLevel: SectionGradeLevel | string;
  maxBoys: number;
  maxGirls: number;
  capacity: number;
  boysFirst: boolean;
  enrolledBoys: number;
  enrolledGirls: number;
  enrolledTotal: number;
  /** Class list: at least one student is from an ended school year. */
  rosterArchived?: boolean;
  rosterSchoolYear?: string;
  rosterSchoolYearEnded?: boolean;
  createdAt?: string;
};

type SectionsResponse = {
  success: boolean;
  sections: Section[];
  strands: string[];
  shifts?: SectionShift[];
  gradeLevels?: SectionGradeLevel[];
  school_year_options?: string[];
  enrollment_school_year_current?: string | null;
  ongoing_school_year_current?: string | null;
  ended_school_years?: string[];
  rosterSchoolYear?: string | null;
  defaults: {
    maxBoys: number;
    maxGirls: number;
    capacity: number;
    boysFirstBoys: number;
    boysFirstGirls: number;
    boysFirstStrands: string[];
    shift?: SectionShift;
  };
};

type SectionRosterStudent = {
  userId: number;
  fullName: string;
  /** Backend sort key (last name, then first); used for A–Z ordering. */
  sortKey?: string;
  /** True when this student's school year was ended by admin. */
  archived?: boolean;
  /** Student declined Grade 12 continuation for the open enrollment school year. */
  declinedGrade12Continuation?: boolean;
  email: string;
  gender: string;
  schoolUsername: string;
  gradeLevel: string;
  schoolYear: string;
  lrn: string;
};

type SectionRosterResponse = {
  success: boolean;
  section: Section;
  students: SectionRosterStudent[];
  rosterSchoolYear?: string;
  rosterSchoolYearEnded?: boolean;
  grade12DeclineSchoolYear?: string | null;
  endedSchoolYears?: string[];
  error?: string;
};

function isMaleGender(gender: string): boolean {
  const g = gender.trim().toLowerCase();
  return g === "male" || g === "m" || g === "boy";
}

function isFemaleGender(gender: string): boolean {
  const g = gender.trim().toLowerCase();
  return g === "female" || g === "f" || g === "girl";
}

function rosterNameSortKey(student: SectionRosterStudent): string {
  const key = student.sortKey?.trim();
  if (key) return key;
  return rosterDisplayName(student).toLowerCase();
}

function sortStudentsAlphabetically(students: SectionRosterStudent[]): SectionRosterStudent[] {
  return [...students].sort((a, b) =>
    rosterNameSortKey(a).localeCompare(rosterNameSortKey(b), undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
}

function partitionStudentsByGender(students: SectionRosterStudent[]) {
  const boys: SectionRosterStudent[] = [];
  const girls: SectionRosterStudent[] = [];
  const other: SectionRosterStudent[] = [];
  for (const s of students) {
    if (isMaleGender(s.gender)) {
      boys.push(s);
    } else if (isFemaleGender(s.gender)) {
      girls.push(s);
    } else {
      other.push(s);
    }
  }
  return {
    boys: sortStudentsAlphabetically(boys),
    girls: sortStudentsAlphabetically(girls),
    other: sortStudentsAlphabetically(other),
  };
}

function rosterDisplayName(student: SectionRosterStudent): string {
  const name = student.fullName.trim();
  if (name) return name;
  if (student.schoolUsername.trim()) return student.schoolUsername.trim();
  const email = student.email.trim();
  if (email) return email.split("@")[0] ?? email;
  return "";
}

const ROSTER_COLUMNS = [
  { key: "name", letter: "A", label: "Student Name", minWidth: "min-w-[140px]" },
  { key: "email", letter: "B", label: "Email", minWidth: "min-w-[180px]" },
  { key: "grade", letter: "C", label: "Grade", minWidth: "min-w-[52px]" },
  { key: "lrn", letter: "D", label: "LRN", minWidth: "min-w-[100px]" },
  { key: "schoolYear", letter: "E", label: "School Year", minWidth: "min-w-[88px]" },
  { key: "username", letter: "F", label: "Portal ID", minWidth: "min-w-[88px]" },
] as const;

const excelCell =
  "border border-gray-300 px-2 py-1 text-xs align-middle whitespace-nowrap";
const excelNameCell =
  "border border-gray-300 px-3 py-2 text-sm align-middle text-left whitespace-normal break-words leading-snug font-medium text-gray-900";
const excelNameCellArchived =
  "text-gray-400 opacity-75";
const excelNameCellDeclined =
  "text-red-700 font-semibold bg-red-50";

function rosterNameCellClass(student: SectionRosterStudent | null, rosterArchived?: boolean): string {
  if (!student) return excelNameCell;
  if (student.declinedGrade12Continuation) return cn(excelNameCell, excelNameCellDeclined);
  const muted = Boolean(student.archived) || Boolean(rosterArchived);
  if (muted) return cn(excelNameCell, excelNameCellArchived);
  return excelNameCell;
}
const excelHead =
  "border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-800 align-middle whitespace-nowrap";

function rosterRowToCsvCells(s: SectionRosterStudent, rowNum: number): string[] {
  return [
    String(rowNum),
    `"${rosterDisplayName(s).replace(/"/g, '""')}"`,
    `"${(s.email || "").replace(/"/g, '""')}"`,
    s.gradeLevel ? `G${s.gradeLevel}` : "",
    `"${(s.lrn || "").replace(/"/g, '""')}"`,
    `"${(s.schoolYear || "").replace(/"/g, '""')}"`,
    `"${(s.schoolUsername || "").replace(/"/g, '""')}"`,
  ];
}

/** One gender block: alphabetical rows + empty seats to capacity. */
function ExcelGenderTable({
  title,
  subtitle,
  headerTint,
  letterTint,
  students,
  seatCapacity,
}: {
  title: string;
  subtitle: string;
  headerTint: string;
  letterTint: string;
  students: SectionRosterStudent[];
  seatCapacity: number;
}) {
  const rowCount = Math.max(seatCapacity, 1);
  const rows: (SectionRosterStudent | null)[] = [...students];
  while (rows.length < rowCount) {
    rows.push(null);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 border border-gray-400 bg-white shadow-inner">
      <div
        className={cn(
          "shrink-0 px-3 py-2 border-b border-gray-400 font-semibold text-sm text-gray-900",
          headerTint,
        )}
      >
        {title}
        <span className="ml-2 font-normal text-gray-600 text-xs">{subtitle}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full border-collapse text-left font-sans">
          <thead className="sticky top-0 z-20">
            <tr className={letterTint}>
              <th
                className={cn(
                  excelHead,
                  "sticky left-0 z-30 w-9 text-center text-gray-600",
                  letterTint,
                )}
              />
              {ROSTER_COLUMNS.map((col) => (
                <th key={col.key} className={cn(excelHead, letterTint, "text-center", col.minWidth)}>
                  {col.letter}
                </th>
              ))}
            </tr>
            <tr className="bg-[#f2f2f2]">
              <th
                className={cn(
                  excelHead,
                  "sticky left-0 z-30 bg-[#e8e8e8] w-9 text-center text-gray-600",
                )}
              >
                #
              </th>
              {ROSTER_COLUMNS.map((col) => (
                <th key={col.key} className={cn(excelHead, "bg-[#f2f2f2]", col.minWidth)}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((student, idx) => {
              const rowNum = idx + 1;
              const isEmpty = student === null;
              const rowBg = idx % 2 === 0 ? "bg-white" : "bg-[#fafafa]";
              const stickyBg = idx % 2 === 0 ? "bg-white" : "bg-[#fafafa]";
              return (
                <tr key={student?.userId ?? `empty-${title}-${rowNum}`} className={rowBg}>
                  <td
                    className={cn(
                      excelCell,
                      "sticky left-0 z-10 text-center font-medium text-gray-500",
                      stickyBg,
                    )}
                  >
                    {rowNum}
                  </td>
                  <td className={cn(excelCell, rowBg)}>
                    {isEmpty ? "" : rosterDisplayName(student)}
                  </td>
                  <td className={cn(excelCell, rowBg, "text-gray-700")}>
                    {isEmpty ? "" : student.email}
                  </td>
                  <td className={cn(excelCell, rowBg, "text-center")}>
                    {isEmpty ? "" : student.gradeLevel ? `G${student.gradeLevel}` : ""}
                  </td>
                  <td className={cn(excelCell, rowBg, "font-mono text-[11px]")}>
                    {isEmpty ? "" : student.lrn}
                  </td>
                  <td className={cn(excelCell, rowBg)}>
                    {isEmpty ? "" : student.schoolYear}
                  </td>
                  <td className={cn(excelCell, rowBg, "font-mono text-[11px]")}>
                    {isEmpty ? "" : student.schoolUsername}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Full-screen roster: boys (left) | center divider | girls (right); names show in full. */
function ExcelClassList({
  students,
  maxBoys,
  maxGirls,
  sectionLabel,
  schoolYearLabel,
  schoolYearEnded = false,
  rosterArchived = false,
  grade12DeclineSchoolYear = null,
}: {
  students: SectionRosterStudent[];
  maxBoys: number;
  maxGirls: number;
  sectionLabel?: string;
  schoolYearLabel?: string;
  schoolYearEnded?: boolean;
  rosterArchived?: boolean;
  grade12DeclineSchoolYear?: string | null;
}) {
  const { boys, girls, other } = partitionStudentsByGender(students);
  const rowCount = Math.max(maxBoys, maxGirls, 1);

  const middleDividerCell =
    "bg-neutral-300 border-x-2 border-neutral-500 p-0 align-middle";

  return (
    <div className="flex flex-1 min-h-0 w-full flex-col gap-3">
      <div className="flex flex-1 min-h-0 w-full flex-col border border-gray-400 bg-white shadow-inner">
        {schoolYearLabel ? (
          <p
            className={cn(
              "shrink-0 text-center text-sm font-semibold border-b border-gray-300 py-2 px-3",
              schoolYearEnded || rosterArchived
                ? "bg-gray-100 text-gray-500"
                : "bg-[#e8f4fc] text-[#1e4d7b]",
            )}
          >
            School Year: {schoolYearLabel}
            {schoolYearEnded || rosterArchived ? (
              <span className="ml-2 font-medium text-gray-500">
                (Ended — names greyed out
                {students.some((s) => s.declinedGrade12Continuation) ? "; red = not continuing to Grade 12" : ""}
                )
              </span>
            ) : null}
          </p>
        ) : null}
        {students.some((s) => s.declinedGrade12Continuation) ? (
          <p className="shrink-0 text-center text-xs text-red-700 border-b border-red-100 py-1.5 bg-red-50/80 px-3">
            Names in <span className="font-semibold text-red-700">red</span> declined Grade 12 continuation
            {grade12DeclineSchoolYear ? ` for SY ${grade12DeclineSchoolYear}` : ""}.
          </p>
        ) : null}
        {sectionLabel ? (
          <p className="shrink-0 text-center text-xs font-medium text-gray-700 border-b border-gray-300 py-1.5 bg-[#f2f2f2]">
            {sectionLabel} · {boys.length}/{maxBoys} boys · {girls.length}/{maxGirls} girls (A–Z)
          </p>
        ) : null}
        <div className="flex flex-1 min-h-0 w-full overflow-auto">
        <table className="w-full h-full border-collapse table-fixed font-sans">
          <colgroup>
            <col style={{ width: "5%" }} />
            <col style={{ width: "42%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "42%" }} />
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr className="bg-[#e2efda]">
              <th className={cn(excelHead, "bg-sky-100 text-center")}>#</th>
              <th className={cn(excelHead, "bg-sky-100 text-left")}>Boys — Last name, First name</th>
              <th
                rowSpan={2}
                className={cn(
                  excelHead,
                  "bg-neutral-500 text-white border-x-2 border-neutral-600 align-middle text-center",
                )}
              >
                <div className="flex flex-col items-center justify-center gap-1.5 py-3 text-xs font-bold leading-tight">
                  <span className="text-sky-100">Boys</span>
                  <span className="w-10 h-px bg-white/70" />
                  <span className="text-pink-100">Girls</span>
                </div>
              </th>
              <th className={cn(excelHead, "bg-pink-100 text-center")}>#</th>
              <th className={cn(excelHead, "bg-pink-100 text-left")}>Girls — Last name, First name</th>
            </tr>
            <tr className="bg-[#f2f2f2]">
              <th className={cn(excelHead, "bg-sky-50/80 text-center text-sky-900")}>No.</th>
              <th className={cn(excelHead, "bg-sky-50/80 text-left text-sky-900")}>
                Last name, First name (A–Z)
              </th>
              <th className={cn(excelHead, "bg-pink-50/80 text-center text-pink-900")}>No.</th>
              <th className={cn(excelHead, "bg-pink-50/80 text-left text-pink-900")}>
                Last name, First name (A–Z)
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, idx) => {
              const rowNum = idx + 1;
              const boy = boys[idx] ?? null;
              const girl = girls[idx] ?? null;
              const rowBg = idx % 2 === 0 ? "bg-white" : "bg-[#fafafa]";
              const stickyNumBg = rowBg;
              return (
                <tr key={`row-${rowNum}`} className={rowBg}>
                  <td
                    className={cn(
                      excelCell,
                      "text-center font-medium text-sky-800 bg-sky-50/50",
                      stickyNumBg,
                    )}
                  >
                    {rowNum <= maxBoys ? rowNum : ""}
                  </td>
                  <td className={cn(rosterNameCellClass(boy, rosterArchived), rowBg)}>
                    {boy ? rosterDisplayName(boy) : ""}
                  </td>
                  <td
                    className={cn(
                      middleDividerCell,
                      "text-center text-[10px] font-semibold text-neutral-600",
                    )}
                    aria-hidden
                  />
                  <td
                    className={cn(
                      excelCell,
                      "text-center font-medium text-pink-800 bg-pink-50/50",
                      stickyNumBg,
                    )}
                  >
                    {rowNum <= maxGirls ? rowNum : ""}
                  </td>
                  <td className={cn(rosterNameCellClass(girl, rosterArchived), rowBg)}>
                    {girl ? rosterDisplayName(girl) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      {other.length > 0 ? (
        <ExcelGenderTable
          title="Unassigned gender"
          subtitle={`${other.length} student(s) · sorted A–Z`}
          headerTint="bg-amber-50"
          letterTint="bg-amber-100"
          students={other}
          seatCapacity={other.length}
        />
      ) : null}
    </div>
  );
}

function downloadRosterCsv(section: Section, students: SectionRosterStudent[]) {
  const { boys, girls, other } = partitionStudentsByGender(students);
  const headers = ["No.", ...ROSTER_COLUMNS.map((c) => c.label)];
  const lines: string[] = [];

  const appendBlock = (label: string, list: SectionRosterStudent[]) => {
    if (list.length === 0) return;
    lines.push("");
    lines.push(`"${label}"`);
    lines.push(headers.join(","));
    list.forEach((s, idx) => lines.push(rosterRowToCsvCells(s, idx + 1).join(",")));
  };

  appendBlock("BOYS (A-Z)", boys);
  appendBlock("GIRLS (A-Z)", girls);
  appendBlock("OTHER", other);
  if (lines.length === 0) {
    lines.push(headers.join(","));
  }

  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = `${section.strand}-${section.name}-${section.shift}`.replace(/\s+/g, "_");
  a.href = url;
  a.download = `class-list_${safeName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Display label for a shift value. */
function shiftLabel(shift: SectionShift): string {
  return shift === "afternoon" ? "Afternoon" : "Morning";
}

function sectionOptionLabel(section: Section, includeStrand: boolean): string {
  const base = `${section.name} — ${shiftLabel(section.shift ?? "morning")} (G${section.gradeLevel ?? "11"})`;
  return includeStrand ? `${section.strand} · ${base}` : base;
}

type RosterYearFilter = "ongoing" | "enrollment" | "all" | string;

function rosterYearFilterToApiParam(filter: RosterYearFilter): string {
  if (filter === "ongoing") return "ongoing";
  if (filter === "enrollment" || filter === "current") return "enrollment";
  if (filter === "all") return "all";
  return filter;
}

function buildSectionsSchoolYearQuery(filter: RosterYearFilter): string {
  const params = new URLSearchParams();
  params.set("school_year", rosterYearFilterToApiParam(filter));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Pill shown on each section card to indicate its shift. */
function ShiftBadge({ shift }: { shift: SectionShift }) {
  if (shift === "afternoon") {
    return (
      <Badge
        variant="outline"
        className="border-indigo-300 bg-indigo-50 text-indigo-800 whitespace-nowrap"
      >
        <Moon className="h-3 w-3 mr-1" />
        Afternoon
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-orange-300 bg-orange-50 text-orange-800 whitespace-nowrap"
    >
      <Sun className="h-3 w-3 mr-1" />
      Morning
    </Badge>
  );
}

/** Per-row capacity bar with boys-vs-girls split. */
function CapacityBar({
  enrolledBoys,
  enrolledGirls,
  maxBoys,
  maxGirls,
}: {
  enrolledBoys: number;
  enrolledGirls: number;
  maxBoys: number;
  maxGirls: number;
}) {
  const capacity = Math.max(1, maxBoys + maxGirls);
  // Width allotted to each gender's lane is proportional to its max so that a
  // 45-boys-0-girls EIM section visually shows the boys lane spanning the
  // whole bar instead of a tiny half-width strip.
  const boysLanePct = (maxBoys / capacity) * 100;
  const girlsLanePct = (maxGirls / capacity) * 100;
  const boysFillPct = maxBoys > 0 ? Math.min(100, (enrolledBoys / maxBoys) * 100) : 0;
  const girlsFillPct = maxGirls > 0 ? Math.min(100, (enrolledGirls / maxGirls) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 flex">
        {boysLanePct > 0 ? (
          <div
            className="h-full bg-gray-200"
            style={{ width: `${boysLanePct}%` }}
            aria-label={`Boys lane (${maxBoys} max)`}
          >
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${boysFillPct}%` }}
            />
          </div>
        ) : null}
        {girlsLanePct > 0 ? (
          <div
            className="h-full bg-gray-200 border-l border-white"
            style={{ width: `${girlsLanePct}%` }}
            aria-label={`Girls lane (${maxGirls} max)`}
          >
            <div
              className="h-full bg-pink-500 transition-all"
              style={{ width: `${girlsFillPct}%` }}
            />
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>
          <span className="inline-block h-2 w-2 rounded-sm bg-blue-500 mr-1.5 align-middle" />
          {enrolledBoys}/{maxBoys} boys
        </span>
        <span>
          <span className="inline-block h-2 w-2 rounded-sm bg-pink-500 mr-1.5 align-middle" />
          {enrolledGirls}/{maxGirls} girls
        </span>
      </div>
    </div>
  );
}

export function Sections() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [strands, setStrands] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<SectionsResponse["defaults"] | null>(null);

  // Add-section dialog state. We let the registrar pick the strand from the
  // canonical list returned by the backend so the dropdown stays in sync if
  // we ever add a strand later.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStrand, setNewStrand] = useState<string>("");
  const [newShift, setNewShift] = useState<SectionShift>("morning");
  const [newGrade, setNewGrade] = useState<SectionGradeLevel>("11");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterSection, setRosterSection] = useState<Section | null>(null);
  const [rosterStudents, setRosterStudents] = useState<SectionRosterStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterArchived, setRosterArchived] = useState(false);
  const [rosterSchoolYear, setRosterSchoolYear] = useState<string>("");
  const [rosterSchoolYearEnded, setRosterSchoolYearEnded] = useState(false);
  const [grade12DeclineSchoolYear, setGrade12DeclineSchoolYear] = useState<string | null>(null);

  const { enrollmentSchoolYearLabel, ongoingSchoolYearLabel, endedSchoolYears } =
    useSchoolYear();
  const [rosterYearFilter, setRosterYearFilter] = useState<RosterYearFilter>("ongoing");
  const [apiSchoolYearOptions, setApiSchoolYearOptions] = useState<string[]>([]);
  const [apiEndedSchoolYears, setApiEndedSchoolYears] = useState<string[]>([]);
  const [gradeFilter, setGradeFilter] = useState<"all" | SectionGradeLevel>("all");
  const [strandFilter, setStrandFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");

  const schoolYearQuery = useMemo(
    () => buildSectionsSchoolYearQuery(rosterYearFilter),
    [rosterYearFilter],
  );

  const appliedRosterYearLabel = useMemo(() => {
    if (rosterYearFilter === "ongoing") {
      return ongoingSchoolYearLabel
        ? `SY ${ongoingSchoolYearLabel} — current classes`
        : "Ongoing school year";
    }
    if (rosterYearFilter === "enrollment" || rosterYearFilter === "current") {
      return enrollmentSchoolYearLabel
        ? `SY ${enrollmentSchoolYearLabel} — new applicants`
        : "Open enrollment year";
    }
    if (rosterYearFilter === "all") {
      return "All school years";
    }
    return `SY ${rosterYearFilter}`;
  }, [rosterYearFilter, enrollmentSchoolYearLabel, ongoingSchoolYearLabel]);

  /** Resolved YYYY-YYYY label for the roster filter (empty when showing all years). */
  const resolvedRosterSchoolYear = useMemo(() => {
    if (rosterYearFilter === "ongoing") {
      return ongoingSchoolYearLabel ?? "";
    }
    if (rosterYearFilter === "enrollment" || rosterYearFilter === "current") {
      return enrollmentSchoolYearLabel ?? "";
    }
    if (rosterYearFilter === "all") {
      return "";
    }
    return rosterYearFilter;
  }, [rosterYearFilter, enrollmentSchoolYearLabel, ongoingSchoolYearLabel]);

  const ongoingDiffersFromEnrollment =
    Boolean(ongoingSchoolYearLabel) &&
    Boolean(enrollmentSchoolYearLabel) &&
    ongoingSchoolYearLabel !== enrollmentSchoolYearLabel;

  const effectiveEndedSchoolYears =
    apiEndedSchoolYears.length > 0 ? apiEndedSchoolYears : endedSchoolYears;

  const schoolYearOptions = useMemo(() => {
    const opts = new Set<string>(apiSchoolYearOptions);
    if (ongoingSchoolYearLabel) opts.add(ongoingSchoolYearLabel);
    if (enrollmentSchoolYearLabel) opts.add(enrollmentSchoolYearLabel);
    effectiveEndedSchoolYears.forEach((y) => opts.add(y));
    return Array.from(opts).sort((a, b) => b.localeCompare(a));
  }, [
    apiSchoolYearOptions,
    ongoingSchoolYearLabel,
    enrollmentSchoolYearLabel,
    effectiveEndedSchoolYears,
  ]);

  const loadSections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/registrar/sections${schoolYearQuery}`);
      const json = (await res.json()) as SectionsResponse | { success: false; error?: string };
      if (!res.ok || !json.success) {
        const msg = ("error" in json && json.error) || `Failed to load sections (${res.status})`;
        setError(msg);
        setSections([]);
        return;
      }
      setSections(Array.isArray(json.sections) ? json.sections : []);
      setStrands(Array.isArray(json.strands) ? json.strands : []);
      setDefaults(json.defaults ?? null);
      if (Array.isArray(json.school_year_options)) {
        setApiSchoolYearOptions(json.school_year_options);
      }
      if (Array.isArray(json.ended_school_years)) {
        setApiEndedSchoolYears(json.ended_school_years);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [schoolYearQuery]);

  useEffect(() => {
    loadSections();
  }, [loadSections, enrollmentSchoolYearLabel]);

  const sortSectionList = useCallback((list: Section[]) => {
    return [...list].sort((a, b) => {
      const sa = (a.shift ?? "morning") === "morning" ? 0 : 1;
      const sb = (b.shift ?? "morning") === "morning" ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }, []);

  const filteredSections = useMemo(() => {
    return sections.filter((s) => {
      if (gradeFilter !== "all" && String(s.gradeLevel ?? "11") !== gradeFilter) {
        return false;
      }
      if (strandFilter !== "all" && s.strand !== strandFilter) {
        return false;
      }
      if (sectionFilter !== "all" && String(s.id) !== sectionFilter) {
        return false;
      }
      return true;
    });
  }, [sections, gradeFilter, strandFilter, sectionFilter]);

  const sectionSelectOptions = useMemo(() => {
    let list = sections;
    if (gradeFilter !== "all") {
      list = list.filter((s) => String(s.gradeLevel ?? "11") === gradeFilter);
    }
    if (strandFilter !== "all") {
      list = list.filter((s) => s.strand === strandFilter);
    }
    return sortSectionList(list);
  }, [sections, gradeFilter, strandFilter, sortSectionList]);

  useEffect(() => {
    if (sectionFilter === "all") return;
    if (!sectionSelectOptions.some((s) => String(s.id) === sectionFilter)) {
      setSectionFilter("all");
    }
  }, [sectionFilter, sectionSelectOptions]);

  const hasActiveSectionFilters =
    gradeFilter !== "all" || strandFilter !== "all" || sectionFilter !== "all";

  const visibleGradeLevels = useMemo(
    (): SectionGradeLevel[] => (gradeFilter === "all" ? GRADE_LEVELS : [gradeFilter]),
    [gradeFilter],
  );

  /** Group sections by strand, then Grade 11 / Grade 12. */
  const sectionsByStrandAndGrade = useMemo(() => {
    const map = new Map<string, Map<string, Section[]>>();
    for (const s of filteredSections) {
      const strandKey = s.strand || "Unassigned";
      const gradeKey = String(s.gradeLevel ?? "11");
      if (!map.has(strandKey)) map.set(strandKey, new Map());
      const gradeMap = map.get(strandKey)!;
      if (!gradeMap.has(gradeKey)) gradeMap.set(gradeKey, []);
      gradeMap.get(gradeKey)!.push(s);
    }
    map.forEach((gradeMap) => {
      gradeMap.forEach((list, grade) => {
        gradeMap.set(grade, sortSectionList(list));
      });
    });
    return map;
  }, [filteredSections, sortSectionList]);

  // Strand list to render: honour strand filter, then sections that survived filters.
  const renderedStrands = useMemo(() => {
    if (strandFilter !== "all") {
      return [strandFilter];
    }
    const set = new Set<string>(strands);
    for (const s of filteredSections) set.add(s.strand);
    return Array.from(set).filter((st) => {
      const gradeMap = sectionsByStrandAndGrade.get(st);
      if (!gradeMap) return false;
      return GRADE_LEVELS.some((g) => (gradeMap.get(g)?.length ?? 0) > 0);
    });
  }, [strands, filteredSections, strandFilter, sectionsByStrandAndGrade]);

  const isBoysFirstStrand = useCallback(
    (strand: string) => Boolean(defaults?.boysFirstStrands?.includes(strand)),
    [defaults],
  );

  const openAddDialog = (
    strand?: string,
    shift?: SectionShift,
    gradeLevel?: SectionGradeLevel,
  ) => {
    setNewStrand(strand ?? strands[0] ?? "STEM");
    setNewShift(shift ?? defaults?.shift ?? "morning");
    setNewGrade(gradeLevel ?? "11");
    setNewName("");
    setDialogOpen(true);
  };

  const openClassList = async (section: Section) => {
    setRosterSection(section);
    setRosterOpen(true);
    setRosterLoading(true);
    setRosterError(null);
    setRosterStudents([]);
    setRosterArchived(false);
    setRosterSchoolYear(resolvedRosterSchoolYear);
    setRosterSchoolYearEnded(
      resolvedRosterSchoolYear !== "" &&
        effectiveEndedSchoolYears.includes(resolvedRosterSchoolYear),
    );
    setGrade12DeclineSchoolYear(null);
    try {
      const rosterQuery = new URLSearchParams({ section_id: String(section.id) });
      rosterQuery.set("school_year", rosterYearFilterToApiParam(rosterYearFilter));
      const res = await apiFetch(`/api/registrar/sections?${rosterQuery.toString()}`);
      const text = await res.text();
      let json: SectionRosterResponse | { success: false; error?: string } = {
        success: false,
      };
      try {
        json = JSON.parse(text) as SectionRosterResponse | { success: false; error?: string };
      } catch {
        const snippet = text.replace(/\s+/g, " ").trim().slice(0, 160);
        throw new Error(
          snippet
            ? `Server returned an invalid response: ${snippet}`
            : "Server returned an invalid response",
        );
      }
      if (!res.ok || !json.success || !("students" in json)) {
        const msg = ("error" in json && json.error) || `Failed to load class list (${res.status})`;
        setRosterError(msg);
        return;
      }
      const list = Array.isArray(json.students) ? json.students : [];
      setRosterStudents(list);
      const sy =
        resolvedRosterSchoolYear ||
        (json.rosterSchoolYear ?? json.section?.rosterSchoolYear ?? "").trim() ||
        (() => {
          const counts = new Map<string, number>();
          for (const s of list) {
            const y = (s.schoolYear ?? "").trim();
            if (y) counts.set(y, (counts.get(y) ?? 0) + 1);
          }
          let best = "";
          let max = 0;
          counts.forEach((n, y) => {
            if (n > max) {
              max = n;
              best = y;
            }
          });
          return best;
        })();
      setRosterSchoolYear(sy);
      const yearEnded =
        resolvedRosterSchoolYear !== ""
          ? effectiveEndedSchoolYears.includes(resolvedRosterSchoolYear)
          : Boolean(
              json.rosterSchoolYearEnded ??
                json.section?.rosterSchoolYearEnded ??
                list.some((s) => s.archived),
            );
      setRosterSchoolYearEnded(yearEnded);
      setRosterArchived(
        Boolean(json.section?.rosterArchived ?? json.rosterSchoolYearEnded ?? yearEnded),
      );
      setGrade12DeclineSchoolYear(
        (json.grade12DeclineSchoolYear ?? "").trim() || null,
      );
      if (json.section) {
        setRosterSection(json.section);
      }
    } catch (e) {
      setRosterError(e instanceof Error ? e.message : "Network error");
    } finally {
      setRosterLoading(false);
    }
  };

  const submitNewSection = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Please enter a section name (e.g. A, B, Rose).");
      return;
    }
    if (!newStrand) {
      toast.error("Please choose a strand.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/registrar/sections", {
        method: "POST",
        body: JSON.stringify({
          name,
          strand: newStrand,
          shift: newShift,
          gradeLevel: newGrade,
        }),
      });
      const json = (await res.json()) as
        | { success: true; section: Section }
        | { success: false; error?: string };
      if (!res.ok || !json.success) {
        const msg = ("error" in json && json.error) || `Failed to create section (${res.status})`;
        toast.error(msg);
        return;
      }
      toast.success(
        `Added ${gradeLabel(String(json.section.gradeLevel ?? newGrade))} section "${json.section.name}" (${shiftLabel(json.section.shift ?? newShift).toLowerCase()}) to ${json.section.strand}.`,
      );
      setDialogOpen(false);
      setNewName("");
      // Refresh from the server so counts and ordering stay consistent.
      loadSections();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create section");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSection = async (section: Section) => {
    if (!confirm(`Delete section "${section.name}" from ${section.strand}? This cannot be undone.`)) {
      return;
    }
    setDeletingId(section.id);
    try {
      const res = await apiFetch(`/api/registrar/sections?id=${section.id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast.error(json.error || `Failed to delete (${res.status})`);
        return;
      }
      toast.success(`Deleted "${section.name}".`);
      loadSections();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete section");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Layers className="h-6 w-6 text-[#8B1538]" />
            Sections
          </h2>
          <p className="text-gray-600">
            Manage class sections per strand for{" "}
            <span className="font-semibold">Grade 11</span> and{" "}
            <span className="font-semibold">Grade 12</span>. Each section seats{" "}
            <span className="font-semibold">{defaults?.capacity ?? 45} students</span> by default
            ({defaults?.maxBoys ?? 23} boys + {defaults?.maxGirls ?? 22} girls).
          </p>
        </div>
        <Button
          className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
          onClick={() => openAddDialog()}
          disabled={loading || strands.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add section
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="min-w-0">
            <label
              htmlFor="sections-roster-year"
              className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              Roster school year
            </label>
            <select
              id="sections-roster-year"
              value={rosterYearFilter}
              onChange={(e) => setRosterYearFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
            >
              {ongoingSchoolYearLabel && (
                <option value="ongoing">
                  Current classes — ongoing ({ongoingSchoolYearLabel})
                </option>
              )}
              {enrollmentSchoolYearLabel && (
                <option value="enrollment">
                  New applicants — enrollment ({enrollmentSchoolYearLabel})
                </option>
              )}
              <option value="all">All school years (combined)</option>
              {!enrollmentSchoolYearLabel && !ongoingSchoolYearLabel && (
                <option value="ongoing">Current school year</option>
              )}
              {schoolYearOptions
                .filter(
                  (y) =>
                    y !== ongoingSchoolYearLabel &&
                    (!enrollmentSchoolYearLabel || y !== enrollmentSchoolYearLabel),
                )
                .map((y) => (
                <option key={y} value={y}>
                  SY {y}
                  {effectiveEndedSchoolYears.includes(y) ? " (ended)" : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1 leading-snug">
              Counts students whose enrollment record matches this school year.
            </p>
          </div>
          <div className="min-w-0">
            <label
              htmlFor="sections-grade-filter"
              className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Grade level
            </label>
            <select
              id="sections-grade-filter"
              value={gradeFilter}
              onChange={(e) =>
                setGradeFilter(e.target.value as "all" | SectionGradeLevel)
              }
              className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
            >
              <option value="all">All grades</option>
              <option value="11">Grade 11</option>
              <option value="12">Grade 12</option>
            </select>
          </div>
          <div className="min-w-0">
            <label
              htmlFor="sections-strand-filter"
              className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              Strand
            </label>
            <select
              id="sections-strand-filter"
              value={strandFilter}
              onChange={(e) => setStrandFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
            >
              <option value="all">All strands</option>
              {strands.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label
              htmlFor="sections-section-filter"
              className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              Section
            </label>
            <select
              id="sections-section-filter"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
            >
              <option value="all">All sections</option>
              {sectionSelectOptions.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {sectionOptionLabel(s, strandFilter === "all")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Sectioning · {appliedRosterYearLabel}
            {filteredSections.length !== sections.length
              ? ` · Showing ${filteredSections.length} of ${sections.length} sections`
              : sections.length > 0
                ? ` · ${sections.length} section${sections.length === 1 ? "" : "s"}`
                : ""}
          </p>
          {hasActiveSectionFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-gray-600"
              onClick={() => {
                setGradeFilter("all");
                setStrandFilter("all");
                setSectionFilter("all");
              }}
            >
              Clear section filters
            </Button>
          ) : null}
        </div>
      </Card>

      {error ? (
        <Alert className="border-red-300 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-700" />
          <AlertDescription className="text-red-900">{error}</AlertDescription>
        </Alert>
      ) : null}

      {ongoingDiffersFromEnrollment ? (
        <Alert className="border-violet-200 bg-violet-50">
          <Info className="h-4 w-4 text-violet-700" />
          <AlertDescription className="text-violet-900 space-y-1">
            <div>
              <span className="font-semibold">Ongoing ({ongoingSchoolYearLabel})</span> is the
              current academic year — use this to see students already in class.
            </div>
            <div>
              <span className="font-semibold">Enrollment ({enrollmentSchoolYearLabel})</span> is the
              year accepting new applications — use this to see newly approved students for that
              intake only.
            </div>
            <div className="text-sm">
              Section counts follow the <span className="font-semibold">Roster school year</span>{" "}
              filter above, not the open-enrollment setting on its own.
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Explainer for how auto-fill works on approval */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-700" />
        <AlertDescription className="text-blue-900 space-y-1">
          <div>
            <span className="font-semibold">Auto-fill on approval:</span> When you approve a
            student, the system places them into the first non-full section for their strand,
            gender, and <span className="font-semibold">preferred shift</span> (taken from the
            enrollment form: Morning Shift or Afternoon Shift).
          </div>
          <div>
            If every section in their preferred shift is full, a new section is{" "}
            <span className="font-semibold">created automatically</span> in that same shift using
            the next free letter (A &rarr; B &rarr; C &hellip;). If you haven&rsquo;t created any
            sections in the preferred shift yet, the student is placed in the other shift and you
            get a warning so you can reassign.
          </div>
          {defaults?.boysFirstStrands?.length ? (
            <div>
              <span className="font-semibold">Exception &mdash; {defaults.boysFirstStrands.join(", ")}:</span>{" "}
              boys are auto-placed normally. Girls applying to this strand are{" "}
              <span className="font-semibold">not</span> auto-placed &mdash; you&rsquo;ll be warned
              so you can decide where to put them.
            </div>
          ) : null}
        </AlertDescription>
      </Alert>

      {/* Explainer for the EIM exception */}
      {defaults?.boysFirstStrands?.length ? (
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-900">
            <span className="font-semibold">Boys-first strand:</span>{" "}
            {defaults.boysFirstStrands.join(", ")} sections are configured for{" "}
            {defaults.boysFirstBoys} boys, but girls may still apply if they choose. Capacity can be
            adjusted later if a girl enrolls.
          </AlertDescription>
        </Alert>
      ) : null}

      {loading && sections.length === 0 ? (
        <div className="flex items-center gap-2 text-gray-600 py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading sections…
        </div>
      ) : renderedStrands.length === 0 ? (
        <Card className="p-10 text-center text-gray-600">
          <p className="font-medium text-gray-900 mb-1">No sections match these filters</p>
          <p className="text-sm">
            Try a different enrollment year, strand, or section — or clear the section filters above.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {renderedStrands.map((strand) => {
            const gradeMap = sectionsByStrandAndGrade.get(strand) ?? new Map<string, Section[]>();
            const totalSections = visibleGradeLevels.reduce(
              (n, g) => n + (gradeMap.get(g)?.length ?? 0),
              0,
            );
            const boysFirst = isBoysFirstStrand(strand);
            return (
              <Card key={strand} className="p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <GraduationCap className="h-5 w-5 text-[#8B1538] shrink-0" />
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{strand}</h3>
                    {boysFirst ? (
                      <Badge variant="outline" className="border-amber-400 text-amber-800">
                        Boys-first
                      </Badge>
                    ) : null}
                    <span className="text-sm text-gray-500">
                      {totalSections} section{totalSections === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                {totalSections === 0 ? (
                  <p className="text-sm text-gray-500 italic mb-4">
                    No sections yet. Add a section under Grade 11 or Grade 12 below.
                  </p>
                ) : null}

                {visibleGradeLevels.map((grade) => {
                  const list = gradeMap.get(grade) ?? [];
                  if (list.length === 0 && sectionFilter !== "all") {
                    return null;
                  }
                  return (
                    <div key={`${strand}-${grade}`} className="mb-6 last:mb-0">
                      <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b-2 border-[#8B1538]/20">
                        <h4 className="text-base font-semibold text-[#8B1538]">
                          {gradeLabel(grade)}
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAddDialog(strand, undefined, grade)}
                        >
                          <Plus className="h-4 w-4 mr-1.5" />
                          Add {gradeLabel(grade)} section
                        </Button>
                      </div>

                      {list.length === 0 ? (
                        <p className="text-sm text-gray-500 italic mb-2">
                          No {gradeLabel(grade)} sections yet.
                        </p>
                      ) : (
                  (["morning", "afternoon"] as SectionShift[]).map((shift) => {
                    const shiftList = list.filter((s) => (s.shift ?? "morning") === shift);
                    const total = shiftList.reduce((acc, s) => acc + s.enrolledTotal, 0);
                    const cap = shiftList.reduce((acc, s) => acc + s.capacity, 0);
                    return (
                      <div key={shift} className="mb-5 last:mb-0">
                        <div className="flex items-center justify-between gap-2 mb-2 pb-1 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <ShiftBadge shift={shift} />
                            <span className="text-sm text-gray-600">
                              {shiftList.length} section{shiftList.length === 1 ? "" : "s"}
                              {shiftList.length > 0 ? ` · ${total}/${cap} enrolled` : ""}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#8B1538] hover:bg-[#8B1538]/5"
                            onClick={() => openAddDialog(strand, shift, grade)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add {shiftLabel(shift).toLowerCase()} section
                          </Button>
                        </div>

                        {shiftList.length === 0 ? (
                          <p className="text-xs text-gray-500 italic">
                            No {shiftLabel(shift).toLowerCase()} sections yet.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {shiftList.map((section) => {
                              const full = section.enrolledTotal >= section.capacity;
                              return (
                                <div
                                  key={section.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => openClassList(section)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      openClassList(section);
                                    }
                                  }}
                                  className={cn(
                                    "rounded-lg border p-4 transition-colors cursor-pointer",
                                    full
                                      ? "border-emerald-300 bg-emerald-50/60 hover:border-emerald-400"
                                      : "border-gray-200 bg-white hover:border-[#8B1538]/40 hover:shadow-sm",
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-gray-900 truncate">
                                        {gradeLabel(String(section.gradeLevel ?? grade))} – {strand}{" "}
                                        {section.name}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Capacity {section.capacity}
                                        {full ? " (full)" : ""}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <ShiftBadge shift={section.shift ?? "morning"} />
                                      <Badge
                                        variant="outline"
                                        className="border-gray-300 text-gray-700 whitespace-nowrap"
                                      >
                                        <Users className="h-3 w-3 mr-1" />
                                        {section.enrolledTotal}/{section.capacity}
                                      </Badge>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-gray-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteSection(section);
                                        }}
                                        disabled={deletingId === section.id}
                                        title={
                                          section.enrolledTotal > 0
                                            ? "Reassign assigned students before deleting"
                                            : "Delete section"
                                        }
                                      >
                                        {deletingId === section.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                  <CapacityBar
                                    enrolledBoys={section.enrolledBoys}
                                    enrolledGirls={section.enrolledGirls}
                                    maxBoys={section.maxBoys}
                                    maxGirls={section.maxGirls}
                                  />
                                  <p className="mt-3 text-xs text-[#8B1538] flex items-center gap-1">
                                    <List className="h-3.5 w-3.5" />
                                    Click to view class list
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                      )}
                    </div>
                  );
                })}
              </Card>
            );
          })}
          {renderedStrands.length === 0 ? (
            <Card className="p-8 text-center text-gray-600">
              No strands configured. Please contact an administrator.
            </Card>
          ) : null}
        </div>
      )}

      {/* Class list dialog */}
      <Dialog
        open={rosterOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRosterOpen(false);
            setRosterSection(null);
            setRosterStudents([]);
            setRosterError(null);
          }
        }}
      >
        <DialogContent
          className={cn(
            // Override default DialogContent centering + sm:max-w-lg so this fills the viewport.
            "!fixed !inset-0 !top-0 !left-0 !right-0 !bottom-0 !m-0",
            "!h-[100dvh] !w-screen !max-w-none !max-h-none sm:!max-w-none",
            "!translate-x-0 !translate-y-0",
            "flex flex-col gap-2 overflow-hidden rounded-none border-0 p-3 sm:p-4 shadow-lg",
            "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100",
          )}
        >
          <DialogHeader className="shrink-0 space-y-0.5 pr-10 text-center sm:text-center items-center">
            {rosterSchoolYear ? (
              <p
                className={cn(
                  "text-base font-semibold text-center w-full rounded-md px-3 py-2 border",
                  rosterSchoolYearEnded || rosterArchived
                    ? "bg-gray-100 border-gray-300 text-gray-600"
                    : "bg-[#e8f4fc] border-[#b8d4e8] text-[#1e4d7b]",
                )}
              >
                School Year: {rosterSchoolYear}
                {rosterSchoolYearEnded || rosterArchived ? (
                  <span className="block text-sm font-normal text-gray-500 mt-0.5">
                    Ended — student names are greyed out
                  </span>
                ) : null}
              </p>
            ) : null}
            <DialogTitle className="flex flex-wrap items-center justify-center gap-2 text-lg">
              <List className="h-5 w-5 text-[#217346]" />
              Class list
              {rosterSection ? (
                <span className="font-normal text-gray-600">
                  — {gradeLabel(String(rosterSection.gradeLevel ?? "11"))}{" "}
                  {rosterSection.strand} {rosterSection.name} (
                  {shiftLabel(rosterSection.shift ?? "morning")})
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription className="text-sm text-center">
              {rosterSection
                ? `Boys and girls listed separately (A–Z). ${rosterSection.enrolledBoys} boys · ${rosterSection.enrolledGirls} girls · ${rosterSection.capacity} total seats.`
                : "Students enrolled in this section."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-1 min-h-0 w-full flex-col items-stretch justify-center">
            {rosterLoading ? (
              <div className="flex flex-1 items-center justify-center text-gray-500 border border-gray-300 bg-[#fafafa]">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading class list…
              </div>
            ) : rosterError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{rosterError}</AlertDescription>
              </Alert>
            ) : rosterSection ? (
              <ExcelClassList
                students={rosterStudents}
                maxBoys={rosterSection.maxBoys}
                maxGirls={rosterSection.maxGirls}
                sectionLabel={`${gradeLabel(String(rosterSection.gradeLevel ?? "11"))} · ${rosterSection.strand} ${rosterSection.name}`}
                schoolYearLabel={rosterSchoolYear}
                schoolYearEnded={rosterSchoolYearEnded || rosterArchived}
                rosterArchived={rosterArchived || rosterSchoolYearEnded}
                grade12DeclineSchoolYear={grade12DeclineSchoolYear}
              />
            ) : null}
          </div>

          <DialogFooter className="shrink-0 flex-col-reverse sm:flex-row sm:justify-between gap-2 border-t border-gray-200 pt-2">
            <p className="text-xs text-gray-500 self-center sm:mr-auto">
              Boys (left) and girls (right), separated in the middle; names sorted A–Z. Empty rows =
              open seats.
              {rosterStudents.some((s) => s.declinedGrade12Continuation) ? (
                <span className="block text-red-700 mt-0.5">
                  Red names = not continuing to Grade 12
                  {grade12DeclineSchoolYear ? ` (SY ${grade12DeclineSchoolYear})` : ""}.
                </span>
              ) : null}
            </p>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              {rosterSection && rosterStudents.length > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#217346] text-[#217346] hover:bg-[#e2efda]"
                  onClick={() => downloadRosterCsv(rosterSection, rosterStudents)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setRosterOpen(false)}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add-section dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && !submitting) setDialogOpen(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a new section</DialogTitle>
            <DialogDescription>
              Pick a strand and give the section a name (e.g. <span className="font-mono">A</span>,
              <span className="font-mono"> B</span>, or <span className="font-mono">Rose</span>).
              Default capacity is {defaults?.capacity ?? 45} students per section.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Grade level</Label>
              <div className="grid grid-cols-2 gap-2">
                {GRADE_LEVELS.map((grade) => {
                  const active = newGrade === grade;
                  return (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => setNewGrade(grade)}
                      className={cn(
                        "h-10 rounded-md border text-sm font-medium transition-colors",
                        active
                          ? "border-[#8B1538] bg-[#8B1538]/10 text-[#8B1538]"
                          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                      )}
                    >
                      {gradeLabel(grade)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="section-strand">Strand</Label>
              <select
                id="section-strand"
                value={newStrand}
                onChange={(e) => setNewStrand(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
              >
                {strands.length === 0 ? <option value="">No strands available</option> : null}
                {strands.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {newStrand && isBoysFirstStrand(newStrand) ? (
                <p className="text-xs text-amber-800 flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  {newStrand} sections default to {defaults?.boysFirstBoys ?? 45} boys (no girl
                  seats reserved). Girls who apply will need a registrar adjustment.
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label>Class shift</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["morning", "afternoon"] as SectionShift[]).map((shift) => {
                  const active = newShift === shift;
                  const isMorning = shift === "morning";
                  return (
                    <button
                      key={shift}
                      type="button"
                      onClick={() => setNewShift(shift)}
                      className={cn(
                        "flex items-center justify-center gap-2 h-10 rounded-md border text-sm font-medium transition-colors",
                        active
                          ? isMorning
                            ? "border-orange-400 bg-orange-50 text-orange-900"
                            : "border-indigo-400 bg-indigo-50 text-indigo-900"
                          : "border-gray-300 bg-white text-gray-700 hover:border-[#8B1538]/40",
                      )}
                    >
                      {isMorning ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {shiftLabel(shift)} Shift
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500">
                Students whose enrollment form requested the{" "}
                <span className="font-semibold">{shiftLabel(newShift)} Shift</span> will fill
                sections here first.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="section-name">Section name</Label>
              <Input
                id="section-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. A"
                maxLength={50}
                autoFocus
              />
              <p className="text-xs text-gray-500">
                The full label shown to staff and students will be{" "}
                <span className="font-mono">
                  {newStrand || "STRAND"} – {newName.trim() || "name"} ({shiftLabel(newShift).toLowerCase()})
                </span>
                .
              </p>
            </div>

            {/* Show the capacity that will be created so the registrar can
                verify before clicking. EIM gets the boys-first defaults. */}
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span className="font-medium">Capacity</span>
                <span className="font-semibold text-gray-900">
                  {(isBoysFirstStrand(newStrand)
                    ? defaults?.boysFirstBoys ?? 45
                    : defaults?.maxBoys ?? 23) +
                    (isBoysFirstStrand(newStrand)
                      ? defaults?.boysFirstGirls ?? 0
                      : defaults?.maxGirls ?? 22)}{" "}
                  students
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {isBoysFirstStrand(newStrand)
                  ? `${defaults?.boysFirstBoys ?? 45} boys (no reserved girl seats)`
                  : `${defaults?.maxBoys ?? 23} boys + ${defaults?.maxGirls ?? 22} girls`}
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitNewSection}
              disabled={submitting || !newName.trim() || !newStrand}
              className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add section
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Sections;
