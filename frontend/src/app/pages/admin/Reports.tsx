import { useState } from 'react';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { 
  BarChart3, 
  Server, 
  Database,
  Shield,
  Search,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  HardDrive,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Clock
} from 'lucide-react';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { apiFetch } from '../../lib/api';

// Mock Data
const systemPerformanceData = [
  { metric: 'Server Uptime', value: '99.98%', status: 'Excellent', trend: 'up' },
  { metric: 'Average Response Time', value: '120ms', status: 'Good', trend: 'down' },
  { metric: 'Database Performance', value: '95%', status: 'Good', trend: 'up' },
  { metric: 'API Success Rate', value: '99.5%', status: 'Excellent', trend: 'up' },
  { metric: 'Error Rate', value: '0.2%', status: 'Excellent', trend: 'down' },
  { metric: 'Memory Usage', value: '62%', status: 'Normal', trend: 'stable' },
];

const securityReports = [
  { date: '2026-02-26', type: 'Failed Login Attempts', count: 7, severity: 'Medium', details: '3 unique IPs blocked' },
  { date: '2026-02-26', type: 'Unauthorized Access', count: 2, severity: 'High', details: 'Student attempting restricted access' },
  { date: '2026-02-25', type: 'Password Changes', count: 15, severity: 'Low', details: 'Routine password updates' },
  { date: '2026-02-25', type: 'Failed Login Attempts', count: 12, severity: 'Medium', details: '5 unique IPs blocked' },
  { date: '2026-02-24', type: 'Account Lockouts', count: 3, severity: 'Medium', details: 'Automatic lockout after failed attempts' },
];

const databaseReports = [
  { database: 'student_records', size: '2.4 GB', growth: '+120 MB', lastBackup: '2026-02-26 02:00 AM', status: 'Healthy' },
  { database: 'academic_records', size: '1.8 GB', growth: '+95 MB', lastBackup: '2026-02-26 02:00 AM', status: 'Healthy' },
  { database: 'system_logs', size: '3.2 GB', growth: '+240 MB', lastBackup: '2026-02-26 02:00 AM', status: 'Warning' },
  { database: 'user_sessions', size: '456 MB', growth: '+18 MB', lastBackup: '2026-02-26 02:00 AM', status: 'Healthy' },
  { database: 'document_verification', size: '920 MB', growth: '+42 MB', lastBackup: '2026-02-26 02:00 AM', status: 'Healthy' },
];

const userActivityReports = [
  { role: 'Student', logins: 1240, avgDuration: '45 min', activeUsers: 342, failedLogins: 8 },
  { role: 'Registrar', logins: 18, avgDuration: '4 hrs', activeUsers: 3, failedLogins: 0 },
  { role: 'Admin', logins: 8, avgDuration: '2 hrs', activeUsers: 1, failedLogins: 0 },
];

const auditTrail = [
  { timestamp: '2026-02-26 09:30 AM', user: 'Juan Dela Cruz', action: 'Modified RBAC Settings', module: 'System Config', status: 'Success' },
  { timestamp: '2026-02-26 08:15 AM', user: 'Ana Reyes', action: 'Created Student Account', module: 'User Management', status: 'Success' },
  { timestamp: '2026-02-26 07:45 AM', user: 'System', action: 'Database Backup Completed', module: 'Database', status: 'Success' },
  { timestamp: '2026-02-26 02:00 AM', user: 'System', action: 'Automated Backup', module: 'Database', status: 'Success' },
  { timestamp: '2026-02-25 11:45 PM', user: 'Unknown', action: 'Failed Login Attempt', module: 'Authentication', status: 'Failed' },
  { timestamp: '2026-02-25 03:30 PM', user: 'Ana Reyes', action: 'Verified Student Documents', module: 'Document Verification', status: 'Success' },
];

