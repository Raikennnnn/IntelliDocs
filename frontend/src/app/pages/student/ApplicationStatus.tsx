import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { useStudentPortal } from "../../hooks/useStudentPortal";

export function ApplicationStatus() {
  const { data, loading, error } = useStudentPortal();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
      case "Verified":
        return "bg-green-600 hover:bg-green-600";
      case "Under Review":
        return "bg-blue-600 hover:bg-blue-600";
      case "Pending":
        return "bg-yellow-600 hover:bg-yellow-600";
      case "Rejected":
        return "bg-red-600 hover:bg-red-600";
      default:
        return "bg-gray-600 hover:bg-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved":
      case "Verified":
        return <CheckCircle className="w-5 h-5" />;
      case "Under Review":
        return <Clock className="w-5 h-5" />;
      case "Pending":
        return <AlertCircle className="w-5 h-5" />;
      case "Rejected":
        return <XCircle className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-gray-600 py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading application status…
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error || "Could not load application data."}
        </AlertDescription>
      </Alert>
    );
  }

  const application = data.application;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">
          Application Status
        </h2>
        <p className="text-gray-600">
          Track your enrollment application progress
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application Overview</CardTitle>
          <CardDescription>Application ID: {application.id}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(application.status)}
              <div>
                <p className="font-semibold text-blue-900">
                  {application.status}
                </p>
                <p className="text-sm text-blue-700">
                  Last updated: {application.lastUpdated}
                </p>
              </div>
            </div>
            <Badge className={getStatusColor(application.status)}>
              {application.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Submitted Date</p>
              <p className="font-medium">{application.submittedDate}</p>
            </div>
            <div>
              <p className="text-gray-600">Last Updated</p>
              <p className="font-medium">{application.lastUpdated}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document Verification Status</CardTitle>
          <CardDescription>
            Individual status of your submitted documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {application.documents.length === 0 ? (
            <p className="text-sm text-gray-600 py-4 text-center">
              No documents on file yet. Complete enrollment to upload requirements.
            </p>
          ) : (
            application.documents.map((doc, index) => (
              <div
                key={`${doc.name}-${index}`}
                className="p-4 border rounded-lg hover:border-[#8B1538] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-gray-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{doc.name}</p>
                      {doc.remarks ? (
                        <p className="text-sm text-gray-600 mt-1">{doc.remarks}</p>
                      ) : null}
                    </div>
                  </div>
                  <Badge className={`shrink-0 ${getStatusColor(doc.status)}`}>
                    {doc.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {application.registrarRemarks ? (
        <Card className="border-[#8B1538]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#8B1538]">
              <MessageSquare className="w-5 h-5" />
              Registrar&apos;s Remarks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 border border-[#8B1538] bg-red-50 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#8B1538] shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">
                  {application.registrarRemarks}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
