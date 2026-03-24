import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LandingNavbar } from '../../components/LandingNavbar';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { 
  Upload, 
  CheckCircle, 
  X, 
  FileText, 
  User, 
  GraduationCap, 
  FolderOpen,
  ArrowLeft,
  ArrowRight,
  Send
} from 'lucide-react';

interface FormData {
  // Personal Information
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  homeAddress: string;
  email: string;
  contactNumber: string;
  lrn: string;
  
  // Parent/Guardian Information
  fatherName: string;
  fatherOccupation: string;
  fatherContact: string;
  motherName: string;
  motherMaidenName: string;
  motherOccupation: string;
  motherContact: string;
  guardianName: string;
  guardianRelationship: string;
  guardianOccupation: string;
  guardianContact: string;
  
  // Academic Background
  previousSchoolName: string;
  schoolAddress: string;
  lastGradeCompleted: string;
  lastSchoolYearAttended: string;
  grade11School: string;
  isTransferee: string;
  strandApplying: string;
  schoolYearApplying: string;
  
  // Requirements
  reportCard: File | null;
  birthCertificate: File | null;
  goodMoralCert: File | null;
  idPhoto: File | null;
  otherDocs: File | null;
  
  // Certification
  certified: boolean;
}

export function ApplicationForm() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    homeAddress: '',
    email: '',
    contactNumber: '',
    lrn: '',
    fatherName: '',
    fatherOccupation: '',
    fatherContact: '',
    motherName: '',
    motherMaidenName: '',
    motherOccupation: '',
    motherContact: '',
    guardianName: '',
    guardianRelationship: '',
    guardianOccupation: '',
    guardianContact: '',
    previousSchoolName: '',
    schoolAddress: '',
    lastGradeCompleted: '',
    lastSchoolYearAttended: '',
    grade11School: '',
    isTransferee: '',
    strandApplying: '',
    schoolYearApplying: '',
    reportCard: null,
    birthCertificate: null,
    goodMoralCert: null,
    idPhoto: null,
    otherDocs: null,
    certified: false,
  });

  const tabs = [
    { name: 'Personal Information', icon: User },
    { name: 'Parent/Guardian Information', icon: User },
    { name: 'Academic Background', icon: GraduationCap },
    { name: 'Requirements Upload', icon: FolderOpen },
    { name: 'Review & Submit', icon: FileText },
  ];

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (field: keyof FormData, file: File | null) => {
    setFormData(prev => ({ ...prev, [field]: file }));
  };

  const handleSubmit = () => {
    if (!formData.certified) {
      alert('Please certify that the information is true and correct.');
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LandingNavbar />
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Card className="shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-[#2D5016] rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Application Submitted Successfully!
              </h1>
              <p className="text-gray-600 mb-2">
                Thank you for submitting your application to Nuestra Señora De Guia Academy.
              </p>
              <p className="text-gray-600 mb-8">
                Our Registrar's Office will review your application and contact you within 3-5 business days.
              </p>
              <div className="bg-green-50 border-l-4 border-[#2D5016] p-6 mb-8 text-left">
                <p className="font-bold text-gray-900 mb-2">Next Steps:</p>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• Check your email for confirmation</li>
                  <li>• Wait for verification from the Registrar's Office</li>
                  <li>• Prepare for possible interview or orientation</li>
                  <li>• Keep your documents ready for verification</li>
                </ul>
              </div>
              <Button 
                onClick={() => navigate('/landing')}
                className="bg-[#8B1538] hover:bg-[#8B1538]/90"
              >
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LandingNavbar />
      
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#8B1538] mb-2">Admission Application</h1>
          <p className="text-gray-600">Complete all sections to submit your application</p>
        </div>

        {/* Folder Tabs */}
        <Card className="shadow-lg border-t-4 border-[#2D5016] mb-6">
          <div className="flex border-b">
            {tabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`flex-1 px-4 py-4 text-sm font-medium transition-colors ${
                  activeTab === index
                    ? 'bg-[#2D5016] text-white'
                    : 'bg-white text-[#8B1538] border-b-2 border-[#8B1538]'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.name}</span>
                </div>
              </button>
            ))}
          </div>

          <CardContent className="p-6 md:p-8">
            {/* Tab 1 - Personal Information */}
            {activeTab === 0 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Applicant Information</h2>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="middleName">Middle Name <span className="text-red-600">*</span></Label>
                    <Input
                      id="middleName"
                      value={formData.middleName}
                      onChange={(e) => handleInputChange('middleName', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gender">Gender *</Label>
                    <select
                      id="gender"
                      value={formData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#2D5016] focus:ring-1 focus:ring-[#2D5016]"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="homeAddress">Home Address *</Label>
                  <Textarea
                    id="homeAddress"
                    value={formData.homeAddress}
                    onChange={(e) => handleInputChange('homeAddress', e.target.value)}
                    className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    rows={3}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactNumber">Contact Number *</Label>
                    <Input
                      id="contactNumber"
                      type="tel"
                      value={formData.contactNumber}
                      onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="lrn">Learner Reference Number (LRN) *</Label>
                  <Input
                    id="lrn"
                    value={formData.lrn}
                    onChange={(e) => handleInputChange('lrn', e.target.value)}
                    className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                  />
                </div>
              </div>
            )}

            {/* Tab 2 - Parent/Guardian Information */}
            {activeTab === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Parent/Guardian Information</h2>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fatherName">Father's Name *</Label>
                    <Input
                      id="fatherName"
                      value={formData.fatherName}
                      onChange={(e) => handleInputChange('fatherName', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="fatherOccupation">Father's Occupation *</Label>
                    <Input
                      id="fatherOccupation"
                      value={formData.fatherOccupation}
                      onChange={(e) => handleInputChange('fatherOccupation', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="fatherContact">Father's Contact Number *</Label>
                  <Input
                    id="fatherContact"
                    type="tel"
                    value={formData.fatherContact}
                    onChange={(e) => handleInputChange('fatherContact', e.target.value)}
                    className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="motherName">Mother's Name *</Label>
                    <Input
                      id="motherName"
                      value={formData.motherName}
                      onChange={(e) => handleInputChange('motherName', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="motherMaidenName">Mother's Maiden Name *</Label>
                    <Input
                      id="motherMaidenName"
                      value={formData.motherMaidenName}
                      onChange={(e) => handleInputChange('motherMaidenName', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="motherOccupation">Mother's Occupation *</Label>
                    <Input
                      id="motherOccupation"
                      value={formData.motherOccupation}
                      onChange={(e) => handleInputChange('motherOccupation', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="motherContact">Mother's Contact Number *</Label>
                    <Input
                      id="motherContact"
                      type="tel"
                      value={formData.motherContact}
                      onChange={(e) => handleInputChange('motherContact', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="guardianName">Guardian's Name (if applicable)</Label>
                    <Input
                      id="guardianName"
                      value={formData.guardianName}
                      onChange={(e) => handleInputChange('guardianName', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="guardianRelationship">Guardian's Relationship (if applicable)</Label>
                    <Input
                      id="guardianRelationship"
                      value={formData.guardianRelationship}
                      onChange={(e) => handleInputChange('guardianRelationship', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="guardianOccupation">Guardian's Occupation (if applicable)</Label>
                    <Input
                      id="guardianOccupation"
                      value={formData.guardianOccupation}
                      onChange={(e) => handleInputChange('guardianOccupation', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="guardianContact">Guardian's Contact Number (if applicable)</Label>
                    <Input
                      id="guardianContact"
                      type="tel"
                      value={formData.guardianContact}
                      onChange={(e) => handleInputChange('guardianContact', e.target.value)}
                      className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3 - Academic Background */}
            {activeTab === 2 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Previous School Information</h2>
                
                <div>
                  <Label htmlFor="previousSchoolName">Previous School Name *</Label>
                  <Input
                    id="previousSchoolName"
                    value={formData.previousSchoolName}
                    onChange={(e) => handleInputChange('previousSchoolName', e.target.value)}
                    className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                  />
                </div>

                <div>
                  <Label htmlFor="schoolAddress">School Address *</Label>
                  <Textarea
                    id="schoolAddress"
                    value={formData.schoolAddress}
                    onChange={(e) => handleInputChange('schoolAddress', e.target.value)}
                    className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="lastSchoolYearAttended">Last School Year Attended *</Label>
                  <Input
                    id="lastSchoolYearAttended"
                    value={formData.lastSchoolYearAttended}
                    onChange={(e) => handleInputChange('lastSchoolYearAttended', e.target.value)}
                    className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                    placeholder="e.g., 2025-2026"
                  />
                </div>

                <div>
                  <Label htmlFor="grade11School">Grade 11 School (if applicable)</Label>
                  <Input
                    id="grade11School"
                    value={formData.grade11School}
                    onChange={(e) => handleInputChange('grade11School', e.target.value)}
                    className="focus:border-[#2D5016] focus:ring-[#2D5016]"
                  />
                </div>

                <div>
                  <Label htmlFor="isTransferee">Are you a transferee?</Label>
                  <select
                    id="isTransferee"
                    value={formData.isTransferee}
                    onChange={(e) => handleInputChange('isTransferee', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#2D5016] focus:ring-1 focus:ring-[#2D5016]"
                  >
                    <option value="">Select Option</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="strandApplying">Strand Applying For *</Label>
                  <select
                    id="strandApplying"
                    value={formData.strandApplying}
                    onChange={(e) => handleInputChange('strandApplying', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#2D5016] focus:ring-1 focus:ring-[#2D5016]"
                  >
                    <option value="">Select Strand</option>
                    <option value="HUMSS">HUMSS - Humanities and Social Sciences</option>
                    <option value="TVL">TVL - Technical-Vocational-Livelihood</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="schoolYearApplying">School Year Applying For *</Label>
                  <select
                    id="schoolYearApplying"
                    value={formData.schoolYearApplying}
                    onChange={(e) => handleInputChange('schoolYearApplying', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#2D5016] focus:ring-1 focus:ring-[#2D5016]"
                  >
                    <option value="">Select School Year</option>
                    <option value="2026-2027">2026-2027</option>
                    <option value="2027-2028">2027-2028</option>
                  </select>
                </div>
              </div>
            )}

            {/* Tab 4 - Requirements Upload */}
            {activeTab === 3 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Required Documents</h2>
                
                <FileUploadBox
                  label="📄 Report Card (SF9)"
                  description="PDF format only. Maximum 5MB."
                  file={formData.reportCard}
                  onUpload={(file) => handleFileUpload('reportCard', file)}
                  accept=".pdf"
                />

                <FileUploadBox
                  label="📄 PSA Birth Certificate"
                  description="PDF format only. Maximum 5MB."
                  file={formData.birthCertificate}
                  onUpload={(file) => handleFileUpload('birthCertificate', file)}
                  accept=".pdf"
                />

                <FileUploadBox
                  label="📄 Good Moral Certificate"
                  description="PDF format only. Maximum 5MB."
                  file={formData.goodMoralCert}
                  onUpload={(file) => handleFileUpload('goodMoralCert', file)}
                  accept=".pdf"
                />

                <FileUploadBox
                  label="📄 2×2 ID Photo"
                  description="JPG or PNG format. Maximum 5MB."
                  file={formData.idPhoto}
                  onUpload={(file) => handleFileUpload('idPhoto', file)}
                  accept=".jpg,.jpeg,.png"
                />

                <FileUploadBox
                  label="📄 Other Supporting Documents (Optional)"
                  description="PDF format only. Maximum 5MB."
                  file={formData.otherDocs}
                  onUpload={(file) => handleFileUpload('otherDocs', file)}
                  accept=".pdf"
                  optional
                />
              </div>
            )}

            {/* Tab 5 - Review & Submit */}
            {activeTab === 4 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Review Application</h2>
                
                {/* Personal Info Summary */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="font-bold text-lg text-[#8B1538] mb-4">Personal Information</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Full Name:</p>
                      <p className="font-semibold">{formData.firstName} {formData.middleName} {formData.lastName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Date of Birth:</p>
                      <p className="font-semibold">{formData.dateOfBirth}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Gender:</p>
                      <p className="font-semibold capitalize">{formData.gender}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Email:</p>
                      <p className="font-semibold">{formData.email}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Contact:</p>
                      <p className="font-semibold">{formData.contactNumber}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">LRN:</p>
                      <p className="font-semibold">{formData.lrn}</p>
                    </div>
                  </div>
                </div>

                {/* Parent/Guardian Info Summary */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="font-bold text-lg text-[#8B1538] mb-4">Parent/Guardian Information</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Father's Name:</p>
                      <p className="font-semibold">{formData.fatherName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Father's Occupation:</p>
                      <p className="font-semibold">{formData.fatherOccupation}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Father's Contact:</p>
                      <p className="font-semibold">{formData.fatherContact}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Mother's Name:</p>
                      <p className="font-semibold">{formData.motherName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Mother's Maiden Name:</p>
                      <p className="font-semibold">{formData.motherMaidenName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Mother's Occupation:</p>
                      <p className="font-semibold">{formData.motherOccupation}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Mother's Contact:</p>
                      <p className="font-semibold">{formData.motherContact}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Guardian's Name:</p>
                      <p className="font-semibold">{formData.guardianName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Guardian's Relationship:</p>
                      <p className="font-semibold">{formData.guardianRelationship}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Guardian's Occupation:</p>
                      <p className="font-semibold">{formData.guardianOccupation}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Guardian's Contact:</p>
                      <p className="font-semibold">{formData.guardianContact}</p>
                    </div>
                  </div>
                </div>

                {/* Academic Info Summary */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="font-bold text-lg text-[#8B1538] mb-4">Academic Background</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Previous School:</p>
                      <p className="font-semibold">{formData.previousSchoolName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Last School Year Attended:</p>
                      <p className="font-semibold">{formData.lastSchoolYearAttended}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Grade 11 School:</p>
                      <p className="font-semibold">{formData.grade11School}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Is Transferee:</p>
                      <p className="font-semibold capitalize">{formData.isTransferee}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Strand Applying:</p>
                      <p className="font-semibold">{formData.strandApplying}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">School Year:</p>
                      <p className="font-semibold">{formData.schoolYearApplying}</p>
                    </div>
                  </div>
                </div>

                {/* Uploaded Documents Summary */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="font-bold text-lg text-[#8B1538] mb-4">Uploaded Documents</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      {formData.reportCard ? (
                        <CheckCircle className="w-5 h-5 text-[#2D5016]" />
                      ) : (
                        <X className="w-5 h-5 text-red-500" />
                      )}
                      <span>Report Card (SF9)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {formData.birthCertificate ? (
                        <CheckCircle className="w-5 h-5 text-[#2D5016]" />
                      ) : (
                        <X className="w-5 h-5 text-red-500" />
                      )}
                      <span>PSA Birth Certificate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {formData.goodMoralCert ? (
                        <CheckCircle className="w-5 h-5 text-[#2D5016]" />
                      ) : (
                        <X className="w-5 h-5 text-red-500" />
                      )}
                      <span>Good Moral Certificate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {formData.idPhoto ? (
                        <CheckCircle className="w-5 h-5 text-[#2D5016]" />
                      ) : (
                        <X className="w-5 h-5 text-red-500" />
                      )}
                      <span>2×2 ID Photo</span>
                    </div>
                  </div>
                </div>

                {/* Certification */}
                <div className="bg-green-50 border-l-4 border-[#2D5016] p-6 rounded">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.certified}
                      onChange={(e) => handleInputChange('certified', e.target.checked)}
                      className="mt-1 w-5 h-5 text-[#2D5016] border-gray-300 rounded focus:ring-[#2D5016]"
                    />
                    <span className="text-sm text-gray-700">
                      I certify that the information provided is true and correct to the best of my knowledge.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => setActiveTab(Math.max(0, activeTab - 1))}
                disabled={activeTab === 0}
                className="border-[#8B1538] text-[#8B1538]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              
              {activeTab < tabs.length - 1 ? (
                <Button
                  onClick={() => setActiveTab(Math.min(tabs.length - 1, activeTab + 1))}
                  className="bg-[#8B1538] hover:bg-[#8B1538]/90"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  className="bg-[#8B1538] hover:bg-[#8B1538]/90"
                  disabled={!formData.certified}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit Application
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// File Upload Component
function FileUploadBox({
  label,
  description,
  file,
  onUpload,
  accept,
  optional = false,
}: {
  label: string;
  description: string;
  file: File | null;
  onUpload: (file: File | null) => void;
  accept: string;
  optional?: boolean;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    onUpload(selectedFile);
  };

  return (
    <div className="border-2 border-dashed border-[#2D5016] rounded-lg p-6 bg-white">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-gray-900">{label}</h4>
        {optional && <span className="text-xs text-gray-500">(Optional)</span>}
      </div>
      <p className="text-xs text-gray-500 mb-4">{description}</p>
      
      {!file ? (
        <label className="cursor-pointer">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Upload className="w-8 h-8 text-[#2D5016] mb-2" />
            <p className="text-sm text-gray-600 mb-1">Click to upload or drag and drop file</p>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
          <input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      ) : (
        <div className="bg-green-50 border border-[#2D5016] rounded p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-[#2D5016]" />
              <div>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">
                  Uploaded: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpload(null)}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}