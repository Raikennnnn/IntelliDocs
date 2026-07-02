import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import {
  Server,
  Database,
  Shield,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Clock,
  Loader2,
} from 'lucide-react';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { apiFetch } from '../../lib/api';
import { toast } from 'sonner';

type DateRangeKey = 'today' | '7days' | '30days' | '90days';

type PerformanceRow = {
  metric: string;
  value: string;
  status: string;
  trend: string;
};

type SecurityRow = {
  date: string;
  type: string;
  count: number;
  severity: string;
  details: string;
};

type DatabaseRow = {
  database: string;
  size: string;
  growth: string;
  lastBackup: string;
  status: string;
};

type ActivityRow = {
  role: string;
  logins: number;
  avgDuration: string;
  activeUsers: number;
  failedLogins: number;
};

type AuditRow = {
  timestamp: string;
  user: string;
  action: string;
  module: string;
  status: string;
};

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center text-sm text-gray-500 py-8">
        {message}
      </TableCell>
    </TableRow>
  );
}

export function Reports() {
  const [activeTab, setActiveTab] = useState<'performance' | 'security' | 'database' | 'activity' | 'audit'>('performance');
  const [dateRange, setDateRange] = useState<DateRangeKey>('7days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({ dateRangeLabel: 'Last 7 Days', generatedAt: '' });
  const [summary, setSummary] = useState({
    systemUptime: 'N/A',
    databaseSizeLabel: 'N/A',
    securityEvents: 0,
    activeUsers: 0,
  });
  const [securityAlert, setSecurityAlert] = useState<{ show: boolean; message: string }>({
    show: false,
    message: '',
  });
  const [backupInfo, setBackupInfo] = useState({
    lastBackup: 'N/A',
    backupCount: 0,
    backupPath: 'backups/mysql',
    latestFile: null as string | null,
    status: 'Warning',
  });
  const [resourceUsage, setResourceUsage] = useState({
    memoryPercent: 0,
    memoryLabel: 'N/A',
    uploadsSize: 'N/A',
  });
  const [performanceRows, setPerformanceRows] = useState<PerformanceRow[]>([]);
  const [securityRows, setSecurityRows] = useState<SecurityRow[]>([]);
  const [databaseRows, setDatabaseRows] = useState<DatabaseRow[]>([]);
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reportsRes = await apiFetch(`/api/admin/reports?range=${dateRange}`);
      const reportsText = await reportsRes.text();
      let reportsJson: Record<string, unknown> = {};
      try {
        reportsJson = JSON.parse(reportsText);
      } catch {
        throw new Error('Could not load reports. Please try again.');
      }
      if (!reportsRes.ok || !reportsJson.success) {
        throw new Error(
          (reportsJson.error as string) || 'Could not load reports. Please try again.',
        );
      }

      const s = (reportsJson.summary ?? {}) as Record<string, unknown>;
      setSummary({
        systemUptime: String(s.systemUptime ?? 'N/A'),
        databaseSizeLabel: String(s.databaseSizeLabel ?? 'N/A'),
        securityEvents: Number(s.securityEvents ?? 0),
        activeUsers: Number(s.activeUsers ?? 0),
      });

      const m = (reportsJson.meta ?? {}) as Record<string, unknown>;
      setMeta({
        dateRangeLabel: String(m.dateRangeLabel ?? 'Last 7 Days'),
        generatedAt: String(m.generatedAt ?? ''),
      });

      const alert = (reportsJson.securityAlert ?? {}) as Record<string, unknown>;
      setSecurityAlert({
        show: Boolean(alert.show),
        message: String(alert.message ?? ''),
      });

      const backup = (reportsJson.backupInfo ?? {}) as Record<string, unknown>;
      setBackupInfo({
        lastBackup: String(backup.lastBackup ?? 'N/A'),
        backupCount: Number(backup.backupCount ?? 0),
        backupPath: String(backup.backupPath ?? 'backups/mysql'),
        latestFile: backup.latestFile != null ? String(backup.latestFile) : null,
        status: String(backup.status ?? 'Warning'),
      });

      const resources = (reportsJson.resourceUsage ?? {}) as Record<string, unknown>;
      setResourceUsage({
        memoryPercent: Number(resources.memoryPercent ?? 0),
        memoryLabel: String(resources.memoryLabel ?? 'N/A'),
        uploadsSize: String(resources.uploadsSize ?? 'N/A'),
      });

      setPerformanceRows(Array.isArray(reportsJson.performance) ? reportsJson.performance as PerformanceRow[] : []);
      setSecurityRows(Array.isArray(reportsJson.securityReports) ? reportsJson.securityReports as SecurityRow[] : []);
      setDatabaseRows(Array.isArray(reportsJson.databaseReports) ? reportsJson.databaseReports as DatabaseRow[] : []);
      setActivityRows(Array.isArray(reportsJson.userActivityReports) ? reportsJson.userActivityReports as ActivityRow[] : []);
      setAuditRows(Array.isArray(reportsJson.auditTrail) ? reportsJson.auditTrail as AuditRow[] : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const totalLogins = activityRows.reduce((sum, r) => sum + Number(r.logins ?? 0), 0);
  const totalActiveUsers = activityRows.reduce((sum, r) => sum + Number(r.activeUsers ?? 0), 0);
  const totalFailed = activityRows.reduce((sum, r) => sum + Number(r.failedLogins ?? 0), 0);
  const failedRate = totalLogins > 0 ? ((totalFailed / totalLogins) * 100).toFixed(1) : '0.0';

  const exportSection = useMemo(() => {
    if (activeTab === 'audit') return 'audit';
    if (activeTab === 'security') return 'security';
    return 'summary';
  }, [activeTab]);

  const handleExport = async () => {
    try {
      const res = await apiFetch(
        `/api/admin/reports?range=${dateRange}&format=csv&section=${exportSection}`,
      );
      if (!res.ok) {
        const text = await res.text();
        let json: { error?: string } = {};
        try {
          json = JSON.parse(text);
        } catch {
          /* ignore */
        }
        throw new Error(json.error || 'Export failed. Please try again.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin-${exportSection}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return <Badge className="bg-red-600 hover:bg-red-600 text-xs">Critical</Badge>;
      case 'High':
        return <Badge className="bg-orange-600 hover:bg-orange-600 text-xs">High</Badge>;
      case 'Medium':
        return <Badge className="bg-yellow-600 hover:bg-yellow-600 text-xs">Medium</Badge>;
      case 'Low':
        return <Badge className="bg-[#2D5016] hover:bg-[#2D5016] text-xs">Low</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Excellent':
      case 'Good':
      case 'Healthy':
      case 'Success':
        return <Badge className="bg-[#2D5016] hover:bg-[#2D5016] text-xs">{status}</Badge>;
      case 'Normal':
        return <Badge className="bg-gray-600 hover:bg-gray-600 text-xs">{status}</Badge>;
      case 'Warning':
        return <Badge className="bg-orange-600 hover:bg-orange-600 text-xs">{status}</Badge>;
      case 'Failed':
        return <Badge className="bg-red-600 hover:bg-red-600 text-xs">{status}</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-green-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">System Reports</h2>
          <p className="text-gray-600">
            Live operational reports from the database and activity logs
            {meta.generatedAt ? (
              <span className="text-gray-400"> · Updated {meta.generatedAt}</span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangeKey)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
            disabled={loading}
          >
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
          </select>
          <Button
            className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
            onClick={() => void handleExport()}
            disabled={loading}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading reports for {meta.dateRangeLabel || dateRange}…
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Server className="w-4 h-4" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#2D5016]">{summary.systemUptime}</div>
            <p className="text-xs text-gray-500 mt-1">{meta.dateRangeLabel}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Database className="w-4 h-4" />
              Database Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{summary.databaseSizeLabel}</div>
            <p className="text-xs text-gray-500 mt-1">MySQL (intellidocs_db)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Failed Logins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{summary.securityEvents}</div>
            <p className="text-xs text-gray-500 mt-1">{meta.dateRangeLabel}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{summary.activeUsers}</div>
            <p className="text-xs text-gray-500 mt-1">Active in last 15 minutes</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)}>
        <div className="tabs-scroll w-full overflow-x-auto rounded-lg border bg-muted p-1">
          <TabsList className="inline-flex h-auto min-w-max gap-1 bg-transparent p-0">
          <TabsTrigger value="performance" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs sm:text-sm">
            <Server className="w-4 h-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="security" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs sm:text-sm">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="database" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs sm:text-sm">
            <Database className="w-4 h-4" />
            Database
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs sm:text-sm">
            <Activity className="w-4 h-4" />
            User Activity
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs sm:text-sm">
            <FileText className="w-4 h-4" />
            Audit Trail
          </TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-[#8B1538]" />
                System Performance Metrics
              </CardTitle>
              <CardDescription>Derived from database stats and activity logs ({meta.dateRangeLabel})</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {performanceRows.length === 0 && !loading ? (
                  <p className="text-sm text-gray-500 col-span-2">No performance metrics available.</p>
                ) : (
                  performanceRows.map((metric, index) => (
                    <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{metric.metric}</span>
                        {getTrendIcon(metric.trend)}
                      </div>
                      <div className="flex items-end justify-between">
                        <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
                        {getStatusBadge(metric.status)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <HardDrive className="w-5 h-5 text-[#8B1538]" />
                    <span className="text-sm font-medium text-gray-700">PHP Memory (request)</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{resourceUsage.memoryLabel}</span>
                      <span className="font-semibold">{resourceUsage.memoryPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.min(100, resourceUsage.memoryPercent)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-5 h-5 text-[#8B1538]" />
                    <span className="text-sm font-medium text-gray-700">Uploads Storage</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{resourceUsage.uploadsSize}</div>
                  <p className="text-xs text-gray-500 mt-1">Total size under uploads/</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#8B1538]" />
                Security Incident Reports
              </CardTitle>
              <CardDescription>Failed logins and enrollment security signals ({meta.dateRangeLabel})</CardDescription>
            </CardHeader>
            <CardContent>
              {securityAlert.show && securityAlert.message ? (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-900">Security Alert</p>
                    <p className="text-sm text-orange-700 mt-1">{securityAlert.message}</p>
                  </div>
                </div>
              ) : null}

              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Event Type</TableHead>
                      <TableHead className="font-semibold text-center">Count</TableHead>
                      <TableHead className="font-semibold">Details</TableHead>
                      <TableHead className="font-semibold text-center">Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {securityRows.length === 0 && !loading ? (
                      <EmptyRow colSpan={5} message="No security events recorded for this period." />
                    ) : (
                      securityRows.map((report, index) => (
                        <TableRow key={index} className={report.severity === 'Critical' ? 'bg-red-50' : ''}>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              {report.date}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{report.type}</TableCell>
                          <TableCell className="text-center font-semibold">{report.count}</TableCell>
                          <TableCell className="text-sm text-gray-600">{report.details}</TableCell>
                          <TableCell className="text-center">{getSeverityBadge(report.severity)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#8B1538]" />
                MySQL Database Reports
              </CardTitle>
              <CardDescription>Table sizes and backup status for intellidocs_db</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Table / Scope</TableHead>
                      <TableHead className="font-semibold">Current Size</TableHead>
                      <TableHead className="font-semibold">Rows / Tables</TableHead>
                      <TableHead className="font-semibold">Last Backup</TableHead>
                      <TableHead className="font-semibold text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {databaseRows.length === 0 && !loading ? (
                      <EmptyRow colSpan={5} message="No database statistics available." />
                    ) : (
                      databaseRows.map((db, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium text-sm">{db.database}</TableCell>
                          <TableCell className="font-semibold">{db.size}</TableCell>
                          <TableCell className="text-sm text-gray-600">{db.growth}</TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gray-400" />
                              {db.lastBackup}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{getStatusBadge(db.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div
                className={
                  backupInfo.status === 'Healthy'
                    ? 'bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6'
                    : 'bg-orange-50 border border-orange-200 rounded-lg p-4 mt-6'
                }
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className={
                      backupInfo.status === 'Healthy'
                        ? 'w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5'
                        : 'w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5'
                    }
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Database Backup Status</p>
                    <p className="text-sm text-gray-700 mt-1">
                      {backupInfo.backupCount > 0
                        ? `Latest backup: ${backupInfo.lastBackup}${backupInfo.latestFile ? ` (${backupInfo.latestFile})` : ''}.`
                        : 'No SQL backups found. Run scripts/backup_db.ps1 to create one.'}
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      {backupInfo.backupCount} backup file(s) in {backupInfo.backupPath}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#8B1538]" />
                User Activity Analytics
              </CardTitle>
              <CardDescription>Login activity from activity_logs ({meta.dateRangeLabel})</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">User Role</TableHead>
                      <TableHead className="font-semibold text-center">Total Logins</TableHead>
                      <TableHead className="font-semibold text-center">Avg Duration</TableHead>
                      <TableHead className="font-semibold text-center">Active Users</TableHead>
                      <TableHead className="font-semibold text-center">Failed Logins</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityRows.map((report, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{report.role}</TableCell>
                        <TableCell className="text-center font-semibold">{report.logins}</TableCell>
                        <TableCell className="text-center">{report.avgDuration}</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-[#2D5016] hover:bg-[#2D5016]">{report.activeUsers}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {report.failedLogins > 0 ? (
                            <Badge className="bg-red-600 hover:bg-red-600">{report.failedLogins}</Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="border rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600 mb-1">Total Logins</p>
                  <p className="text-3xl font-bold text-gray-900">{totalLogins}</p>
                </div>
                <div className="border rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600 mb-1">Active Users Now</p>
                  <p className="text-3xl font-bold text-[#2D5016]">{totalActiveUsers}</p>
                </div>
                <div className="border rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600 mb-1">Failed Login Rate</p>
                  <p className="text-3xl font-bold text-orange-600">{failedRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#8B1538]" />
                System Audit Trail
              </CardTitle>
              <CardDescription>Recent administrative actions from activity_logs ({meta.dateRangeLabel})</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Timestamp</TableHead>
                      <TableHead className="font-semibold">User</TableHead>
                      <TableHead className="font-semibold">Action</TableHead>
                      <TableHead className="font-semibold">Module</TableHead>
                      <TableHead className="font-semibold text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditRows.length === 0 && !loading ? (
                      <EmptyRow colSpan={5} message="No audit entries for this period." />
                    ) : (
                      auditRows.map((log, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gray-400" />
                              {log.timestamp}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{log.user}</TableCell>
                          <TableCell className="text-sm">{log.action}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{log.module}</Badge>
                          </TableCell>
                          <TableCell className="text-center">{getStatusBadge(log.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <Button
                  variant="outline"
                  className="border-[#8B1538] text-[#8B1538] hover:bg-red-50"
                  onClick={() => void handleExport()}
                  disabled={loading || auditRows.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Audit Log
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
