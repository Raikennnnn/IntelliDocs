import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  FileText,
  AlertCircle,
  Download,
  Eye,
  ArrowLeft,
  User,
  Users,
  GraduationCap,
  Upload,
  ClipboardCheck,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import sampleDocument from "figma:asset/ff224afb70ee110a8c1e062b666490387126cfb5.png";

// Force cache refresh
const CACHE_VERSION = "v1.0.1";

export function ReviewDocuments() {
  const params = useParams();
  const applicationId = params.applicationId;
  const [remarks, setRemarks] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  
  // Mock application data - in real app, fetch based on applicationId
  const application = {
    id: applicationId || "APP-2026-001",
    
    // Enrollment Status
    enrollmentStatus: "new",
    
    // Personal Information
    givenName: "Juan",
    middleName: "Santos",
    middleInitial: "S",
    lastName: "Dela Cruz",
    extensionName: "",
    gender: "Male",
    contactNumber: "0912-345-6789",
    email: "juan.delacruz@email.com",
    lrn: "123456789012",
    
    // Address
    blockLotHouseNo: "Block 5 Lot 12",
    street: "Main Street",
    compoundSubdivisionVillage: "Green Valley Subdivision",
    barangay: "Barangka",
    municipality: "Marikina City",
    
    // Birth Information
    birthDate: "January 15, 2008",
    birthPlace: "Marikina City",
    religion: "Roman Catholic",
    
    // Academic Information
    gradeLevel: "11",
    strand: "HUMSS",
    preferredSchedule: "Morning (7:00 AM - 12:00 PM)",
    
    // Mother's Information
    motherGivenName: "Maria",
    motherMaidenMiddleName: "Garcia",
    motherMaidenLastName: "Reyes",
    motherContactNumber: "0923-456-7890",
    motherOccupation: "Teacher",
    
    // Father's Information
    fatherGivenName: "Pedro",
    fatherMiddleName: "Lopez",
    fatherLastName: "Dela Cruz",
    fatherContactNumber: "0934-567-8901",
    fatherOccupation: "Engineer",
    
    // Guardian Information
    hasGuardian: false,
    guardianGivenName: "",
    guardianMiddleName: "",
    guardianLastName: "",
    guardianContactNumber: "",
    relationshipToGuardian: "",
    
    // Emergency Contact
    emergencyContact: "mother",
    
    // Enrollment History
    previousSchoolAttended: "Sample High School",
    schoolType: "Public",
    gradeLevelAtPreviousSchool: "10",
    sectionAtPreviousSchool: "A",
    lastSchoolYearAttended: "2025-2026",
    
    // Bring a Friend Promo
    hasReferralCode: false,
    referralCardControlNumber: "",
    referrerName: "",
    referrerContactNumber: "",
    
    // Accounting
    modeOfPayment: "Cash",
    voucherNo: "",
    
    // Status
    submittedDate: "March 15, 2026",
    status: "Under Review",
    studentName: "Juan Santos Dela Cruz",
    
    documents: [
      {
        name: "Birth Certificate",
        status: "Verified",
        aiConfidence: 98,
        uploadedDate: "March 15, 2026",
        fileUrl: sampleDocument,
        issues: [],
      },
      {
        name: "Good Moral Certificate",
        status: "Verified",
        aiConfidence: 95,
        uploadedDate: "March 15, 2026",
        fileUrl: sampleDocument,
        issues: [],
      },
      {
        name: "SF9 (Report Card)",
        status: "Under Review",
        aiConfidence: 87,
        uploadedDate: "March 15, 2026",
        fileUrl: sampleDocument,
        issues: ["Document quality could be improved"],
      },
      {
        name: "SF10 / Form 137",
        status: "Flagged",
        aiConfidence: 62,
        uploadedDate: "March 15, 2026",
        fileUrl: sampleDocument,
        issues: [
          "Watermark or stamp appears to be tampered",
          "Date format inconsistency detected",
          "Signature authenticity requires manual verification"
        ],
      },
    ],
  };

  const handleApprove = () => {
    toast.success(`Application ${application.id} has been approved`);
  };

  const handleReject = () => {
    if (!remarks.trim()) {
      toast.error("Please provide remarks for rejection");
      return;
    }
    toast.success(`Application ${application.id} has been rejected`);
  };

  const handleSaveRemarks = () => {
    toast.success("Remarks saved successfully");
  };

  const getDocumentStatusColor = (status: string) => {
    switch (status) {
      case "Verified":
        return "bg-green-600";
      case "Flagged":
        return "bg-red-600";
      case "Under Review":
        return "bg-yellow-600";
      default:
        return "bg-gray-600";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-600";
    if (confidence >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const handleViewDocument = (doc: any) => {
    setSelectedDocument({
      ...doc,
      studentName: application.studentName,
      applicationId: application.id,
      strand: application.strand,
      gradeLevel: application.gradeLevel,
    });
    setIsDocumentDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/registrar/applications">
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
            <ArrowLeft className="w-3 h-3 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold text-gray-900">
            Review Application
          </h2>
          <p className="text-gray-600">Application ID: {application.id}</p>
        </div>
        <Badge className={
          application.status === "Approved" ? "bg-green-600" :
          application.status === "Under Review" ? "bg-blue-600" :
          application.status === "Rejected" ? "bg-red-600" :
          "bg-yellow-600"
        }>
          {application.status}
        </Badge>
      </div>

      {/* Enrollment Status Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Student Type</p>
              <p className="font-medium capitalize">{application.enrollmentStatus}</p>
            </div>
            <div>
              <p className="text-gray-600">Submitted Date</p>
              <p className="font-medium">{application.submittedDate}</p>
            </div>
            <div>
              <p className="text-gray-600">Grade Level</p>
              <p className="font-medium">Grade {application.gradeLevel}</p>
            </div>
            <div>
              <p className="text-gray-600">Strand</p>
              <p className="font-medium">{application.strand}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Interface */}
      <Card>
        <Tabs defaultValue="personal" className="w-full">
          <div className="border-b bg-gray-50">
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent rounded-none">
              <TabsTrigger 
                value="personal" 
                className="data-[state=active]:bg-[#2D5016] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#2D5016] px-6 py-3"
              >
                <User className="w-4 h-4 mr-2" />
                Personal Information
              </TabsTrigger>
              <TabsTrigger 
                value="family" 
                className="data-[state=active]:bg-[#8B1538] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#8B1538] px-6 py-3"
              >
                <Users className="w-4 h-4 mr-2" />
                Parent/Guardian Information
              </TabsTrigger>
              <TabsTrigger 
                value="academic" 
                className="data-[state=active]:bg-[#2D5016] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#2D5016] px-6 py-3"
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                Academic Background
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="data-[state=active]:bg-[#8B1538] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#8B1538] px-6 py-3"
              >
                <Upload className="w-4 h-4 mr-2" />
                Documents Upload
              </TabsTrigger>
              <TabsTrigger 
                value="review" 
                className="data-[state=active]:bg-[#2D5016] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#2D5016] px-6 py-3"
              >
                <ClipboardCheck className="w-4 h-4 mr-2" />
                Review & Decision
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Personal Information Tab */}
          <TabsContent value="personal" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Given Name</p>
                  <p className="font-medium">{application.givenName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Middle Name</p>
                  <p className="font-medium">{application.middleName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-600">Last Name</p>
                  <p className="font-medium">{application.lastName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Extension Name</p>
                  <p className="font-medium">{application.extensionName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-600">Gender</p>
                  <p className="font-medium">{application.gender}</p>
                </div>
                <div>
                  <p className="text-gray-600">LRN</p>
                  <p className="font-medium">{application.lrn}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Contact Number</p>
                  <p className="font-medium">{application.contactNumber}</p>
                </div>
                <div>
                  <p className="text-gray-600">Email Address</p>
                  <p className="font-medium">{application.email}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Block/Lot/House No.</p>
                  <p className="font-medium">{application.blockLotHouseNo}</p>
                </div>
                <div>
                  <p className="text-gray-600">Street</p>
                  <p className="font-medium">{application.street}</p>
                </div>
                <div>
                  <p className="text-gray-600">Compound/Subdivision/Village</p>
                  <p className="font-medium">{application.compoundSubdivisionVillage}</p>
                </div>
                <div>
                  <p className="text-gray-600">Barangay</p>
                  <p className="font-medium">{application.barangay}</p>
                </div>
                <div>
                  <p className="text-gray-600">Municipality/City</p>
                  <p className="font-medium">{application.municipality}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Birth Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Date of Birth</p>
                  <p className="font-medium">{application.birthDate}</p>
                </div>
                <div>
                  <p className="text-gray-600">Place of Birth</p>
                  <p className="font-medium">{application.birthPlace}</p>
                </div>
                <div>
                  <p className="text-gray-600">Religion</p>
                  <p className="font-medium">{application.religion}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Parent/Guardian Information Tab */}
          <TabsContent value="family" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Mother's Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Given Name</p>
                  <p className="font-medium">{application.motherGivenName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Maiden Middle Name</p>
                  <p className="font-medium">{application.motherMaidenMiddleName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Maiden Last Name</p>
                  <p className="font-medium">{application.motherMaidenLastName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Contact Number</p>
                  <p className="font-medium">{application.motherContactNumber}</p>
                </div>
                <div>
                  <p className="text-gray-600">Occupation</p>
                  <p className="font-medium">{application.motherOccupation}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Father's Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Given Name</p>
                  <p className="font-medium">{application.fatherGivenName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Middle Name</p>
                  <p className="font-medium">{application.fatherMiddleName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Last Name</p>
                  <p className="font-medium">{application.fatherLastName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Contact Number</p>
                  <p className="font-medium">{application.fatherContactNumber}</p>
                </div>
                <div>
                  <p className="text-gray-600">Occupation</p>
                  <p className="font-medium">{application.fatherOccupation}</p>
                </div>
              </div>
            </div>

            {application.hasGuardian && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Guardian Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Given Name</p>
                    <p className="font-medium">{application.guardianGivenName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Middle Name</p>
                    <p className="font-medium">{application.guardianMiddleName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Last Name</p>
                    <p className="font-medium">{application.guardianLastName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Contact Number</p>
                    <p className="font-medium">{application.guardianContactNumber}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Relationship</p>
                    <p className="font-medium">{application.relationshipToGuardian}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-4">Emergency Contact</h3>
              <div className="text-sm">
                <p className="text-gray-600">Primary Emergency Contact</p>
                <p className="font-medium capitalize">{application.emergencyContact}</p>
              </div>
            </div>
          </TabsContent>

          {/* Academic Background Tab */}
          <TabsContent value="academic" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Academic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Grade Level</p>
                  <p className="font-medium">Grade {application.gradeLevel}</p>
                </div>
                <div>
                  <p className="text-gray-600">Strand</p>
                  <p className="font-medium">{application.strand}</p>
                </div>
                <div>
                  <p className="text-gray-600">Preferred Schedule</p>
                  <p className="font-medium">{application.preferredSchedule}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Enrollment History</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Previous School Attended</p>
                  <p className="font-medium">{application.previousSchoolAttended}</p>
                </div>
                <div>
                  <p className="text-gray-600">School Type</p>
                  <p className="font-medium capitalize">{application.schoolType}</p>
                </div>
                <div>
                  <p className="text-gray-600">Grade Level at Previous School</p>
                  <p className="font-medium">Grade {application.gradeLevelAtPreviousSchool}</p>
                </div>
                <div>
                  <p className="text-gray-600">Section at Previous School</p>
                  <p className="font-medium">{application.sectionAtPreviousSchool}</p>
                </div>
                <div>
                  <p className="text-gray-600">Last School Year Attended</p>
                  <p className="font-medium">{application.lastSchoolYearAttended}</p>
                </div>
              </div>
            </div>

            {application.hasReferralCode && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Bring a Friend Promo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Referral Card Control Number</p>
                    <p className="font-medium">{application.referralCardControlNumber}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Referrer Name</p>
                    <p className="font-medium">{application.referrerName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Referrer Contact Number</p>
                    <p className="font-medium">{application.referrerContactNumber}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-4">Payment Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Mode of Payment</p>
                  <p className="font-medium">{application.modeOfPayment}</p>
                </div>
                {application.voucherNo && (
                  <div>
                    <p className="text-gray-600">Voucher Number</p>
                    <p className="font-medium">{application.voucherNo}</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Documents Upload Tab */}
          <TabsContent value="documents" className="p-6">
            <div className="space-y-3">
              {application.documents.map((doc, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg hover:border-[#8B1538] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <FileText className="w-5 h-5 text-gray-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium">{doc.name}</p>
                          <Badge className={getDocumentStatusColor(doc.status)}>
                            {doc.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div>
                            <span className="text-gray-500">AI Confidence: </span>
                            <span
                              className={`font-semibold ${getConfidenceColor(doc.aiConfidence)}`}
                            >
                              {doc.aiConfidence}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Uploaded: </span>
                            <span>{doc.uploadedDate}</span>
                          </div>
                        </div>
                        {doc.status === "Flagged" && (
                          <Alert className="mt-3 border-red-300 bg-red-50">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-700">
                              This document has been flagged by AI. Please review
                              carefully for authenticity issues.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDocument(doc)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Review & Decision Tab */}
          <TabsContent value="review" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Registrar Remarks</h3>
              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks / Notes</Label>
                <textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter your remarks here..."
                  className="w-full min-h-[120px] px-3 py-2 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
                />
              </div>
              <Button
                variant="outline"
                onClick={handleSaveRemarks}
                className="mt-4 border-[#8B1538] text-[#8B1538] hover:bg-[#8B1538] hover:text-white"
              >
                Save Remarks
              </Button>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Application Decision</h3>
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Review all information and documents carefully before making a final decision.
                </AlertDescription>
              </Alert>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                  onClick={handleReject}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Application
                </Button>
                <Button
                  className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
                  onClick={handleApprove}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve Application
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Document View Dialog */}
      <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Document Verification Details</DialogTitle>
            <DialogDescription>
              Review AI verification results and detected issues
            </DialogDescription>
          </DialogHeader>
          {selectedDocument && (
            <>
              <div className="border rounded-lg p-4">
                <div className="flex items-start gap-3 flex-1">
                  {selectedDocument.status === "Verified" ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : selectedDocument.status === "Under Review" ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {selectedDocument.name}
                      </h3>
                      <Badge className={getDocumentStatusColor(selectedDocument.status)}>
                        {selectedDocument.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-2">
                      <div>
                        <p className="text-xs text-gray-500">Student</p>
                        <p className="font-medium">{selectedDocument.studentName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Application ID</p>
                        <p className="font-medium">{selectedDocument.applicationId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Strand / Grade</p>
                        <p className="font-medium">
                          {selectedDocument.strand} - Grade {selectedDocument.gradeLevel}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Confidence Score</p>
                        <p className={`font-semibold ${getConfidenceColor(selectedDocument.aiConfidence)}`}>
                          {selectedDocument.aiConfidence}%
                        </p>
                      </div>
                    </div>
                    {selectedDocument.issues.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm font-medium text-red-700">
                          Detected Issues:
                        </p>
                        <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                          {selectedDocument.issues.map((issue: string, idx: number) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Verified: {selectedDocument.uploadedDate}
                    </p>
                  </div>
                </div>
              </div>

              {/* Document Preview */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold text-gray-900 mb-3">Uploaded Document</h4>
                <div className="bg-white border rounded-lg overflow-hidden">
                  <img
                    src={selectedDocument.fileUrl || sampleDocument}
                    alt={selectedDocument.name}
                    className="w-full h-auto max-h-[500px] object-contain"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Click to view full size or download the document
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}