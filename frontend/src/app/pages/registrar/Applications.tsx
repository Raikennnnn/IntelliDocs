import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Search,
  Filter,
  Brain,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

interface Application {
  id: string;
  studentName: string;
  email: string;
  strand: string;
  gradeLevel: string;
  submittedDate: string;
  status: "Pending" | "Under Review" | "Approved" | "Rejected";
  documentsVerified: number;
  totalDocuments: number;
}

interface AIVerificationResult {
  applicationId: string;
  studentName: string;
  strand: string;
  gradeLevel: string;
  documentName: string;
  confidence: number;
  status: "Verified" | "Suspicious" | "Failed";
  issues: string[];
  verifiedDate: string;
}

export function Applications() {
  const [activeTab, setActiveTab] = useState<"applications">("applications");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterStrand, setFilterStrand] = useState<string>("All");
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>("All");

  // Mock data - replace with actual API data
  const [applications] = useState<Application[]>([
    {
      id: "APP-2026-001",
      studentName: "Juan Dela Cruz",
      email: "juan.delacruz@email.com",
      strand: "HUMSS",
      gradeLevel: "11",
      submittedDate: "March 15, 2026",
      status: "Under Review",
      documentsVerified: 2,
      totalDocuments: 4,
    },
    {
      id: "APP-2026-002",
      studentName: "Maria Santos",
      email: "maria.santos@email.com",
      strand: "TVL-ICT",
      gradeLevel: "12",
      submittedDate: "March 16, 2026",
      status: "Pending",
      documentsVerified: 0,
      totalDocuments: 5,
    },
    {
      id: "APP-2026-003",
      studentName: "Pedro Reyes",
      email: "pedro.reyes@email.com",
      strand: "HUMSS",
      gradeLevel: "11",
      submittedDate: "March 14, 2026",
      status: "Approved",
      documentsVerified: 4,
      totalDocuments: 4,
    },
    {
      id: "APP-2026-004",
      studentName: "Ana Garcia",
      email: "ana.garcia@email.com",
      strand: "STEM",
      gradeLevel: "12",
      submittedDate: "March 13, 2026",
      status: "Rejected",
      documentsVerified: 3,
      totalDocuments: 4,
    },
    {
      id: "APP-2026-005",
      studentName: "Carlos Mendoza",
      email: "carlos.mendoza@email.com",
      strand: "ABM",
      gradeLevel: "11",
      submittedDate: "March 17, 2026",
      status: "Pending",
      documentsVerified: 1,
      totalDocuments: 4,
    },
    {
      id: "APP-2026-006",
      studentName: "Lisa Fernandez",
      email: "lisa.fernandez@email.com",
      strand: "TVL-EIM",
      gradeLevel: "12",
      submittedDate: "March 18, 2026",
      status: "Under Review",
      documentsVerified: 3,
      totalDocuments: 4,
    },
  ]);

  // AI Verification Results
  const verificationResults: AIVerificationResult[] = [
    {
      applicationId: "APP-2026-001",
      studentName: "Juan Dela Cruz",
      strand: "HUMSS",
      gradeLevel: "11",
      documentName: "SF10 / Form 137",
      confidence: 62,
      status: "Suspicious",
      issues: [
        "Possible tampering detected on grades section",
        "Low image quality",
        "Signature authenticity questionable",
      ],
      verifiedDate: "March 18, 2026",
    },
    {
      applicationId: "APP-2026-002",
      studentName: "Maria Santos",
      strand: "TVL-ICT",
      gradeLevel: "12",
      documentName: "Good Moral Certificate",
      confidence: 45,
      status: "Failed",
      issues: [
        "School seal does not match database",
        "Date format inconsistent",
        "Font inconsistencies detected",
      ],
      verifiedDate: "March 18, 2026",
    },
    {
      applicationId: "APP-2026-005",
      studentName: "Carlos Mendoza",
      strand: "ABM",
      gradeLevel: "11",
      documentName: "Birth Certificate",
      confidence: 68,
      status: "Suspicious",
      issues: ["PSA security features not fully detected", "Border quality low"],
      verifiedDate: "March 17, 2026",
    },
    {
      applicationId: "APP-2026-001",
      studentName: "Juan Dela Cruz",
      strand: "HUMSS",
      gradeLevel: "11",
      documentName: "Birth Certificate",
      confidence: 98,
      status: "Verified",
      issues: [],
      verifiedDate: "March 15, 2026",
    },
    {
      applicationId: "APP-2026-003",
      studentName: "Pedro Reyes",
      strand: "STEM",
      gradeLevel: "11",
      documentName: "SF9 (Report Card)",
      confidence: 95,
      status: "Verified",
      issues: [],
      verifiedDate: "March 16, 2026",
    },
    {
      applicationId: "APP-2026-006",
      studentName: "Lisa Fernandez",
      strand: "TVL-EIM",
      gradeLevel: "12",
      documentName: "Good Moral Certificate",
      confidence: 92,
      status: "Verified",
      issues: [],
      verifiedDate: "March 17, 2026",
    },
    {
      applicationId: "APP-2026-004",
      studentName: "Ana Garcia",
      strand: "STEM",
      gradeLevel: "12",
      documentName: "Birth Certificate",
      confidence: 88,
      status: "Verified",
      issues: [],
      verifiedDate: "March 16, 2026",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-600";
      case "Under Review":
        return "bg-blue-600";
      case "Pending":
        return "bg-yellow-600";
      case "Rejected":
        return "bg-red-600";
      default:
        return "bg-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved":
        return <CheckCircle className="w-4 h-4" />;
      case "Under Review":
        return <Clock className="w-4 h-4" />;
      case "Pending":
        return <Clock className="w-4 h-4" />;
      case "Rejected":
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-600";
    if (confidence >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case "Verified":
        return "bg-green-600";
      case "Suspicious":
        return "bg-yellow-600";
      case "Failed":
        return "bg-red-600";
      default:
        return "bg-gray-600";
    }
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterStatus === "All" || app.status === filterStatus;
    const matchesStrand = filterStrand === "All" || app.strand === filterStrand;
    const matchesGradeLevel =
      filterGradeLevel === "All" || app.gradeLevel === filterGradeLevel;
    return matchesSearch && matchesFilter && matchesStrand && matchesGradeLevel;
  });

  const filteredVerificationResults = verificationResults.filter((result) => {
    const matchesSearch =
      result.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.applicationId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.documentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStrand = filterStrand === "All" || result.strand === filterStrand;
    const matchesGradeLevel =
      filterGradeLevel === "All" || result.gradeLevel === filterGradeLevel;
    return matchesSearch && matchesStrand && matchesGradeLevel;
  });

  const stats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === "Pending").length,
    underReview: applications.filter((a) => a.status === "Under Review").length,
    approved: applications.filter((a) => a.status === "Approved").length,
    rejected: applications.filter((a) => a.status === "Rejected").length,
  };

  const aiStats = {
    total: verificationResults.length,
    verified: verificationResults.filter((r) => r.status === "Verified").length,
    suspicious: verificationResults.filter((r) => r.status === "Suspicious").length,
    failed: verificationResults.filter((r) => r.status === "Failed").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Applications</h2>
        <p className="text-gray-600">
          Manage student enrollment applications
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-600">Total Applications</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-sm text-gray-600">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.underReview}</p>
              <p className="text-sm text-gray-600">Under Review</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              <p className="text-sm text-gray-600">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              <p className="text-sm text-gray-600">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or application ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Under Review">Under Review</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <select
                value={filterStrand}
                onChange={(e) => setFilterStrand(e.target.value)}
                className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
              >
                <option value="All">All Strands</option>
                <option value="STEM">STEM</option>
                <option value="HUMSS">HUMSS</option>
                <option value="ABM">ABM</option>
                <option value="TVL-ICT">TVL-ICT</option>
                <option value="TVL-EIM">TVL-EIM</option>
                <option value="TVL-BPP/FBS">TVL-BPP/FBS</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <select
                value={filterGradeLevel}
                onChange={(e) => setFilterGradeLevel(e.target.value)}
                className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
              >
                <option value="All">All Grade Levels</option>
                <option value="11">11</option>
                <option value="12">12</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      {activeTab === "applications" && (
        <Card>
          <CardHeader>
            <CardTitle>All Applications ({filteredApplications.length})</CardTitle>
            <CardDescription>
              Click on an application to review details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredApplications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No applications found
                </div>
              ) : (
                filteredApplications.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 border rounded-lg hover:border-[#8B1538] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">
                            {app.studentName}
                          </h3>
                          <Badge className={getStatusColor(app.status)}>
                            {getStatusIcon(app.status)}
                            <span className="ml-1">{app.status}</span>
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <p className="text-xs text-gray-500">Application ID</p>
                            <p className="font-medium">{app.id}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="font-medium">{app.email}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Strand / Grade</p>
                            <p className="font-medium">
                              {app.strand} - Grade {app.gradeLevel}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Submitted</p>
                            <p className="font-medium">{app.submittedDate}</p>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center gap-2 text-sm">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-[#2D5016] h-2 rounded-full"
                                style={{
                                  width: `${(app.documentsVerified / app.totalDocuments) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 whitespace-nowrap">
                              {app.documentsVerified}/{app.totalDocuments} docs verified
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <Link to={`/registrar/review-documents/${app.id}`}>
                          <Button
                            size="sm"
                            className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Review
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}