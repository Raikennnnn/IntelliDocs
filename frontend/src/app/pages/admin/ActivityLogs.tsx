import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
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
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchActivityLogs,
  type ActivityLogEntry,
  type ActivityLogStats,
} from "../../lib/activityLogsApi";
import { filterActivityTimelineLogs } from "../../lib/activityLogSearch";

const emptyStats: ActivityLogStats = {
  totalActions: 0,
  logins: 0,
  uploads: 0,
  approvals: 0,
  rejections: 0,
  security: 0,
};

export function ActivityLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("All");
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [stats, setStats] = useState<ActivityLogStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchActivityLogs("admin", {
        type: filterType === "All" ? "all" : filterType,
        range: "month",
        limit: 100,
      });
      setActivityLogs(Array.isArray(json.logs) ? json.logs : []);
      setStats(json.stats ?? emptyStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load activity logs");
      setActivityLogs([]);
      setStats(emptyStats);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  const filteredLogs = useMemo(
    () => filterActivityTimelineLogs(activityLogs, searchTerm),
    [activityLogs, searchTerm],
  );

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Activity Logs</h2>
          <p className="text-gray-600">
            System-wide activity tracking and audit trail
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadLogs()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Statistics */}
      <div className="stat-grid">
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

      {error ? (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</Card>
      ) : null}

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : searchTerm.trim()
                ? `${filteredLogs.length} of ${activityLogs.length} events match "${searchTerm.trim()}"`
                : `${activityLogs.length} events in the last 30 days`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-gray-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading activity logs…
              </div>
            ) : error && activityLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Could not load activity logs. Use Refresh or contact support if this continues.
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm.trim()
                  ? `No activity logs match "${searchTerm.trim()}".`
                  : "No activity logs found for the selected filters"}
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
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                          {log.role !== "System" && log.role !== "N/A" && (
                            <>
                              <span className="mx-1">•</span>
                              <span className="capitalize">{log.role}</span>
                            </>
                          )}
                        </div>
                        <span>•</span>
                        <span className="font-mono">{log.ipAddress}</span>
                        <span>•</span>
                        <span>{log.timestampLabel || log.timestamp}</span>
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
