import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Shield, Eye, Key, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const loginHistory = [
  { id: 1, date: '2026-02-22', time: '08:15:23', device: 'Chrome on Windows', ip: '192.168.1.105', status: 'Success' },
  { id: 2, date: '2026-02-21', time: '14:30:11', device: 'Safari on iPhone', ip: '192.168.1.106', status: 'Success' },
  { id: 3, date: '2026-02-20', time: '09:20:45', device: 'Chrome on Windows', ip: '192.168.1.105', status: 'Success' },
  { id: 4, date: '2026-02-19', time: '13:45:33', device: 'Chrome on Windows', ip: '192.168.1.105', status: 'Success' }
];

export function StudentSecurity() {
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Password changed successfully!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Security</h2>
        <p className="text-gray-600">Manage your account security and login history</p>
      </div>

      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              <CardTitle>Account Security</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-gray-600">Last changed 30 days ago</p>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Key className="w-4 h-4 mr-2" />
                      Change
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Change Password</DialogTitle>
                      <DialogDescription>
                        Enter your current password and choose a new password
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleChangePassword}>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="current">Current Password</Label>
                          <Input 
                            id="current"
                            type="password"
                            placeholder="Enter current password"
                            className="mt-1"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="new">New Password</Label>
                          <Input 
                            id="new"
                            type="password"
                            placeholder="Enter new password"
                            className="mt-1"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="confirm">Confirm New Password</Label>
                          <Input 
                            id="confirm"
                            type="password"
                            placeholder="Confirm new password"
                            className="mt-1"
                            required
                          />
                        </div>
                      </div>
                      <DialogFooter className="mt-6">
                        <Button type="submit">Change Password</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="flex items-center justify-between pt-3 border-t">
                <div>
                  <p className="font-medium">Account Status</p>
                  <p className="text-sm text-gray-600">Your account is secure</p>
                </div>
                <Badge variant="default">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                <span>Use a strong, unique password</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                <span>Never share your password with anyone</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                <span>Log out when using shared computers</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                <span>Review login history regularly</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Login History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-indigo-600" />
            <CardTitle>Login History</CardTitle>
          </div>
          <CardDescription>Recent account access activity</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Device/Browser</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loginHistory.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                  <TableCell>{entry.time}</TableCell>
                  <TableCell>{entry.device}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.ip}</TableCell>
                  <TableCell>
                    <Badge variant="default">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {entry.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Security Notice</p>
              <p className="text-sm text-blue-700 mt-1">
                If you notice any suspicious activity or unrecognized logins, please contact the IT department immediately.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
