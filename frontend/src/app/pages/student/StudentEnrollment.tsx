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
import { UsDateInput } from "../../components/UsDateInput";
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
import { useAuth } from "../../context/AuthContext";
import { useEnrollmentAllowed } from "../../context/SchoolYearContext";
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
  middleInitialFromMiddleName,
  formatBirthDateUsDisplay,
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
import {
  formatStrandDisplay,
  normalizeStrandCode,
  STRANDS,
} from "../../lib/strands";
import { EnrollmentGuard } from "../../components/EnrollmentGuard";
import {
  isDocumentUploadTooLarge,
  MAX_DOCUMENT_UPLOAD_LABEL,
} from "../../lib/uploadLimits";
import { useStudentLocale } from "../../context/StudentLocaleContext";
import {
  translateEmergencyContact,
  translateEnrollmentDocumentName,
  translateEnrollmentStatus,
  referralPromoErrorMessage,
} from "../../lib/studentLocale";
import {
  displayEnrollmentText,
  formatPaymentArrangementDisplay,
  displayFullName,
  displayStrandText,
  formatGradeLevelDisplay,
} from "../../lib/enrollmentDisplayFormat";

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

/** Youngest birth year allowed (current calendar year minus 15). */
function getShsLatestBirthYear(asOf: Date = new Date()): number {
  return asOf.getFullYear() - 15;
}

function birthDateBoundsForShs(asOf: Date = new Date()) {
  const latestBirthYear = getShsLatestBirthYear(asOf);
  return {
    max: `${latestBirthYear}-12-31`,
  };
}

type BirthDateValidationIssue = 'invalid' | 'ineligible';

function getBirthDateValidationIssue(ymd: string, asOf: Date = new Date()): BirthDateValidationIssue | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return 'invalid';
  const [y, m, d] = ymd.split('-').map(Number);
  const birth = new Date(y, m - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== d) {
    return 'invalid';
  }
  if (y > getShsLatestBirthYear(asOf)) {
    return 'ineligible';
  }
  return null;
}

