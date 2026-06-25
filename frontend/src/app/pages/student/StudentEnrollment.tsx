import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  CheckCircle,
  Upload,
  FileText,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  User,
  Users,
  GraduationCap,
  FileCheck,
  DollarSign,
  Gift,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { apiFetch } from "../../lib/api";
import { Combobox } from "../../components/Combobox";
import { SchoolYearCombobox } from "../../components/SchoolYearCombobox";
import {
  getSchoolYearAttendedOptions,
  hasValidPersonName,
  hasValidSectionLabel,
  hasValidTextOnlyContent,
  isValidEnrollmentLrn,
  isValidPhilippineMobileNumber,
  isValidSchoolYearAttended,
  sanitizeEnrollmentFieldValue,
  sanitizeEnrollmentFormData,
} from "../../lib/enrollmentFieldValidation";
import {
  getBarangaysForMunicipality,
  hasValidAddressLabel,
  isKnownNcrMunicipality,
  NCR_MUNICIPALITIES,
  normalizeBarangayValue,
  normalizeMunicipalityValue,
  resolveNcrBarangay,
  resolveNcrMunicipality,
  sanitizeAddressLabelInput,
} from "../../lib/ncrAddress";
import { useEnrollmentAllowed } from "../../context/SchoolYearContext";
import { EnrollmentGuard } from "../../components/EnrollmentGuard";
import {
  isDocumentUploadTooLarge,
  MAX_DOCUMENT_UPLOAD_LABEL,
} from "../../lib/uploadLimits";

/**
 * `RequiredLabel` renders a form label and a consistently-styled red
 * asterisk to mark the field as required. Use this anywhere we previously
 * wrote `<Label>Field *</Label>` so the asterisk color cannot drift between
 * fields (the original markup mixed `*` glyphs in the default text color
 * with `<span className="text-red-500">*</span>` spans, producing the
 * black-vs-red inconsistency seen in the Personal Information section).
 *
 * Spreads any other props (htmlFor, className, etc.) onto the underlying
 * `<Label>` so it remains a drop-in replacement.
 */
function RequiredLabel({
  children,
  ...rest
}: React.ComponentProps<typeof Label> & { children: React.ReactNode }) {
  return (
    <Label {...rest}>
      {children} <span className="text-red-500" aria-hidden="true">*</span>
    </Label>
  );
}

/** YYYY-MM-DD in local calendar (avoids UTC shifting the day on `<input type="date">`). */
function formatLocalDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Senior High: typical DepEd K–12 learner age range for Grades 11–12. */
const SHS_MIN_AGE_YEARS = 15;
const SHS_MAX_AGE_YEARS = 25;

/** Calendar age in whole years on a given date (local timezone). */
function calendarAgeYears(ymd: string, asOf: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const birth = new Date(y, m - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== d) {
    return null;
  }
  let age = asOf.getFullYear() - y;
  const asOfMonth = asOf.getMonth() + 1;
  const asOfDay = asOf.getDate();
  if (asOfMonth < m || (asOfMonth === m && asOfDay < d)) {
    age -= 1;
  }
  return age;
}

function birthDateBoundsForShs(minAgeYears: number, maxAgeYears: number) {
  const now = new Date();
  const maxDob = new Date(now.getFullYear() - minAgeYears, now.getMonth(), now.getDate());
  // Oldest allowed DOB: still maxAge today, not yet (maxAge + 1).
  const minDob = new Date(now.getFullYear() - maxAgeYears - 1, now.getMonth(), now.getDate());
  minDob.setDate(minDob.getDate() + 1);
  return { min: formatLocalDateYmd(minDob), max: formatLocalDateYmd(maxDob) };
}

function birthDateValidationError(ymd: string, minAgeYears: number, maxAgeYears: number): string | null {
  const age = calendarAgeYears(ymd);
  if (age === null) return "Invalid birth date.";
  if (age < minAgeYears) {
    return `Birth date must show the learner is at least ${minAgeYears} years old (Senior High eligibility).`;
  }
  if (age > maxAgeYears) {
    return `Birth date must show the learner is at most ${maxAgeYears} years old (Senior High eligibility).`;
  }
  return null;
}

function isBirthDateValidForShs(ymd: string, minAgeYears: number, maxAgeYears: number): boolean {
  return birthDateValidationError(ymd, minAgeYears, maxAgeYears) === null;
}

interface DocumentUpload {
  name: string;
  file: File | null;
  status: 'missing' | 'uploaded';
  required: boolean;
  requiredFor?: 'all' | 'transferee';
  uploadedId?: number;
  uploadedAt?: string;
  /** Latest AI status (verified|failed|rejected|pending|…). Used to lock approved files during resubmission. */
  aiStatus?: string;
  /** "rejected" when the registrar explicitly required a re-upload of this requirement. */
  registrarDecision?: string;
  /** Registrar's note for the student (shown next to the rejected document on the upload step). */
  registrarRemarks?: string;
  /**
   * True once the registrar has manually marked this document as reviewed in
   * the registrar portal. We treat this as an "approval" signal on the
   * student side so the badge shows "Approved" instead of leaving the
   * student wondering whether anyone has looked at their file yet.
   */
  registrarReviewed?: boolean;
  /**
   * Resubmit attempts used after the registrar rejected this requirement.
   * While filling the enrollment form, replacements do not increment this.
   */
  uploadCount?: number;
  /** Copied from a prior school-year enrollment during Grade 12 rollover. */
  carriedForward?: boolean;
  /** Set when deferred readability checks cannot reach the AI service. */
  readabilityCheckPaused?: boolean;
}

/** Maximum number of times a student may upload a single requirement. */
const UPLOAD_ATTEMPT_LIMIT = 5;

/** Match API document rows to enrollment step labels (PSA vs birth_certificate, etc.). */
function normalizeRequirementKey(label: string): string {
  const t = label.trim().toLowerCase();
  if (!t) return "";
  if (["birth_certificate", "birthcert", "psa"].includes(t)) return "birth_certificate";
  if (["good_moral", "goodmoral"].includes(t)) return "good_moral";
  if (["sf9", "report_card"].includes(t)) return "sf9";
  if (["sf10", "form137", "form_137"].includes(t)) return "sf10";
  if (["photo_2x2", "id_picture", "picture_2x2"].includes(t)) return "photo_2x2";
  if (t.includes("2x2") || (t.includes("picture") && t.includes("white"))) return "photo_2x2";
  if (t.includes("good moral")) return "good_moral";
  if (t.includes("sf9") || t.includes("report card")) return "sf9";
  if (t.includes("form 137") || t.includes("form137") || t.includes("sf10")) return "sf10";
  if (t.includes("birth")) return "birth_certificate";
  return t;
}

/** Student-facing label/class for one requirement on the upload step. */
function studentDocumentDisplayMeta(
  doc: DocumentUpload,
  opts: {
    enrollmentFinalized: boolean;
    isGrade12PromotionFlow: boolean;
    isResubmitFlow: boolean;
  }
): {
  needsResubmit: boolean;
  verified: boolean;
  label: string;
  badgeClass: string;
  showCarriedHint: boolean;
  allowReupload: boolean;
} {
  const aiStatus = String(doc.aiStatus || "").toLowerCase();
  const decision = String(doc.registrarDecision || "").toLowerCase();
  const registrarCleared = doc.registrarReviewed === true;
  const aiVerified =
    aiStatus === "verified" ||
    aiStatus === "approved" ||
    aiStatus === "pass" ||
    aiStatus.includes("verify");
  const needsResubmit =
    !registrarCleared &&
    (decision === "rejected" ||
      aiStatus === "rejected" ||
      (!opts.isGrade12PromotionFlow &&
        String(doc.registrarRemarks || "").trim().length > 0 &&
        !aiVerified &&
        !opts.enrollmentFinalized));

  if (doc.status !== "uploaded") {
    return {
      needsResubmit: false,
      verified: false,
      label: "Missing",
      badgeClass: "bg-gray-600",
      showCarriedHint: false,
      allowReupload: !opts.isGrade12PromotionFlow,
    };
  }

  // Registrar manually reviewed this file — always show cleared (even if AI is pending).
  if (registrarCleared && !needsResubmit) {
    return {
      needsResubmit: false,
      verified: true,
      label: opts.enrollmentFinalized ? "Verified" : "Approved",
      badgeClass: "bg-green-600",
      showCarriedHint: false,
      allowReupload: false,
    };
  }

  // Grade 12 re-enrollment: files on file from last year are already cleared.
  if (opts.isGrade12PromotionFlow && !opts.enrollmentFinalized) {
    if (needsResubmit) {
      return {
        needsResubmit: true,
        verified: false,
        label: "Contact registrar",
        badgeClass: "bg-red-600",
        showCarriedHint: false,
        allowReupload: false,
      };
    }
    return {
      needsResubmit: false,
      verified: true,
      label: "Approved",
      badgeClass: "bg-green-600",
      showCarriedHint: false,
      allowReupload: false,
    };
  }

  const verified =
    !needsResubmit && (opts.enrollmentFinalized || aiVerified);

  const showCarriedHint =
    opts.isGrade12PromotionFlow &&
    !opts.enrollmentFinalized &&
    !verified &&
    !needsResubmit &&
    Boolean(doc.carriedForward);

  if (needsResubmit) {
    return {
      needsResubmit: true,
      verified: false,
      label: "Resubmission required",
      badgeClass: "bg-red-600",
      showCarriedHint: false,
      allowReupload: true,
    };
  }

  if (verified) {
    return {
      needsResubmit: false,
      verified: true,
      label: opts.enrollmentFinalized ? "Verified" : "Approved",
      badgeClass: "bg-green-600",
      showCarriedHint: false,
      allowReupload: false,
    };
  }
  if (showCarriedHint) {
    return {
      needsResubmit: false,
      verified: false,
      label: "On file from last year",
      badgeClass: "bg-slate-600",
      showCarriedHint: true,
      allowReupload: false,
    };
  }
  if (opts.isResubmitFlow && aiStatus === "pending" && doc.file) {
    return {
      needsResubmit: false,
      verified: false,
      label: "Resubmitted — awaiting review",
      badgeClass: "bg-amber-500 text-white",
      showCarriedHint: false,
      allowReupload: true,
    };
  }

  if (aiStatus === "screening") {
    if (doc.readabilityCheckPaused) {
      return {
        needsResubmit: false,
        verified: false,
        label: "Verification unavailable",
        badgeClass: "bg-red-600 text-white",
        showCarriedHint: false,
        allowReupload: false,
      };
    }
    return {
      needsResubmit: false,
      verified: false,
      label: "Checking readability…",
      badgeClass: "bg-amber-500 text-white",
      showCarriedHint: false,
      allowReupload: false,
    };
  }

  return {
    needsResubmit: false,
    verified: false,
    label: "Uploaded — awaiting review",
    badgeClass: "bg-blue-600",
    showCarriedHint: false,
    allowReupload: true,
  };
}

type ApiDocumentRow = {
  id: number;
  type?: string;
  uploaded_at?: string;
  ai_status?: string;
  registrar_doc_decision?: string;
  registrar_doc_remarks?: string;
  registrar_reviewed?: number | boolean;
  upload_count?: number | string;
  carried_forward?: number | boolean;
};

function documentRowFromApiHit(doc: DocumentUpload, hit: ApiDocumentRow): DocumentUpload {
  return {
    ...doc,
    status: "uploaded",
    uploadedId: hit.id,
    uploadedAt: hit.uploaded_at,
    aiStatus: hit.ai_status,
    registrarDecision: hit.registrar_doc_decision,
    registrarRemarks: hit.registrar_doc_remarks,
    registrarReviewed: hit.registrar_reviewed === true || Number(hit.registrar_reviewed ?? 0) === 1,
    uploadCount: Math.max(0, Number(hit.upload_count ?? 0) || 0),
    carriedForward: hit.carried_forward === true || Number(hit.carried_forward ?? 0) === 1,
  };
}

/** Map API rows (machine or human type keys) onto the enrollment step requirements. */
function mergeDocumentsFromApiRows(prev: DocumentUpload[], rows: ApiDocumentRow[]): DocumentUpload[] {
  const mapByType = new Map<string, ApiDocumentRow>();
  for (const d of rows) {
    const key = normalizeRequirementKey(String(d.type || ""));
    if (key && !mapByType.has(key)) {
      mapByType.set(key, d);
    }
  }
  return prev.map((doc) => {
    const hit = mapByType.get(normalizeRequirementKey(doc.name));
    return hit ? documentRowFromApiHit(doc, hit) : doc;
  });
}

interface EnrollmentFormData {
  // Enrollment Status
  enrollmentStatus: 'old' | 'new' | 'transferee' | '';
  
  // Personal Information
  givenName: string;
  middleName: string;
  middleInitial: string;
  lastName: string;
  extensionName: string;
  gender: string;
  contactNumber: string;
  email: string;
  lrn: string;
  
  // Address
  blockLotHouseNo: string;
  street: string;
  compoundSubdivisionVillage: string;
  barangay: string;
  municipality: string;
  
  // Birth Information
  birthDate: string;
  birthPlace: string;
  religion: string;
  
  // Academic Information
  gradeLevel: '11' | '12' | '';
  strand: string;
  preferredSchedule: string;
  
  // Mother's Information
  motherGivenName: string;
  motherMaidenMiddleName: string;
  motherMaidenLastName: string;
  motherContactNumber: string;
  motherOccupation: string;
  
  // Father's Information
  fatherGivenName: string;
  fatherMiddleName: string;
  fatherLastName: string;
  fatherContactNumber: string;
  fatherOccupation: string;
  
  // Guardian Information
  hasGuardian: boolean;
  guardianGivenName: string;
  guardianMiddleName: string;
  guardianLastName: string;
  guardianContactNumber: string;
  relationshipToGuardian: string;
  
  // Emergency Contact
  emergencyContact: 'mother' | 'father' | 'guardian' | '';
  
  // Enrollment History
  previousSchoolAttended: string;
  schoolType: 'public' | 'private' | '';
  gradeLevelAtPreviousSchool: string;
  sectionAtPreviousSchool: string;
  lastSchoolYearAttended: string;
  
  // Bring a Friend Promo
  hasReferralCode: boolean;
  referralCardControlNumber: string;
  referrerName: string;
  referrerContactNumber: string;
  
