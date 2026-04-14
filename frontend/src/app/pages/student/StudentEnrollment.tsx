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
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { apiFetch } from "../../lib/api";
import { useEnrollmentAllowed } from "../../context/SchoolYearContext";

/** YYYY-MM-DD in local calendar (avoids UTC shifting the day on `<input type="date">`). */
function formatLocalDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Senior High: learner must be at least this many years old (DepEd K–12 typical range). */
const SHS_MIN_AGE_YEARS = 15;

function birthDateBoundsForShs(minAgeYears: number) {
  const now = new Date();
  const maxDob = new Date(now.getFullYear() - minAgeYears, now.getMonth(), now.getDate());
  const minDob = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
  return { min: formatLocalDateYmd(minDob), max: formatLocalDateYmd(maxDob) };
}

function isBirthDateValidForShs(ymd: string, minAgeYears: number): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const { min, max } = birthDateBoundsForShs(minAgeYears);
  return ymd >= min && ymd <= max;
}

interface DocumentUpload {
  name: string;
  file: File | null;
  status: 'missing' | 'uploaded';
  required: boolean;
  requiredFor?: 'all' | 'transferee';
  uploadedId?: number;
  uploadedAt?: string;
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

export function StudentEnrollment() {
  const enrollmentAllowed = useEnrollmentAllowed();
  const shsBirthDateBounds = useMemo(() => birthDateBoundsForShs(SHS_MIN_AGE_YEARS), []);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnrollmentLocked, setIsEnrollmentLocked] = useState(false);
  const [enrollmentId, setEnrollmentId] = useState<number | null>(null);
  const [formData, setFormData] = useState<EnrollmentFormData>({
    enrollmentStatus: '',
    givenName: '',
    middleName: '',
    middleInitial: '',
    lastName: '',
    extensionName: '',
    gender: '',
    contactNumber: '',
    email: '',
    lrn: '',
    blockLotHouseNo: '',
    street: '',
    compoundSubdivisionVillage: '',
    barangay: '',
    municipality: '',
    birthDate: '',
    birthPlace: '',
    religion: '',
    gradeLevel: '',
    strand: 'HUMSS',
    preferredSchedule: '',
    motherGivenName: '',
    motherMaidenMiddleName: '',
    motherMaidenLastName: '',
    motherContactNumber: '',
    motherOccupation: '',
    fatherGivenName: '',
    fatherMiddleName: '',
    fatherLastName: '',
    fatherContactNumber: '',
    fatherOccupation: '',
    hasGuardian: false,
    guardianGivenName: '',
    guardianMiddleName: '',
    guardianLastName: '',
    guardianContactNumber: '',
    relationshipToGuardian: '',
    emergencyContact: '',
    previousSchoolAttended: '',
    schoolType: '',
    gradeLevelAtPreviousSchool: '',
    sectionAtPreviousSchool: '',
    lastSchoolYearAttended: '',
    hasReferralCode: false,
    referralCardControlNumber: '',
    referrerName: '',
    referrerContactNumber: '',
    modeOfPayment: '',
    voucherNo: '',
    confirmInformation: false,
  });

  const [documents, setDocuments] = useState<DocumentUpload[]>([
    { name: 'PSA Birth Certificate', file: null, status: 'missing', required: true, requiredFor: 'all' },
    { name: 'Grade 10 Report Card (SF9)', file: null, status: 'missing', required: true, requiredFor: 'all' },
    { name: 'Good Moral Certificate', file: null, status: 'missing', required: true, requiredFor: 'all' },
    { name: 'SF10 / Form 137', file: null, status: 'missing', required: true, requiredFor: 'all' },
    { name: 'Transcript of Records (TOR)', file: null, status: 'missing', required: true, requiredFor: 'transferee' },
    { name: '2x2 Picture (White Background)', file: null, status: 'missing', required: true, requiredFor: 'all' },
  ]);

