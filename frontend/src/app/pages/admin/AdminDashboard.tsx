import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
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
  });
  const [alerts, setAlerts] = useState<Array<any>>([]);
  const [recentLogs, setRecentLogs] = useState<Array<any>>([]);

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{log.action}</p>
                  <p className="text-xs text-gray-600">
                    User: {log.user} | IP: {log.ipAddress}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={log.status === 'Success' ? 'default' : 'destructive'}>
                    {log.status}
                  </Badge>
                  <p className="text-xs text-gray-500 mt-1">{log.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
