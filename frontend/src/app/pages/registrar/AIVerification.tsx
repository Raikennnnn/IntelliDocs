import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  Brain,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  FileText,
  Eye,
  Filter,
} from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";

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

export function AIVerification() {
  const [filterStrand, setFilterStrand] = useState<string>("All");
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>("All");

  // Mock AI verification results
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
      applicationId: "APP-2026-007",
      studentName: "Mark Gonzales",
      strand: "TVL-BPP/FBS",
      gradeLevel: "11",
      documentName: "Birth Certificate",
      confidence: 88,
      status: "Verified",
      issues: [],
      verifiedDate: "March 16, 2026",
    },
  ];

  const getStatusColor = (status: string) => {
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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-600";
    if (confidence >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 90)
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    return <TrendingDown className="w-4 h-4 text-red-600" />;
  };

  const stats = {
    total: verificationResults.length,
    verified: verificationResults.filter((r) => r.status === "Verified").length,
    suspicious: verificationResults.filter((r) => r.status === "Suspicious")
      .length,
    failed: verificationResults.filter((r) => r.status === "Failed").length,
    avgConfidence: Math.round(
      verificationResults.reduce((sum, r) => sum + r.confidence, 0) /
        verificationResults.length
    ),
  };

  // Filter results by strand and grade level
  const filteredResults = verificationResults.filter((result) => {
    const matchesStrand = filterStrand === "All" || result.strand === filterStrand;
    const matchesGradeLevel =
      filterGradeLevel === "All" || result.gradeLevel === filterGradeLevel;
    return matchesStrand && matchesGradeLevel;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">
          AI Verification Results
        </h2>
        <p className="text-gray-600">
          Review AI-powered document verification results
        </p>
      </div>

      {/* AI Overview Alert */}
      <Alert className="border-[#8B1538] bg-red-50">
        <Brain className="h-4 w-4 text-[#8B1538]" />
        <AlertDescription className="text-gray-700">
          <strong>AI Verification System:</strong> Our AI analyzes documents
          for authenticity, tampering, and compliance. Results with low
          confidence scores require manual review.
        </AlertDescription>
      </Alert>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-600">Total Verified</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {stats.verified}
              </p>
              <p className="text-sm text-gray-600">Passed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {stats.suspicious}
              </p>
              <p className="text-sm text-gray-600">Suspicious</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              <p className="text-sm text-gray-600">Failed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p
                className={`text-2xl font-bold ${getConfidenceColor(stats.avgConfidence)}`}
              >
                {stats.avgConfidence}%
              </p>
              <p className="text-sm text-gray-600">Avg Confidence</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
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
                <option value="11">Grade 11</option>
                <option value="12">Grade 12</option>
              </select>
            </div>
            <div className="text-sm text-gray-600">
              Showing {filteredResults.length} of {verificationResults.length} results
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flagged Documents (Priority Review) */}
      <Card className="border-red-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Flagged Documents - Requires Attention
          </CardTitle>
          <CardDescription>
            Documents with low confidence scores or detected issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredResults
            .filter(
              (result) =>
                result.status === "Suspicious" || result.status === "Failed"
            )
            .map((result, index) => (
              <div
                key={index}
                className="p-4 border border-red-200 rounded-lg bg-red-50 hover:border-red-400 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {result.documentName}
                        </h3>
                        <Badge className={getStatusColor(result.status)}>
                          {result.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                        <div>
                          <span className="text-gray-600">Student: </span>
                          <span className="font-medium">
                            {result.studentName}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Application: </span>
                          <span className="font-medium">
                            {result.applicationId}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Strand: </span>
                          <span className="font-medium">
                            {result.strand}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Grade: </span>
                          <span className="font-medium">
                            {result.gradeLevel}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        {getConfidenceIcon(result.confidence)}
                        <span className="text-sm text-gray-600">
                          Confidence Score:{" "}
                        </span>
                        <span
                          className={`font-semibold ${getConfidenceColor(result.confidence)}`}
                        >
                          {result.confidence}%
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-red-700">
                          Detected Issues:
                        </p>
                        <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                          {result.issues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Verified: {result.verifiedDate}
                      </p>
                    </div>
                  </div>
                  <Link to={`/registrar/review-documents/${result.applicationId}`}>
                    <Button
                      size="sm"
                      className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white ml-4"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Review
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* All Verification Results */}
      <Card>
        <CardHeader>
          <CardTitle>All Verification Results</CardTitle>
          <CardDescription>Complete AI verification history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredResults.map((result, index) => (
            <div
              key={index}
              className="p-4 border rounded-lg hover:border-[#8B1538] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {result.status === "Verified" ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : result.status === "Suspicious" ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-gray-900">
                        {result.documentName}
                      </h3>
                      <Badge className={getStatusColor(result.status)}>
                        {result.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="text-gray-500">Student: </span>
                        <span className="font-medium">
                          {result.studentName}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Strand / Grade: </span>
                        <span className="font-medium">
                          {result.strand} - Grade {result.gradeLevel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Confidence: </span>
                        <span
                          className={`font-semibold ${getConfidenceColor(result.confidence)}`}
                        >
                          {result.confidence}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {result.verifiedDate}
                    </p>
                  </div>
                </div>
                <Link to={`/registrar/review-documents/${result.applicationId}`}>
                  <Button variant="outline" size="sm" className="ml-4">
                    <FileText className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}