  useEffect(() => {
    const loadEnrollment = async () => {
      try {
        const res = await apiFetch('/api/student/enrollment');
        const text = await res.text();
        const json = JSON.parse(text) as { success?: boolean; enrollment?: { current_step?: number; form_data?: Partial<EnrollmentFormData> } | null; error?: string };
        if (!res.ok || !json.success) {
          if (json.error) toast.error(json.error);
          return;
        }
        if (json.enrollment?.form_data) {
          setFormData(prev => ({ ...prev, ...(json.enrollment?.form_data ?? {}) }));
        }
        if (json.enrollment?.id) {
          setEnrollmentId(Number(json.enrollment.id));
        }
        if (json.enrollment && json.enrollment.can_edit === false) {
          setIsEnrollmentLocked(true);
          localStorage.setItem('studentEnrollmentLocked', '1');
        } else {
          setIsEnrollmentLocked(false);
          localStorage.removeItem('studentEnrollmentLocked');
        }
        if (json.enrollment?.current_step && json.enrollment.current_step >= 1 && json.enrollment.current_step <= 6) {
          setCurrentStep(json.enrollment.current_step);
        }

        const docsRes = await apiFetch('/api/documents');
        const docsText = await docsRes.text();
        const docsJson = JSON.parse(docsText) as { success?: boolean; documents?: Array<{ id: number; type: string; uploaded_at?: string }> };
        if (docsRes.ok && docsJson.success && Array.isArray(docsJson.documents)) {
          const mapByType = new Map<string, { id: number; uploaded_at?: string }>();
          for (const d of docsJson.documents) {
            mapByType.set(String(d.type || '').toLowerCase(), { id: Number(d.id), uploaded_at: d.uploaded_at });
          }
          setDocuments(prev =>
            prev.map((doc) => {
              const hit = mapByType.get(doc.name.toLowerCase());
              return hit
                ? { ...doc, status: 'uploaded', uploadedId: hit.id, uploadedAt: hit.uploaded_at }
                : doc;
            })
          );
        }
      } catch {
        // keep defaults when no draft exists / parse errors
      }
    };
    loadEnrollment();
  }, []);

