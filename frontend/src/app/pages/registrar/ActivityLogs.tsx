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
  FileUp,
  CheckCircle,
  XCircle,
  Eye,
  MessageSquare,
  UserPlus,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  fetchActivityLogs,
  type ActivityLogEntry,
  type ActivityLogStats,
} from "../../lib/activityLogsApi";

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
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [stats, setStats] = useState<ActivityLogStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchActivityLogs("registrar", {
        search: searchTerm,
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
  }, [searchTerm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLogs();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadLogs]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Activity Logs</h2>
          <p className="text-gray-600">
            Track all system actions and user activities
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

      {error ? (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</Card>
      ) : null}

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Live log from the `activity_logs` database (last 30 days)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-gray-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading activity logs…
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No activity logs found
              </div>
            ) : (
              activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 border rounded-lg hover:border-[#8B1538] transition-colors"
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
