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
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiFetch } from "../../lib/api";

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

export function Applications() {
  const [activeTab, setActiveTab] = useState<"applications">("applications");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterStrand, setFilterStrand] = useState<string>("All");
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [applications, setApplications] = useState<Application[]>([]);
  
  const loadApplications = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/registrar/applications");
      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("Server returned an invalid response");
      }

      if (!res.ok || !json.success) {
        setError(json.error || `Failed to load applications (${res.status})`);
        setApplications([]);
        return;
      }

      const rows = (Array.isArray(json.applications) ? json.applications : []) as any[];
      setApplications(
        rows.map((row) => ({
          id: String(row.id ?? ""),
          studentName: String(row.studentName ?? "Unknown Applicant"),
          email: String(row.email ?? ""),
          strand: String(row.strand ?? ""),
          gradeLevel: String(row.gradeLevel ?? ""),
          submittedDate: row.submittedDate
            ? new Date(String(row.submittedDate)).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "",
          status: (row.status ?? "Pending") as Application["status"],
          documentsVerified: Number(row.documentsVerified ?? 0),
          totalDocuments: Number(row.totalDocuments ?? 0),
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setApplications([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications(true);
    const intervalId = window.setInterval(() => {
      loadApplications(false);
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, []);

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

  const stats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === "Pending").length,
    underReview: applications.filter((a) => a.status === "Under Review").length,
    approved: applications.filter((a) => a.status === "Approved").length,
    rejected: applications.filter((a) => a.status === "Rejected").length,
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

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
                  {loading ? "Loading applications..." : "No applications found"}
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
                                  width: `${app.totalDocuments > 0 ? (app.documentsVerified / app.totalDocuments) * 100 : 0}%`,
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