export function Reports() {
  const [activeTab, setActiveTab] = useState<'performance' | 'security' | 'database' | 'activity' | 'audit'>('performance');
  const [dateRange, setDateRange] = useState('7days');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    systemUptime: 'N/A',
    databaseSizeLabel: 'N/A',
    securityEvents: 0,
    activeUsers: 0,
  });
  const [reportsData, setReportsData] = useState<{
    performance: any[];
    security: any[];
    database: any[];
    activity: any[];
    audit: any[];
  }>({
    performance: [],
    security: [],
    database: [],
    activity: [],
    audit: [],
  });

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const res = await apiFetch('/api/admin/overview');
        const text = await res.text();
        let json: any = {};
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error('Server returned an invalid response');
        }
        if (!res.ok || !json.success) {
          throw new Error(json.error || `Failed to load reports (${res.status})`);
        }
        const s = json.summary ?? {};
        setSummary({
          systemUptime: s.systemStatus === 'Operational' ? 'Operational' : 'N/A',
          databaseSizeLabel: String(s.databaseSizeLabel ?? 'N/A'),
          securityEvents: Number(s.securityEvents ?? 0),
          activeUsers: Number(s.activeUsers ?? 0),
        });

        const reportsRes = await apiFetch('/api/admin/reports');
        const reportsText = await reportsRes.text();
        let reportsJson: any = {};
        try {
          reportsJson = JSON.parse(reportsText);
        } catch {
          throw new Error('Server returned an invalid reports response');
        }
        if (!reportsRes.ok || !reportsJson.success) {
          throw new Error(reportsJson.error || `Failed to load reports details (${reportsRes.status})`);
        }
        setReportsData({
          performance: Array.isArray(reportsJson.performance) ? reportsJson.performance : [],
          security: Array.isArray(reportsJson.securityReports) ? reportsJson.securityReports : [],
          database: Array.isArray(reportsJson.databaseReports) ? reportsJson.databaseReports : [],
          activity: Array.isArray(reportsJson.userActivityReports) ? reportsJson.userActivityReports : [],
          audit: Array.isArray(reportsJson.auditTrail) ? reportsJson.auditTrail : [],
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error');
      }
    };
    load();
  }, []);

  const performanceRows = reportsData.performance.length > 0 ? reportsData.performance : systemPerformanceData;
  const securityRows = reportsData.security.length > 0 ? reportsData.security : securityReports;
  const databaseRows = reportsData.database.length > 0 ? reportsData.database : databaseReports;
  const activityRows = reportsData.activity.length > 0 ? reportsData.activity : userActivityReports;
  const auditRows = reportsData.audit.length > 0 ? reportsData.audit : auditTrail;

  const totalLogins = activityRows.reduce((sum, r) => sum + Number(r.logins ?? 0), 0);
  const totalActiveUsers = activityRows.reduce((sum, r) => sum + Number(r.activeUsers ?? 0), 0);
  const totalFailed = activityRows.reduce((sum, r) => sum + Number(r.failedLogins ?? 0), 0);
  const failedRate = totalLogins > 0 ? ((totalFailed / totalLogins) * 100).toFixed(1) : '0.0';

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
        return <Badge className="bg-[#2D5016] hover:bg-[#2D5016] text-xs">Excellent</Badge>;
      case 'Good':
        return <Badge className="bg-blue-600 hover:bg-blue-600 text-xs">Good</Badge>;
      case 'Normal':
        return <Badge className="bg-gray-600 hover:bg-gray-600 text-xs">Normal</Badge>;
      case 'Warning':
        return <Badge className="bg-orange-600 hover:bg-orange-600 text-xs">Warning</Badge>;
      case 'Healthy':
        return <Badge className="bg-[#2D5016] hover:bg-[#2D5016] text-xs">Healthy</Badge>;
      case 'Success':
        return <Badge className="bg-[#2D5016] hover:bg-[#2D5016] text-xs">Success</Badge>;
      case 'Failed':
        return <Badge className="bg-red-600 hover:bg-red-600 text-xs">Failed</Badge>;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">System Reports</h2>
          <p className="text-gray-600">Technical and operational reports for system monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
          >
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
          </select>
          <Button className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white">
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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Server className="w-4 h-4" />
              System Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#2D5016]">{summary.systemUptime}</div>
            <p className="text-xs text-gray-500 mt-1">Current status</p>
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
            <p className="text-xs text-gray-500 mt-1">Live database indicator</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Security Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{summary.securityEvents}</div>
            <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
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
            <p className="text-xs text-gray-500 mt-1">Currently online</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="performance" className="flex items-center gap-2 text-xs">
            <Server className="w-4 h-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2 text-xs">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2 text-xs">
            <Database className="w-4 h-4" />
            Database
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2 text-xs">
            <Activity className="w-4 h-4" />
            User Activity
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2 text-xs">
            <FileText className="w-4 h-4" />
            Audit Trail
          </TabsTrigger>
        </TabsList>

        {/* Performance Reports Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-[#8B1538]" />
                System Performance Metrics
              </CardTitle>
              <CardDescription>Real-time system performance and health indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {performanceRows.map((metric, index) => (
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
                ))}
              </div>

              {/* Resource Usage */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="w-5 h-5 text-[#8B1538]" />
                    <span className="text-sm font-medium text-gray-700">CPU Usage</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Current</span>
                      <span className="font-semibold">45%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-[#2D5016] h-2 rounded-full" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <HardDrive className="w-5 h-5 text-[#8B1538]" />
                    <span className="text-sm font-medium text-gray-700">Memory Usage</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Current</span>
                      <span className="font-semibold">62%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '62%' }}></div>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-5 h-5 text-[#8B1538]" />
                    <span className="text-sm font-medium text-gray-700">Disk Usage</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Current</span>
                      <span className="font-semibold">38%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-[#2D5016] h-2 rounded-full" style={{ width: '38%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Reports Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#8B1538]" />
                Security Incident Reports
              </CardTitle>
              <CardDescription>SIEM, Filebeat, and system security event logs</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Warning Banner */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-900">Security Alert</p>
                  <p className="text-sm text-orange-700 mt-1">
                    1 critical security event detected. Review and take immediate action.
                  </p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
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
                    {securityRows.map((report, index) => (
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
                        <TableCell className="text-center">
                          {getSeverityBadge(report.severity)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Database Reports Tab */}
        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#8B1538]" />
                PostgreSQL Database Reports
              </CardTitle>
              <CardDescription>Database size, growth, and backup status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Database Name</TableHead>
                      <TableHead className="font-semibold">Current Size</TableHead>
                      <TableHead className="font-semibold">Growth (7 Days)</TableHead>
                      <TableHead className="font-semibold">Last Backup</TableHead>
                      <TableHead className="font-semibold text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {databaseRows.map((db, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium font-mono text-sm">{db.database}</TableCell>
                        <TableCell className="font-semibold">{db.size}</TableCell>
                        <TableCell className="text-sm text-green-600">{db.growth}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            {db.lastBackup}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(db.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Backup Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Automated Backup Status</p>
                    <p className="text-sm text-blue-700 mt-1">
                      All databases backed up successfully. Next backup scheduled for 2026-02-27 at 02:00 AM.
                    </p>
                    <p className="text-xs text-blue-600 mt-2">
                      Backup retention: 30 days | Storage location: /backups/postgresql
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#8B1538]" />
                User Activity Analytics
              </CardTitle>
              <CardDescription>Login patterns, session duration, and user engagement metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
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

              {/* Total Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="border rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600 mb-1">Total Logins (Derived)</p>
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

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#8B1538]" />
                System Audit Trail
              </CardTitle>
              <CardDescription>Track all administrative actions and system changes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
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
                    {auditRows.map((log, index) => (
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
                        <TableCell className="text-center">
                          {getStatusBadge(log.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Export Options */}
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline">
                  <Search className="w-4 h-4 mr-2" />
                  Advanced Search
                </Button>
                <Button variant="outline" className="border-[#8B1538] text-[#8B1538] hover:bg-red-50">
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