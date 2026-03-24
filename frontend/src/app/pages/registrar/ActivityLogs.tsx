import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Activity,
  Search,
  FileUp,
  CheckCircle,
  XCircle,
  Eye,
  MessageSquare,
  UserPlus,
} from "lucide-react";
import { useState } from "react";

interface ActivityLog {
  id: string;
  action: string;
  description: string;
  user: string;
  role: string;
  timestamp: string;
  type: "upload" | "approval" | "rejection" | "view" | "remark" | "registration";
  relatedTo?: string;
}

export function ActivityLogs() {
  const [searchTerm, setSearchTerm] = useState("");

  // Mock activity logs
  const activityLogs: ActivityLog[] = [
    {
      id: "1",
      action: "Application Approved",
      description: "Approved enrollment application for Pedro Reyes",
      user: "Maria Cruz",
      role: "Registrar",
      timestamp: "March 18, 2026 - 3:45 PM",
      type: "approval",
      relatedTo: "APP-2026-003",
    },
    {
      id: "2",
      action: "Document Uploaded",
      description: "Student uploaded Birth Certificate",
      user: "Juan Dela Cruz",
      role: "Student",
      timestamp: "March 18, 2026 - 2:30 PM",
      type: "upload",
      relatedTo: "APP-2026-001",
    },
    {
      id: "3",
      action: "Remark Added",
      description: "Added remarks to application: 'Please re-upload SF10 with better quality'",
      user: "Maria Cruz",
      role: "Registrar",
      timestamp: "March 18, 2026 - 1:15 PM",
      type: "remark",
      relatedTo: "APP-2026-001",
    },
    {
      id: "4",
      action: "Application Reviewed",
      description: "Reviewed documents for application APP-2026-002",
      user: "Maria Cruz",
      role: "Registrar",
      timestamp: "March 18, 2026 - 11:00 AM",
      type: "view",
      relatedTo: "APP-2026-002",
    },
    {
      id: "5",
      action: "Application Rejected",
      description: "Rejected enrollment application for Ana Garcia - Invalid documents",
      user: "Maria Cruz",
      role: "Registrar",
      timestamp: "March 17, 2026 - 4:30 PM",
      type: "rejection",
      relatedTo: "APP-2026-004",
    },
    {
      id: "6",
      action: "New Registration",
      description: "New student registered: Carlos Mendoza",
      user: "Carlos Mendoza",
      role: "Student",
      timestamp: "March 17, 2026 - 2:00 PM",
      type: "registration",
      relatedTo: "APP-2026-005",
    },
    {
      id: "7",
      action: "Document Uploaded",
      description: "Student uploaded Good Moral Certificate",
      user: "Maria Santos",
      role: "Student",
      timestamp: "March 16, 2026 - 3:20 PM",
      type: "upload",
      relatedTo: "APP-2026-002",
    },
    {
      id: "8",
      action: "Application Submitted",
      description: "Student submitted enrollment application",
      user: "Maria Santos",
      role: "Student",
      timestamp: "March 16, 2026 - 3:00 PM",
      type: "upload",
      relatedTo: "APP-2026-002",
    },
  ];

  const getActionIcon = (type: string) => {
    switch (type) {
      case "upload":
        return <FileUp className="w-5 h-5 text-blue-600" />;
      case "approval":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "rejection":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "view":
        return <Eye className="w-5 h-5 text-gray-600" />;
      case "remark":
        return <MessageSquare className="w-5 h-5 text-yellow-600" />;
      case "registration":
        return <UserPlus className="w-5 h-5 text-[#8B1538]" />;
      default:
        return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const getActionBadgeColor = (type: string) => {
    switch (type) {
      case "upload":
        return "bg-blue-600";
      case "approval":
        return "bg-green-600";
      case "rejection":
        return "bg-red-600";
      case "view":
        return "bg-gray-600";
      case "remark":
        return "bg-yellow-600";
      case "registration":
        return "bg-[#8B1538]";
      default:
        return "bg-gray-600";
    }
  };

  const filteredLogs = activityLogs.filter(
    (log) =>
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.relatedTo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalActions: activityLogs.length,
    uploads: activityLogs.filter((l) => l.type === "upload").length,
    approvals: activityLogs.filter((l) => l.type === "approval").length,
    rejections: activityLogs.filter((l) => l.type === "rejection").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Activity Logs</h2>
        <p className="text-gray-600">
          Track all system actions and user activities
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalActions}
              </p>
              <p className="text-sm text-gray-600">Total Actions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {stats.uploads}
              </p>
              <p className="text-sm text-gray-600">Uploads</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {stats.approvals}
              </p>
              <p className="text-sm text-gray-600">Approvals</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {stats.rejections}
              </p>
              <p className="text-sm text-gray-600">Rejections</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by action, user, or application ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Chronological log of all system actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No activity logs found
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 border rounded-lg hover:border-[#8B1538] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getActionIcon(log.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {log.action}
                        </h3>
                        <Badge className={getActionBadgeColor(log.type)}>
                          {log.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {log.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div>
                          <span className="font-medium">{log.user}</span>
                          <span className="mx-1">•</span>
                          <span className="capitalize">{log.role}</span>
                        </div>
                        {log.relatedTo && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{log.relatedTo}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{log.timestamp}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