  const saveEnrollment = async (action: 'save_draft' | 'submit', step: number): Promise<boolean> => {
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/student/enrollment', {
        method: 'POST',
        body: JSON.stringify({
          action,
          current_step: step,
          form_data: formData,
        }),
      });
      const text = await res.text();
      const json = JSON.parse(text) as { success?: boolean; error?: string; message?: string };
      if (!res.ok || !json.success) {
        toast.error(json.error || `Failed to save enrollment (${res.status})`);
        if (res.status === 409) {
          setIsEnrollmentLocked(true);
          localStorage.setItem('studentEnrollmentLocked', '1');
        }
        return false;
      }
      if (action === 'submit') {
        setIsEnrollmentLocked(true);
        localStorage.setItem('studentEnrollmentLocked', '1');
      }
      if (json.enrollment_id) {
        setEnrollmentId(Number(json.enrollment_id));
      }
      return true;
    } catch {
      toast.error('Failed to save enrollment');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof EnrollmentFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (index: number, file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Maximum file size is 5MB');
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
      const json = JSON.parse(text) as { success?: boolean; error?: string; document?: { id?: number; uploaded_at?: string } };
      if (!res.ok || !json.success) {
        toast.error(json.error || `Upload failed (${res.status})`);
        return;
      }

      setDocuments(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          file,
          status: 'uploaded',
          uploadedId: Number(json.document?.id ?? 0) || undefined,
          uploadedAt: json.document?.uploaded_at ?? new Date().toISOString(),
        };
        return next;
      });
      toast.success(`${documents[index].name} uploaded successfully`);
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
    ];
    for (const field of required) {
      if (!formData[field as keyof EnrollmentFormData]) {
        toast.error(`Please fill in all required fields`);
        return false;
      }
    }
    if (!isBirthDateValidForShs(formData.birthDate, SHS_MIN_AGE_YEARS)) {
      toast.error(
        `Birth date must show the learner is at least ${SHS_MIN_AGE_YEARS} years old (Senior High eligibility).`,
      );
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const motherName = formData.motherGivenName.trim();
    const fatherName = formData.fatherGivenName.trim();
    const guardianName = formData.guardianGivenName.trim();
    const hasMother = motherName.length > 0;
    const hasFather = fatherName.length > 0;
    const hasGuardianFilled = formData.hasGuardian && guardianName.length > 0;

    if (!hasMother && !hasFather && !hasGuardianFilled) {
      toast.error(
        'Please provide at least one parent or guardian name (mother, father, or guardian section).',
      );
      return false;
    }

    if (!formData.emergencyContact) {
      toast.error('Please select who to contact in case of emergency.');
      return false;
    }

    if (formData.emergencyContact === 'mother' && !hasMother) {
      toast.error("Emergency contact is Mother, but mother's given name was not provided.");
      return false;
    }
    if (formData.emergencyContact === 'father' && !hasFather) {
      toast.error("Emergency contact is Father, but father's given name was not provided.");
      return false;
    }
    if (formData.emergencyContact === 'guardian') {
      if (!formData.hasGuardian) {
        toast.error('To use Guardian as emergency contact, check "I have a guardian" and enter their details.');
        return false;
      }
      if (!guardianName) {
        toast.error("Emergency contact is Guardian, but guardian's given name was not provided.");
        return false;
      }
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
    return true;
  };

  const handleNext = async () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 4 && !validateStep4()) return;
    const ok = await saveEnrollment('save_draft', currentStep);
    if (!ok) return;
    setCurrentStep(prev => Math.min(prev + 1, 6));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep1()) return;
    if (!validateStep2()) return;
    if (!formData.modeOfPayment?.trim()) {
      toast.error('Please select a mode of payment (Payment & Promo step).');
      return;
    }
    if (!formData.confirmInformation) {
      toast.error('Please confirm that all information is accurate');
      return;
    }
    await saveEnrollment('submit', 6);
  };

  const tabs = [
    { number: 1, name: 'Personal Information', icon: User },
    { number: 2, name: 'Family Information', icon: Users },
    { number: 3, name: 'Enrollment History', icon: GraduationCap },
    { number: 4, name: 'Requirements Upload', icon: Upload },
    { number: 5, name: 'Payment & Promo', icon: DollarSign },
    { number: 6, name: 'Review & Submit', icon: FileCheck },
  ];

  if (enrollmentAllowed && isEnrollmentLocked) {
    return (
      <div className="min-h-[min(520px,calc(100vh-8rem))] flex flex-col items-center justify-center px-6 py-16 bg-gray-50">
        <Card className="w-full max-w-md border border-gray-200 shadow-sm">
          <CardContent className="pt-12 pb-12 px-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-[#2D5016] mx-auto mb-6" aria-hidden />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Processing</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Your enrollment has been submitted and is being processed. The Registrar&apos;s office will review your
              application.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {!enrollmentAllowed && (
        <div className="p-6">
          <Alert variant="destructive">
            <AlertDescription>
              Enrollment is currently unavailable because there is no active school year.
            </AlertDescription>
          </Alert>
        </div>
      )}
      {/* Step Indicator */}
      <div className="bg-white border-b py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = currentStep === tab.number;
              const isCompleted = currentStep > tab.number;
              
              return (
                <div key={tab.number} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center flex-1">
                    {/* Circle with number */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                        isActive
                          ? 'bg-[#2D5016] text-white ring-4 ring-[#2D5016]/20'
                          : isCompleted
                          ? 'bg-[#2D5016] text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        tab.number
                      )}
                    </div>
                    {/* Label */}
                    <p
                      className={`text-xs mt-2 text-center font-medium ${
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
                  {/* Connecting line */}
                  {index < tabs.length - 1 && (
                    <div className="flex-1 h-0.5 -mt-8 mx-2">
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
      <div className="bg-gray-50 min-h-screen p-6">
        {/* Step 1: Personal Information */}
        {currentStep === 1 && (
          <div className="max-w-5xl mx-auto space-y-6">
            <Card>
              <CardContent className="p-8">
                <h2 className="text-2xl font-semibold mb-6">Personal Information</h2>
                
                {/* Enrollment Status */}
                <div className="mb-6">
                  <Label className="mb-3 block">Enrollment Status *</Label>
                  <div className="flex gap-4">
                    {['old', 'new', 'transferee'].map((status) => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="enrollmentStatus"
                          value={status}
                          checked={formData.enrollmentStatus === status}
                          onChange={(e) => handleInputChange('enrollmentStatus', e.target.value)}
                          className="w-4 h-4 text-[#8B1538] border-gray-300 focus:ring-[#8B1538]"
                        />
                        <span className="capitalize">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="givenName">Given Name *</Label>
                    <Input
                      id="givenName"
                      value={formData.givenName}
                      onChange={(e) => handleInputChange('givenName', e.target.value)}
                      placeholder="Enter given name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="middleName">Middle Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="middleName"
                      value={formData.middleName}
                      onChange={(e) => handleInputChange('middleName', e.target.value)}
                      placeholder="Enter middle name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="middleInitial">Middle Initial <span className="text-red-500">*</span></Label>
                    <Input
                      id="middleInitial"
                      value={formData.middleInitial}
                      onChange={(e) => handleInputChange('middleInitial', e.target.value)}
                      placeholder="M.I."
                      maxLength={2}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      placeholder="Enter last name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extensionName">Extension Name (if applicable)</Label>
                    <Input
                      id="extensionName"
                      value={formData.extensionName}
                      onChange={(e) => handleInputChange('extensionName', e.target.value)}
                      placeholder="Jr., Sr., III, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender *</Label>
                    <select
                      id="gender"
                      value={formData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
                    >
                      <option value="">Select Gender</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactNumber">Contact Number *</Label>
                    <Input
                      id="contactNumber"
                      value={formData.contactNumber}
                      onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                      placeholder="09XX-XXX-XXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="your.email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lrn">LRN (Learner Reference Number) *</Label>
                    <Input
                      id="lrn"
                      value={formData.lrn}
                      onChange={(e) => handleInputChange('lrn', e.target.value)}
                      placeholder="12 digit LRN"
                      maxLength={12}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address Section */}
            <Card>
              <CardContent className="p-8">
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
                    <Label htmlFor="street">Street <span className="text-red-500">*</span></Label>
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
                    <Label htmlFor="barangay">Barangay <span className="text-red-500">*</span></Label>
                    <Input
                      id="barangay"
                      value={formData.barangay}
                      onChange={(e) => handleInputChange('barangay', e.target.value)}
                      placeholder="Enter barangay"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="municipality">Municipality <span className="text-red-500">*</span></Label>
                    <Input
                      id="municipality"
                      value={formData.municipality}
                      onChange={(e) => handleInputChange('municipality', e.target.value)}
                      placeholder="Enter municipality"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Birth Information & Academic Details */}
            <Card>
              <CardContent className="p-8">
                <h3 className="text-xl font-semibold mb-4">Birth Information & Academic Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="birthDate">Birth Date *</Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => handleInputChange('birthDate', e.target.value)}
                      min={shsBirthDateBounds.min}
                      max={shsBirthDateBounds.max}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthPlace">Birth Place *</Label>
                    <Input
                      id="birthPlace"
                      value={formData.birthPlace}
                      onChange={(e) => handleInputChange('birthPlace', e.target.value)}
                      placeholder="Enter birth place"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="religion">Religion *</Label>
                    <select
                      id="religion"
                      value={formData.religion}
                      onChange={(e) => handleInputChange('religion', e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
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
                    <Label>Grade Level to Enroll In *</Label>
                    <div className="flex gap-4 pt-2">
                      {['11', '12'].map((grade) => (
                        <label key={grade} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="gradeLevel"
                            value={grade}
                            checked={formData.gradeLevel === grade}
                            onChange={(e) => handleInputChange('gradeLevel', e.target.value)}
                            className="w-4 h-4 text-[#8B1538] border-gray-300 focus:ring-[#8B1538]"
                          />
                          <span>Grade {grade}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="strand">Strand *</Label>
                    <select
                      id="strand"
                      value={formData.strand}
                      onChange={(e) => handleInputChange('strand', e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
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
                    <Label htmlFor="preferredSchedule">Preferred Schedule *</Label>
                    <select
                      id="preferredSchedule"
                      value={formData.preferredSchedule}
                      onChange={(e) => handleInputChange('preferredSchedule', e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
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
          <div className="max-w-5xl mx-auto space-y-6">
            <p className="text-sm text-gray-600 -mt-2 mb-2">
              Single-parent or guardian-led households: fill only the sections that apply. You must enter at least one
              parent or guardian name (and match your emergency contact choice below).
            </p>
            {/* Mother's Information */}
            <Card>
              <CardContent className="p-8">
                <h2 className="text-2xl font-semibold mb-6">Mother's Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="motherGivenName">Mother's Given Name</Label>
                    <Input
                      id="motherGivenName"
                      value={formData.motherGivenName}
                      onChange={(e) => handleInputChange('motherGivenName', e.target.value)}
                      placeholder="Enter mother's given name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherMaidenMiddleName">Mother's Maiden Middle Name</Label>
                    <Input
                      id="motherMaidenMiddleName"
                      value={formData.motherMaidenMiddleName}
                      onChange={(e) => handleInputChange('motherMaidenMiddleName', e.target.value)}
                      placeholder="Enter mother's maiden middle name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherMaidenLastName">Mother's Maiden Last Name</Label>
                    <Input
                      id="motherMaidenLastName"
                      value={formData.motherMaidenLastName}
                      onChange={(e) => handleInputChange('motherMaidenLastName', e.target.value)}
                      placeholder="Enter mother's maiden last name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherContactNumber">Mother's Contact Number</Label>
                    <Input
                      id="motherContactNumber"
                      value={formData.motherContactNumber}
                      onChange={(e) => handleInputChange('motherContactNumber', e.target.value)}
                      placeholder="09XX-XXX-XXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherOccupation">Mother's Occupation</Label>
                    <Input
                      id="motherOccupation"
                      value={formData.motherOccupation}
                      onChange={(e) => handleInputChange('motherOccupation', e.target.value)}
                      placeholder="Enter mother's occupation"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Father's Information */}
            <Card>
              <CardContent className="p-8">
                <h2 className="text-2xl font-semibold mb-6">Father's Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fatherGivenName">Father's Given Name</Label>
                    <Input
                      id="fatherGivenName"
                      value={formData.fatherGivenName}
                      onChange={(e) => handleInputChange('fatherGivenName', e.target.value)}
                      placeholder="Enter father's given name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherMiddleName">Father's Middle Name</Label>
                    <Input
                      id="fatherMiddleName"
                      value={formData.fatherMiddleName}
                      onChange={(e) => handleInputChange('fatherMiddleName', e.target.value)}
                      placeholder="Enter father's middle name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherLastName">Father's Last Name</Label>
                    <Input
                      id="fatherLastName"
                      value={formData.fatherLastName}
                      onChange={(e) => handleInputChange('fatherLastName', e.target.value)}
                      placeholder="Enter father's last name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherContactNumber">Father's Contact Number</Label>
                    <Input
                      id="fatherContactNumber"
                      value={formData.fatherContactNumber}
                      onChange={(e) => handleInputChange('fatherContactNumber', e.target.value)}
                      placeholder="09XX-XXX-XXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherOccupation">Father's Occupation</Label>
                    <Input
                      id="fatherOccupation"
                      value={formData.fatherOccupation}
                      onChange={(e) => handleInputChange('fatherOccupation', e.target.value)}
                      placeholder="Enter father's occupation"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Guardian's Information (if applicable) */}
            <Card>
              <CardContent className="p-8">
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
                        <Label htmlFor="guardianGivenName">Guardian's Given Name</Label>
                        <Input
                          id="guardianGivenName"
                          value={formData.guardianGivenName}
                          onChange={(e) => handleInputChange('guardianGivenName', e.target.value)}
                          placeholder="Enter guardian's given name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guardianMiddleName">Guardian's Middle Name</Label>
                        <Input
                          id="guardianMiddleName"
                          value={formData.guardianMiddleName}
                          onChange={(e) => handleInputChange('guardianMiddleName', e.target.value)}
                          placeholder="Enter guardian's middle name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guardianLastName">Guardian's Last Name</Label>
                        <Input
                          id="guardianLastName"
                          value={formData.guardianLastName}
                          onChange={(e) => handleInputChange('guardianLastName', e.target.value)}
                          placeholder="Enter guardian's last name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guardianContactNumber">Guardian's Contact Number</Label>
                        <Input
                          id="guardianContactNumber"
                          value={formData.guardianContactNumber}
                          onChange={(e) => handleInputChange('guardianContactNumber', e.target.value)}
                          placeholder="09XX-XXX-XXXX"
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
              <CardContent className="p-8">
                <h2 className="text-2xl font-semibold mb-6">Person to Contact in Case of Emergency</h2>
                <div className="flex gap-4">
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
          <div className="max-w-5xl mx-auto">
            <Card>
              <CardContent className="p-8">
                <h2 className="text-2xl font-semibold mb-6">Enrollment History</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="previousSchoolAttended">Previous School Attended</Label>
                    <Input
                      id="previousSchoolAttended"
                      value={formData.previousSchoolAttended}
                      onChange={(e) => handleInputChange('previousSchoolAttended', e.target.value)}
                      placeholder="Enter previous school name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>School Type</Label>
                    <div className="flex gap-4 pt-2">
                      {['public', 'private'].map((type) => (
                        <label key={type} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="schoolType"
                            value={type}
                            checked={formData.schoolType === type}
                            onChange={(e) => handleInputChange('schoolType', e.target.value)}
                            className="w-4 h-4 text-[#8B1538] border-gray-300 focus:ring-[#8B1538]"
                          />
                          <span className="capitalize">{type}</span>
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
                      className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
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
                      placeholder="Enter section"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastSchoolYearAttended">Last School Year Attended</Label>
                    <Input
                      id="lastSchoolYearAttended"
                      value={formData.lastSchoolYearAttended}
                      onChange={(e) => handleInputChange('lastSchoolYearAttended', e.target.value)}
                      placeholder="e.g., 2023-2024"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Requirements Upload */}
        {currentStep === 4 && (
          <div className="max-w-5xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Upload Required Documents</CardTitle>
                <CardDescription>Upload scanned copies of your documents (PDF, JPG, PNG)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please ensure all documents are clear and readable. Maximum file size: 5MB per document.
                  </AlertDescription>
                </Alert>

                {documents.map((doc, index) => {
                  // Check if document should be displayed
                  const shouldShow = doc.requiredFor === 'all' || 
                    (doc.requiredFor === 'transferee' && formData.enrollmentStatus === 'transferee');
                  
                  if (!shouldShow) return null;

                  return (
                  <div
                    key={index}
                    className={`p-4 border rounded-lg ${
                      doc.status === 'uploaded' ? 'border-green-300 bg-green-50' : 'border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className={`w-5 h-5 ${
                          doc.status === 'uploaded' ? 'text-green-600' : 'text-gray-400'
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
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.status === 'uploaded' ? (
                          <>
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Uploaded
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.pdf,.jpg,.jpeg,.png';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) handleFileUpload(index, file);
                                };
                                input.click();
                              }}
                            >
                              Re-upload
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[#8B1538] text-[#8B1538] hover:bg-[#8B1538] hover:text-white"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = '.pdf,.jpg,.jpeg,.png';
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) handleFileUpload(index, file);
                              };
                              input.click();
                            }}
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
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 5: Payment & Promo */}
        {currentStep === 5 && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Bring a Friend Promo */}
            <Card>
              <CardContent className="p-8">
                <h2 className="text-2xl font-semibold mb-6">Bring a Friend Promo</h2>
                <div className="mb-4">
                  <Label className="mb-3 block">Do you have a referral code?</Label>
                  <div className="flex gap-4">
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
                        value={formData.referrerContactNumber}
                        onChange={(e) => handleInputChange('referrerContactNumber', e.target.value)}
                        placeholder="09XX-XXX-XXXX"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Accounting - Mode of Payment */}
            <Card>
              <CardContent className="p-8">
                <h2 className="text-2xl font-semibold mb-6">Accounting</h2>
                <div className="space-y-4">
                  <Label className="mb-3 block">Mode of Payment *</Label>
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
          <div className="max-w-5xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Review & Submit</CardTitle>
                <CardDescription>Please review your information before submitting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Personal Information Review */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-[#8B1538]">Personal Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
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
                  <div className="grid grid-cols-2 gap-4 text-sm">
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
                  <div className="grid grid-cols-2 gap-4 text-sm">
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
        <div className="max-w-5xl mx-auto flex justify-between">
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
              disabled={isSaving || isEnrollmentLocked || !enrollmentAllowed}
              className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
            >
              {isSaving ? 'Saving...' : 'Next'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
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
    </div>
  );
}