  // Accounting
  modeOfPayment: string;
  voucherNo: string;
  
  // Confirmation
  confirmInformation: boolean;
}

type PriorApprovedMeta = {
  grade_level: string;
  grade_level_number: number;
  strand: string;
  school_year: string;
  form_data?: Partial<EnrollmentFormData>;
};

type Grade12PhysicalDocsGate = {
  applies: boolean;
  complete: boolean;
  priorEnrollmentId: number | null;
  priorSchoolYear: string;
  totalRequired: number;
  receivedCount: number;
  missingCount: number;
  missingLabels: string[];
};

/** Pre-fill returning students from their last enrolled application. */
function applyReEnrollmentFormPrefill(
  base: EnrollmentFormData,
  priorForm: Partial<EnrollmentFormData> | undefined,
  prior: PriorApprovedMeta | null,
  options?: { promoteGrade?: boolean }
): EnrollmentFormData {
  const promoteGrade = options?.promoteGrade !== false;
  const merged: EnrollmentFormData = { ...base, ...(priorForm ?? {}) };

  const g = prior?.grade_level_number ?? 0;
  if (promoteGrade) {
    if (g === 11) merged.gradeLevel = "12";
    else if (g >= 12) merged.gradeLevel = "12";
  }

  const strandFromRecord = (prior?.strand ?? "").trim();
  if (strandFromRecord) {
    merged.strand = strandFromRecord;
  } else if ((priorForm?.strand ?? "").trim()) {
    merged.strand = String(priorForm?.strand).trim();
  }

  merged.enrollmentStatus = "old";
  merged.confirmInformation = false;

  return merged;
}

/** Set when the student confirms they want to proceed to the new SY / Grade 12 enrollment. */
const GRADE12_ENROLLMENT_CONSENT_KEY = "intellidocs_grade12_enrollment_sy";

function isGrade12PrefillLocked(input: {
  grade12PromotionActive: boolean;
  schoolYearCurrent: string | null;
  priorApprovedSchoolYear: string | undefined;
  showNewEnrollmentForm: boolean;
  hasConsentedToNewSy: boolean;
  gradeLevel: string;
  enrollmentStatus: string;
}): boolean {
  const isGrade12PromotionFlow =
    input.gradeLevel === "12" &&
    (input.grade12PromotionActive ||
      (input.schoolYearCurrent !== null &&
        (input.priorApprovedSchoolYear ?? "") !== "" &&
        input.priorApprovedSchoolYear !== input.schoolYearCurrent &&
        (input.showNewEnrollmentForm || input.hasConsentedToNewSy)));

  const isUpcomingGrade12Reenrollment =
    input.showNewEnrollmentForm &&
    input.gradeLevel === "12" &&
    input.enrollmentStatus === "old";

  return isGrade12PromotionFlow || isUpcomingGrade12Reenrollment;
}

const lockedPrefillInputClass = " bg-gray-100 text-gray-700";
const lockedPrefillSelectClass =
  "bg-gray-100 text-gray-700 cursor-not-allowed disabled:opacity-100";

const INITIAL_ENROLLMENT_FORM_DATA: EnrollmentFormData = {
  enrollmentStatus: "",
  givenName: "",
  middleName: "",
  middleInitial: "",
  lastName: "",
  extensionName: "",
  gender: "",
  contactNumber: "",
  email: "",
  lrn: "",
  blockLotHouseNo: "",
  street: "",
  compoundSubdivisionVillage: "",
  barangay: "",
  municipality: "",
  birthDate: "",
  birthPlace: "",
  religion: "",
  gradeLevel: "",
  strand: "HUMSS",
  preferredSchedule: "",
  motherGivenName: "",
  motherMaidenMiddleName: "",
  motherMaidenLastName: "",
  motherContactNumber: "",
  motherOccupation: "",
  fatherGivenName: "",
  fatherMiddleName: "",
  fatherLastName: "",
  fatherContactNumber: "",
  fatherOccupation: "",
  hasGuardian: false,
  guardianGivenName: "",
  guardianMiddleName: "",
  guardianLastName: "",
  guardianContactNumber: "",
  relationshipToGuardian: "",
  emergencyContact: "",
  previousSchoolAttended: "",
  schoolType: "",
  gradeLevelAtPreviousSchool: "",
  sectionAtPreviousSchool: "",
  lastSchoolYearAttended: "",
  hasReferralCode: false,
  referralCardControlNumber: "",
  referrerName: "",
  referrerContactNumber: "",
  modeOfPayment: "",
  voucherNo: "",
  confirmInformation: false,
};

