import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { mockSecurityAlerts, mockSecurityLogs, mockUsers } from '../../data/mockData';
import { Users, Activity, Shield, AlertTriangle, Eye, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';

export function SecurityOverview() {
  const totalUsers = Object.keys(mockUsers).length;
  const activeSessions = 12;
  const openAlerts = mockSecurityAlerts.filter(a => a.status === 'Open').length;
  const recentLogs = mockSecurityLogs.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header with View-Only Notice */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Security Overview</h2>
        <p className="text-gray-600">View-only access to security monitoring and system logs</p>
      </div>

      {/* View-Only Notice */}
      <Alert className="border-[#8B1538] bg-red-50">
        <Eye className="h-4 w-4 text-[#8B1538]" />
        <AlertTitle className="text-[#8B1538]">View-Only Access</AlertTitle>
        <AlertDescription>
          You have read-only access to security information. For security management and incident response, 
          please contact the IT Administrator.
        </AlertDescription>
      </Alert>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="opacity-90">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered accounts</p>
          </CardContent>
        </Card>

        <Card className="opacity-90">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeSessions}</div>
            <p className="text-xs text-muted-foreground">Currently logged in</p>
          </CardContent>
        </Card>

        <Card className="opacity-90">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{openAlerts}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card className="opacity-90">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-green-600">Operational</div>
            <p className="text-xs text-muted-foreground">All systems running</p>
          </CardContent>
        </Card>
      </div>

      {/* Security Alerts - View Only */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Security Alerts</CardTitle>
              <CardDescription className="mt-1">
                Recent security alerts (View-only mode)
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              <Eye className="w-3 h-3 mr-1" />
              READ-ONLY
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockSecurityAlerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`p-4 border-l-4 rounded-lg opacity-90 ${
                  alert.severity === 'High' ? 'border-red-600 bg-red-50' :
                  alert.severity === 'Medium' ? 'border-orange-600 bg-orange-50' :
                  'border-yellow-600 bg-yellow-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
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
                  <div className="flex flex-col items-end gap-2">
                    <Badge 
                      variant={
                        alert.severity === 'High' ? 'destructive' :
                        alert.severity === 'Medium' ? 'secondary' :
                        'outline'
                      }
                    >
                      {alert.severity}
                    </Badge>
                    <Badge variant="outline" className={
                      alert.status === 'Open' ? 'border-red-500 text-red-600' : 'border-green-500 text-green-600'
                    }>
                      {alert.status}
                    </Badge>
                  </div>
                </div>
                {alert.severity === 'High' && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-gray-600 bg-white/50 p-2 rounded">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>This alert requires IT Administrator attention for resolution.</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity Logs - View Only */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Activity Logs</CardTitle>
              <CardDescription className="mt-1">
                System security events and user activities
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              <Eye className="w-3 h-3 mr-1" />
              READ-ONLY
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => (
                  <TableRow key={log.id} className="opacity-90">
                    <TableCell className="font-mono text-xs">{log.timestamp}</TableCell>
                    <TableCell>{log.user}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell className="font-mono text-xs">{log.ipAddress}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'Success' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {log.attempts && `${log.attempts} attempts`}
                      {log.target && `Target: ${log.target}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Security Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="opacity-90">
          <CardHeader>
            <CardTitle className="text-sm">Total Events (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
            <p className="text-xs text-gray-500 mt-1">All logged events</p>
          </CardContent>
        </Card>
        <Card className="opacity-90">
          <CardHeader>
            <CardTitle className="text-sm">Successful Logins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">143</div>
            <p className="text-xs text-gray-500 mt-1">Today's logins</p>
          </CardContent>
        </Card>
        <Card className="opacity-90">
          <CardHeader>
            <CardTitle className="text-sm">Failed Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">13</div>
            <p className="text-xs text-gray-500 mt-1">Login failures</p>
          </CardContent>
        </Card>
        <Card className="opacity-90">
          <CardHeader>
            <CardTitle className="text-sm">Suspicious Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">3</div>
            <p className="text-xs text-gray-500 mt-1">Flagged events</p>
          </CardContent>
        </Card>
      </div>

      {/* Help Text */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Need Security Assistance?</h4>
              <p className="text-sm text-blue-700">
                If you notice any suspicious activity or have security concerns, please contact the IT Administrator 
                immediately. You have view-only access to this information for awareness and oversight purposes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
