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
  LogIn,
  FileUp,
  CheckCircle,
  XCircle,
  UserPlus,
  Settings,
  Shield,
  Filter,
} from "lucide-react";
import { useState } from "react";

interface ActivityLog {
  id: string;
  action: string;
  description: string;
  user: string;
  role: string;
  ipAddress: string;
  timestamp: string;
  type: "login" | "upload" | "approval" | "rejection" | "user_management" | "system_config" | "security";
}

export function ActivityLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("All");

  // Mock activity logs
  const activityLogs: ActivityLog[] = [
    {
      id: "1",
      action: "User Login",
      description: "Successful login to Admin portal",
      user: "Admin User",
      role: "Admin",
      ipAddress: "192.168.1.100",
      timestamp: "March 18, 2026 - 4:00 PM",
      type: "login",
    },
    {
      id: "2",
      action: "Application Approved",
      description: "Approved enrollment application for Pedro Reyes",
      user: "Maria Cruz",
      role: "Registrar",
      ipAddress: "192.168.1.105",
      timestamp: "March 18, 2026 - 3:45 PM",
      type: "approval",
    },
    {
      id: "3",
      action: "New User Created",
      description: "Created new Registrar account: Jane Doe",
      user: "Admin User",
      role: "Admin",
      ipAddress: "192.168.1.100",
      timestamp: "March 18, 2026 - 3:30 PM",
      type: "user_management",
    },
    {
      id: "4",
      action: "Document Uploaded",
      description: "Student uploaded Birth Certificate",
      user: "Juan Dela Cruz",
      role: "Student",
      ipAddress: "192.168.1.150",
      timestamp: "March 18, 2026 - 2:30 PM",
      type: "upload",
    },
    {
      id: "5",
      action: "System Configuration Updated",
      description: "Updated OTP email configuration settings",
      user: "Admin User",
      role: "Admin",
      ipAddress: "192.168.1.100",
      timestamp: "March 18, 2026 - 1:00 PM",
      type: "system_config",
    },
    {
      id: "6",
      action: "User Login",
      description: "Successful login to Registrar portal",
      user: "Maria Cruz",
      role: "Registrar",
      ipAddress: "192.168.1.105",
      timestamp: "March 18, 2026 - 9:00 AM",
      type: "login",
    },
    {
      id: "7",
      action: "Application Rejected",
      description: "Rejected enrollment application - Invalid documents",
      user: "Maria Cruz",
      role: "Registrar",
      ipAddress: "192.168.1.105",
      timestamp: "March 17, 2026 - 4:30 PM",
      type: "rejection",
    },
    {
      id: "8",
      action: "Failed Login Attempt",
      description: "Failed login attempt - Invalid credentials",
      user: "Unknown",
      role: "N/A",
      ipAddress: "203.0.113.45",
      timestamp: "March 17, 2026 - 3:15 PM",
      type: "security",
    },
    {
      id: "9",
      action: "User Deactivated",
      description: "Deactivated student account: Carlos Mendoza",
      user: "Admin User",
      role: "Admin",
      ipAddress: "192.168.1.100",
      timestamp: "March 17, 2026 - 2:00 PM",
      type: "user_management",
    },
    {
      id: "10",
      action: "User Login",
      description: "Successful login to Student portal",
      user: "Pedro Reyes",
      role: "Student",
      ipAddress: "192.168.1.160",
      timestamp: "March 17, 2026 - 10:30 AM",
      type: "login",
    },
  ];

  const getActionIcon = (type: string) => {
    switch (type) {
      case "login":
        return <LogIn className="w-5 h-5 text-blue-600" />;
      case "upload":
        return <FileUp className="w-5 h-5 text-green-600" />;
      case "approval":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "rejection":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "user_management":
        return <UserPlus className="w-5 h-5 text-[#8B1538]" />;
      case "system_config":
        return <Settings className="w-5 h-5 text-gray-600" />;
      case "security":
        return <Shield className="w-5 h-5 text-yellow-600" />;
      default:
        return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const getActionBadgeColor = (type: string) => {
    switch (type) {
      case "login":
        return "bg-blue-600";
      case "upload":
        return "bg-green-600";
      case "approval":
        return "bg-green-600";
      case "rejection":
        return "bg-red-600";
      case "user_management":
        return "bg-[#8B1538]";
      case "system_config":
        return "bg-gray-600";
      case "security":
        return "bg-yellow-600";
      default:
        return "bg-gray-600";
    }
  };

  const filteredLogs = activityLogs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ipAddress.includes(searchTerm);
    const matchesFilter =
      filterType === "All" || log.type === filterType.toLowerCase().replace(" ", "_");
    return matchesSearch && matchesFilter;
  });

  const stats = {
    totalActions: activityLogs.length,
    logins: activityLogs.filter((l) => l.type === "login").length,
    uploads: activityLogs.filter((l) => l.type === "upload").length,
    approvals: activityLogs.filter((l) => l.type === "approval").length,
    security: activityLogs.filter((l) => l.type === "security").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Activity Logs</h2>
        <p className="text-gray-600">
          System-wide activity tracking and audit trail
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                {stats.logins}
              </p>
              <p className="text-sm text-gray-600">Logins</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
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
              <p className="text-2xl font-bold text-yellow-600">
                {stats.security}
              </p>
              <p className="text-sm text-gray-600">Security Events</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by action, user, or IP address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
              >
                <option value="All">All Types</option>
                <option value="login">Login</option>
                <option value="upload">Upload</option>
                <option value="approval">Approval</option>
                <option value="rejection">Rejection</option>
                <option value="user_management">User Management</option>
                <option value="system_config">System Config</option>
                <option value="security">Security</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            Complete audit trail of all system activities
          </CardDescription>
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
                  className={`p-4 border rounded-lg hover:border-[#8B1538] transition-colors ${
                    log.type === "security" ? "border-yellow-300 bg-yellow-50" : ""
                  }`}
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
                          {log.type.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {log.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <div>
                          <span className="font-medium">{log.user}</span>
                          {log.role !== "N/A" && (
                            <>
                              <span className="mx-1">•</span>
                              <span className="capitalize">{log.role}</span>
                            </>
                          )}
                        </div>
                        <span>•</span>
                        <span className="font-mono">{log.ipAddress}</span>
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
