import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Users, Activity, Shield, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    totalUsers: 0,
    activeSessions: 0,
    securityAlerts: 0,
    systemStatus: 'Operational',
    ongoingSchoolYear: { year: null as string | null, startDate: null as string | null, endDate: null as string | null },
    ongoingEnrollment: { enabled: false, year: null as string | null },
  });
  const [alerts, setAlerts] = useState<Array<any>>([]);
  const [recentLogs, setRecentLogs] = useState<Array<any>>([]);
  const [logSearch, setLogSearch] = useState('');
  const [logFrom, setLogFrom] = useState<string>(''); // yyyy-mm-dd
  const [logTo, setLogTo] = useState<string>(''); // yyyy-mm-dd

  const parseLogDate = (ts: string): Date | null => {
    const s = String(ts || '').trim();
    if (!s) return null;
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return null;
    return d;
  };

  const ymd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const filteredLogs = recentLogs.filter((log) => {
    const q = logSearch.trim().toLowerCase();
    if (q) {
      const hay = `${log.action || ''} ${log.user || ''} ${log.ipAddress || ''} ${log.status || ''} ${log.timestamp || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const d = parseLogDate(String(log.timestamp || ''));
    if (!d) return true;
    const day = ymd(d);
    if (logFrom && day < logFrom) return false;
    if (logTo && day > logTo) return false;
    return true;
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
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
          setError(json.error || `Failed to load dashboard (${res.status})`);
          return;
        }
        const next = json.summary ?? {};
        setSummary({
          totalUsers: Number(next.totalUsers ?? 0),
          activeSessions: Number(next.activeSessions ?? 0),
          securityAlerts: Number(next.securityAlerts ?? 0),
          systemStatus: String(next.systemStatus ?? 'Operational'),
          ongoingSchoolYear: {
            year: (next.ongoingSchoolYear?.year ?? null) as string | null,
            startDate: (next.ongoingSchoolYear?.startDate ?? null) as string | null,
            endDate: (next.ongoingSchoolYear?.endDate ?? null) as string | null,
          },
          ongoingEnrollment: {
            enabled: Boolean(next.ongoingEnrollment?.enabled ?? false),
            year: (next.ongoingEnrollment?.year ?? null) as string | null,
          },
        });
        setAlerts(Array.isArray(json.alerts) ? json.alerts : []);
        setRecentLogs(Array.isArray(json.activityLogs) ? json.activityLogs : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error');
      } finally {
        setLoading(false);
      }
    };
    load();
    const id = window.setInterval(() => {
      load();
    }, 10000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h2>
        <p className="text-gray-600">System administration and security monitoring</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="stat-grid-wide">
        <Card className="sm:col-span-2 lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ongoing School Year</CardTitle>
            <Badge variant={summary.ongoingSchoolYear.year ? 'default' : 'destructive'}>
              {summary.ongoingSchoolYear.year ? 'Active' : 'Not set'}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.ongoingSchoolYear.year ?? '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.ongoingSchoolYear.startDate && summary.ongoingSchoolYear.endDate
                ? `${new Date(summary.ongoingSchoolYear.startDate).toLocaleDateString()} - ${new Date(summary.ongoingSchoolYear.endDate).toLocaleDateString()}`
                : 'Set this in School Year Management'}
            </p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ongoing Enrollment</CardTitle>
            <Badge variant={summary.ongoingEnrollment.enabled ? 'default' : 'destructive'}>
              {summary.ongoingEnrollment.enabled ? 'Open' : 'Closed'}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.ongoingEnrollment.enabled ? (summary.ongoingEnrollment.year ?? '—') : 'Closed'}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.ongoingEnrollment.enabled
                ? 'Accepting enrollments for the active school year'
                : 'Enable by activating a school year'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.activeSessions}</div>
            <p className="text-xs text-muted-foreground">Currently logged in</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary.securityAlerts}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-green-600">{summary.systemStatus}</div>
            <p className="text-xs text-muted-foreground">All systems running</p>
          </CardContent>
        </Card>
      </div>

      {/* Security Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(alerts.length > 0 ? alerts : [{ id: 'empty', type: 'No alerts', description: loading ? 'Loading...' : 'No alerts available', severity: 'Low', timestamp: '' }]).map((alert) => (
              <div 
                key={alert.id} 
                className={`p-4 border-l-4 rounded-lg ${
                  alert.severity === 'High' ? 'border-red-600 bg-red-50' :
                  alert.severity === 'Medium' ? 'border-orange-600 bg-orange-50' :
                  'border-yellow-600 bg-yellow-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={`w-5 h-5 ${
                        alert.severity === 'High' ? 'text-red-600' :
                        alert.severity === 'Medium' ? 'text-orange-600' :
                        'text-yellow-600'
                      }`} />
                      <h3 className="font-semibold">{alert.type}</h3>
                    </div>
                    <p className="text-sm text-gray-700">{alert.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{alert.timestamp}</p>
                  </div>
                  <Badge 
                    variant={
                      alert.severity === 'High' ? 'destructive' :
                      alert.severity === 'Medium' ? 'secondary' :
                      'outline'
                    }
                  >
                    {alert.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 md:items-end justify-between mb-4">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700 mb-2">Search</div>
              <Input
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search action, user, IP, status…"
              />
            </div>
            <div className="flex gap-3 flex-wrap">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">From</div>
                <Input type="date" value={logFrom} onChange={(e) => setLogFrom(e.target.value)} />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">To</div>
                <Input type="date" value={logTo} onChange={(e) => setLogTo(e.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const today = ymd(new Date());
                    setLogFrom(today);
                    setLogTo(today);
                  }}
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const now = new Date();
                    const start = new Date(now);
                    start.setDate(start.getDate() - 6);
                    setLogFrom(ymd(start));
                    setLogTo(ymd(now));
                  }}
                >
                  Last 7 days
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setLogFrom('');
                    setLogTo('');
                    setLogSearch('');
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white">
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-semibold text-gray-700">Date/Time</th>
                    <th className="px-3 py-2 font-semibold text-gray-700">Action</th>
                    <th className="px-3 py-2 font-semibold text-gray-700">User</th>
                    <th className="px-3 py-2 font-semibold text-gray-700">IP</th>
                    <th className="px-3 py-2 font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                        No logs match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log: any, idx: number) => (
                      <tr key={log.id ?? idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 tabular-nums">
                          {String(log.timestamp || '')}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">{String(log.action || '')}</td>
                        <td className="px-3 py-2 text-gray-700">{String(log.user || '')}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">{String(log.ipAddress || '')}</td>
                        <td className="px-3 py-2">
                          <Badge variant={log.status === 'Success' ? 'default' : 'destructive'}>
                            {String(log.status || '')}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