export function StudentEnrollment() {
  const [searchParams, setSearchParams] = useSearchParams();
  const enrollmentAllowedFromSettings = useEnrollmentAllowed();
  const [enrollmentMetaLoaded, setEnrollmentMetaLoaded] = useState(false);
  // (moved) useSearchParams is declared above so we can read query params
  const shsBirthDateBounds = useMemo(
    () => birthDateBoundsForShs(SHS_MIN_AGE_YEARS, SHS_MAX_AGE_YEARS),
    [],
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnrollmentLocked, setIsEnrollmentLocked] = useState(false);
  const [enrollmentId, setEnrollmentId] = useState<number | null>(null);
  /** Student declaration that uploads are genuine (stored in DB like DPA consent). */
  const [documentsAuthenticityConfirmed, setDocumentsAuthenticityConfirmed] = useState(false);
  // Status-card state: drives the post-submission UI on this page so the
  // student sees the actual decision (Enrolled / Rejected / Under review)
  // instead of a generic "Processing" message after the registrar acts.
  const [enrollmentStatusRaw, setEnrollmentStatusRaw] = useState<string>('');
  const [enrollmentSchoolYear, setEnrollmentSchoolYear] = useState<string>('');
  const [enrollmentRemarks, setEnrollmentRemarks] = useState<string>('');
  const [enrollmentGradeLevel, setEnrollmentGradeLevel] = useState<string>('');
  const [enrollmentStrand, setEnrollmentStrand] = useState<string>('');
  const [schoolYearCurrent, setSchoolYearCurrent] = useState<string | null>(null);
  const [priorApproved, setPriorApproved] = useState<PriorApprovedMeta | null>(null);
  const [currentStudentSection, setCurrentStudentSection] = useState<string | null>(null);
  const [priorReenrollFormData, setPriorReenrollFormData] = useState<Partial<EnrollmentFormData> | null>(null);
  const [isGraduate, setIsGraduate] = useState(false);
  const [reEnrollmentEligible, setReEnrollmentEligible] = useState(false);
  const [newSchoolYearReenrollment, setNewSchoolYearReenrollment] = useState(false);
  const [needsGrade12Confirmation, setNeedsGrade12Confirmation] = useState(false);
  const [grade12PromotionActive, setGrade12PromotionActive] = useState(false);
  const [grade12BlockedPhysicalDocs, setGrade12BlockedPhysicalDocs] = useState(false);
  const [grade12PhysicalDocs, setGrade12PhysicalDocs] = useState<Grade12PhysicalDocsGate | null>(
    null,
  );
  const [showNewEnrollmentForm, setShowNewEnrollmentForm] = useState(false);
  const [isStartingGrade12, setIsStartingGrade12] = useState(false);
  const [isDecliningGrade12, setIsDecliningGrade12] = useState(false);
  const [missingParentDialogOpen, setMissingParentDialogOpen] = useState(false);
  const [missingParentParts, setMissingParentParts] = useState<string[]>([]);
  const [formData, setFormData] = useState<EnrollmentFormData>(INITIAL_ENROLLMENT_FORM_DATA);
  const submitInFlightRef = useRef(false);
  const readabilityInFlightRef = useRef(new Set<number>());
  const readabilityRetryRef = useRef(new Map<number, number>());

  const hasOpenSchoolYear =
    enrollmentAllowedFromSettings === true ||
    (schoolYearCurrent !== null && schoolYearCurrent !== '');

  const enrollmentGateReady =
    enrollmentMetaLoaded && enrollmentAllowedFromSettings !== null;

  const enrollmentBlocked = enrollmentGateReady && !hasOpenSchoolYear;

  /** While settings load, trust enrollment API if it already returned an open SY. */
  const enrollmentAllowed =
    enrollmentAllowedFromSettings === null
      ? schoolYearCurrent !== null && schoolYearCurrent !== ''
      : hasOpenSchoolYear;

  const addressBarangayOptions = useMemo(
    () => getBarangaysForMunicipality(formData.municipality),
    [formData.municipality],
  );

  const lastSchoolYearOptions = useMemo(() => getSchoolYearAttendedOptions({ count: 5 }), []);

  const selectFieldClass =
    "w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]";

  const isBirthPlaceOther =
    formData.birthPlace &&
    formData.birthPlace !== "" &&
    !NCR_MUNICIPALITIES.some(
      (c) => c.toLowerCase() === formData.birthPlace.toLowerCase(),
    );

  const [documents, setDocuments] = useState<DocumentUpload[]>([
    { name: 'PSA Birth Certificate', file: null, status: 'missing', required: true, requiredFor: 'all' },
    { name: 'Grade 10 Report Card (SF9)', file: null, status: 'missing', required: true, requiredFor: 'all' },
    { name: 'Good Moral Certificate', file: null, status: 'missing', required: true, requiredFor: 'all' },
    { name: 'SF10 / Form 137', file: null, status: 'missing', required: true, requiredFor: 'all' },
    { name: 'Transcript of Records (TOR)', file: null, status: 'missing', required: true, requiredFor: 'transferee' },
    { name: '2x2 Picture (White Background)', file: null, status: 'missing', required: true, requiredFor: 'all' },
  ]);

  const [enrollmentReloadKey, setEnrollmentReloadKey] = useState(0);

  useEffect(() => {
    const loadEnrollment = async () => {
      try {
        const res = await apiFetch('/api/student/enrollment');
        const text = await res.text();
        const json = JSON.parse(text) as {
          success?: boolean;
          enrollment?: {
            id?: number;
            current_step?: number;
            form_data?: Partial<EnrollmentFormData>;
            can_edit?: boolean;
            status?: string;
            school_year?: string;
            grade_level?: string;
            strand?: string;
            registrar_remarks?: string;
            document_authenticity_confirmed?: boolean;
            document_authenticity_confirmed_at?: string | null;
          } | null;
          school_year_current?: string | null;
          prior_approved?: {
            grade_level?: string;
            grade_level_number?: number;
            strand?: string;
            school_year?: string;
            form_data?: Partial<EnrollmentFormData>;
          } | null;
          is_graduate?: boolean;
          re_enrollment_eligible?: boolean;
          new_school_year_reenrollment?: boolean;
          needs_grade12_confirmation?: boolean;
          grade12_promotion_active?: boolean;
          grade12_blocked_physical_docs?: boolean;
          grade12_physical_docs?: Grade12PhysicalDocsGate;
          prefill_form_data?: Partial<EnrollmentFormData>;
          student_section?: { section?: string | null; shift?: string | null };
          error?: string;
        };
        if (!res.ok || !json.success) {
          if (json.error) toast.error(json.error);
          return;
        }
        const priorMeta: PriorApprovedMeta | null = json.prior_approved
          ? {
              grade_level: String(json.prior_approved.grade_level ?? ""),
              grade_level_number: Number(json.prior_approved.grade_level_number ?? 0) || 0,
              strand: String(json.prior_approved.strand ?? ""),
              school_year: String(json.prior_approved.school_year ?? ""),
              form_data: json.prior_approved.form_data,
            }
          : null;

        const isNewSyOpen = Boolean(json.new_school_year_reenrollment);
        const needsConfirm = Boolean(json.needs_grade12_confirmation);
        setNewSchoolYearReenrollment(isNewSyOpen);
        setNeedsGrade12Confirmation(needsConfirm);
        setGrade12PromotionActive(Boolean(json.grade12_promotion_active));
        setGrade12BlockedPhysicalDocs(Boolean(json.grade12_blocked_physical_docs));
        setGrade12PhysicalDocs(json.grade12_physical_docs ?? null);

        const priorFormFromApi =
          (json.prefill_form_data as Partial<EnrollmentFormData> | undefined) ??
          (json.prior_approved?.form_data as Partial<EnrollmentFormData> | undefined) ??
          (json.enrollment?.form_data as Partial<EnrollmentFormData> | undefined);
        if (priorFormFromApi && Object.keys(priorFormFromApi).length > 0) {
          setPriorReenrollFormData(priorFormFromApi);
        }
        setCurrentStudentSection((json.student_section?.section ?? "").trim() || null);

        const reEnrollEligible = Boolean(json.re_enrollment_eligible);
        const rowSy = (json.enrollment?.school_year ?? "").toString();
        const currentSy = (json.school_year_current ?? "").toString();
        const rowStatus = (json.enrollment?.status ?? "").toLowerCase().trim();
        const hasCurrentSyApplication =
          rowSy !== "" && currentSy !== "" && rowSy === currentSy;
        const isDraftCurrentSy =
          hasCurrentSyApplication && (rowStatus === "draft" || rowStatus === "");
        const isSubmittedCurrentSy =
          hasCurrentSyApplication &&
          (rowStatus === "pending" ||
            rowStatus === "under_review" ||
            rowStatus === "under review" ||
            rowStatus === "review" ||
            rowStatus === "approved" ||
            rowStatus === "enrolled");
        const isInProgressCurrentSy =
          hasCurrentSyApplication &&
          (isDraftCurrentSy ||
            rowStatus === "pending" ||
            rowStatus === "under_review" ||
            rowStatus === "review" ||
            rowStatus === "rejected");

        const storedConsentSy = localStorage.getItem(GRADE12_ENROLLMENT_CONSENT_KEY) ?? "";
        let hasConsentedToNewSy =
          storedConsentSy !== "" && currentSy !== "" && storedConsentSy === currentSy;

        // Stale browser consent must not skip the Grade 12 prompt when no
        // enrollment row exists yet for the open school year.
        if (needsConfirm && hasConsentedToNewSy && !hasCurrentSyApplication) {
          localStorage.removeItem(GRADE12_ENROLLMENT_CONSENT_KEY);
          hasConsentedToNewSy = false;
        }

        if (needsConfirm) {
          if (isDraftCurrentSy) {
            setShowNewEnrollmentForm(true);
          } else {
            setShowNewEnrollmentForm(false);
            if (rowStatus === "enrolled" || rowStatus === "approved") {
              localStorage.removeItem(GRADE12_ENROLLMENT_CONSENT_KEY);
            }
          }
        } else if (isDraftCurrentSy && hasConsentedToNewSy) {
          setShowNewEnrollmentForm(true);
        } else if (isSubmittedCurrentSy) {
          setShowNewEnrollmentForm(false);
        }

        if (json.enrollment?.form_data && (isInProgressCurrentSy || !isNewSyOpen)) {
          setFormData(prev => {
            const merged = { ...prev, ...(json.enrollment?.form_data ?? {}) };
            if (isInProgressCurrentSy && priorFormFromApi && isNewSyOpen) {
              return applyReEnrollmentFormPrefill(merged, priorFormFromApi, priorMeta, {
                promoteGrade: true,
              });
            }
            if (reEnrollEligible && priorFormFromApi && !isNewSyOpen) {
              return applyReEnrollmentFormPrefill(merged, priorFormFromApi, priorMeta, {
                promoteGrade: false,
              });
            }
            return merged;
          });
        } else if (isInProgressCurrentSy && priorFormFromApi && isNewSyOpen) {
          setFormData(prev =>
            applyReEnrollmentFormPrefill(prev, priorFormFromApi, priorMeta, { promoteGrade: true })
          );
        } else if (reEnrollEligible && priorFormFromApi && !isNewSyOpen) {
          setFormData(prev =>
            applyReEnrollmentFormPrefill(prev, priorFormFromApi, priorMeta, { promoteGrade: false })
          );
        }

        if (json.enrollment?.id) {
          setEnrollmentId(Number(json.enrollment.id));
        }
        if (json.enrollment?.document_authenticity_confirmed) {
          setDocumentsAuthenticityConfirmed(true);
        } else {
          setDocumentsAuthenticityConfirmed(false);
        }

        // Allow document resubmissions even when the enrollment row is locked.
        // We unlock via query param and force step 4 below.
        const resubmit = searchParams.get('resubmit') === '1';
        if (resubmit) {
          setIsEnrollmentLocked(false);
          localStorage.removeItem('studentEnrollmentLocked');
        } else if (json.enrollment?.can_edit === false) {
          setIsEnrollmentLocked(true);
          setShowNewEnrollmentForm(false);
          localStorage.setItem('studentEnrollmentLocked', '1');
        } else {
          setIsEnrollmentLocked(false);
          localStorage.removeItem('studentEnrollmentLocked');
        }

        let docsEnrollmentId =
          isInProgressCurrentSy && json.enrollment?.id ? Number(json.enrollment.id) : 0;
        const forcedStep = Number(searchParams.get('step') || '') || 0;
        if (searchParams.get('resubmit') === '1') {
          setCurrentStep(4);
        } else if (forcedStep >= 1 && forcedStep <= 6) {
          setCurrentStep(forcedStep);
        } else if (
          !isNewSyOpen &&
          json.enrollment?.current_step &&
          json.enrollment.current_step >= 1 &&
          json.enrollment.current_step <= 6
        ) {
          setCurrentStep(json.enrollment.current_step);
        } else if (isNewSyOpen && !isInProgressCurrentSy) {
          setCurrentStep(1);
        }

        // Surface status / SY context on the page so the locked-out branch
        // can show the right message (Enrolled vs Rejected vs Under review)
        // and the new-SY re-enrollment CTA can render when applicable.
        setEnrollmentStatusRaw((json.enrollment?.status ?? '').toString());
        setEnrollmentSchoolYear((json.enrollment?.school_year ?? '').toString());
        setEnrollmentGradeLevel((json.enrollment?.grade_level ?? '').toString());
        setEnrollmentStrand((json.enrollment?.strand ?? '').toString());
        setEnrollmentRemarks((json.enrollment?.registrar_remarks ?? '').toString());
        setSchoolYearCurrent(json.school_year_current ?? null);
        setPriorApproved(priorMeta);
        setIsGraduate(Boolean(json.is_graduate));
        setReEnrollmentEligible(Boolean(json.re_enrollment_eligible));

        const docsUrl =
          docsEnrollmentId > 0
            ? `/api/documents?enrollment_id=${docsEnrollmentId}`
            : "/api/documents";
        const docsRes = await apiFetch(docsUrl);
        const docsText = await docsRes.text();
        const docsJson = JSON.parse(docsText) as {
          success?: boolean;
          documents?: Array<{
            id: number;
            type: string;
            uploaded_at?: string;
            ai_status?: string;
            registrar_doc_decision?: string;
            registrar_doc_remarks?: string;
            /** 0/1 from MySQL — true means the registrar manually reviewed this row. */
            registrar_reviewed?: number | boolean;
            /** Latest attempt number (defaults to 1 if the column is missing on legacy schemas). */
            upload_count?: number | string;
            carried_forward?: number | boolean;
          }>;
        };
        if (docsRes.ok && docsJson.success && Array.isArray(docsJson.documents)) {
          setDocuments((prev) => mergeDocumentsFromApiRows(prev, docsJson.documents as ApiDocumentRow[]));
        }

        const stepFromUrl = new URLSearchParams(window.location.search).get("step");
        const parsedStep = stepFromUrl != null ? parseInt(stepFromUrl, 10) : NaN;
        const lockedNow = json.enrollment != null && json.enrollment.can_edit === false;
        const canUseUrlStep =
          !lockedNow &&
          !Number.isNaN(parsedStep) &&
          parsedStep >= 1 &&
          parsedStep <= 6;
        if (canUseUrlStep) {
          setCurrentStep(parsedStep);
        }
        const nextParams = new URLSearchParams(window.location.search);
        if (nextParams.has("step")) {
          nextParams.delete("step");
          setSearchParams(nextParams, { replace: true });
        }
      } catch {
        // keep defaults when no draft exists / parse errors
      } finally {
        setEnrollmentMetaLoaded(true);
      }
    };
    loadEnrollment();
  }, [setSearchParams, enrollmentReloadKey]);

  const saveEnrollment = async (action: 'save_draft' | 'submit', step: number): Promise<boolean> => {
    setIsSaving(true);
    try {
      const sanitizedForm = sanitizeEnrollmentFormData({
        ...formData,
        municipality: normalizeMunicipalityValue(formData.municipality),
        barangay: normalizeBarangayValue(formData.municipality, formData.barangay),
      });
      setFormData(sanitizedForm);
      const grade12PrefillLocked = isGrade12PrefillLocked({
        grade12PromotionActive,
        schoolYearCurrent,
        priorApprovedSchoolYear: priorApproved?.school_year,
        showNewEnrollmentForm,
        hasConsentedToNewSy:
          typeof window !== "undefined" &&
          schoolYearCurrent !== null &&
          localStorage.getItem(GRADE12_ENROLLMENT_CONSENT_KEY) === schoolYearCurrent,
        gradeLevel: sanitizedForm.gradeLevel,
        enrollmentStatus: sanitizedForm.enrollmentStatus,
      });
      const res = await apiFetch('/api/student/enrollment', {
        method: 'POST',
        body: JSON.stringify({
          action,
          current_step: step,
          form_data: sanitizedForm,
          ...(step >= 4 && (documentsAuthenticityConfirmed || grade12PrefillLocked)
            ? { documents_authenticity_confirmed: true }
            : {}),
        }),
      });
      const text = await res.text();
      const json = JSON.parse(text) as {
        success?: boolean;
        error?: string;
        message?: string;
        enrollment_id?: number;
        status?: string;
        already_submitted?: boolean;
        grade12_blocked_physical_docs?: boolean;
        section_assignment?: {
          assigned?: boolean;
          section?: string | null;
          shift?: string | null;
          kept_section?: boolean;
          shift_changed?: boolean;
        };
      };
      if (!res.ok || !json.success) {
        if (json.grade12_blocked_physical_docs) {
          setGrade12BlockedPhysicalDocs(true);
        }
        toast.error(json.error || `Failed to save enrollment (${res.status})`, {
          duration: json.grade12_blocked_physical_docs ? 10000 : 4000,
        });
        if (res.status === 409) {
          setEnrollmentStatusRaw('pending');
          setShowNewEnrollmentForm(false);
          setIsEnrollmentLocked(true);
          localStorage.setItem('studentEnrollmentLocked', '1');
        }
        return false;
      }
      if (action === 'submit') {
        setEnrollmentStatusRaw((json.status || 'pending').toString());
        if (schoolYearCurrent) {
          setEnrollmentSchoolYear(schoolYearCurrent);
        }
        setNeedsGrade12Confirmation(false);
        setShowNewEnrollmentForm(false);
        setIsEnrollmentLocked(true);
        localStorage.setItem('studentEnrollmentLocked', '1');
        localStorage.removeItem(GRADE12_ENROLLMENT_CONSENT_KEY);
        if (!json.already_submitted) {
          toast.success(json.message || 'Enrollment submitted successfully');
        }
        const sa = json.section_assignment;
        if (sa?.assigned && sa.section) {
          const shiftLabel = sa.shift === "afternoon" ? "afternoon" : "morning";
          if (sa.shift_changed) {
            toast.success(
              `You were placed in section ${sa.section} (${shiftLabel} shift) based on available seats.`,
            );
          } else if (sa.kept_section) {
            toast.success(`You remain in section ${sa.section} (${shiftLabel} shift) for Grade 12.`);
          }
        }
        setEnrollmentReloadKey((key) => key + 1);
      }
      if (json.enrollment_id) {
        const newId = Number(json.enrollment_id);
        setEnrollmentId(newId);
        try {
          const docsRes = await apiFetch(`/api/documents?enrollment_id=${newId}`);
          const docsText = await docsRes.text();
          const docsJson = JSON.parse(docsText) as {
            success?: boolean;
            documents?: Array<{
              id: number;
              type: string;
              uploaded_at?: string;
              ai_status?: string;
              registrar_doc_decision?: string;
              registrar_doc_remarks?: string;
              registrar_reviewed?: number | boolean;
              upload_count?: number | string;
            }>;
          };
          if (docsRes.ok && docsJson.success && Array.isArray(docsJson.documents)) {
            setDocuments((prev) =>
              mergeDocumentsFromApiRows(prev, docsJson.documents as ApiDocumentRow[])
            );
          }
        } catch {
          // non-fatal; student can still upload manually
        }
      }
      return true;
    } catch {
      toast.error('Failed to save enrollment');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const applyUploadedDocuments = (rows: ApiDocumentRow[]) => {
    setDocuments((prev) => mergeDocumentsFromApiRows(prev, rows));
  };

  // Grade 12 step 4: refresh documents after server heal marks rollover copies.
  useEffect(() => {
    if (currentStep !== 4) return;
    if (!grade12PromotionActive) return;
    const eid = enrollmentId;
    if (!eid) return;

    let cancelled = false;
    (async () => {
      try {
        const docsRes = await apiFetch(`/api/documents?enrollment_id=${eid}`);
        const docsText = await docsRes.text();
        const docsJson = JSON.parse(docsText) as {
          success?: boolean;
          documents?: Array<{
            id: number;
            type: string;
            uploaded_at?: string;
            ai_status?: string;
            registrar_doc_decision?: string;
            registrar_doc_remarks?: string;
            registrar_reviewed?: number | boolean;
            upload_count?: number | string;
            carried_forward?: number | boolean;
          }>;
        };
        if (cancelled || !docsRes.ok || !docsJson.success || !Array.isArray(docsJson.documents)) {
          return;
        }
        applyUploadedDocuments(docsJson.documents);
      } catch {
        // keep existing document state
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentStep, grade12PromotionActive, enrollmentId]);

  const startGrade12Enrollment = useCallback(async () => {
    if (grade12BlockedPhysicalDocs) {
      toast.error(
        "Complete your physical document checklist at the registrar before starting Grade 12 enrollment.",
        { duration: 9000 },
      );
      return;
    }
    setIsStartingGrade12(true);
    try {
      const prefill = applyReEnrollmentFormPrefill(
        INITIAL_ENROLLMENT_FORM_DATA,
        priorReenrollFormData ?? priorApproved?.form_data ?? {},
        priorApproved,
        { promoteGrade: true }
      );
      setFormData(prefill);
      setCurrentStep(1);

      const seedRes = await apiFetch("/api/student/enrollment", {
        method: "POST",
        body: JSON.stringify({
          action: "save_draft",
          current_step: 1,
          form_data: prefill,
        }),
      });
      const seedText = await seedRes.text();
      const seedJson = JSON.parse(seedText) as {
        success?: boolean;
        enrollment_id?: number;
        error?: string;
        grade12_blocked_physical_docs?: boolean;
      };
      if (!seedRes.ok || !seedJson.success) {
        if (seedJson.grade12_blocked_physical_docs) {
          setGrade12BlockedPhysicalDocs(true);
        }
        toast.error(seedJson.error || "Could not start your enrollment. Please try again.", {
          duration: seedJson.grade12_blocked_physical_docs ? 10000 : 4000,
        });
        return;
      }

      if (seedJson.enrollment_id) {
        const newId = Number(seedJson.enrollment_id);
        setEnrollmentId(newId);
        try {
          const docsRes = await apiFetch(`/api/documents?enrollment_id=${newId}`);
          const docsText = await docsRes.text();
          const docsJson = JSON.parse(docsText) as {
            success?: boolean;
            documents?: Array<{
              id: number;
              type: string;
              uploaded_at?: string;
              ai_status?: string;
              registrar_doc_decision?: string;
              registrar_doc_remarks?: string;
              registrar_reviewed?: number | boolean;
              upload_count?: number | string;
            }>;
          };
          if (docsRes.ok && docsJson.success && Array.isArray(docsJson.documents)) {
            applyUploadedDocuments(docsJson.documents);
          }
        } catch {
          // Documents can be reloaded on the upload step.
        }
      }

      if (schoolYearCurrent) {
        localStorage.setItem(GRADE12_ENROLLMENT_CONSENT_KEY, schoolYearCurrent);
      }
      setNeedsGrade12Confirmation(false);
      setGrade12PromotionActive(true);
      setShowNewEnrollmentForm(true);
      setIsEnrollmentLocked(false);
      localStorage.removeItem("studentEnrollmentLocked");
      toast.success("Your enrollment form has been pre-filled. Please review each step.");
    } catch {
      toast.error("Could not start your enrollment. Please try again.");
    } finally {
      setIsStartingGrade12(false);
    }
  }, [priorApproved, priorReenrollFormData, schoolYearCurrent, grade12BlockedPhysicalDocs]);

  const declineGrade12Continuation = useCallback(async () => {
    setIsDecliningGrade12(true);
    try {
      const res = await apiFetch("/api/student/enrollment", {
        method: "POST",
        body: JSON.stringify({ action: "decline_grade12_continuation" }),
      });
      const text = await res.text();
      const json = JSON.parse(text) as { success?: boolean; error?: string; message?: string };
      if (!res.ok || !json.success) {
        toast.error(json.error || "Could not save your decision. Please try again.");
        return;
      }
      localStorage.removeItem(GRADE12_ENROLLMENT_CONSENT_KEY);
      setNeedsGrade12Confirmation(false);
      setShowNewEnrollmentForm(false);
      toast.success(
        json.message ||
          "Your decision has been recorded. You can still enroll later from this page if you change your mind.",
      );
    } catch {
      toast.error("Could not save your decision. Please try again.");
    } finally {
      setIsDecliningGrade12(false);
    }
  }, []);

  const UPPERCASE_FIELDS = new Set<keyof EnrollmentFormData>([
    'givenName',
    'middleName',
    'middleInitial',
    'lastName',
    'extensionName',
    'motherGivenName',
    'motherMaidenMiddleName',
    'motherMaidenLastName',
    'fatherGivenName',
    'fatherMiddleName',
    'fatherLastName',
    'guardianGivenName',
    'guardianMiddleName',
    'guardianLastName',
    'motherOccupation',
    'fatherOccupation',
    'relationshipToGuardian',
    'previousSchoolAttended',
    'sectionAtPreviousSchool',
    'lastSchoolYearAttended',
  ]);

  const handleInputChange = (field: keyof EnrollmentFormData, value: string | boolean) => {
    if (typeof value !== "string") {
      setFormData((prev) => ({ ...prev, [field]: value }));
      return;
    }
    const sanitized = sanitizeEnrollmentFieldValue(field, value);
    if (UPPERCASE_FIELDS.has(field)) {
      setFormData((prev) => ({ ...prev, [field]: sanitized.toUpperCase() }));
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: sanitized }));
  };

  const handleMunicipalityChange = (municipality: string) => {
    setFormData((prev) => {
      const nextMunicipality = sanitizeAddressLabelInput(municipality);
      const barangays = getBarangaysForMunicipality(nextMunicipality);
      const knownMunicipality = isKnownNcrMunicipality(nextMunicipality);
      let nextBarangay = prev.barangay;
      if (knownMunicipality && barangays.length > 0) {
        const barangayStillValid =
          barangays.includes(prev.barangay) ||
          !!resolveNcrBarangay(nextMunicipality, prev.barangay);
        if (!barangayStillValid) {
          nextBarangay = "";
        }
      }
      return { ...prev, municipality: nextMunicipality, barangay: nextBarangay };
    });
  };

  const handleBarangayChange = (barangay: string) => {
    handleInputChange("barangay", sanitizeAddressLabelInput(barangay));
  };

  const runDocumentReadabilityCheck = useCallback(async (docIndex: number, documentId: number) => {
    if (!documentId || readabilityInFlightRef.current.has(documentId)) return;
    readabilityInFlightRef.current.add(documentId);
    setDocuments((prev) => {
      const next = [...prev];
      if (next[docIndex]?.uploadedId === documentId) {
        next[docIndex] = {
          ...next[docIndex],
          readabilityCheckPaused: false,
        };
      }
      return next;
    });
    try {
      const res = await apiFetch('/api/documents/screen-readability', {
        method: 'POST',
        body: JSON.stringify({ document_id: documentId }),
      });
      const text = await res.text();
      const json = JSON.parse(text) as {
        success?: boolean;
        error?: string;
        ai_status?: string;
        readability_failed?: boolean;
        retryable?: boolean;
        level?: number;
      };
      if (!res.ok || !json.success) {
        if (json.readability_failed || res.status === 422) {
          readabilityRetryRef.current.delete(documentId);
          setDocuments((prev) => {
            const next = [...prev];
            next[docIndex] = {
              ...next[docIndex],
              status: 'missing',
              file: undefined,
              uploadedId: undefined,
              uploadedAt: undefined,
              aiStatus: undefined,
              readabilityCheckPaused: false,
            };
            return next;
          });
          setDocumentsAuthenticityConfirmed(false);
          toast.error(`Document not readable: ${json.error || 'Upload a clearer photo (JPG or PNG).'}`, {
            duration: 9000,
          });
        } else if (json.retryable || res.status === 503) {
          const attempts = (readabilityRetryRef.current.get(documentId) ?? 0) + 1;
          readabilityRetryRef.current.set(documentId, attempts);
          if (attempts >= 6) {
            setDocuments((prev) => {
              const next = [...prev];
              if (next[docIndex]?.uploadedId === documentId) {
                next[docIndex] = {
                  ...next[docIndex],
                  readabilityCheckPaused: true,
                };
              }
              return next;
            });
            toast.error(
              'Document verification is temporarily unavailable. Tap Retry check on the document, or try again in a few minutes.',
              { duration: 8000 },
            );
            return;
          }
          toast.error(json.error || 'Readability check unavailable. Retrying…', {
            duration: 5000,
          });
          window.setTimeout(() => {
            void runDocumentReadabilityCheck(docIndex, documentId);
          }, 5000);
        } else {
          toast.error(json.error || 'Readability check failed.');
        }
        return;
      }
      readabilityRetryRef.current.delete(documentId);
      setDocuments((prev) => {
        const next = [...prev];
        if (next[docIndex]?.uploadedId === documentId) {
          next[docIndex] = {
            ...next[docIndex],
            aiStatus: json.ai_status || 'pending',
            readabilityCheckPaused: false,
          };
        }
        return next;
      });
    } catch {
      toast.error('Readability check failed. Try uploading again.');
    } finally {
      readabilityInFlightRef.current.delete(documentId);
    }
  }, []);

  useEffect(() => {
    documents.forEach((doc, index) => {
      if (
        doc.status === 'uploaded' &&
        doc.uploadedId &&
        String(doc.aiStatus || '').toLowerCase() === 'screening'
      ) {
        void runDocumentReadabilityCheck(index, doc.uploadedId);
      }
    });
  }, [documents, runDocumentReadabilityCheck]);

  const handleFileUpload = async (index: number, file: File | null) => {
    if (!file) return;
    if (isDocumentUploadTooLarge(file.size)) {
      toast.error(`Maximum file size is ${MAX_DOCUMENT_UPLOAD_LABEL}`);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') {
      toast.error(
        'PDF uploads cannot be verified. Take a clear photo (JPG or PNG) of the document and upload that instead.',
        { duration: 8000 },
      );
      return;
    }
    if (!['jpg', 'jpeg', 'png'].includes(ext)) {
      toast.error('Only JPG and PNG photos are accepted so we can verify your document.');
      return;
    }

    if (isGrade12PromotionFlow && documents[index].status === 'uploaded') {
      toast.error('Documents from your previous enrollment are locked during Grade 12 registration. Contact the registrar if you need to make a change.');
      return;
    }

    const uploadMeta = studentDocumentDisplayMeta(documents[index], {
      enrollmentFinalized,
      isGrade12PromotionFlow,
      isResubmitFlow,
    });
    if (documents[index].status === 'uploaded' && !uploadMeta.allowReupload) {
      toast.error('This document is locked and cannot be replaced. Contact the registrar if you need to make a change.');
      return;
    }

    // Ensure we have an enrollment row before attaching documents.
    let targetEnrollmentId = enrollmentId;
    if (!targetEnrollmentId) {
      const created = await saveEnrollment('save_draft', currentStep);
      if (!created) return;
      try {
        const snapshotRes = await apiFetch('/api/student/enrollment');
        const snapshotText = await snapshotRes.text();
        const snapshotJson = JSON.parse(snapshotText) as { success?: boolean; enrollment?: { id?: number } };
        if (snapshotRes.ok && snapshotJson.success && snapshotJson.enrollment?.id) {
          targetEnrollmentId = Number(snapshotJson.enrollment.id);
          setEnrollmentId(targetEnrollmentId);
        }
      } catch {
        // Keep null and let backend resolve to latest enrollment by user.
      }
    }

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('document_type', documents[index].name);
      if (targetEnrollmentId) {
        form.append('enrollment_id', String(targetEnrollmentId));
      }

      const res = await apiFetch('/api/documents', {
        method: 'POST',
        body: form,
      });
      const text = await res.text();
      const json = JSON.parse(text) as {
        success?: boolean;
        error?: string;
        level?: number;
        limit_reached?: boolean;
        attempts_used?: number;
        attempt_limit?: number;
        requirement_label?: string;
        email_sent?: boolean;
        document?: {
          id?: number;
          uploaded_at?: string;
          upload_count?: number;
          attempts_remaining?: number | null;
          resubmit_attempt?: boolean;
          attempt_limit?: number;
        };
      };
      if (!res.ok || !json.success) {
        // 429 with limit_reached: lock the row, surface a long-form toast
        // pointing to the email we just sent and the in-person workflow.
        if (res.status === 429 && json.limit_reached) {
          toast.error(
            json.error ||
              `You've used all ${json.attempt_limit ?? UPLOAD_ATTEMPT_LIMIT} resubmit attempts for this document. Please bring the original to the registrar.`,
            { duration: 12000 }
          );
          setDocuments(prev => {
            const next = [...prev];
            next[index] = {
              ...next[index],
              // Pin upload_count to the limit so the UI shows "5 of 5" and
              // the re-upload button stays disabled until the registrar
              // verifies the document in person.
              uploadCount: json.attempt_limit ?? UPLOAD_ATTEMPT_LIMIT,
            };
            return next;
          });
          return;
        }
        const msg = json.error || `Upload failed (${res.status})`;
        if (json.level === 2) {
          toast.error(`Document not readable: ${msg}`, { duration: 9000 });
        } else if (json.level === 1) {
          toast.error(`Image quality: ${msg}`, { duration: 8000 });
        } else {
          toast.error(msg);
        }
        return;
      }

      // Heads-up only after registrar rejection (resubmit phase).
      const remaining = json.document?.attempts_remaining;
      if (remaining != null && remaining === 0) {
        toast.warning(
          'This was your last resubmit attempt for this requirement. If the registrar still rejects it, you will need to bring the original document in person.',
          { duration: 10000 }
        );
      } else if (remaining != null && remaining > 0 && remaining <= 2) {
        toast.info(
          `You have ${remaining} resubmit attempt${remaining === 1 ? '' : 's'} left for this requirement.`,
          { duration: 6000 }
        );
      }

      setDocuments(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          file,
          status: 'uploaded',
          uploadedId: Number(json.document?.id ?? 0) || undefined,
          uploadedAt: json.document?.uploaded_at ?? new Date().toISOString(),
          aiStatus: json.document?.ai_status ?? 'screening',
          registrarDecision: '',
          registrarRemarks: '',
          registrarReviewed: false,
          uploadCount: Math.max(0, Number(json.document?.upload_count ?? 0) || 0),
          carriedForward: false,
        };
        return next;
      });
      setDocumentsAuthenticityConfirmed(false);
      toast.success(`${documents[index].name} uploaded — checking readability…`);
      const uploadedDocId = Number(json.document?.id ?? 0);
      if (uploadedDocId > 0) {
        void runDocumentReadabilityCheck(index, uploadedDocId);
      }
    } catch {
      toast.error('Failed to upload document');
    }
  };

  const validateStep1 = () => {
    const required = [
      'enrollmentStatus',
      'givenName',
      'lastName',
      'gender',
      'contactNumber',
      'email',
      'lrn',
      'gradeLevel',
      'strand',
      'preferredSchedule',
      'birthDate',
      'birthPlace',
      'religion',
      'municipality',
      'barangay',
      'street',
    ];
    for (const field of required) {
      if (!formData[field as keyof EnrollmentFormData]) {
        toast.error(`Please fill in all required fields`);
        return false;
      }
    }
    const birthDateErr = birthDateValidationError(
      formData.birthDate,
      SHS_MIN_AGE_YEARS,
      SHS_MAX_AGE_YEARS,
    );
    if (birthDateErr) {
      toast.error(birthDateErr);
      return false;
    }
    if (!hasValidPersonName(formData.givenName)) {
      toast.error("First name must contain letters only (no numbers).");
      return false;
    }
    if (!hasValidPersonName(formData.middleName)) {
      toast.error("Middle name must contain letters only (no numbers).");
      return false;
    }
    if (!hasValidPersonName(formData.lastName)) {
      toast.error("Last name must contain letters only (no numbers).");
      return false;
    }
    if (
      formData.extensionName.trim() &&
      !/^[A-Za-zñÑ.\s,]+$/.test(formData.extensionName.trim())
    ) {
      toast.error("Extension name must use letters only (e.g. Jr., III).");
      return false;
    }
    if (!isValidPhilippineMobileNumber(formData.contactNumber)) {
      toast.error("Contact number must be 11 digits starting with 09.");
      return false;
    }
    if (!isValidEnrollmentLrn(formData.lrn)) {
      toast.error("LRN must be exactly 12 digits (numbers only).");
      return false;
    }
    if (!hasValidAddressLabel(formData.municipality)) {
      toast.error("Please enter your city / municipality.");
      return false;
    }
    if (!hasValidAddressLabel(formData.barangay)) {
      toast.error("Please enter your barangay.");
      return false;
    }
    return true;
  };

  const getMissingParentParts = (): string[] => {
    const parts: string[] = [];
    if (!formData.motherGivenName.trim()) parts.push("Mother");
    if (!formData.fatherGivenName.trim()) parts.push("Father");
    return parts;
  };

  const validateStep2 = () => {
    const motherName = formData.motherGivenName.trim();
    const fatherName = formData.fatherGivenName.trim();
    const guardianName = formData.guardianGivenName.trim();
    const hasMother = motherName.length > 0;
    const hasFather = fatherName.length > 0;
    const hasGuardianFilled = formData.hasGuardian && guardianName.length > 0;

    // Still require at least one contact name overall so the registrar has a responsible party.
    if (!hasMother && !hasFather && !hasGuardianFilled) {
      toast.error("Please provide at least one parent or guardian name.");
      return false;
    }

    if (!formData.emergencyContact) {
      toast.error('Please select who to contact in case of emergency.');
      return false;
    }

    if (formData.emergencyContact === 'mother' && !hasMother) {
      toast.error("Emergency contact is Mother, but mother's first name was not provided.");
      return false;
    }
    if (formData.emergencyContact === 'father' && !hasFather) {
      toast.error("Emergency contact is Father, but father's first name was not provided.");
      return false;
    }
    if (formData.emergencyContact === 'guardian') {
      if (!formData.hasGuardian) {
        toast.error('To use Guardian as emergency contact, check "I have a guardian" and enter their details.');
        return false;
      }
      if (!guardianName) {
        toast.error("Emergency contact is Guardian, but guardian's first name was not provided.");
        return false;
      }
    }

    const nameChecks: Array<{ value: string; label: string }> = [];
    if (hasMother) {
      nameChecks.push(
        { value: formData.motherGivenName, label: "Mother's first name" },
        { value: formData.motherMaidenMiddleName, label: "Mother's middle name" },
        { value: formData.motherMaidenLastName, label: "Mother's last name" },
      );
    }
    if (hasFather) {
      nameChecks.push(
        { value: formData.fatherGivenName, label: "Father's first name" },
        { value: formData.fatherMiddleName, label: "Father's middle name" },
        { value: formData.fatherLastName, label: "Father's last name" },
      );
    }
    if (hasGuardianFilled) {
      nameChecks.push(
        { value: formData.guardianGivenName, label: "Guardian's first name" },
        { value: formData.guardianMiddleName, label: "Guardian's middle name" },
        { value: formData.guardianLastName, label: "Guardian's last name" },
      );
    }
    for (const { value, label } of nameChecks) {
      if (value.trim() && !hasValidPersonName(value)) {
        toast.error(`${label} must contain letters only (no numbers).`);
        return false;
      }
    }

    const phoneChecks: Array<{ value: string; label: string }> = [
      { value: formData.motherContactNumber, label: "Mother's contact number" },
      { value: formData.fatherContactNumber, label: "Father's contact number" },
      { value: formData.guardianContactNumber, label: "Guardian's contact number" },
    ];
    for (const { value, label } of phoneChecks) {
      if (value.trim() && !isValidPhilippineMobileNumber(value)) {
        toast.error(`${label} must be 11 digits starting with 09.`);
        return false;
      }
    }

    const textOnlyChecks: Array<{ value: string; label: string; when?: boolean }> = [
      { value: formData.motherOccupation, label: "Mother's occupation" },
      { value: formData.fatherOccupation, label: "Father's occupation" },
      {
        value: formData.relationshipToGuardian,
        label: "Relationship to guardian",
        when: hasGuardianFilled,
      },
    ];
    for (const { value, label, when } of textOnlyChecks) {
      if (when === false) continue;
      if (value.trim() && !hasValidTextOnlyContent(value)) {
        toast.error(`${label} must contain letters only (no numbers).`);
        return false;
      }
    }

    return true;
  };

  const validateStep3 = () => {
    if (
      formData.previousSchoolAttended.trim() &&
      !hasValidTextOnlyContent(formData.previousSchoolAttended)
    ) {
      toast.error("Previous school name must contain letters only (no numbers).");
      return false;
    }
    if (
      formData.sectionAtPreviousSchool.trim() &&
      !hasValidSectionLabel(formData.sectionAtPreviousSchool)
    ) {
      toast.error(
        "Section must include letters (e.g. A, 10-A). Long numbers-only values are not allowed.",
      );
      return false;
    }
    if (
      formData.lastSchoolYearAttended.trim() &&
      !isValidSchoolYearAttended(formData.lastSchoolYearAttended)
    ) {
      toast.error("Last school year must be a valid year (e.g. 2023 or 2023-2024).");
      return false;
    }
    return true;
  };

  const validateStep4 = () => {
    const requiredDocs = documents.filter(doc => {
      if (doc.requiredFor === 'all') return true;
      if (doc.requiredFor === 'transferee' && formData.enrollmentStatus === 'transferee') return true;
      return false;
    });

    const missingDocs = requiredDocs.filter(doc => doc.status !== 'uploaded');
    
    if (missingDocs.length > 0) {
      toast.error(`Please upload all required documents: ${missingDocs.map(d => d.name).join(', ')}`);
      return false;
    }

    const screeningDocs = requiredDocs.filter(
      (doc) => doc.status === 'uploaded' && String(doc.aiStatus || '').toLowerCase() === 'screening',
    );
    if (screeningDocs.length > 0) {
      const paused = screeningDocs.some((doc) => doc.readabilityCheckPaused);
      toast.error(
        paused
          ? 'Document verification is temporarily unavailable. Tap Retry check on the affected document(s), or try again in a few minutes.'
          : 'Document readability checks are still in progress. Please wait a moment.',
      );
      return false;
    }
    if (!documentsAuthenticityConfirmed) {
      const grade12PrefillLocked = isGrade12PrefillLocked({
        grade12PromotionActive,
        schoolYearCurrent,
        priorApprovedSchoolYear: priorApproved?.school_year,
        showNewEnrollmentForm,
        hasConsentedToNewSy:
          typeof window !== "undefined" &&
          schoolYearCurrent !== null &&
          localStorage.getItem(GRADE12_ENROLLMENT_CONSENT_KEY) === schoolYearCurrent,
        gradeLevel: formData.gradeLevel,
        enrollmentStatus: formData.enrollmentStatus,
      });
      if (!grade12PrefillLocked) {
        toast.error(
          'Please confirm that your uploaded documents are genuine and have not been altered or falsified.',
        );
        return false;
      }
    }
    return true;
  };

  const advanceToNextStep = async () => {
    const ok = await saveEnrollment('save_draft', currentStep);
    if (!ok) return;
    setCurrentStep((prev) => Math.min(prev + 1, 6));
  };

  const handleNext = async () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2) {
      if (!validateStep2()) return;
      const missing = getMissingParentParts();
      if (missing.length > 0) {
        setMissingParentParts(missing);
        setMissingParentDialogOpen(true);
        return;
      }
    }
    if (currentStep === 3 && !validateStep3()) return;
    if (currentStep === 4 && !validateStep4()) return;
    await advanceToNextStep();
  };

  const handleMissingParentContinue = async () => {
    setMissingParentDialogOpen(false);
    setMissingParentParts([]);
    await advanceToNextStep();
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (submitInFlightRef.current || isEnrollmentLocked || isSaving) return;
    if (!validateStep1()) return;
    if (!validateStep2()) return;
    if (!validateStep3()) return;
    if (!validateStep4()) return;
    if (!formData.modeOfPayment?.trim()) {
      toast.error('Please select a mode of payment (Payment & Promo step).');
      return;
    }
    if (!formData.confirmInformation) {
      toast.error('Please confirm that all information is accurate');
      return;
    }
    submitInFlightRef.current = true;
    try {
      await saveEnrollment('submit', 6);
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const tabs = [
    { number: 1, name: 'Personal Information', icon: User },
    { number: 2, name: 'Family Information', icon: Users },
    { number: 3, name: 'Enrollment History', icon: GraduationCap },
    { number: 4, name: 'Requirements Upload', icon: Upload },
    { number: 5, name: 'Payment & Promo', icon: DollarSign },
    { number: 6, name: 'Review & Submit', icon: FileCheck },
  ];

  // Decide what to render before the form: the form is shown only when
  // (a) enrollment is allowed (school year open) AND
  // (b) the student is not in a locked state for the current SY AND
  // (c) the student is not a graduate.
  // When (b) is locked, show a status card driven by the actual enrollment
  // status (Enrolled / Rejected / Under review). When the SY has rolled
  // and the student is eligible to re-enroll, surface a CTA on top of the
  // status card and (on click) start a fresh enrollment for the new SY.
  const status = (enrollmentStatusRaw || '').toLowerCase().trim();

  // The "show form" override lets a re-enrollment-eligible student click
  // through to the blank form. Without it, the locked branch wins because
  // the latest row in the DB is still the previous SY's approved row.
  // Allow resubmission flow to bypass the locked status card and open the upload step.
  const isResubmitFlow = searchParams.get('resubmit') === '1';
  const lockedView = enrollmentAllowed && isEnrollmentLocked && !showNewEnrollmentForm && !isResubmitFlow;

  const promoteToGradeLabel = useMemo(() => {
    const g = priorApproved?.grade_level_number ?? 0;
    if (g === 11) return "Grade 12";
    if (g >= 7 && g < 12) return `Grade ${g + 1}`;
    if (g >= 12) return "Grade 12";
    return "the next grade level";
  }, [priorApproved?.grade_level_number]);

  const hasConsentedToNewSy =
    typeof window !== "undefined" &&
    schoolYearCurrent !== null &&
    localStorage.getItem(GRADE12_ENROLLMENT_CONSENT_KEY) === schoolYearCurrent;

  const isGrade12PromotionFlow =
    formData.gradeLevel === "12" &&
    (grade12PromotionActive ||
      (schoolYearCurrent !== null &&
        priorApproved?.school_year !== "" &&
        priorApproved?.school_year !== schoolYearCurrent &&
        (showNewEnrollmentForm || hasConsentedToNewSy)));

  const hasInProgressCurrentSyEnrollment =
    schoolYearCurrent !== null &&
    enrollmentSchoolYear === schoolYearCurrent &&
    (status === "draft" ||
      status === "pending" ||
      status === "under_review" ||
      status === "under review" ||
      status === "review" ||
      status === "rejected");

  const hasSubmittedCurrentSyApplication =
    schoolYearCurrent !== null &&
    enrollmentId > 0 &&
    (status === "enrolled" ||
      status === "approved" ||
      status === "pending" ||
      status === "under_review" ||
      status === "under review" ||
      status === "review") &&
    (enrollmentSchoolYear === schoolYearCurrent ||
      formData.gradeLevel === "12" ||
      grade12PromotionActive);

  const showGrade12PhysicalDocsBlock =
    enrollmentAllowed &&
    grade12BlockedPhysicalDocs &&
    !isGraduate &&
    !showNewEnrollmentForm &&
    !isResubmitFlow &&
    schoolYearCurrent !== null;

  const showGrade12Prompt =
    enrollmentAllowed &&
    needsGrade12Confirmation &&
    !grade12BlockedPhysicalDocs &&
    !hasInProgressCurrentSyEnrollment &&
    !hasSubmittedCurrentSyApplication &&
    !showNewEnrollmentForm &&
    !isResubmitFlow &&
    schoolYearCurrent !== null;

  const isEnrolled =
    (status === "approved" || status === "enrolled") && !showGrade12Prompt;
  const isRejected = status === "rejected";
  const isPending =
    status === "pending" ||
    status === "under_review" ||
    status === "under review" ||
    status === "review";

  const lockGrade12PrefilledSections = isGrade12PrefillLocked({
    grade12PromotionActive,
    schoolYearCurrent,
    priorApprovedSchoolYear: priorApproved?.school_year,
    showNewEnrollmentForm,
    hasConsentedToNewSy,
    gradeLevel: formData.gradeLevel,
    enrollmentStatus: formData.enrollmentStatus,
  });

  const lockEnrollmentHistory = lockGrade12PrefilledSections;

  const isPermanentlyLockedField = lockGrade12PrefilledSections;
  const lockPreferredScheduleField = lockGrade12PrefilledSections && !isGrade12PromotionFlow;

  const enrollmentFinalized = isEnrolled;

  if (isGraduate && !lockedView && !showGrade12Prompt) {
    return (
      <div className="min-h-[min(520px,calc(100vh-8rem))] flex flex-col items-center justify-center px-6 py-16 bg-gray-50">
        <Card className="w-full max-w-md border border-gray-200 shadow-sm">
          <CardContent className="pt-12 pb-12 px-8 text-center">
            <GraduationCap className="h-12 w-12 text-[#2D5016] mx-auto mb-6" aria-hidden />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">You have completed Senior High</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Your records show you were approved for Grade 12{priorApproved?.school_year ? ` (SY ${priorApproved.school_year})` : ''}.
              Re-enrollment from the student portal is no longer available. For transcripts or
              certifications, please contact the registrar's office.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showGrade12PhysicalDocsBlock) {
    const priorSy =
      grade12PhysicalDocs?.priorSchoolYear ||
      priorApproved?.school_year ||
      enrollmentSchoolYear;
    const missingCount = grade12PhysicalDocs?.missingCount ?? 0;
    const missingLabels = grade12PhysicalDocs?.missingLabels ?? [];

    return (
      <div className="min-h-[min(520px,calc(100vh-8rem))] flex flex-col items-center justify-center px-6 py-16 bg-gray-50">
        <Card className="w-full max-w-xl border border-amber-300 shadow-sm">
          <CardContent className="pt-12 pb-10 px-8">
            <AlertCircle className="h-12 w-12 text-amber-700 mx-auto mb-6" aria-hidden />
            <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">
              Physical documents required before Grade 12
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              You must submit all required original documents in person to the registrar
              {priorSy ? (
                <>
                  {" "}
                  for your Grade 11 enrollment (SY <strong>{priorSy}</strong>)
                </>
              ) : null}{" "}
              before you can enroll in Grade 12 for SY <strong>{schoolYearCurrent}</strong>.
            </p>
            {missingCount > 0 ? (
              <p className="mt-3 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <span className="font-semibold">
                  {missingCount} item{missingCount === 1 ? "" : "s"} still missing
                </span>
                {missingLabels.length > 0 ? (
                  <span className="block mt-1 text-amber-950">
                    {missingLabels.slice(0, 4).join(" · ")}
                    {missingLabels.length > 4 ? " · …" : ""}
                  </span>
                ) : null}
              </p>
            ) : null}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white">
                <Link to="/student/application-status#physical-documents">
                  View physical document checklist
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showGrade12Prompt) {
    const priorSy = priorApproved?.school_year || enrollmentSchoolYear;
    const priorGrade =
      priorApproved?.grade_level?.replace(/[^0-9]/g, "") ||
      enrollmentGradeLevel.replace(/[^0-9]/g, "") ||
      "11";
    const priorStrand = priorApproved?.strand || enrollmentStrand;

    return (
      <div className="min-h-[min(520px,calc(100vh-8rem))] flex flex-col items-center justify-center px-6 py-16 bg-gray-50">
        <Card className="w-full max-w-xl border border-gray-200 shadow-sm">
          <CardContent className="pt-12 pb-10 px-8 text-center">
            <GraduationCap className="h-12 w-12 text-[#2D5016] mx-auto mb-6" aria-hidden />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Continue to {promoteToGradeLabel}?
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed text-left">
              Enrollment for school year <strong>{schoolYearCurrent}</strong> is now open.
              {priorSy ? (
                <>
                  {" "}
                  You are currently enrolled in <strong>Grade {priorGrade}</strong>
                  {priorStrand ? ` (${priorStrand})` : ""} for SY <strong>{priorSy}</strong>.
                </>
              ) : null}
            </p>
            <p className="text-sm text-gray-700 mt-4 text-left">
              Do you wish to proceed with enrollment for <strong>{promoteToGradeLabel}</strong> in SY{" "}
              <strong>{schoolYearCurrent}</strong>? If you continue, your previous application will be
              pre-filled so you can review and update it before submitting.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                type="button"
                variant="outline"
                className="border-gray-300"
                disabled={isStartingGrade12 || isDecliningGrade12}
                onClick={() => void declineGrade12Continuation()}
              >
                {isDecliningGrade12 ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  "Not continuing to Grade 12"
                )}
              </Button>
              <Button
                type="button"
                className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
                disabled={isStartingGrade12}
                onClick={() => void startGrade12Enrollment()}
              >
                {isStartingGrade12 ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Starting…
                  </>
                ) : (
                  `Yes, proceed to ${promoteToGradeLabel}`
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (lockedView) {
    const showReEnrollCta = reEnrollmentEligible && schoolYearCurrent && !newSchoolYearReenrollment;
    const headerLine = isEnrolled
      ? `Enrolled — SY ${enrollmentSchoolYear || '—'}`
      : isRejected
        ? `Application rejected — SY ${enrollmentSchoolYear || '—'}`
        : `Application under review — SY ${enrollmentSchoolYear || '—'}`;
    return (
      <div className="min-h-[min(520px,calc(100vh-8rem))] flex flex-col items-center justify-center px-6 py-16 bg-gray-50">
        <Card className="w-full max-w-xl border border-gray-200 shadow-sm">
          <CardContent className="pt-12 pb-12 px-8 text-center">
            {isEnrolled ? (
              <CheckCircle className="h-12 w-12 text-[#2D5016] mx-auto mb-6" aria-hidden />
            ) : isRejected ? (
              <AlertCircle className="h-12 w-12 text-[#8B1538] mx-auto mb-6" aria-hidden />
            ) : null}
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{headerLine}</h2>

            {isEnrolled && (
              <>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {`You are enrolled${enrollmentGradeLevel ? ` in Grade ${enrollmentGradeLevel.replace(/[^0-9]/g, '') || enrollmentGradeLevel}` : ''}${enrollmentStrand ? ` ${enrollmentStrand}` : ''} for school year ${enrollmentSchoolYear || ''}.`}
                </p>
                <p className="text-sm text-gray-700 mt-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-left">
                  <span className="block text-xs font-semibold text-amber-900 mb-1">
                    Physical documents
                  </span>
                  Hand-deliver the original copies of your required documents to the
                  registrar's office. Check <strong>Application Status</strong> for your checklist.
                </p>
              </>
            )}

            {isRejected && (
              <>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Your enrollment application for SY {enrollmentSchoolYear || ''} was not approved.
                </p>
                {enrollmentRemarks && (
                  <p className="text-sm text-gray-700 mt-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-left whitespace-pre-wrap">
                    <span className="block text-xs font-medium text-gray-500 mb-1">Registrar's remarks</span>
                    {enrollmentRemarks}
                  </p>
                )}
              </>
            )}

            {isPending && (
              <p className="text-sm text-gray-600 leading-relaxed">
                Your enrollment has been submitted and is being processed. The Registrar&apos;s office will review your application.
              </p>
            )}

            {showReEnrollCta && (
              <div className="mt-8 border-t border-gray-200 pt-6">
                <p className="text-sm text-gray-700 mb-3">
                  Enrollment for school year <span className="font-semibold">{schoolYearCurrent}</span> is now open.
                </p>
                <Button
                  type="button"
                  className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
                  onClick={() => void startGrade12Enrollment()}
                  disabled={isStartingGrade12}
                >
                  {isStartingGrade12 ? "Starting…" : `Proceed to ${promoteToGradeLabel}`}
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Your previous application will be pre-filled for the new school year.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (enrollmentBlocked && !lockedView && !showGrade12Prompt && !isGraduate) {
    return (
      <div className="p-6">
        <EnrollmentGuard
          message="Enrollment is currently unavailable because there is no active school year. An administrator must open enrollment in School Year Management before you can submit an application."
        />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {enrollmentAllowed && showNewEnrollmentForm && schoolYearCurrent && !showGrade12Prompt && (
        <div className="px-6 pt-6">
          <Alert className="border-[#2D5016]/30 bg-[#2D5016]/5">
            <AlertDescription className="text-sm text-gray-800">
              Enrollment for school year <strong>{schoolYearCurrent}</strong> is open.
              Your application has been pre-filled from
              {priorApproved?.school_year ? ` SY ${priorApproved.school_year}` : " your last enrollment"}.
              Review each step, update anything that changed, then submit.
            </AlertDescription>
          </Alert>
        </div>
      )}
      {/* Step Indicator */}
      <div className="border-b bg-white px-4 py-4 sm:px-6 sm:py-8">
        <div className="w-full">
          {/* Mobile: compact progress */}
          <div className="md:hidden">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-[#2D5016]">
                Step {currentStep} of {tabs.length}
              </span>
              <span className="truncate pl-3 text-right text-gray-600">
                {tabs[currentStep - 1]?.name}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[#2D5016] transition-all duration-300"
                style={{ width: `${(currentStep / tabs.length) * 100}%` }}
              />
            </div>
          </div>
          {/* Tablet/desktop: full stepper */}
          <div className="hidden items-center justify-between md:flex">
            {tabs.map((tab, index) => {
              const isActive = currentStep === tab.number;
              const isCompleted = currentStep > tab.number;
              
              return (
                <div key={tab.number} className="flex flex-1 items-center">
                  <div className="flex flex-1 flex-col items-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-[#2D5016] text-white ring-4 ring-[#2D5016]/20'
                          : isCompleted
                          ? 'bg-[#2D5016] text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        tab.number
                      )}
                    </div>
                    <p
                      className={`mt-2 hidden text-center text-xs font-medium lg:block ${
                        isActive
                          ? 'text-[#2D5016]'
                          : isCompleted
                          ? 'text-gray-700'
                          : 'text-gray-400'
                      }`}
                    >
                      {tab.name}
                    </p>
                  </div>
                  {index < tabs.length - 1 && (
                    <div className="mx-2 -mt-8 h-0.5 flex-1">
                      <div
                        className={`h-full ${
                          currentStep > tab.number ? 'bg-[#2D5016]' : 'bg-gray-200'
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="min-h-0 bg-gray-50 p-4 sm:p-6">
        {/* Step 1: Personal Information */}
        {currentStep === 1 && (
          <div className="w-full space-y-6">
            <Card>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <h2 className="text-2xl font-semibold mb-6">Personal Information</h2>
                
                {/* Enrollment Status */}
                <div className="mb-6">
                  <RequiredLabel className="mb-3 block">Enrollment Status</RequiredLabel>
                  <div className="flex flex-wrap gap-3 sm:gap-4">
                    {['old', 'new', 'transferee'].map((status) => (
                      <label key={status} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="enrollmentStatus"
                          value={status}
                          checked={formData.enrollmentStatus === status}
                          onChange={(e) => handleInputChange('enrollmentStatus', e.target.value)}
                          disabled={isPermanentlyLockedField}
                          className="w-4 h-4 text-[#8B1538] border-gray-300 focus:ring-[#8B1538] disabled:opacity-100"
                        />
                        <span className="capitalize">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="givenName">First Name</RequiredLabel>
                    <Input
                      id="givenName"
                      value={formData.givenName}
                      onChange={(e) => handleInputChange('givenName', e.target.value)}
                      placeholder="Enter first name"
                      disabled={isPermanentlyLockedField}
                      className={`uppercase${isPermanentlyLockedField ? lockedPrefillInputClass : ""}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="middleName">Middle Name</RequiredLabel>
                    <Input
                      id="middleName"
                      value={formData.middleName}
                      onChange={(e) => handleInputChange('middleName', e.target.value)}
                      placeholder="Enter middle name"
                      required
                      disabled={isPermanentlyLockedField}
                      className={`uppercase${isPermanentlyLockedField ? lockedPrefillInputClass : ""}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="middleInitial">Middle Initial</RequiredLabel>
                    <Input
                      id="middleInitial"
                      value={formData.middleInitial}
                      onChange={(e) => handleInputChange('middleInitial', e.target.value)}
                      placeholder="M.I."
                      maxLength={2}
                      required
                      disabled={isPermanentlyLockedField}
                      className={`uppercase${isPermanentlyLockedField ? lockedPrefillInputClass : ""}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="lastName">Last Name</RequiredLabel>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      placeholder="Enter last name"
                      disabled={isPermanentlyLockedField}
                      className={`uppercase${isPermanentlyLockedField ? lockedPrefillInputClass : ""}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extensionName">Extension Name (if applicable)</Label>
                    <Input
                      id="extensionName"
                      value={formData.extensionName}
                      onChange={(e) => handleInputChange('extensionName', e.target.value)}
                      placeholder="Jr., Sr., III, etc."
                      disabled={isPermanentlyLockedField}
                      className={`uppercase${isPermanentlyLockedField ? lockedPrefillInputClass : ""}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="gender">Gender</RequiredLabel>
                    <select
                      id="gender"
                      value={formData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      disabled={isPermanentlyLockedField}
                      className={`w-full h-10 px-3 rounded-md border border-gray-300 text-sm ${
                        isPermanentlyLockedField
                          ? lockedPrefillSelectClass
                          : "bg-white focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
                      }`}
                    >
                      <option value="">Select Gender</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="contactNumber">Contact Number</RequiredLabel>
                    <Input
                      id="contactNumber"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={formData.contactNumber}
                      onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                      placeholder="09XXXXXXXXX"
                      maxLength={11}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="email">Email Address</RequiredLabel>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="your.email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="lrn">LRN (Learner Reference Number)</RequiredLabel>
                    <Input
                      id="lrn"
                      type="text"
                      inputMode="numeric"
                      value={formData.lrn}
                      onChange={(e) => handleInputChange('lrn', e.target.value)}
                      placeholder="12 digit LRN"
                      maxLength={12}
                      disabled={isPermanentlyLockedField}
                      className={isPermanentlyLockedField ? lockedPrefillInputClass.trim() : undefined}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address Section */}
            <Card>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <h3 className="text-xl font-semibold mb-4">Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="blockLotHouseNo">Block/Lot No./House No.</Label>
                    <Input
                      id="blockLotHouseNo"
                      value={formData.blockLotHouseNo}
                      onChange={(e) => handleInputChange('blockLotHouseNo', e.target.value)}
                      placeholder="Enter block/lot/house no."
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="street">Street</RequiredLabel>
                    <Input
                      id="street"
                      value={formData.street}
                      onChange={(e) => handleInputChange('street', e.target.value)}
                      placeholder="Enter street"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compoundSubdivisionVillage">Compound/Subdivision/Village</Label>
                    <Input
                      id="compoundSubdivisionVillage"
                      value={formData.compoundSubdivisionVillage}
                      onChange={(e) => handleInputChange('compoundSubdivisionVillage', e.target.value)}
                      placeholder="Enter compound/subdivision/village"
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="municipality">City / Municipality</RequiredLabel>
                    <Combobox
                      id="municipality"
                      value={formData.municipality}
                      onChange={handleMunicipalityChange}
                      options={NCR_MUNICIPALITIES}
                      placeholder="Select or type city / municipality"
                      ariaLabel="Show city / municipality options"
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="barangay">Barangay</RequiredLabel>
                    <Combobox
                      id="barangay"
                      value={formData.barangay}
                      onChange={handleBarangayChange}
                      options={addressBarangayOptions}
                      placeholder={
                        formData.municipality.trim()
                          ? "Select or type barangay"
                          : "Enter city / municipality first"
                      }
                      disabled={!formData.municipality.trim()}
                      ariaLabel="Show barangay options"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Birth Information & Academic Details */}
            <Card>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <h3 className="text-xl font-semibold mb-4">Birth Information & Academic Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="birthDate">Birth Date</RequiredLabel>
                    <Input
                      id="birthDate"
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => handleInputChange('birthDate', e.target.value)}
                      min={shsBirthDateBounds.min}
                      max={shsBirthDateBounds.max}
                      disabled={isPermanentlyLockedField}
                      className={isPermanentlyLockedField ? lockedPrefillInputClass.trim() : undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="birthPlace">Birth Place</RequiredLabel>
                    <select
                      id="birthPlace"
                      value={isBirthPlaceOther ? "__OTHER__" : (formData.birthPlace || "")}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__OTHER__") {
                          handleInputChange("birthPlace", "");
                        } else {
                          handleInputChange("birthPlace", v);
                        }
                      }}
                      disabled={isPermanentlyLockedField}
                      className={`w-full h-10 px-3 rounded-md border border-gray-300 text-sm ${
                        isPermanentlyLockedField
                          ? lockedPrefillSelectClass
                          : "bg-white focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
                      }`}
                    >
                      <option value="">Select birth place</option>
                      {NCR_MUNICIPALITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__OTHER__">Other (type manually)</option>
                    </select>
                    {isBirthPlaceOther || formData.birthPlace === "" ? (
                      <Input
                        value={formData.birthPlace}
                        onChange={(e) => handleInputChange("birthPlace", e.target.value)}
                        placeholder="If not in NCR, type your birth place"
                        disabled={isPermanentlyLockedField}
                        className={isPermanentlyLockedField ? lockedPrefillInputClass.trim() : undefined}
                      />
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="religion">Religion</RequiredLabel>
                    <select
                      id="religion"
                      value={formData.religion}
                      onChange={(e) => handleInputChange('religion', e.target.value)}
                      disabled={isPermanentlyLockedField}
                      className={`w-full h-10 px-3 rounded-md border border-gray-300 text-sm ${
                        isPermanentlyLockedField
                          ? lockedPrefillSelectClass
                          : "bg-white focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
                      }`}
                    >
                      <option value="">Select Religion</option>
                      <option value="Roman Catholic">Roman Catholic</option>
                      <option value="INC (Iglesia Ni Cristo)">INC (Iglesia Ni Cristo)</option>
                      <option value="Buddhism">Buddhism</option>
                      <option value="Hinduism">Hinduism</option>
                      <option value="Christianity">Christianity</option>
                      <option value="Islam">Islam</option>
                      <option value="Indigenous Religion">Indigenous Religion</option>
                      <option value="Judaism">Judaism</option>
                      <option value="Sikhism">Sikhism</option>
                      <option value="Taoism">Taoism</option>
                      <option value="No Religion">No Religion</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel>Grade Level to Enroll In</RequiredLabel>
                    <div className="flex gap-4 pt-2">
                      {['11', '12'].map((grade) => (
                        <label key={grade} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="gradeLevel"
                            value={grade}
                            checked={formData.gradeLevel === grade}
                            onChange={(e) => handleInputChange('gradeLevel', e.target.value)}
                            disabled={isPermanentlyLockedField}
                            className="w-4 h-4 text-[#8B1538] border-gray-300 focus:ring-[#8B1538] disabled:opacity-100"
                          />
                          <span>Grade {grade}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="strand">Strand</RequiredLabel>
                    <select
                      id="strand"
                      value={formData.strand}
                      onChange={(e) => handleInputChange('strand', e.target.value)}
                      disabled={isPermanentlyLockedField}
                      className={`w-full h-10 px-3 rounded-md border border-gray-300 text-sm ${
                        isPermanentlyLockedField
                          ? lockedPrefillSelectClass
                          : "bg-white focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
                      }`}
                    >
                      <option value="STEM">STEM</option>
                      <option value="HUMSS">HUMSS</option>
                      <option value="ABM">ABM</option>
                      <option value="TVL - ICT">TVL - ICT</option>
                      <option value="TVL - EIM">TVL - EIM</option>
                      <option value="TVL - BPP/FBS">TVL - BPP/FBS</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="preferredSchedule">Preferred Schedule</RequiredLabel>
                    {isGrade12PromotionFlow && currentStudentSection ? (
                      <p className="text-xs text-gray-600 leading-relaxed">
                        You stay in section <span className="font-semibold">{currentStudentSection}</span> for Grade 12
                        unless you change your class time below. If you switch to morning or afternoon, the system
                        places you in the section with the most available seats for your chosen shift.
                      </p>
                    ) : null}
                    <select
                      id="preferredSchedule"
                      value={formData.preferredSchedule}
                      onChange={(e) => handleInputChange('preferredSchedule', e.target.value)}
                      disabled={lockPreferredScheduleField}
                      className={`w-full h-10 px-3 rounded-md border border-gray-300 text-sm ${
                        lockPreferredScheduleField
                          ? lockedPrefillSelectClass
                          : "bg-white focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
                      }`}
                    >
                      <option value="">Select Schedule</option>
                      <option value="Morning Shift">Morning Shift</option>
                      <option value="Afternoon Shift">Afternoon Shift</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Family Information */}
        {currentStep === 2 && (
          <div className="w-full space-y-6">
            <p className="text-sm text-gray-600 -mt-2 mb-2">
              Single-parent or guardian-led households: fill only the sections that apply. You must enter at least one
              parent or guardian name (and match your emergency contact choice below).
            </p>
            {/* Mother's Information */}
            <Card>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <h2 className="text-2xl font-semibold mb-6">Mother's Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="motherGivenName">Mother's First Name</Label>
                    <Input
                      id="motherGivenName"
                      value={formData.motherGivenName}
                      onChange={(e) => handleInputChange('motherGivenName', e.target.value)}
                      placeholder="Enter mother's first name"
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherMaidenMiddleName">Mother's Maiden Middle Name</Label>
                    <Input
                      id="motherMaidenMiddleName"
                      value={formData.motherMaidenMiddleName}
                      onChange={(e) => handleInputChange('motherMaidenMiddleName', e.target.value)}
                      placeholder="Enter mother's maiden middle name"
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherMaidenLastName">Mother's Maiden Last Name</Label>
                    <Input
                      id="motherMaidenLastName"
                      value={formData.motherMaidenLastName}
                      onChange={(e) => handleInputChange('motherMaidenLastName', e.target.value)}
                      placeholder="Enter mother's maiden last name"
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherContactNumber">Mother's Contact Number</Label>
                    <Input
                      id="motherContactNumber"
                      type="tel"
                      inputMode="numeric"
                      value={formData.motherContactNumber}
                      onChange={(e) => handleInputChange('motherContactNumber', e.target.value)}
                      placeholder="09XXXXXXXXX"
                      maxLength={11}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherOccupation">Mother's Occupation</Label>
                    <Input
                      id="motherOccupation"
                      value={formData.motherOccupation}
                      onChange={(e) => handleInputChange('motherOccupation', e.target.value)}
                      placeholder="Enter mother's occupation"
                      className="uppercase"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Father's Information */}
            <Card>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <h2 className="text-2xl font-semibold mb-6">Father's Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fatherGivenName">Father's First Name</Label>
                    <Input
                      id="fatherGivenName"
                      value={formData.fatherGivenName}
                      onChange={(e) => handleInputChange('fatherGivenName', e.target.value)}
                      placeholder="Enter father's first name"
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherMiddleName">Father's Middle Name</Label>
                    <Input
                      id="fatherMiddleName"
                      value={formData.fatherMiddleName}
                      onChange={(e) => handleInputChange('fatherMiddleName', e.target.value)}
                      placeholder="Enter father's middle name"
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherLastName">Father's Last Name</Label>
                    <Input
                      id="fatherLastName"
                      value={formData.fatherLastName}
                      onChange={(e) => handleInputChange('fatherLastName', e.target.value)}
                      placeholder="Enter father's last name"
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherContactNumber">Father's Contact Number</Label>
                    <Input
                      id="fatherContactNumber"
                      type="tel"
                      inputMode="numeric"
                      value={formData.fatherContactNumber}
                      onChange={(e) => handleInputChange('fatherContactNumber', e.target.value)}
                      placeholder="09XXXXXXXXX"
                      maxLength={11}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherOccupation">Father's Occupation</Label>
                    <Input
                      id="fatherOccupation"
                      value={formData.fatherOccupation}
                      onChange={(e) => handleInputChange('fatherOccupation', e.target.value)}
                      placeholder="Enter father's occupation"
                      className="uppercase"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Guardian's Information (if applicable) */}
            <Card>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasGuardian}
                      onChange={(e) => handleInputChange('hasGuardian', e.target.checked)}
                      className="w-4 h-4 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                    />
                    <span className="font-medium">I have a guardian (if applicable)</span>
                  </label>
                </div>

                {formData.hasGuardian && (
                  <>
                    <h2 className="text-2xl font-semibold mb-6">Guardian's Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="guardianGivenName">Guardian's First Name</Label>
                        <Input
                          id="guardianGivenName"
                          value={formData.guardianGivenName}
                          onChange={(e) => handleInputChange('guardianGivenName', e.target.value)}
                          placeholder="Enter guardian's first name"
                          className="uppercase"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guardianMiddleName">Guardian's Middle Name</Label>
                        <Input
                          id="guardianMiddleName"
                          value={formData.guardianMiddleName}
                          onChange={(e) => handleInputChange('guardianMiddleName', e.target.value)}
                          placeholder="Enter guardian's middle name"
                          className="uppercase"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guardianLastName">Guardian's Last Name</Label>
                        <Input
                          id="guardianLastName"
                          value={formData.guardianLastName}
                          onChange={(e) => handleInputChange('guardianLastName', e.target.value)}
                          placeholder="Enter guardian's last name"
                          className="uppercase"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guardianContactNumber">Guardian's Contact Number</Label>
                        <Input
                          id="guardianContactNumber"
                          type="tel"
                          inputMode="numeric"
                          value={formData.guardianContactNumber}
                          onChange={(e) => handleInputChange('guardianContactNumber', e.target.value)}
                          placeholder="09XXXXXXXXX"
                          maxLength={11}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="relationshipToGuardian">Relationship to Guardian</Label>
                        <Input
                          id="relationshipToGuardian"
                          value={formData.relationshipToGuardian}
                          onChange={(e) => handleInputChange('relationshipToGuardian', e.target.value)}
                          placeholder="e.g., Aunt, Uncle, Grandparent"
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <h2 className="text-2xl font-semibold mb-6">Person to Contact in Case of Emergency</h2>
                <div className="flex flex-wrap gap-3 sm:gap-4">
                  {['mother', 'father', 'guardian'].map((contact) => (
                    <label key={contact} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="emergencyContact"
                        value={contact}
                        checked={formData.emergencyContact === contact}
                        onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                        className="w-4 h-4 text-[#8B1538] border-gray-300 focus:ring-[#8B1538]"
                      />
                      <span className="capitalize">{contact}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Enrollment History */}
        {currentStep === 3 && (
          <div className="w-full">
            <Card>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <h2 className="text-2xl font-semibold mb-6">Enrollment History</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="previousSchoolAttended">Previous School Attended</Label>
                    <Input
                      id="previousSchoolAttended"
                      value={formData.previousSchoolAttended}
                      onChange={(e) => handleInputChange('previousSchoolAttended', e.target.value)}
                      placeholder="Enter previous school name"
                      inputMode="text"
                      autoComplete="organization"
                      disabled={lockEnrollmentHistory}
                      className={`uppercase${lockEnrollmentHistory ? ' bg-gray-100 text-gray-700' : ''}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>School Type</Label>
                    <div className="flex gap-4 pt-2">
                      {['public', 'private'].map((type) => (
                        <label key={type} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="schoolType"
                            value={type}
                            checked={formData.schoolType === type}
                            onChange={(e) => handleInputChange('schoolType', e.target.value)}
                            disabled={lockEnrollmentHistory}
                            className="w-4 h-4 text-[#8B1538] border-gray-300 focus:ring-[#8B1538] disabled:opacity-100"
                          />
                          <span className="uppercase">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gradeLevelAtPreviousSchool">Grade Level at Previous School Attended</Label>
                    <select
                      id="gradeLevelAtPreviousSchool"
                      value={formData.gradeLevelAtPreviousSchool}
                      onChange={(e) => handleInputChange('gradeLevelAtPreviousSchool', e.target.value)}
                      disabled={lockEnrollmentHistory}
                      className={`w-full h-10 px-3 rounded-md border border-gray-300 text-sm uppercase disabled:opacity-100 ${
                        lockEnrollmentHistory ? 'bg-gray-100 text-gray-700 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]'
                      }`}
                    >
                      <option value="">Select Grade Level</option>
                      <option value="Grade 10">Grade 10</option>
                      <option value="Grade 11">Grade 11</option>
                      <option value="Grade 12">Grade 12</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sectionAtPreviousSchool">Section at Previous School Attended</Label>
                    <Input
                      id="sectionAtPreviousSchool"
                      value={formData.sectionAtPreviousSchool}
                      onChange={(e) => handleInputChange('sectionAtPreviousSchool', e.target.value)}
                      placeholder="e.g. A, 10-A"
                      inputMode="text"
                      disabled={lockEnrollmentHistory}
                      className={`uppercase${lockEnrollmentHistory ? ' bg-gray-100 text-gray-700' : ''}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastSchoolYearAttended">Last School Year Attended</Label>
                    <SchoolYearCombobox
                      id="lastSchoolYearAttended"
                      value={formData.lastSchoolYearAttended}
                      onChange={(value) => handleInputChange("lastSchoolYearAttended", value)}
                      options={lastSchoolYearOptions}
                      placeholder="e.g. 2023-2024"
                      disabled={lockEnrollmentHistory}
                      className={lockEnrollmentHistory ? '[&_input]:bg-gray-100 [&_input]:text-gray-700' : undefined}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Requirements Upload */}
        {currentStep === 4 && (
          <div className="w-full">
            <Card>
              <CardHeader>
                <CardTitle>Upload Required Documents</CardTitle>
                <CardDescription>
                  Upload clear photos of your documents (JPG or PNG). Blurry or unreadable files will
                  not be accepted.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isResubmitFlow ? (
                  <Alert className="border-amber-300 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-700" />
                    <AlertDescription className="text-amber-900">
                      <strong>Resubmission mode.</strong> Approved documents are locked. Only the requirements
                      flagged for resubmission can be re-uploaded.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Use good lighting and include the full document. We check each photo for clarity
                      and readable text before it is accepted. Maximum file size: {MAX_DOCUMENT_UPLOAD_LABEL} per document.
                    </AlertDescription>
                  </Alert>
                )}

                {documents.map((doc, index) => {
                  // Check if document should be displayed
                  const shouldShow = doc.requiredFor === 'all' ||
                    (doc.requiredFor === 'transferee' && formData.enrollmentStatus === 'transferee');

                  if (!shouldShow) return null;

                  const docMeta = studentDocumentDisplayMeta(doc, {
                    enrollmentFinalized,
                    isGrade12PromotionFlow,
                    isResubmitFlow,
                  });
                  const docNeedsResubmit = docMeta.needsResubmit;
                  const docApproved = docMeta.verified;
                  const isCarriedForward = Boolean(doc.carriedForward);
                  // In resubmit mode we lock everything that isn't explicitly flagged for resubmission.
                  const lockedForResubmit =
                    (isResubmitFlow && !docNeedsResubmit && !docApproved) ||
                    (enrollmentFinalized && !docNeedsResubmit);
                  // Attempt-limit tracking: once the student has used up
                  // every allowed upload, the row is permanently locked and
                  // the student is told to bring the document in person.
                  const uploadsUsed = Math.max(0, Number(doc.uploadCount ?? 0));
                  const uploadLimitReached =
                    !docApproved &&
                    uploadsUsed >= UPLOAD_ATTEMPT_LIMIT &&
                    doc.status === 'uploaded' &&
                    (docNeedsResubmit || (isResubmitFlow && uploadsUsed > 0));
                  const showResubmitAttemptCounter =
                    !docApproved &&
                    doc.status === 'uploaded' &&
                    (docNeedsResubmit || (isResubmitFlow && uploadsUsed > 0) || uploadLimitReached);
                  const attemptsRemaining = Math.max(0, UPLOAD_ATTEMPT_LIMIT - uploadsUsed);

                  const aiStatusLower = String(doc.aiStatus || '').toLowerCase();
                  const readabilityPaused =
                    aiStatusLower === 'screening' && Boolean(doc.readabilityCheckPaused);
                  const openUploadPicker = () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.jpg,.jpeg,.png';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleFileUpload(index, file);
                    };
                    input.click();
                  };

                  return (
                  <div
                    key={index}
                    className={`p-4 border rounded-lg ${
                      uploadLimitReached
                        ? 'border-amber-400 bg-amber-50'
                        : docNeedsResubmit
                          ? 'border-red-300 bg-red-50'
                          : doc.status === 'uploaded'
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className={`w-5 h-5 ${
                          uploadLimitReached
                            ? 'text-amber-700'
                            : docNeedsResubmit
                              ? 'text-red-600'
                              : doc.status === 'uploaded'
                                ? 'text-green-600'
                                : 'text-gray-400'
                        }`} />
                        <div>
                          <p className="font-medium">
                            {doc.name}
                            {doc.requiredFor === 'transferee' && (
                              <span className="text-sm text-gray-500 ml-2">(if applicable for transferee students)</span>
                            )}
                          </p>
                          {doc.file && (
                            <p className="text-sm text-gray-600">{doc.file.name}</p>
                          )}
                          {docNeedsResubmit && doc.registrarRemarks ? (
                            <p className="text-sm text-red-700 mt-1">
                              <strong>Registrar's note:</strong> {doc.registrarRemarks}
                            </p>
                          ) : null}
                          {/* Resubmit attempt counter — only after registrar rejection */}
                          {showResubmitAttemptCounter ? (
                            <p
                              className={`text-xs mt-1 ${
                                uploadLimitReached
                                  ? 'text-amber-800 font-semibold'
                                  : attemptsRemaining <= 1 && uploadsUsed > 0
                                    ? 'text-amber-700'
                                    : 'text-gray-500'
                              }`}
                            >
                              {uploadLimitReached
                                ? `Resubmit limit reached (${uploadsUsed} of ${UPLOAD_ATTEMPT_LIMIT}). Bring the original document to the registrar.`
                                : `${uploadsUsed} of ${UPLOAD_ATTEMPT_LIMIT} resubmit attempts used${
                                    attemptsRemaining === 1 && uploadsUsed > 0
                                      ? ' — this is your last allowed attempt'
                                      : ''
                                  }.`}
                            </p>
                          ) : null}
                          {uploadLimitReached ? (
                            <p className="text-xs text-amber-900 mt-1">
                              We&apos;ve emailed you with instructions for face-to-face verification at
                              the registrar&apos;s office.
                            </p>
                          ) : null}
                          {isGrade12PromotionFlow && doc.status === 'uploaded' && !docNeedsResubmit ? (
                            <p className="text-xs text-gray-500 mt-1">
                              On file from your previous enrollment and already cleared by the registrar.
                            </p>
                          ) : null}
                          {docMeta.showCarriedHint && !uploadLimitReached ? (
                            <p className="text-xs text-slate-600 mt-1">
                              On file from your last enrollment. Contact the registrar if you need to update
                              this document.
                            </p>
                          ) : null}
                          {doc.status === 'uploaded' &&
                          !docNeedsResubmit &&
                          !docMeta.allowReupload &&
                          !isGrade12PromotionFlow &&
                          !readabilityPaused ? (
                            <p className="text-xs text-gray-500 mt-1">
                              This document is locked and cannot be replaced here.
                            </p>
                          ) : null}
                          {readabilityPaused ? (
                            <p className="text-xs text-red-700 mt-1">
                              Verification service is temporarily unavailable. Tap Retry check, or wait a few minutes and refresh.
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {uploadLimitReached ? (
                          <>
                            <Badge variant="default" className="bg-amber-600">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Bring to registrar
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="cursor-not-allowed opacity-60"
                              title={`You have used all ${UPLOAD_ATTEMPT_LIMIT} resubmit attempts for this document.`}
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              Upload disabled
                            </Button>
                          </>
                        ) : docNeedsResubmit ? (
                          <>
                            <Badge variant="default" className="bg-red-600">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {isGrade12PromotionFlow ? "Contact registrar" : "Resubmission required"}
                            </Badge>
                            {!isGrade12PromotionFlow ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-600 text-red-700 hover:bg-red-600 hover:text-white"
                                onClick={openUploadPicker}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Re-upload
                              </Button>
                            ) : (
                              <Badge variant="outline" className="border-gray-400 text-gray-600">
                                Locked
                              </Badge>
                            )}
                          </>
                        ) : doc.status === 'uploaded' ? (
                          <>
                            <Badge variant="default" className={docMeta.badgeClass}>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {docMeta.label}
                            </Badge>
                            {readabilityPaused && doc.uploadedId ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-amber-600 text-amber-800 hover:bg-amber-600 hover:text-white"
                                onClick={() => {
                                  readabilityRetryRef.current.delete(doc.uploadedId!);
                                  void runDocumentReadabilityCheck(index, doc.uploadedId!);
                                }}
                              >
                                Retry check
                              </Button>
                            ) : lockedForResubmit || !docMeta.allowReupload ? (
                              <Badge variant="outline" className="border-gray-400 text-gray-600">
                                {enrollmentFinalized ? "On file" : "Locked"}
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={openUploadPicker}
                              >
                                Re-upload
                              </Button>
                            )}
                          </>
                        ) : lockedForResubmit ? (
                          <Badge variant="outline" className="border-gray-400 text-gray-600">
                            Locked
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[#8B1538] text-[#8B1538] hover:bg-[#8B1538] hover:text-white"
                            onClick={openUploadPicker}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}

                <div className="mt-6 rounded-lg border border-[#8B1538]/25 bg-[#8B1538]/5 p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="documentsAuthenticityConfirmed"
                      checked={lockGrade12PrefilledSections || documentsAuthenticityConfirmed}
                      disabled={lockGrade12PrefilledSections}
                      onChange={(e) => {
                        if (!lockGrade12PrefilledSections) {
                          setDocumentsAuthenticityConfirmed(e.target.checked);
                        }
                      }}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-[#8B1538] focus:ring-[#8B1538] disabled:opacity-100"
                    />
                    <div className="space-y-2 text-sm text-gray-800">
                      <label
                        htmlFor="documentsAuthenticityConfirmed"
                        className={`font-medium${lockGrade12PrefilledSections ? "" : " cursor-pointer"}`}
                      >
                        Document authenticity declaration
                      </label>
                      <p className="leading-relaxed text-gray-700">
                        I declare that every document I uploaded for this enrollment application is{" "}
                        <strong>genuine, original or a true copy</strong>, and has{" "}
                        <strong>not been tampered with, falsified, or digitally altered</strong> to misrepresent
                        my records. I understand that submitting fake or manipulated documents may result in
                        rejection of my application and disciplinary action under school policy and applicable
                        law.
                      </p>
                      <p className="text-xs text-gray-500">
                        Your confirmation is recorded with a timestamp and IP address, similar to your registration
                        consent (DPA), as proof of this declaration.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 5: Payment & Promo */}
        {currentStep === 5 && (
          <div className="w-full space-y-6">
            {/* Bring a Friend Promo */}
            <Card>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <h2 className="text-2xl font-semibold mb-6">Bring a Friend Promo</h2>
                <div className="mb-4">
                  <Label className="mb-3 block">Do you have a referral code?</Label>
                  <div className="flex flex-wrap gap-3 sm:gap-4">
                    {['Yes', 'No'].map((option) => (
                      <label key={option} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hasReferralCode"
                          checked={formData.hasReferralCode === (option === 'Yes')}
                          onChange={() => handleInputChange('hasReferralCode', option === 'Yes')}
                          className="w-4 h-4 text-[#8B1538] border-gray-300 focus:ring-[#8B1538]"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {formData.hasReferralCode && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="referralCardControlNumber">Referral Card Control Number</Label>
                      <Input
                        id="referralCardControlNumber"
                        value={formData.referralCardControlNumber}
                        onChange={(e) => handleInputChange('referralCardControlNumber', e.target.value)}
                        placeholder="Enter control number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="referrerName">Referrer's Name</Label>
                      <Input
                        id="referrerName"
                        value={formData.referrerName}
                        onChange={(e) => handleInputChange('referrerName', e.target.value)}
                        placeholder="Enter referrer's name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="referrerContactNumber">Referrer's Contact Number</Label>
                      <Input
                        id="referrerContactNumber"
                        type="tel"
                        inputMode="numeric"
                        value={formData.referrerContactNumber}
                        onChange={(e) => handleInputChange('referrerContactNumber', e.target.value)}
                        placeholder="09XXXXXXXXX"
                        maxLength={11}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Accounting - Mode of Payment */}
            <Card>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <h2 className="text-2xl font-semibold mb-6">Accounting</h2>
                <div className="space-y-4">
                  <RequiredLabel className="mb-3 block">Mode of Payment</RequiredLabel>
                  <div className="space-y-2">
                    {[
                      { value: 'qvr', label: 'Grade 10 Public - Qualified Voucher Recipient (QVR)' },
                      { value: 'esc', label: 'Grade 10 Private - Education Service Contracting (ESC)' },
                      { value: 'qva', label: 'Grade 10 Private - Qualified Voucher Applicant (QVA)' },
                      { value: 'als', label: 'ALS/Balik Aral (QVA)' },
                      { value: 'cash', label: 'Cash' },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="modeOfPayment"
                          value={option.value}
                          checked={formData.modeOfPayment === option.value}
                          onChange={(e) => handleInputChange('modeOfPayment', e.target.value)}
                          className="w-4 h-4 text-[#8B1538] border-gray-300 focus:ring-[#8B1538]"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>

                  <p className="text-sm text-gray-600 mt-4 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2">
                    If you use a voucher program (QVR, ESC, QVA, or ALS), you will enter your{' '}
                    <span className="font-semibold">voucher number on your dashboard</span> after the Registrar approves
                    your enrollment.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 6: Review & Submit */}
        {currentStep === 6 && (
          <div className="w-full">
            <Card>
              <CardHeader>
                <CardTitle>Review & Submit</CardTitle>
                <CardDescription>Please review your information before submitting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Personal Information Review */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-[#8B1538]">Personal Information</h3>
                  <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-gray-600">Enrollment Status</p>
                      <p className="font-medium capitalize">{formData.enrollmentStatus}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Full Name</p>
                      <p className="font-medium">
                        {formData.givenName} {formData.middleName} {formData.lastName} {formData.extensionName}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Gender</p>
                      <p className="font-medium">{formData.gender}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Birth Date</p>
                      <p className="font-medium">{formData.birthDate}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">LRN</p>
                      <p className="font-medium">{formData.lrn}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Contact</p>
                      <p className="font-medium">{formData.contactNumber}</p>
                    </div>
                  </div>
                </div>

                {/* Academic Information */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-[#8B1538]">Academic Information</h3>
                  <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-gray-600">Grade Level</p>
                      <p className="font-medium">Grade {formData.gradeLevel}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Strand</p>
                      <p className="font-medium">{formData.strand}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Preferred Schedule</p>
                      <p className="font-medium">{formData.preferredSchedule}</p>
                    </div>
                  </div>
                </div>

                {/* Family Information */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-[#8B1538]">Family Information</h3>
                  <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-gray-600">Mother's Name</p>
                      <p className="font-medium">
                        {formData.motherGivenName} {formData.motherMaidenMiddleName} {formData.motherMaidenLastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Father's Name</p>
                      <p className="font-medium">
                        {formData.fatherGivenName} {formData.fatherMiddleName} {formData.fatherLastName}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mode of Payment */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-[#8B1538]">Payment Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Mode of Payment</p>
                      <p className="font-medium uppercase">{formData.modeOfPayment || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Voucher No.</p>
                      <p className="font-medium text-gray-700">
                        {formData.modeOfPayment === 'cash'
                          ? 'Not applicable (cash)'
                          : 'Add on your dashboard after enrollment is approved'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Confirmation */}
                <div className="border-t pt-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.confirmInformation}
                      onChange={(e) => handleInputChange('confirmInformation', e.target.checked)}
                      className="w-5 h-5 mt-0.5 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                    />
                    <span className="text-sm">
                      I confirm that all the information I have provided is accurate and complete. I understand that any false information may result in the rejection of my application.
                    </span>
                  </label>
                </div>

                <Alert className="border-[#8B1538] bg-red-50">
                  <AlertCircle className="h-4 w-4 text-[#8B1538]" />
                  <AlertDescription className="text-[#8B1538]">
                    By submitting this application, you confirm that all information provided is accurate and complete.
                    Your application will be reviewed by the Registrar's office.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="bg-white border-t p-6">
        <div className="flex w-full justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || isSaving || isEnrollmentLocked || !enrollmentAllowed}
            className="border-gray-300"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          {currentStep < 6 ? (
            <Button
              onClick={handleNext}
              disabled={
                isSaving ||
                isEnrollmentLocked ||
                !enrollmentAllowed ||
                (currentStep === 4 && !documentsAuthenticityConfirmed && !lockGrade12PrefilledSections)
              }
              className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
            >
              {isSaving ? 'Saving...' : 'Next'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!formData.confirmInformation || isSaving || isEnrollmentLocked || !enrollmentAllowed}
              className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {isSaving ? 'Submitting...' : 'Submit Application'}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={missingParentDialogOpen} onOpenChange={setMissingParentDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#8B1538]">Parent information incomplete</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  You did not fill in{' '}
                  <span className="font-medium text-gray-900">
                    {missingParentParts.join(' and ')}
                  </span>{' '}
                  information.
                </p>
                <p>
                  You can still continue if this matches your household (for example, single-parent or
                  guardian-led homes).
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
              onClick={() => void handleMissingParentContinue()}
            >
              Continue anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}