interface DocumentUpload {
  name: string;
  file: File | null;
  status: 'missing' | 'uploaded';
  required: boolean;
  requiredFor?: 'all' | 'transferee' | 'non_transferee';
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

/** Slot key for matching API rows to enrollment upload labels (TOR is separate from SF9 in the UI). */
function slotKeyFromApiType(type: string): string {
  const t = type.trim().toLowerCase();
  if (!t) return "";
  if (t.includes("transcript") || /\btor\b/.test(t)) return "tor";
  return normalizeRequirementKey(type);
}

function shouldShowDocumentRequirement(
  doc: DocumentUpload,
  enrollmentStatus: string,
): boolean {
  if (doc.requiredFor === "all") return true;
  if (doc.requiredFor === "transferee") return enrollmentStatus === "transferee";
  if (doc.requiredFor === "non_transferee") return enrollmentStatus !== "transferee";
  return false;
}

/** Match API document rows to enrollment step labels (PSA vs birth_certificate, etc.). */
function normalizeRequirementKey(label: string): string {
  const t = label.trim().toLowerCase();
  if (!t) return "";
  if (["birth_certificate", "birthcert", "psa"].includes(t)) return "birth_certificate";
  if (["good_moral", "goodmoral"].includes(t)) return "good_moral";
  if (["sf9", "report_card"].includes(t)) return "sf9";
  if (["tor", "transcript", "transcript_of_records"].includes(t)) return "tor";
  if (["sf10", "form137", "form_137"].includes(t)) return "sf10";
  if (["photo_2x2", "id_picture", "picture_2x2"].includes(t)) return "photo_2x2";
  if (t.includes("2x2") || (t.includes("picture") && t.includes("white"))) return "photo_2x2";
  if (t.includes("good moral")) return "good_moral";
  if (t.includes("transcript") || /\btor\b/.test(t)) return "tor";
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
  // Registrar rejection always wins over AI "verified" / reviewed flags.
  const needsResubmit = isRegistrarRejectionDecision(doc.registrarDecision);

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

  // Only the registrar (or a finalized enrollment) may show "Approved".
  // AI "verified" alone must not look like final approval.
  if (registrarCleared || opts.enrollmentFinalized) {
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
  if (opts.isGrade12PromotionFlow) {
    return {
      needsResubmit: false,
      verified: true,
      label: "Approved",
      badgeClass: "bg-green-600",
      showCarriedHint: false,
      allowReupload: false,
    };
  }

  const showCarriedHint = Boolean(doc.carriedForward);

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

  // AI may have cleared the photo, but registrar has not approved yet.
  // Keep re-upload available so students can replace it before review,
  // and so a later registrar rejection can always take over this slot.
  if (aiVerified) {
    return {
      needsResubmit: false,
      verified: false,
      label: "Uploaded — awaiting review",
      badgeClass: "bg-blue-600",
      showCarriedHint: false,
      allowReupload: true,
    };
  }

  if (aiStatus === "screening") {
    if (doc.readabilityCheckPaused) {
      return {
        needsResubmit: false,
        verified: false,
        label: "Uploaded",
        badgeClass: "bg-slate-600 text-white",
        showCarriedHint: false,
        allowReupload: true,
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
  /** 1 when registrar required a re-upload (explicit server flag). */
  needs_resubmit?: number | boolean;
};

function documentRowFromApiHit(doc: DocumentUpload, hit: ApiDocumentRow): DocumentUpload {
  const decisionRaw =
    hit.registrar_doc_decision ??
    (hit as { registrarDocDecision?: string }).registrarDocDecision ??
    (hit as { registrarDecision?: string }).registrarDecision ??
    "";
  const remarksRaw =
    hit.registrar_doc_remarks ??
    (hit as { registrarDocRemarks?: string }).registrarDocRemarks ??
    (hit as { registrarRemarks?: string }).registrarRemarks ??
    "";
  const needsResubmitFlag =
    hit.needs_resubmit === true ||
    Number(hit.needs_resubmit ?? 0) === 1 ||
    isRegistrarRejectionDecision(String(decisionRaw || ""));
  return {
    ...doc,
    status: "uploaded",
    uploadedId: hit.id,
    uploadedAt: hit.uploaded_at,
    aiStatus: hit.ai_status,
    registrarDecision: needsResubmitFlag ? "rejected" : String(decisionRaw || ""),
    registrarRemarks: String(remarksRaw || ""),
    registrarReviewed: hit.registrar_reviewed === true || Number(hit.registrar_reviewed ?? 0) === 1,
    uploadCount: Math.max(0, Number(hit.upload_count ?? 0) || 0),
    carriedForward: hit.carried_forward === true || Number(hit.carried_forward ?? 0) === 1,
  };
}

/** Whether the registrar marked this requirement for re-upload. */
function isRegistrarRejectionDecision(decision: string | undefined | null): boolean {
  const d = String(decision || "").toLowerCase();
  return d === "rejected" || d === "reject";
}

function apiRowNeedsRegistrarResubmit(row: ApiDocumentRow): boolean {
  if (row.needs_resubmit === true || Number(row.needs_resubmit ?? 0) === 1) {
    return true;
  }
  const decision =
    row.registrar_doc_decision ??
    (row as { registrarDocDecision?: string }).registrarDocDecision ??
    (row as { registrarDecision?: string }).registrarDecision;
  return isRegistrarRejectionDecision(decision);
}

/** Map API rows (machine or human type keys) onto the enrollment step requirements. */
function mergeDocumentsFromApiRows(prev: DocumentUpload[], rows: ApiDocumentRow[]): DocumentUpload[] {
  const mapByType = new Map<string, ApiDocumentRow>();
  for (const d of rows) {
    const key = slotKeyFromApiType(String(d.type || ""));
    if (!key) continue;
    const existing = mapByType.get(key);
    // Prefer a rejected row if an older duplicate slot somehow appears first.
    if (!existing || apiRowNeedsRegistrarResubmit(d)) {
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
  hasReferralCode: boolean | null;
  referralCardControlNumber: string;
  referrerName: string;
  referrerContactNumber: string;
  referrerEmail: string;
  referrerType: string;
  
  // Accounting
  modeOfPayment: string;
  paymentArrangement: '' | 'full_payment' | 'installment';
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
  options?: { promoteGrade?: boolean; currentSection?: string | null },
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

  const priorGrade = prior?.grade_level_number ?? 0;
  const priorSy = (prior?.school_year ?? "").trim();
  const sectionRaw = (options?.currentSection ?? "").trim();

  if (priorGrade >= 10 && priorSy !== "") {
    merged.gradeLevelAtPreviousSchool = `Grade ${priorGrade}`;
    merged.lastSchoolYearAttended = priorSy;
    if (sectionRaw !== "") {
      const sectionMatch = /^(\d+)-(.+)$/i.exec(sectionRaw);
      const sectionSuffix = sectionMatch ? sectionMatch[2].trim() : sectionRaw;
      merged.sectionAtPreviousSchool = `${priorGrade}-${sectionSuffix}`.toUpperCase();
    }
  }

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
  strand: "",
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
  hasReferralCode: null,
  referralCardControlNumber: "",
  referrerName: "",
  referrerContactNumber: "",
  referrerEmail: "",
  referrerType: "",
  modeOfPayment: "",
  paymentArrangement: "",
  voucherNo: "",
  confirmInformation: false,
};

export function StudentEnrollment() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { t, locale } = useStudentLocale();
  const enrollmentAllowedFromSettings = useEnrollmentAllowed();
  const [enrollmentMetaLoaded, setEnrollmentMetaLoaded] = useState(false);
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
  /** Live voucher check while typing on the referral step. */
  const [referralControlCheck, setReferralControlCheck] = useState<
    'idle' | 'checking' | 'available' | 'used' | 'not_found' | 'invalid' | 'error'
  >('idle');
  const referralCheckSeqRef = useRef(0);
  const accountEmail = String(user?.email ?? "").trim();
  const [formData, setFormData] = useState<EnrollmentFormData>(() => ({
    ...INITIAL_ENROLLMENT_FORM_DATA,
    email: String(user?.email ?? "").trim(),
  }));
  const birthDateBounds = useMemo(() => birthDateBoundsForShs(), []);
  const submitInFlightRef = useRef(false);
  const readabilityInFlightRef = useRef(new Set<number>());
  const readabilityRetryRef = useRef(new Map<number, number>());

  // Enrollment email always comes from the logged-in account (register/login).
  useEffect(() => {
    if (!accountEmail) return;
    setFormData((prev) => (prev.email === accountEmail ? prev : { ...prev, email: accountEmail }));
  }, [accountEmail]);

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

  const lastSchoolYearOptions = useMemo(
    () =>
      getSchoolYearAttendedOptions({
        count: 15,
        extraYears: [formData.lastSchoolYearAttended],
      }),
    [formData.lastSchoolYearAttended],
  );

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
    { name: 'Grade 10 Report Card (SF9)', file: null, status: 'missing', required: true, requiredFor: 'non_transferee' },
    { name: 'Good Moral Certificate', file: null, status: 'missing', required: true, requiredFor: 'all' },
    { name: 'SF10 / Form 137', file: null, status: 'missing', required: false, requiredFor: 'all' },
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
        const loadedStudentSection = (json.student_section?.section ?? "").trim() || null;

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

        const withAccountEmail = (data: EnrollmentFormData): EnrollmentFormData => {
          const email = String(user?.email ?? "").trim();
          return email ? { ...data, email } : data;
        };

        if (json.enrollment?.form_data && (isInProgressCurrentSy || !isNewSyOpen)) {
          setFormData(prev => {
            const merged = {
              ...prev,
              ...(json.enrollment?.form_data ?? {}),
              strand: normalizeStrandCode(
                String((json.enrollment?.form_data as Partial<EnrollmentFormData> | undefined)?.strand ?? prev.strand),
              ),
            };
            if (isInProgressCurrentSy && priorFormFromApi && isNewSyOpen) {
              return withAccountEmail(
                applyReEnrollmentFormPrefill(merged, priorFormFromApi, priorMeta, {
                  promoteGrade: true,
                  currentSection: loadedStudentSection,
                }),
              );
            }
            if (reEnrollEligible && priorFormFromApi && !isNewSyOpen) {
              return withAccountEmail(
                applyReEnrollmentFormPrefill(merged, priorFormFromApi, priorMeta, {
                  promoteGrade: false,
                  currentSection: loadedStudentSection,
                }),
              );
            }
            return withAccountEmail(merged);
          });
        } else if (isInProgressCurrentSy && priorFormFromApi && isNewSyOpen) {
          setFormData(prev =>
            withAccountEmail(
              applyReEnrollmentFormPrefill(prev, priorFormFromApi, priorMeta, {
                promoteGrade: true,
                currentSection: loadedStudentSection,
              }),
            )
          );
        } else if (reEnrollEligible && priorFormFromApi && !isNewSyOpen) {
          setFormData(prev =>
            withAccountEmail(
              applyReEnrollmentFormPrefill(prev, priorFormFromApi, priorMeta, {
                promoteGrade: false,
                currentSection: loadedStudentSection,
              }),
            )
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

        let docsEnrollmentId = json.enrollment?.id ? Number(json.enrollment.id) : 0;
        if (!Number.isFinite(docsEnrollmentId) || docsEnrollmentId <= 0) {
          docsEnrollmentId = 0;
        }
        const forcedStep = Number(searchParams.get('step') || '') || 0;
        if (searchParams.get('resubmit') === '1') {
          setCurrentStep(4);
        } else if (forcedStep >= 1 && forcedStep <= 6) {
          setCurrentStep(forcedStep);
        } else if (
          json.enrollment?.current_step &&
          json.enrollment.current_step >= 1 &&
          json.enrollment.current_step <= 6 &&
          // Resume the saved draft step for any in-progress application
          // (including a new-school-year draft). Only reset to step 1 when
          // a new SY is open and there is no draft yet for that year.
          (isInProgressCurrentSy || !isNewSyOpen)
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
          const hasRejectedDocs = docsJson.documents.some((row) =>
            apiRowNeedsRegistrarResubmit(row as ApiDocumentRow),
          );
          if (hasRejectedDocs) {
            setIsEnrollmentLocked(false);
            localStorage.removeItem("studentEnrollmentLocked");
            if (!resubmit && forcedStep < 1) {
              setCurrentStep(4);
            }
          }
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
        email: accountEmail || formData.email,
        municipality: normalizeMunicipalityValue(formData.municipality),
        barangay: normalizeBarangayValue(formData.municipality, formData.barangay),
        strand: normalizeStrandCode(formData.strand),
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
        code?: string;
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
        const referralCodes = new Set([
          'referral_choice_required',
          'referral_control_invalid',
          'referral_control_not_found',
          'referral_control_used',
          'referrer_name_required',
          'referrer_contact_invalid',
          'referrer_email_invalid',
          'referrer_type_required',
          'referral_invalid',
        ]);
        const toastMessage =
          json.code && referralCodes.has(json.code)
            ? referralPromoErrorMessage(t, json.code, json.error)
            : json.error || 'Could not save enrollment. Please try again.';
        toast.error(toastMessage, {
          duration: json.grade12_blocked_physical_docs || referralCodes.has(json.code || '') ? 10000 : 5000,
        });
        // Referral conflicts use HTTP 409 historically — never treat those as
        // "already submitted" or the form falsely locks under review.
        const isReferralConflict = !!(json.code && referralCodes.has(json.code));
        if (res.status === 409 && !isReferralConflict) {
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
          toast.success(displayEnrollmentText(json.message || 'Enrollment submitted successfully'));
        }
        const sa = json.section_assignment;
        if (sa?.assigned && sa.section) {
          const shiftLabel = sa.shift === "afternoon" ? "afternoon" : "morning";
          if (sa.shift_changed) {
            toast.success(
              displayEnrollmentText(
                `You were placed in section ${sa.section} (${shiftLabel} shift) based on available seats.`,
              ),
            );
          } else if (sa.kept_section) {
            toast.success(
              displayEnrollmentText(
                `You remain in section ${sa.section} (${shiftLabel} shift) for Grade 12.`,
              ),
            );
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

  // Refresh documents whenever the student opens the upload step so registrar
  // rejections (require re-upload) sync even if the page was already open.
  useEffect(() => {
    if (currentStep !== 4) return;
    const eid = enrollmentId;
    if (!eid) return;

    let cancelled = false;
    const refreshDocs = async () => {
      try {
        const docsRes = await apiFetch(`/api/documents?enrollment_id=${eid}`);
        const docsText = await docsRes.text();
        const docsJson = JSON.parse(docsText) as {
          success?: boolean;
          documents?: ApiDocumentRow[];
        };
        if (cancelled || !docsRes.ok || !docsJson.success || !Array.isArray(docsJson.documents)) {
          return;
        }
        applyUploadedDocuments(docsJson.documents);
        const hasRejectedDocs = docsJson.documents.some(apiRowNeedsRegistrarResubmit);
        if (hasRejectedDocs) {
          setIsEnrollmentLocked(false);
          localStorage.removeItem("studentEnrollmentLocked");
        }
      } catch {
        // keep existing document state
      }
    };

    void refreshDocs();
    const pollId = window.setInterval(() => {
      void refreshDocs();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [currentStep, enrollmentId]);

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
        {
          ...INITIAL_ENROLLMENT_FORM_DATA,
          email: String(user?.email ?? "").trim(),
        },
        priorReenrollFormData ?? priorApproved?.form_data ?? {},
        priorApproved,
        { promoteGrade: true, currentSection: currentStudentSection }
      );
      if (String(user?.email ?? "").trim() !== "") {
        prefill.email = String(user?.email ?? "").trim();
      }
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
  }, [priorApproved, priorReenrollFormData, schoolYearCurrent, grade12BlockedPhysicalDocs, currentStudentSection, user?.email]);

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
  ]);

  const handleInputChange = (field: keyof EnrollmentFormData, value: string | boolean | null) => {
    if (field === "hasReferralCode") {
      const hasReferral = value === true;
      setReferralControlCheck('idle');
      setFormData((prev) => ({
        ...prev,
        hasReferralCode: typeof value === "boolean" ? value : null,
        ...(hasReferral
          ? {}
          : {
              referralCardControlNumber: "",
              referrerName: "",
              referrerContactNumber: "",
              referrerEmail: "",
              referrerType: "",
            }),
      }));
      return;
    }
    if (typeof value !== "string") {
      setFormData((prev) => ({ ...prev, [field]: value }));
      return;
    }
    const sanitized = sanitizeEnrollmentFieldValue(field, value);
    if (field === 'referralCardControlNumber') {
      setReferralControlCheck('idle');
    }
    if (field === 'middleName') {
      const middleName = UPPERCASE_FIELDS.has(field) ? sanitized.toUpperCase() : sanitized;
      setFormData((prev) => ({
        ...prev,
        middleName,
        middleInitial: middleInitialFromMiddleName(middleName),
      }));
      return;
    }
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
        deferred?: boolean;
        message?: string;
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
        } else {
          // Never hold the student workflow for an automated-check failure.
          setDocuments((prev) => {
            const next = [...prev];
            if (next[docIndex]?.uploadedId === documentId) {
              next[docIndex] = {
                ...next[docIndex],
                aiStatus: 'pending',
                readabilityCheckPaused: true,
              };
            }
            return next;
          });
          toast.error(
            'Automatic verification is unavailable. Your upload was saved and you may continue enrollment.',
            { duration: 9000 },
          );
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
            readabilityCheckPaused: Boolean(json.deferred),
          };
        }
        return next;
      });
      if (json.deferred) {
        toast.message(
          'Automatic verification is unavailable. Your upload was saved.',
          { duration: 8000 },
        );
      }
    } catch {
      setDocuments((prev) => {
        const next = [...prev];
        if (next[docIndex]?.uploadedId === documentId) {
          next[docIndex] = {
            ...next[docIndex],
            aiStatus: 'pending',
            readabilityCheckPaused: true,
          };
        }
        return next;
      });
      toast.error(
        'Automatic verification could not run. Your upload was saved and you may continue enrollment.',
        { duration: 9000 },
      );
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
          ai_status?: string;
          ai_check_deferred?: boolean;
          readability_pending?: boolean;
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
        const msg = json.error || 'Upload failed. Please try again.';
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

      const deferredCheck = Boolean(json.document?.ai_check_deferred);
      const uploadedDocId = Number(json.document?.id ?? 0);
      const initialAiStatus = json.document?.ai_status ?? (deferredCheck ? 'pending' : 'screening');

      setDocuments(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          file,
          status: 'uploaded',
          uploadedId: uploadedDocId > 0 ? uploadedDocId : undefined,
          uploadedAt: json.document?.uploaded_at ?? new Date().toISOString(),
          aiStatus: initialAiStatus,
          registrarDecision: '',
          registrarRemarks: '',
          registrarReviewed: false,
          uploadCount: Math.max(0, Number(json.document?.upload_count ?? 0) || 0),
          carriedForward: false,
          readabilityCheckPaused: deferredCheck,
        };
        return next;
      });
      setDocumentsAuthenticityConfirmed(false);
      if (deferredCheck) {
        toast.success(
          `${documents[index].name} uploaded.`,
          { duration: 8000 },
        );
      } else {
        toast.success(`${documents[index].name} uploaded — checking readability…`);
        if (uploadedDocId > 0) {
          void runDocumentReadabilityCheck(index, uploadedDocId);
        }
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
      if (field === "birthDate") continue;
      if (!formData[field as keyof EnrollmentFormData]) {
        toast.error(t('form.val.requiredFields'));
        return false;
      }
    }
    const birthYmd = formData.birthDate.trim();
    if (!birthYmd) {
      toast.error(t('form.val.requiredFields'));
      return false;
    }
    const birthDateIssue = getBirthDateValidationIssue(birthYmd);
    if (birthDateIssue === 'invalid') {
      toast.error(t('form.val.birthDateFormat'));
      return false;
    }
    if (birthDateIssue === 'ineligible') {
      toast.error(t('form.val.birthDateIneligible'));
      return false;
    }
    if (formData.gradeLevel !== '11' && formData.gradeLevel !== '12') {
      toast.error(t('form.val.requiredFields'));
      return false;
    }
    if (!hasValidPersonName(formData.givenName)) {
      toast.error(t('form.val.firstNameLetters'));
      return false;
    }
    if (!hasValidPersonName(formData.middleName)) {
      toast.error(t('form.val.middleNameLetters'));
      return false;
    }
    if (!hasValidPersonName(formData.lastName)) {
      toast.error(t('form.val.lastNameLetters'));
      return false;
    }
    if (
      formData.extensionName.trim() &&
      !/^[A-Za-zñÑ.\s,]+$/.test(formData.extensionName.trim())
    ) {
      toast.error(t('form.val.extensionLetters'));
      return false;
    }
    if (!isValidPhilippineMobileNumber(formData.contactNumber)) {
      toast.error(t('form.val.contactNumber'));
      return false;
    }
    if (!isValidEnrollmentLrn(formData.lrn)) {
      toast.error(t('form.val.lrn'));
      return false;
    }
    if (!hasValidAddressLabel(formData.municipality)) {
      toast.error(t('form.val.municipality'));
      return false;
    }
    if (!hasValidAddressLabel(formData.barangay)) {
      toast.error(t('form.val.barangay'));
      return false;
    }
    return true;
  };

  const getMissingParentParts = (): string[] => {
    const parts: string[] = [];
    if (!formData.motherGivenName.trim()) parts.push(t('form.emergency.mother'));
    if (!formData.fatherGivenName.trim()) parts.push(t('form.emergency.father'));
    return parts;
  };

  const validateStep2 = () => {
    const groupHasAnyValue = (fields: Array<keyof EnrollmentFormData>) =>
      fields.some((field) => String(formData[field] ?? "").trim().length > 0);
    const groupIsComplete = (fields: Array<keyof EnrollmentFormData>) =>
      fields.every((field) => String(formData[field] ?? "").trim().length > 0);

    const motherFields: Array<keyof EnrollmentFormData> = [
      'motherGivenName',
      'motherMaidenMiddleName',
      'motherMaidenLastName',
      'motherContactNumber',
      'motherOccupation',
    ];
    const fatherFields: Array<keyof EnrollmentFormData> = [
      'fatherGivenName',
      'fatherMiddleName',
      'fatherLastName',
      'fatherContactNumber',
      'fatherOccupation',
    ];
    const guardianFields: Array<keyof EnrollmentFormData> = [
      'guardianGivenName',
      'guardianMiddleName',
      'guardianLastName',
      'guardianContactNumber',
      'relationshipToGuardian',
    ];

    const hasMotherStarted = groupHasAnyValue(motherFields);
    const hasFatherStarted = groupHasAnyValue(fatherFields);
    const hasGuardianStarted = formData.hasGuardian || groupHasAnyValue(guardianFields);
    const hasMother = groupIsComplete(motherFields);
    const hasFather = groupIsComplete(fatherFields);
    const hasGuardianFilled = formData.hasGuardian && groupIsComplete(guardianFields);

    if (hasMotherStarted && !hasMother) {
      toast.error(t('form.val.familySectionIncomplete', { section: t('form.mother.section') }));
      return false;
    }
    if (hasFatherStarted && !hasFather) {
      toast.error(t('form.val.familySectionIncomplete', { section: t('form.father.section') }));
      return false;
    }
    if (hasGuardianStarted && !hasGuardianFilled) {
      toast.error(t('form.val.familySectionIncomplete', { section: t('form.guardian.section') }));
      return false;
    }

    if (!hasMother && !hasFather && !hasGuardianFilled) {
      toast.error(t('form.val.parentRequired'));
      return false;
    }

    if (!formData.emergencyContact) {
      toast.error(t('form.val.emergencySelect'));
      return false;
    }

    if (formData.emergencyContact === 'mother' && !hasMother) {
      toast.error(t('form.val.emergencyMother'));
      return false;
    }
    if (formData.emergencyContact === 'father' && !hasFather) {
      toast.error(t('form.val.emergencyFather'));
      return false;
    }
    if (formData.emergencyContact === 'guardian') {
      if (!formData.hasGuardian) {
        toast.error(t('form.val.emergencyGuardianCheck'));
        return false;
      }
      if (!guardianName) {
        toast.error(t('form.val.emergencyGuardian'));
        return false;
      }
    }

    const nameChecks: Array<{ value: string; label: string }> = [];
    if (hasMother) {
      nameChecks.push(
        { value: formData.motherGivenName, label: t('form.val.mother') },
        { value: formData.motherMaidenMiddleName, label: t('form.val.motherMiddle') },
        { value: formData.motherMaidenLastName, label: t('form.val.motherLast') },
      );
    }
    if (hasFather) {
      nameChecks.push(
        { value: formData.fatherGivenName, label: t('form.val.father') },
        { value: formData.fatherMiddleName, label: t('form.val.fatherMiddle') },
        { value: formData.fatherLastName, label: t('form.val.fatherLast') },
      );
    }
    if (hasGuardianFilled) {
      nameChecks.push(
        { value: formData.guardianGivenName, label: t('form.val.guardian') },
        { value: formData.guardianMiddleName, label: t('form.val.guardianMiddle') },
        { value: formData.guardianLastName, label: t('form.val.guardianLast') },
      );
    }
    for (const { value, label } of nameChecks) {
      if (value.trim() && !hasValidPersonName(value)) {
        toast.error(t('form.val.lettersOnly', { label }));
        return false;
      }
    }

    const phoneChecks: Array<{ value: string; label: string }> = [
      { value: formData.motherContactNumber, label: t('form.val.motherContact') },
      { value: formData.fatherContactNumber, label: t('form.val.fatherContact') },
      { value: formData.guardianContactNumber, label: t('form.val.guardianContact') },
    ];
    for (const { value, label } of phoneChecks) {
      if (value.trim() && !isValidPhilippineMobileNumber(value)) {
        toast.error(t('form.val.contactFormat', { label }));
        return false;
      }
    }

    const textOnlyChecks: Array<{ value: string; label: string; when?: boolean }> = [
      { value: formData.motherOccupation, label: t('form.val.motherOccupation') },
      { value: formData.fatherOccupation, label: t('form.val.fatherOccupation') },
      {
        value: formData.relationshipToGuardian,
        label: t('form.val.guardianRelationship'),
        when: hasGuardianFilled,
      },
    ];
    for (const { value, label, when } of textOnlyChecks) {
      if (when === false) continue;
      if (value.trim() && !hasValidTextOnlyContent(value)) {
        toast.error(t('form.val.lettersOnly', { label }));
        return false;
      }
    }

    return true;
  };

  const validateStep3 = () => {
    if (!formData.previousSchoolAttended.trim()) {
      toast.error(t('form.val.previousSchool'));
      return false;
    }
    if (!hasValidTextOnlyContent(formData.previousSchoolAttended)) {
      toast.error(t('form.val.previousSchoolLetters'));
      return false;
    }
    if (formData.schoolType !== 'public' && formData.schoolType !== 'private') {
      toast.error(t('form.val.schoolType'));
      return false;
    }
    if (!formData.gradeLevelAtPreviousSchool.trim()) {
      toast.error(t('form.val.historyGradeLevel'));
      return false;
    }
    if (!formData.sectionAtPreviousSchool.trim()) {
      toast.error(t('form.val.section'));
      return false;
    }
    if (!hasValidSectionLabel(formData.sectionAtPreviousSchool)) {
      toast.error(t('form.val.sectionInvalid'));
      return false;
    }
    if (!formData.lastSchoolYearAttended.trim()) {
      toast.error(t('form.val.lastSchoolYear'));
      return false;
    }
    if (!isValidSchoolYearAttended(formData.lastSchoolYearAttended)) {
      toast.error(t('form.val.lastSchoolYearInvalid'));
      return false;
    }
    return true;
  };

  const validateStep4 = () => {
    const requiredDocs = documents.filter(
      (doc) => doc.required && shouldShowDocumentRequirement(doc, formData.enrollmentStatus),
    );

    const missingDocs = requiredDocs.filter(doc => doc.status !== 'uploaded');
    
    if (missingDocs.length > 0) {
      toast.error(`Please upload all required documents: ${missingDocs.map(d => d.name).join(', ')}`);
      return false;
    }

    const screeningDocs = requiredDocs.filter(
      (doc) => doc.status === 'uploaded' && String(doc.aiStatus || '').toLowerCase() === 'screening',
    );
    if (screeningDocs.length > 0) {
      const allPaused = screeningDocs.every((doc) => doc.readabilityCheckPaused);
      if (!allPaused) {
        toast.error('Document readability checks are still in progress. Please wait a moment.');
        return false;
      }
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

  const validateStep5 = () => {
    if (formData.hasReferralCode === null) {
      toast.error(t('form.val.referralChoice'));
      return false;
    }
    if (formData.hasReferralCode) {
      const controlDigits = formData.referralCardControlNumber.replace(/\D/g, '');
      if (controlDigits.length !== 5) {
        toast.error(t('form.val.referralControl'));
        return false;
      }
      if (referralControlCheck === 'used') {
        toast.error(t('form.val.referralControlUsed'));
        return false;
      }
      if (referralControlCheck === 'not_found') {
        toast.error(t('form.val.referralControlNotFound'));
        return false;
      }
      if (referralControlCheck === 'checking') {
        toast.error(t('form.val.referralControlChecking'));
        return false;
      }
      if (!formData.referrerName.trim()) {
        toast.error(t('form.val.referrerName'));
        return false;
      }
      const referrerContact = formData.referrerContactNumber.replace(/\D/g, '');
      if (!/^09\d{9}$/.test(referrerContact)) {
        toast.error(t('form.val.referrerContact'));
        return false;
      }
      const referrerEmail = formData.referrerEmail.trim().toLowerCase();
      if (!referrerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referrerEmail)) {
        toast.error(t('form.val.referrerEmail'));
        return false;
      }
      if (!formData.referrerType.trim()) {
        toast.error(t('form.val.referrerType'));
        return false;
      }
    }
    return true;
  };

  const verifyReferralControlNow = async (
    controlNumber: string,
  ): Promise<'available' | 'used' | 'not_found' | 'invalid' | 'error'> => {
    const digits = controlNumber.replace(/\D/g, '');
    if (digits.length !== 5) {
      setReferralControlCheck('invalid');
      return 'invalid';
    }
    const seq = ++referralCheckSeqRef.current;
    setReferralControlCheck('checking');
    try {
      const res = await apiFetch('/api/student/enrollment', {
        method: 'POST',
        body: JSON.stringify({
          action: 'check_referral_control',
          control_number: digits,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        available?: boolean;
        code?: string;
        error?: string;
      };
      if (seq !== referralCheckSeqRef.current) {
        return 'error';
      }
      if (res.ok && json.success && json.available) {
        setReferralControlCheck('available');
        return 'available';
      }
      const code = String(json.code || '');
      if (code === 'referral_control_used') {
        setReferralControlCheck('used');
        return 'used';
      }
      if (code === 'referral_control_not_found') {
        setReferralControlCheck('not_found');
        return 'not_found';
      }
      if (code === 'referral_control_invalid') {
        setReferralControlCheck('invalid');
        return 'invalid';
      }
      setReferralControlCheck('error');
      return 'error';
    } catch {
      if (seq === referralCheckSeqRef.current) {
        setReferralControlCheck('error');
      }
      return 'error';
    }
  };

  // Live-check referral voucher as soon as 5 digits are entered.
  useEffect(() => {
    if (!formData.hasReferralCode) {
      setReferralControlCheck('idle');
      return;
    }
    const digits = formData.referralCardControlNumber.replace(/\D/g, '');
    if (digits.length !== 5) {
      setReferralControlCheck(digits.length === 0 ? 'idle' : 'invalid');
      return;
    }
    const handle = window.setTimeout(() => {
      void verifyReferralControlNow(digits);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [formData.hasReferralCode, formData.referralCardControlNumber]);

  const advanceToNextStep = async () => {
    // Persist the destination step so "Continue enrollment" resumes where the
    // student left off (the next incomplete step), not the last completed one.
    const nextStep = Math.min(currentStep + 1, 6);
    const ok = await saveEnrollment('save_draft', nextStep);
    if (!ok) return;
    setCurrentStep(nextStep);
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
    if (currentStep === 5) {
      if (!validateStep5()) return;
      if (formData.hasReferralCode) {
        const check = await verifyReferralControlNow(formData.referralCardControlNumber);
        if (check === 'used') {
          toast.error(t('form.val.referralControlUsed'));
          return;
        }
        if (check === 'not_found') {
          toast.error(t('form.val.referralControlNotFound'));
          return;
        }
        if (check === 'invalid') {
          toast.error(t('form.val.referralControl'));
          return;
        }
        if (check !== 'available') {
          toast.error(t('form.val.referralGeneric'));
          return;
        }
      }
    }
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
    if (!validateStep5()) return;
    if (formData.hasReferralCode) {
      const check = await verifyReferralControlNow(formData.referralCardControlNumber);
      if (check === 'used') {
        toast.error(t('form.val.referralControlUsed'));
        setCurrentStep(5);
        return;
      }
      if (check === 'not_found') {
        toast.error(t('form.val.referralControlNotFound'));
        setCurrentStep(5);
        return;
      }
      if (check !== 'available') {
        toast.error(t('form.val.referralGeneric'));
        setCurrentStep(5);
        return;
      }
    }
    if (!formData.modeOfPayment?.trim()) {
      toast.error(t('form.val.paymentSelect'));
      return;
    }
    if (formData.paymentArrangement !== 'full_payment' && formData.paymentArrangement !== 'installment') {
      toast.error(t('form.val.paymentArrangementSelect'));
      return;
    }
    if (!formData.confirmInformation) {
      toast.error(t('form.val.confirmInfo'));
      return;
    }
    submitInFlightRef.current = true;
    try {
      await saveEnrollment('submit', 6);
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const paymentOptions = useMemo(
    () => [
      { value: 'qvr', label: t('form.payment.qvr') },
      { value: 'esc', label: t('form.payment.esc') },
      { value: 'qva', label: t('form.payment.qva') },
      { value: 'als', label: t('form.payment.als') },
      { value: 'cash', label: t('form.payment.cash') },
    ],
    [t],
  );

  const paymentArrangementOptions = useMemo(
    () => [
      { value: 'full_payment' as const, label: t('form.payment.fullPayment') },
      { value: 'installment' as const, label: t('form.payment.installment') },
    ],
    [t],
  );

  const referrerTypeOptions = useMemo(
    () => [
      { value: 'enrolled_student', label: t('form.payment.referrerType.enrolledStudent') },
      { value: 'graduate', label: t('form.payment.referrerType.graduate') },
      { value: 'parent_civilian', label: t('form.payment.referrerType.parentCivilian') },
      { value: 'visitation', label: t('form.payment.referrerType.visitation') },
      { value: 'other_civilian', label: t('form.payment.referrerType.otherCivilian') },
    ],
    [t],
  );

  const tabs = useMemo(
    () => [
      { number: 1, name: t('enrollment.step1'), icon: User },
      { number: 2, name: t('enrollment.step2'), icon: Users },
      { number: 3, name: t('enrollment.step3'), icon: GraduationCap },
      { number: 4, name: t('enrollment.step4'), icon: Upload },
      { number: 5, name: t('enrollment.step5'), icon: DollarSign },
      { number: 6, name: t('enrollment.step6'), icon: FileCheck },
    ],
    [t],
  );

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
  const hasRejectedDocuments = useMemo(
    () => documents.some((doc) => isRegistrarRejectionDecision(doc.registrarDecision)),
    [documents],
  );
  const isResubmitFlow = searchParams.get("resubmit") === "1" || hasRejectedDocuments;
  const lockedView = enrollmentAllowed && isEnrollmentLocked && !showNewEnrollmentForm && !isResubmitFlow;

  const isFirstTimeEnrollmentUser = useMemo(() => {
    if (!enrollmentMetaLoaded) return false;
    if (isResubmitFlow) return false;
    if (showNewEnrollmentForm) return false;
    if (needsGrade12Confirmation) return false;
    if (reEnrollmentEligible) return false;
    if (priorApproved?.school_year) return false;
    if (isEnrollmentLocked) return false;
    return enrollmentId === null;
  }, [
    enrollmentMetaLoaded,
    isResubmitFlow,
    showNewEnrollmentForm,
    needsGrade12Confirmation,
    reEnrollmentEligible,
    priorApproved?.school_year,
    isEnrollmentLocked,
    enrollmentId,
  ]);

  const showWelcomeNav = currentStep === 1 && isFirstTimeEnrollmentUser;

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
    const enrolledGradeNumber =
      parseInt(String(enrollmentGradeLevel).replace(/\D/g, ""), 10) || 0;
    const showEnrolledPhysicalDocsNotice = isEnrolled && enrolledGradeNumber !== 12;
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
                {showEnrolledPhysicalDocsNotice ? (
                  <p className="text-sm text-gray-700 mt-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-left">
                    <span className="block text-xs font-semibold text-amber-900 mb-1">
                      Physical documents
                    </span>
                    Hand-deliver the original copies of your required documents to the
                    registrar's office. Check <strong>Application Status</strong> for your checklist.
                  </p>
                ) : null}
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
              {t('form.alert.prefill', {
                year: schoolYearCurrent,
                source: priorApproved?.school_year
                  ? t('form.alert.prefillSource', { year: priorApproved.school_year })
                  : t('form.alert.prefillLast'),
              })}
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
                {t('enrollment.stepOf', { current: currentStep, total: tabs.length })}
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
                <h2 className="text-2xl font-semibold mb-6">{t('enrollment.step1')}</h2>
                
                {/* Enrollment Status */}
                <div className="mb-6">
                  <RequiredLabel className="mb-3 block">{t('form.enrollmentStatus')}</RequiredLabel>
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
                        <span>{translateEnrollmentStatus(status, t)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="givenName">{t('form.firstName')}</RequiredLabel>
                    <Input
                      id="givenName"
                      value={formData.givenName}
                      onChange={(e) => handleInputChange('givenName', e.target.value)}
                      placeholder={t('form.ph.firstName')}
                      disabled={isPermanentlyLockedField}
                      className={`uppercase${isPermanentlyLockedField ? lockedPrefillInputClass : ""}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="middleName">{t('form.middleName')}</RequiredLabel>
                    <Input
                      id="middleName"
                      value={formData.middleName}
                      onChange={(e) => handleInputChange('middleName', e.target.value)}
                      placeholder={t('form.ph.middleName')}
                      required
                      disabled={isPermanentlyLockedField}
                      className={`uppercase${isPermanentlyLockedField ? lockedPrefillInputClass : ""}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="middleInitial">{t('form.middleInitial')}</RequiredLabel>
                    <Input
                      id="middleInitial"
                      value={formData.middleInitial}
                      onChange={(e) => handleInputChange('middleInitial', e.target.value)}
                      placeholder={t('form.ph.middleInitial')}
                      maxLength={2}
                      required
                      disabled={isPermanentlyLockedField}
                      className={`uppercase${isPermanentlyLockedField ? lockedPrefillInputClass : ""}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="lastName">{t('form.lastName')}</RequiredLabel>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      placeholder={t('form.ph.lastName')}
                      disabled={isPermanentlyLockedField}
                      className={`uppercase${isPermanentlyLockedField ? lockedPrefillInputClass : ""}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extensionName">{t('form.extensionName')}</Label>
                    <Input
                      id="extensionName"
                      value={formData.extensionName}
                      onChange={(e) => handleInputChange('extensionName', e.target.value)}
                      placeholder={t('form.ph.extension')}
                      disabled={isPermanentlyLockedField}
                      className={`uppercase${isPermanentlyLockedField ? lockedPrefillInputClass : ""}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="gender">{t('form.gender')}</RequiredLabel>
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
                      <option value="">{t('form.select.gender')}</option>
                      <option value="Female">{t('form.gender.female')}</option>
                      <option value="Male">{t('form.gender.male')}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="contactNumber">{t('form.contactNumber')}</RequiredLabel>
                    <Input
                      id="contactNumber"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={formData.contactNumber}
                      onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                      placeholder={t('form.ph.contact')}
                      maxLength={11}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="email">{t('form.email')}</RequiredLabel>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      readOnly
                      disabled
                      autoComplete="email"
                      placeholder={t('form.ph.email')}
                      className={lockedPrefillInputClass.trim()}
                    />
                    <p className="text-xs text-gray-500">
                      Uses the email from your registration / login. Update it in Profile if needed.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="lrn">{t('form.lrn')}</RequiredLabel>
                    <Input
                      id="lrn"
                      type="text"
                      inputMode="numeric"
                      value={formData.lrn}
                      onChange={(e) => handleInputChange('lrn', e.target.value)}
                      placeholder={t('form.ph.lrn')}
                      maxLength={12}
                      disabled={isPermanentlyLockedField}
                      className={isPermanentlyLockedField ? lockedPrefillInputClass.trim() : undefined}
                    />
                    <p className="text-xs text-gray-500">{t('form.hint.lrn')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address Section */}
            <Card>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <h3 className="text-xl font-semibold mb-4">{t('form.address')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="blockLotHouseNo">{t('form.blockLot')}</Label>
                    <Input
                      id="blockLotHouseNo"
                      value={formData.blockLotHouseNo}
                      onChange={(e) => handleInputChange('blockLotHouseNo', e.target.value)}
                      placeholder={t('form.ph.blockLot')}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="street">{t('form.street')}</RequiredLabel>
                    <Input
                      id="street"
                      value={formData.street}
                      onChange={(e) => handleInputChange('street', e.target.value)}
                      placeholder={t('form.ph.street')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compoundSubdivisionVillage">{t('form.compound')}</Label>
                    <Input
                      id="compoundSubdivisionVillage"
                      value={formData.compoundSubdivisionVillage}
                      onChange={(e) => handleInputChange('compoundSubdivisionVillage', e.target.value)}
                      placeholder={t('form.ph.compound')}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="municipality">{t('form.municipality')}</RequiredLabel>
                    <Combobox
                      id="municipality"
                      value={formData.municipality}
                      onChange={handleMunicipalityChange}
                      options={NCR_MUNICIPALITIES}
                      placeholder={t('form.ph.municipality')}
                      ariaLabel="Show city / municipality options"
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="barangay">{t('form.barangay')}</RequiredLabel>
                    <Combobox
                      id="barangay"
                      value={formData.barangay}
                      onChange={handleBarangayChange}
                      options={addressBarangayOptions}
                      placeholder={
                        formData.municipality.trim()
                          ? t('form.ph.barangay')
                          : t('form.ph.barangayFirst')
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
                <h3 className="text-xl font-semibold mb-4">{t('form.birthAndAcademic')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="birthDate">{t('form.birthDate')}</RequiredLabel>
                    <UsDateInput
                      id="birthDate"
                      value={formData.birthDate}
                      max={birthDateBounds.max}
                      placeholder={t('form.ph.birthDate')}
                      disabled={isPermanentlyLockedField}
                      className={isPermanentlyLockedField ? lockedPrefillInputClass.trim() : undefined}
                      onChange={(ymd) =>
                        setFormData((prev) =>
                          prev.birthDate === ymd ? prev : { ...prev, birthDate: ymd },
                        )
                      }
                      onBlurInvalid={() => toast.error(t('form.val.birthDateFormat'))}
                    />
                    <p className="text-xs text-gray-500">{t('form.hint.birthDate')}</p>
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="birthPlace">{t('form.birthPlace')}</RequiredLabel>
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
                      <option value="">{t('form.select.birthPlace')}</option>
                      {NCR_MUNICIPALITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__OTHER__">{t('form.select.birthPlaceOther')}</option>
                    </select>
                    {isBirthPlaceOther || formData.birthPlace === "" ? (
                      <Input
                        value={formData.birthPlace}
                        onChange={(e) => handleInputChange("birthPlace", e.target.value)}
                        placeholder={t('form.ph.birthPlaceOther')}
                        disabled={isPermanentlyLockedField}
                        className={isPermanentlyLockedField ? lockedPrefillInputClass.trim() : undefined}
                      />
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="religion">{t('form.religion')}</RequiredLabel>
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
                      <option value="">{t('form.select.religion')}</option>
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
                    <RequiredLabel>{t('form.gradeLevel')}</RequiredLabel>
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
                          <span>{t('form.grade', { level: grade })}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="strand">{t('form.strand')}</RequiredLabel>
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
                      <option value="">{t('form.select.strand')}</option>
                      {STRANDS.map((strand) => (
                        <option key={strand.code} value={strand.code}>
                          {formatStrandDisplay(strand.code)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="preferredSchedule">{t('form.preferredSchedule')}</RequiredLabel>
                    {isGrade12PromotionFlow && currentStudentSection ? (
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {t('form.hint.grade12Section', { section: currentStudentSection })}
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
                      <option value="">{t('form.select.schedule')}</option>
                      <option value="Morning Shift">{t('form.schedule.morning')}</option>
                      <option value="Afternoon Shift">{t('form.schedule.afternoon')}</option>
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
            <p className="text-sm text-gray-600 -mt-2 mb-2">{t('form.family.hint')}</p>
            {/* Mother's Information */}
            <Card>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <h2 className="text-2xl font-semibold mb-6">{t('form.mother.section')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="motherGivenName">{t('form.mother.firstName')}</RequiredLabel>
                    <Input
                      id="motherGivenName"
                      value={formData.motherGivenName}
                      onChange={(e) => handleInputChange('motherGivenName', e.target.value)}
                      placeholder={t('form.ph.motherFirstName')}
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="motherMaidenMiddleName">{t('form.mother.middleName')}</RequiredLabel>
                    <Input
                      id="motherMaidenMiddleName"
                      value={formData.motherMaidenMiddleName}
                      onChange={(e) => handleInputChange('motherMaidenMiddleName', e.target.value)}
                      placeholder={t('form.ph.motherMiddleName')}
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="motherMaidenLastName">{t('form.mother.lastName')}</RequiredLabel>
                    <Input
                      id="motherMaidenLastName"
                      value={formData.motherMaidenLastName}
                      onChange={(e) => handleInputChange('motherMaidenLastName', e.target.value)}
                      placeholder={t('form.ph.motherLastName')}
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="motherContactNumber">{t('form.mother.contact')}</RequiredLabel>
                    <Input
                      id="motherContactNumber"
                      type="tel"
                      inputMode="numeric"
                      value={formData.motherContactNumber}
                      onChange={(e) => handleInputChange('motherContactNumber', e.target.value)}
                      placeholder={t('form.ph.contact')}
                      maxLength={11}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="motherOccupation">{t('form.mother.occupation')}</RequiredLabel>
                    <Input
                      id="motherOccupation"
                      value={formData.motherOccupation}
                      onChange={(e) => handleInputChange('motherOccupation', e.target.value)}
                      placeholder={t('form.ph.motherOccupation')}
                      className="uppercase"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Father's Information */}
            <Card>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <h2 className="text-2xl font-semibold mb-6">{t('form.father.section')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="fatherGivenName">{t('form.father.firstName')}</RequiredLabel>
                    <Input
                      id="fatherGivenName"
                      value={formData.fatherGivenName}
                      onChange={(e) => handleInputChange('fatherGivenName', e.target.value)}
                      placeholder={t('form.ph.fatherFirstName')}
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="fatherMiddleName">{t('form.father.middleName')}</RequiredLabel>
                    <Input
                      id="fatherMiddleName"
                      value={formData.fatherMiddleName}
                      onChange={(e) => handleInputChange('fatherMiddleName', e.target.value)}
                      placeholder={t('form.ph.fatherMiddleName')}
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="fatherLastName">{t('form.father.lastName')}</RequiredLabel>
                    <Input
                      id="fatherLastName"
                      value={formData.fatherLastName}
                      onChange={(e) => handleInputChange('fatherLastName', e.target.value)}
                      placeholder={t('form.ph.fatherLastName')}
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="fatherContactNumber">{t('form.father.contact')}</RequiredLabel>
                    <Input
                      id="fatherContactNumber"
                      type="tel"
                      inputMode="numeric"
                      value={formData.fatherContactNumber}
                      onChange={(e) => handleInputChange('fatherContactNumber', e.target.value)}
                      placeholder={t('form.ph.contact')}
                      maxLength={11}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="fatherOccupation">{t('form.father.occupation')}</RequiredLabel>
                    <Input
                      id="fatherOccupation"
                      value={formData.fatherOccupation}
                      onChange={(e) => handleInputChange('fatherOccupation', e.target.value)}
                      placeholder={t('form.ph.fatherOccupation')}
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
                    <span className="font-medium">{t('form.guardian.checkbox')}</span>
                  </label>
                </div>

                {formData.hasGuardian && (
                  <>
                    <h2 className="text-2xl font-semibold mb-6">{t('form.guardian.section')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <RequiredLabel htmlFor="guardianGivenName">{t('form.guardian.firstName')}</RequiredLabel>
                        <Input
                          id="guardianGivenName"
                          value={formData.guardianGivenName}
                          onChange={(e) => handleInputChange('guardianGivenName', e.target.value)}
                          placeholder={t('form.ph.guardianFirstName')}
                          className="uppercase"
                        />
                      </div>
                      <div className="space-y-2">
                        <RequiredLabel htmlFor="guardianMiddleName">{t('form.guardian.middleName')}</RequiredLabel>
                        <Input
                          id="guardianMiddleName"
                          value={formData.guardianMiddleName}
                          onChange={(e) => handleInputChange('guardianMiddleName', e.target.value)}
                          placeholder={t('form.ph.guardianMiddleName')}
                          className="uppercase"
                        />
                      </div>
                      <div className="space-y-2">
                        <RequiredLabel htmlFor="guardianLastName">{t('form.guardian.lastName')}</RequiredLabel>
                        <Input
                          id="guardianLastName"
                          value={formData.guardianLastName}
                          onChange={(e) => handleInputChange('guardianLastName', e.target.value)}
                          placeholder={t('form.ph.guardianLastName')}
                          className="uppercase"
                        />
                      </div>
                      <div className="space-y-2">
                        <RequiredLabel htmlFor="guardianContactNumber">{t('form.guardian.contact')}</RequiredLabel>
                        <Input
                          id="guardianContactNumber"
                          type="tel"
                          inputMode="numeric"
                          value={formData.guardianContactNumber}
                          onChange={(e) => handleInputChange('guardianContactNumber', e.target.value)}
                          placeholder={t('form.ph.contact')}
                          maxLength={11}
                        />
                      </div>
                      <div className="space-y-2">
                        <RequiredLabel htmlFor="relationshipToGuardian">{t('form.guardian.relationship')}</RequiredLabel>
                        <Input
                          id="relationshipToGuardian"
                          value={formData.relationshipToGuardian}
                          onChange={(e) => handleInputChange('relationshipToGuardian', e.target.value)}
                          placeholder={t('form.ph.guardianRelationship')}
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
                <RequiredLabel className="text-2xl font-semibold mb-6 block">{t('form.emergency.section')}</RequiredLabel>
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
                      <span>{translateEmergencyContact(contact, t)}</span>
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
                <h2 className="text-2xl font-semibold mb-6">{t('enrollment.step3')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <RequiredLabel htmlFor="previousSchoolAttended">{t('form.history.previousSchool')}</RequiredLabel>
                    <Input
                      id="previousSchoolAttended"
                      value={formData.previousSchoolAttended}
                      onChange={(e) => handleInputChange('previousSchoolAttended', e.target.value)}
                      placeholder={t('form.ph.previousSchool')}
                      required
                      inputMode="text"
                      autoComplete="organization"
                      disabled={lockEnrollmentHistory}
                      className={`uppercase${lockEnrollmentHistory ? ' bg-gray-100 text-gray-700' : ''}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel>{t('form.history.schoolType')}</RequiredLabel>
                    <div className="flex gap-4 pt-2" role="radiogroup" aria-required="true">
                      {(['public', 'private'] as const).map((type) => (
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
                          <span>{t(type === 'public' ? 'form.schoolType.public' : 'form.schoolType.private')}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="gradeLevelAtPreviousSchool">{t('form.history.gradeLevel')}</RequiredLabel>
                    <select
                      id="gradeLevelAtPreviousSchool"
                      value={formData.gradeLevelAtPreviousSchool}
                      onChange={(e) => handleInputChange('gradeLevelAtPreviousSchool', e.target.value)}
                      required
                      disabled={lockEnrollmentHistory}
                      className={`w-full h-10 px-3 rounded-md border border-gray-300 text-sm uppercase disabled:opacity-100 ${
                        lockEnrollmentHistory ? 'bg-gray-100 text-gray-700 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]'
                      }`}
                    >
                      <option value="">{t('form.select.gradeLevel')}</option>
                      <option value="Grade 10">Grade 10</option>
                      <option value="Grade 11">Grade 11</option>
                      <option value="Grade 12">Grade 12</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="sectionAtPreviousSchool">{t('form.history.section')}</RequiredLabel>
                    <Input
                      id="sectionAtPreviousSchool"
                      value={formData.sectionAtPreviousSchool}
                      onChange={(e) => handleInputChange('sectionAtPreviousSchool', e.target.value)}
                      placeholder={t('form.ph.section')}
                      required
                      inputMode="text"
                      disabled={lockEnrollmentHistory}
                      className={`uppercase${lockEnrollmentHistory ? ' bg-gray-100 text-gray-700' : ''}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel htmlFor="lastSchoolYearAttended">{t('form.history.lastSchoolYear')}</RequiredLabel>
                    <SchoolYearCombobox
                      id="lastSchoolYearAttended"
                      value={formData.lastSchoolYearAttended}
                      onChange={(value) => handleInputChange("lastSchoolYearAttended", value)}
                      options={lastSchoolYearOptions}
                      placeholder={t('form.ph.lastSchoolYear')}
                      disabled={lockEnrollmentHistory}
                      className={lockEnrollmentHistory ? 'bg-gray-100 text-gray-700' : undefined}
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
                <CardTitle>{t('form.docs.title')}</CardTitle>
                <CardDescription>{t('form.docs.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isResubmitFlow ? (
                  <Alert className="border-amber-300 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-700" />
                    <AlertDescription className="text-amber-900">{t('form.docs.resubmit')}</AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {t('form.docs.tip', { maxSize: MAX_DOCUMENT_UPLOAD_LABEL })}
                    </AlertDescription>
                  </Alert>
                )}

                {documents.map((doc, index) => {
                  // Check if document should be displayed
                  const shouldShow = shouldShowDocumentRequirement(doc, formData.enrollmentStatus);

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
                            {translateEnrollmentDocumentName(doc.name, t)}
                            {doc.requiredFor === 'transferee' && (
                              <span className="text-sm text-gray-500 ml-2">{t('form.docs.transfereeNote')}</span>
                            )}
                            {!doc.required && (
                              <span className="text-sm text-gray-500 ml-2">{t('form.docs.optionalNote')}</span>
                            )}
                          </p>
                          {doc.file && (
                            <p className="text-sm text-gray-600">{doc.file.name}</p>
                          )}
                          {docNeedsResubmit && doc.registrarRemarks ? (
                            <p className="text-sm text-red-700 mt-1">
                              <strong>{t('form.docs.registrarNote')}</strong> {doc.registrarRemarks}
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
                              {t('form.doc.bringRegistrar')}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="cursor-not-allowed opacity-60"
                              title={`You have used all ${UPLOAD_ATTEMPT_LIMIT} resubmit attempts for this document.`}
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              {t('form.doc.uploadDisabled')}
                            </Button>
                          </>
                        ) : docNeedsResubmit ? (
                          <>
                            <Badge variant="default" className="bg-red-600">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {isGrade12PromotionFlow ? t('form.doc.contactRegistrar') : t('form.doc.resubmitRequired')}
                            </Badge>
                            {!isGrade12PromotionFlow ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-600 text-red-700 hover:bg-red-600 hover:text-white"
                                onClick={openUploadPicker}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                {t('form.doc.reupload')}
                              </Button>
                            ) : (
                              <Badge variant="outline" className="border-gray-400 text-gray-600">
                                {t('form.doc.locked')}
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
                                {t('form.doc.retryCheck')}
                              </Button>
                            ) : lockedForResubmit || !docMeta.allowReupload ? (
                              <Badge variant="outline" className="border-gray-400 text-gray-600">
                                {enrollmentFinalized ? t('form.doc.onFile') : t('form.doc.locked')}
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={openUploadPicker}
                              >
                                {t('form.doc.reupload')}
                              </Button>
                            )}
                          </>
                        ) : lockedForResubmit ? (
                          <Badge variant="outline" className="border-gray-400 text-gray-600">
                            {t('form.doc.locked')}
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[#8B1538] text-[#8B1538] hover:bg-[#8B1538] hover:text-white"
                            onClick={openUploadPicker}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            {t('form.doc.upload')}
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
                        {t('form.docs.authenticityTitle')}
                      </label>
                      <p className="leading-relaxed text-gray-700">{t('form.docs.authenticityBody')}</p>
                      <p className="text-xs text-gray-500">{t('form.docs.authenticityFootnote')}</p>
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
                <h2 className="text-2xl font-semibold mb-2">{t('form.payment.promo')}</h2>
                <p className="text-sm text-gray-600 mb-6 rounded-md border border-blue-100 bg-blue-50/80 px-3 py-2">
                  {t('form.payment.promoHint')}
                </p>
                <div className="mb-4">
                  <RequiredLabel className="mb-3 block">{t('form.payment.hasReferral')}</RequiredLabel>
                  <div className="flex flex-wrap gap-3 sm:gap-4">
                    {(['yes', 'no'] as const).map((option) => (
                      <label key={option} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hasReferralCode"
                          checked={
                            option === 'yes'
                              ? formData.hasReferralCode === true
                              : formData.hasReferralCode === false
                          }
                          onChange={() => handleInputChange('hasReferralCode', option === 'yes')}
                          className="w-4 h-4 text-[#8B1538] border-gray-300 focus:ring-[#8B1538]"
                        />
                        <span>{t(option === 'yes' ? 'form.payment.yes' : 'form.payment.no')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {formData.hasReferralCode && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="referralCardControlNumber">{t('form.payment.referralControl')}</RequiredLabel>
                      <Input
                        id="referralCardControlNumber"
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        value={formData.referralCardControlNumber}
                        onChange={(e) => handleInputChange('referralCardControlNumber', e.target.value)}
                        placeholder={t('form.ph.referralControl')}
                        className={
                          referralControlCheck === 'used' || referralControlCheck === 'not_found'
                            ? 'border-red-500 focus-visible:ring-red-500'
                            : referralControlCheck === 'available'
                              ? 'border-green-600 focus-visible:ring-green-600'
                              : undefined
                        }
                        aria-invalid={
                          referralControlCheck === 'used' || referralControlCheck === 'not_found'
                        }
                      />
                      {referralControlCheck === 'checking' && (
                        <p className="text-xs text-gray-500">{t('form.val.referralControlChecking')}</p>
                      )}
                      {referralControlCheck === 'available' && (
                        <p className="text-xs text-green-700">{t('form.val.referralControlAvailable')}</p>
                      )}
                      {referralControlCheck === 'used' && (
                        <p className="text-xs text-red-600">{t('form.val.referralControlUsed')}</p>
                      )}
                      {referralControlCheck === 'not_found' && (
                        <p className="text-xs text-red-600">{t('form.val.referralControlNotFound')}</p>
                      )}
                      {referralControlCheck === 'invalid' &&
                        formData.referralCardControlNumber.replace(/\D/g, '').length > 0 && (
                          <p className="text-xs text-red-600">{t('form.val.referralControl')}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="referrerName">{t('form.payment.referrerName')}</RequiredLabel>
                      <Input
                        id="referrerName"
                        value={formData.referrerName}
                        onChange={(e) => handleInputChange('referrerName', e.target.value)}
                        placeholder={t('form.ph.referrerName')}
                      />
                    </div>
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="referrerContactNumber">{t('form.payment.referrerContact')}</RequiredLabel>
                      <Input
                        id="referrerContactNumber"
                        type="tel"
                        inputMode="numeric"
                        value={formData.referrerContactNumber}
                        onChange={(e) => handleInputChange('referrerContactNumber', e.target.value)}
                        placeholder={t('form.ph.contact')}
                        maxLength={11}
                      />
                    </div>
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="referrerEmail">{t('form.payment.referrerEmail')}</RequiredLabel>
                      <Input
                        id="referrerEmail"
                        type="email"
                        autoComplete="email"
                        value={formData.referrerEmail}
                        onChange={(e) => handleInputChange('referrerEmail', e.target.value)}
                        placeholder={t('form.ph.referrerEmail')}
                      />
                    </div>
                    <div className="space-y-2">
                      <RequiredLabel htmlFor="referrerType">{t('form.payment.referrerType.label')}</RequiredLabel>
                      <select
                        id="referrerType"
                        value={formData.referrerType}
                        onChange={(e) => handleInputChange('referrerType', e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="">{t('form.payment.referrerType.placeholder')}</option>
                        {referrerTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Accounting - Mode of Payment */}
            <Card>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <h2 className="text-2xl font-semibold mb-6">{t('form.payment.accounting')}</h2>
                <div className="space-y-4">
                  <RequiredLabel className="mb-3 block">{t('form.payment.mode')}</RequiredLabel>
                  <div className="space-y-2">
                    {paymentOptions.map((option) => (
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
                    {t('form.payment.voucherHint')}
                  </p>
                </div>

                <div className="space-y-4 mt-8 pt-6 border-t">
                  <RequiredLabel className="mb-3 block">{t('form.payment.arrangement')}</RequiredLabel>
                  <div className="space-y-2">
                    {paymentArrangementOptions.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentArrangement"
                          value={option.value}
                          checked={formData.paymentArrangement === option.value}
                          onChange={(e) =>
                            handleInputChange(
                              'paymentArrangement',
                              e.target.value as EnrollmentFormData['paymentArrangement'],
                            )
                          }
                          className="w-4 h-4 text-[#8B1538] border-gray-300 focus:ring-[#8B1538]"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
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
                <CardTitle>{t('form.review.title')}</CardTitle>
                <CardDescription>{t('form.review.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-[#8B1538]">{t('enrollment.step1')}</h3>
                  <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-gray-600">{t('form.enrollmentStatus')}</p>
                      <p className="font-medium">{displayEnrollmentText(translateEnrollmentStatus(formData.enrollmentStatus, t))}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">{t('form.review.fullName')}</p>
                      <p className="font-medium">
                        {displayFullName(
                          formData.givenName,
                          formData.middleName,
                          formData.lastName,
                          formData.extensionName,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">{t('form.gender')}</p>
                      <p className="font-medium">{displayEnrollmentText(formData.gender)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">{t('form.review.birthDate')}</p>
                      <p className="font-medium">
                        {displayEnrollmentText(formatBirthDateUsDisplay(formData.birthDate) || formData.birthDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">{t('form.lrn')}</p>
                      <p className="font-medium">{displayEnrollmentText(formData.lrn)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">{t('form.review.contact')}</p>
                      <p className="font-medium">{displayEnrollmentText(formData.contactNumber)}</p>
                    </div>
                  </div>
                </div>

                {/* Academic Information */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-[#8B1538]">{t('form.review.academic')}</h3>
                  <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-gray-600">{t('form.gradeLevel')}</p>
                      <p className="font-medium">{formatGradeLevelDisplay(formData.gradeLevel)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">{t('form.strand')}</p>
                      <p className="font-medium">{displayStrandText(formData.strand)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">{t('form.preferredSchedule')}</p>
                      <p className="font-medium">{displayEnrollmentText(formData.preferredSchedule)}</p>
                    </div>
                  </div>
                </div>

                {/* Family Information */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-[#8B1538]">{t('form.review.family')}</h3>
                  <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-gray-600">{t('form.review.motherName')}</p>
                      <p className="font-medium">
                        {displayFullName(
                          formData.motherGivenName,
                          formData.motherMaidenMiddleName,
                          formData.motherMaidenLastName,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">{t('form.review.fatherName')}</p>
                      <p className="font-medium">
                        {displayFullName(
                          formData.fatherGivenName,
                          formData.fatherMiddleName,
                          formData.fatherLastName,
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mode of Payment */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-[#8B1538]">{t('form.review.payment')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">{t('form.payment.mode')}</p>
                      <p className="font-medium">{displayEnrollmentText(formData.modeOfPayment)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">{t('form.payment.arrangement')}</p>
                      <p className="font-medium">{formatPaymentArrangementDisplay(formData.paymentArrangement)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">{t('form.review.voucherNo')}</p>
                      <p className="font-medium text-gray-700">
                        {displayEnrollmentText(
                          formData.modeOfPayment === 'cash'
                            ? t('form.review.voucherCash')
                            : t('form.review.voucherLater'),
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.confirmInformation}
                      onChange={(e) => handleInputChange('confirmInformation', e.target.checked)}
                      className="w-5 h-5 mt-0.5 text-[#8B1538] border-gray-300 rounded focus:ring-[#8B1538]"
                    />
                    <span className="text-sm">{t('form.review.confirm')}</span>
                  </label>
                </div>

                <Alert className="border-[#8B1538] bg-red-50">
                  <AlertCircle className="h-4 w-4 text-[#8B1538]" />
                  <AlertDescription className="text-[#8B1538]">{t('form.review.submitAlert')}</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="bg-white border-t p-6">
        <div className="flex w-full items-center justify-between">
          {showWelcomeNav ? (
            <div className="min-w-0 pr-4">
              <p className="text-sm font-semibold text-[#2D5016]">
                {t('enrollment.welcome')}
                {user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
              </p>
              <p className="mt-0.5 text-xs text-gray-600">{t('enrollment.welcomeHint')}</p>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || isSaving || isEnrollmentLocked || !enrollmentAllowed}
              className="border-gray-300"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              {t('form.nav.back')}
            </Button>
          )}
          {currentStep < 6 ? (
            <Button
              onClick={handleNext}
              disabled={
                isSaving ||
                isEnrollmentLocked ||
                !enrollmentAllowed ||
                (currentStep === 4 && !documentsAuthenticityConfirmed && !lockGrade12PrefilledSections) ||
                (currentStep === 5 &&
                  formData.hasReferralCode === true &&
                  (referralControlCheck === 'used' ||
                    referralControlCheck === 'not_found' ||
                    referralControlCheck === 'checking' ||
                    referralControlCheck === 'invalid'))
              }
              className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
            >
              {isSaving ? t('form.nav.saving') : t('form.nav.next')}
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
              {isSaving ? t('form.nav.submitting') : t('form.nav.submit')}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={missingParentDialogOpen} onOpenChange={setMissingParentDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#8B1538]">{t('form.dialog.parentTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  {t('form.dialog.parentBody', {
                    parts: missingParentParts.join(
                      locale === 'tl' ? ' at ' : ' and ',
                    ),
                  })}
                </p>
                <p>{t('form.dialog.parentHint')}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('form.dialog.goBack')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
              onClick={() => void handleMissingParentContinue()}
            >
              {t('form.dialog.continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}