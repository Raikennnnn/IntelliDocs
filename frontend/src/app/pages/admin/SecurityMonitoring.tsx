import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Search, Download, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { apiFetch } from '../../lib/api';
import { filterSecurityLogs } from '../../lib/activityLogSearch';
import { displayEnrollmentText } from '../../lib/enrollmentDisplayFormat';

type SecurityLog = {
  id: number;
  timestamp: string;
  user_id: number | null;
  user: string;
  action: string;
  module: string;
  status: string;
  ip_address: string;
  details: Record<string, unknown>;
};

type Summary = {
  total_events: number;
  successful_logins: number;
  failed_attempts: number;
  suspicious_activity: number;
};

export function SecurityMonitoring() {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total_events: 0,
    successful_logins: 0,
    failed_attempts: 0,
    suspicious_activity: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [range, setRange] = useState('week');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('range', range);
      params.set('limit', '100');

      const response = await apiFetch(`/api/admin/security-logs?${params.toString()}`);
      const text = await response.text();
      if (!text.trim()) {
        throw new Error('Empty response from server. Please refresh and try again.');
      }
      let data: { success?: boolean; logs?: SecurityLog[]; summary?: Summary; error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid response from server. Please refresh and try again.');
      }
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Could not load security logs.');
      }
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setSummary(data.summary ?? summary);
    } catch (e) {
      console.error('Failed to load security logs', e);
      setError(e instanceof Error ? e.message : 'Failed to load security logs.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, statusFilter, range]);

  const filteredLogs = useMemo(
    () => filterSecurityLogs(logs, search),
    [logs, search],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLogs();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadLogs]);

  const exportCsv = () => {
    const header = ['Timestamp', 'User', 'User ID', 'Action', 'Module', 'Status', 'IP'];
    const rows = filteredLogs.map((log) => [
      log.timestamp,
      log.user,
      log.user_id ?? '',
      log.action,
      log.module,
      log.status,
      log.ip_address,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nsdga-security-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Security Monitoring</h2>
          <p className="text-gray-600">Live activity logs from the NSDGA enrollment audit trail</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadLogs()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={filteredLogs.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Logs</CardTitle>
          <CardDescription>Search and filter security activity from `activity_logs`</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="User, action, module..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Action</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="login">login</SelectItem>
                  <SelectItem value="login_success">login_success</SelectItem>
                  <SelectItem value="login_attempt">login_attempt</SelectItem>
                  <SelectItem value="logout_success">logout_success</SelectItem>
                  <SelectItem value="session_expired">session_expired</SelectItem>
                  <SelectItem value="document_upload">document_upload</SelectItem>
                  <SelectItem value="registrar_decision">registrar_decision</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="flagged">Flagged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 days</SelectItem>
                  <SelectItem value="month">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Logs</CardTitle>
          <CardDescription>
            {loading
              ? 'Loading…'
              : search.trim()
                ? `${filteredLogs.length} of ${logs.length} events match "${search.trim()}"`
                : `${logs.length} events shown`}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          {error ? (
            <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="w-full min-w-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    {search.trim()
                      ? `No activity logs match "${search.trim()}".`
                      : 'No activity logs found for the selected filters.'}
                  </TableCell>
                </TableRow>
              )}
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{log.timestamp}</TableCell>
                  <TableCell>
                    <div className="text-sm">{displayEnrollmentText(log.user)}</div>
                    {log.user_id != null && (
                      <div className="text-xs text-gray-500">ID {log.user_id}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{displayEnrollmentText(log.action)}</TableCell>
                  <TableCell className="text-sm text-gray-600">{displayEnrollmentText(log.module)}</TableCell>
                  <TableCell className="font-mono text-xs">{log.ip_address === '—' ? '—' : log.ip_address}</TableCell>
                  <TableCell>
                    <Badge variant={log.status.toLowerCase() === 'success' ? 'default' : 'destructive'}>
                      {displayEnrollmentText(log.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Total Events</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.total_events}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Successful Logins</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{summary.successful_logins}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Failed Attempts</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{summary.failed_attempts}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Suspicious Activity</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-600">{summary.suspicious_activity}</div></CardContent>
        </Card>
      </div>
    </div>
  );
}
