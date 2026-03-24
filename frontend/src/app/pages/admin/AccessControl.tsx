import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Lock,
  Users,
  Shield,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  UserPlus,
  Key,
  RefreshCw,
  Info,
  Unlock,
  Ban,
  Eye,
  EyeOff,
  Copy,
  UserCog,
  GraduationCap,
  BookOpen,
  ClipboardList,
  Building2,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '../../components/ui/alert';

// ─── Types ────────────────────────────────────────────────────────────────────
type UserRole = 'Admin' | 'Registrar' | 'Student';
type AccountStatus = 'Active' | 'Inactive' | 'Blocked';

interface SystemUser {
  id: string;
  name: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  lastLogin: string;
  failedAttempts: number;
  isBlocked: boolean;
  createdDate: string;
  birthdate: string;  // yyyy-mm-dd stored
  createdBy: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const initialUsers: SystemUser[] = [
  {
    id: '001', firstName: 'Juan', middleName: 'Bautista', lastName: 'Dela Cruz',
    name: 'Juan B. Dela Cruz', email: 'JBdelacruz@nsdgam.edu.ph', role: 'Admin',
    status: 'Active', lastLogin: '2026-03-03 09:30 AM', failedAttempts: 0,
    isBlocked: false, createdDate: '2024-06-15', birthdate: '1985-03-20', createdBy: 'System'
  },
  {
    id: '002', firstName: 'Ana', middleName: 'Lopez', lastName: 'Reyes',
    name: 'Ana L. Reyes', email: 'ALreyes@nsdgam.edu.ph', role: 'Registrar',
    status: 'Active', lastLogin: '2026-03-03 10:00 AM', failedAttempts: 0,
    isBlocked: false, createdDate: '2024-07-01', birthdate: '1990-07-15', createdBy: 'Juan B. Dela Cruz'
  },
  {
    id: '003', firstName: 'Lisa', middleName: 'Mae', lastName: 'Fernandez',
    name: 'Lisa M. Fernandez', email: 'LMfernandez@student.nsdgam.edu.ph', role: 'Student',
    status: 'Active', lastLogin: '2026-03-03 06:00 AM', failedAttempts: 0,
    isBlocked: false, createdDate: '2024-08-01', birthdate: '2008-06-14', createdBy: 'Ana L. Reyes'
  },
  {
    id: '004', firstName: 'Miguel', middleName: 'Santos', lastName: 'Torres',
    name: 'Miguel S. Torres', email: 'MStorres@student.nsdgam.edu.ph', role: 'Student',
    status: 'Blocked', lastLogin: '2026-03-02 11:00 AM', failedAttempts: 3,
    isBlocked: true, createdDate: '2024-08-01', birthdate: '2008-02-28', createdBy: 'Ana L. Reyes'
  },
  {
    id: '005', firstName: 'Angela', middleName: 'Diaz', lastName: 'Villanueva',
    name: 'Angela D. Villanueva', email: 'ADvillanueva@student.nsdgam.edu.ph', role: 'Student',
    status: 'Active', lastLogin: '2026-03-03 07:15 AM', failedAttempts: 0,
    isBlocked: false, createdDate: '2024-08-01', birthdate: '2009-01-05', createdBy: 'Ana L. Reyes'
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateEmail(firstName: string, middleName: string, lastName: string, role: UserRole): string {
  const fI = firstName.trim().charAt(0).toUpperCase();
  const mI = middleName.trim() ? middleName.trim().charAt(0).toUpperCase() : '';
  const last = lastName.trim().toLowerCase().replace(/\s+/g, '');
  const domain = role === 'Student' ? 'student.nsdgam.edu.ph' : 'nsdgam.edu.ph';
  return `${fI}${mI}${last}@${domain}`;
}

function generatePassword(birthdate: string): string {
  // birthdate is yyyy-mm-dd, convert to dd-mm-yyyy
  const [year, month, day] = birthdate.split('-');
  return `${day}-${month}-${year}`;
}

function getRoleIcon(role: UserRole) {
  switch (role) {
    case 'Admin':     return <Shield className="w-3.5 h-3.5" />;
    case 'Registrar': return <ClipboardList className="w-3.5 h-3.5" />;
    case 'Student':   return <GraduationCap className="w-3.5 h-3.5" />;
  }
}

function getRoleBadgeClass(role: UserRole): string {
  switch (role) {
    case 'Admin':     return 'bg-[#8B1538] text-white border-[#8B1538]';
    case 'Registrar': return 'bg-blue-700 text-white border-blue-700';
    case 'Student':   return 'bg-gray-600 text-white border-gray-600';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AccessControl() {
  const [activeTab, setActiveTab] = useState<'users' | 'create-account'>('users');
  const [users, setUsers] = useState<SystemUser[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | UserRole>('All');

  // Dialog states
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen]   = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen]       = useState(false);
  const [isUnblockDialogOpen, setIsUnblockDialogOpen]   = useState(false);
  const [isViewDetailsOpen, setIsViewDetailsOpen]       = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen]   = useState(false);

  // Password reset form
  const [resetMode, setResetMode] = useState<'birthdate' | 'manual'>('birthdate');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  // Create account form
  const [createForm, setCreateForm] = useState({
    role: '' as UserRole | '',
    firstName: '',
    middleName: '',
    lastName: '',
    birthdate: ''
  });
  const [createdCredentials, setCreatedCredentials] = useState<{ name: string; email: string; password: string; role: string } | null>(null);
  const [showCreatedPassword, setShowCreatedPassword] = useState(false);

  // ── Derived ──
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const blockedCount      = users.filter(u => u.isBlocked).length;
  const activeCount       = users.filter(u => u.status === 'Active').length;
  const institutionalCount = users.filter(u => ['Admin','Registrar'].includes(u.role)).length;
  const studentCount      = users.filter(u => u.role === 'Student').length;

  // ── Computed preview for Create form ──
  const previewEmail = createForm.firstName && createForm.lastName
    ? generateEmail(createForm.firstName, createForm.middleName, createForm.lastName, (createForm.role as UserRole) || 'Teacher')
    : '';
  const previewPassword = createForm.birthdate ? generatePassword(createForm.birthdate) : '';

  // ── Handlers ──
  function handleResetPassword() {
    if (!selectedUser) return;
    const newPw =
      resetMode === 'birthdate'
        ? generatePassword(selectedUser.birthdate)
        : newPasswordInput.trim();

    if (resetMode === 'manual' && newPw.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    toast.success(
      <div>
        <p className="font-semibold">Password reset successfully!</p>
        <p className="text-sm mt-1">User: <strong>{selectedUser.name}</strong></p>
        <p className="text-sm">New password: <strong>{newPw}</strong></p>
        {resetMode === 'birthdate' && <p className="text-xs mt-1 text-gray-500">Format: dd-mm-yyyy (birthdate)</p>}
      </div>,
      { duration: 7000 }
    );
    setIsResetPasswordOpen(false);
    setSelectedUser(null);
    setNewPasswordInput('');
    setResetMode('birthdate');
  }

  function handleBlockAccount() {
    if (!selectedUser) return;
    setUsers(prev => prev.map(u =>
      u.id === selectedUser.id ? { ...u, isBlocked: true, status: 'Blocked' } : u
    ));
    toast.success(`Account blocked: ${selectedUser.name}`);
    setIsBlockDialogOpen(false);
    setBlockReason('');
    setSelectedUser(null);
  }

  function handleUnblockAccount() {
    if (!selectedUser) return;
    setUsers(prev => prev.map(u =>
      u.id === selectedUser.id ? { ...u, isBlocked: false, failedAttempts: 0, status: 'Active' } : u
    ));
    toast.success(`Account unblocked: ${selectedUser.name}`);
    setIsUnblockDialogOpen(false);
    setSelectedUser(null);
  }

  function handleCreateAccount() {
    const { role, firstName, middleName, lastName, birthdate } = createForm;
    if (!role || !firstName.trim() || !lastName.trim() || !birthdate) {
      toast.error('Please fill in all required fields.');
      return;
    }

    const email    = generateEmail(firstName, middleName, lastName, role as UserRole);
    const password = generatePassword(birthdate);
    const fullName = `${firstName.trim()} ${middleName.trim() ? middleName.trim().charAt(0).toUpperCase() + '. ' : ''}${lastName.trim()}`;

    const newUser: SystemUser = {
      id: String(Date.now()),
      firstName: firstName.trim(),
      middleName: middleName.trim(),
      lastName: lastName.trim(),
      name: fullName,
      email,
      role: role as UserRole,
      status: 'Active',
      lastLogin: 'Never',
      failedAttempts: 0,
      isBlocked: false,
      createdDate: new Date().toISOString().split('T')[0],
      birthdate,
      createdBy: 'Admin'
    };

    setUsers(prev => [...prev, newUser]);
    setCreatedCredentials({ name: fullName, email, password, role });
    setIsSuccessDialogOpen(true);
    setCreateForm({ role: '', firstName: '', middleName: '', lastName: '', birthdate: '' });
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied!`));
  }

  // ── Render ──
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-[#8B1538]" />
          Access Control
        </h2>
        <p className="text-gray-600 mt-1">
          Manage system accounts, reset passwords, and control access permissions for all roles.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-gray-400">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Accounts</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-gray-900">{users.length}</div>
            <p className="text-xs text-gray-400 mt-1">All roles</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#2D5016]">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-[#2D5016]">{activeCount}</div>
            <p className="text-xs text-gray-400 mt-1">Currently active</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Blocked</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-red-600">{blockedCount}</div>
            <p className="text-xs text-gray-400 mt-1">Needs attention</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#8B1538]">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Institutional</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-[#8B1538]">{institutionalCount}</div>
            <p className="text-xs text-gray-400 mt-1">{studentCount} students</p>
          </CardContent>
        </Card>
      </div>

      {/* Blocked accounts alert */}
      {blockedCount > 0 && (
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 text-sm">
            <strong>{blockedCount} account(s)</strong> are currently blocked. This may be due to multiple failed login attempts or manual blocks. Review and unblock if the user confirmed it was a mistake.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="users" className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="create-account" className="flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" />
            Create Institutional Account
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 1 – User Management
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCog className="w-5 h-5 text-[#8B1538]" />
                All User Accounts
              </CardTitle>
              <CardDescription>
                Reset passwords, block/unblock accounts for any role. Student accounts are created exclusively by the Registrar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Search + Filter */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name, email, or role…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Roles</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Registrar">Registrar</SelectItem>
                      <SelectItem value="Student">Student</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Name</TableHead>
                      <TableHead>Email / Username</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Failed Attempts</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id} className={user.isBlocked ? 'bg-red-50/50' : ''}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell className="text-sm text-gray-600">{user.email}</TableCell>
                          <TableCell>
                            <Badge className={`flex items-center gap-1 w-fit text-xs ${getRoleBadgeClass(user.role)}`}>
                              {getRoleIcon(user.role)}
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {user.isBlocked ? (
                              <Badge variant="destructive" className="bg-red-600 text-xs">
                                <Ban className="w-3 h-3 mr-1" />
                                Blocked
                              </Badge>
                            ) : user.status === 'Active' ? (
                              <Badge className="bg-[#2D5016] text-xs">Active</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {user.failedAttempts > 0 ? (
                              <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-sm">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {user.failedAttempts}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{user.lastLogin}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">

                              {/* View Details */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="View Details"
                                onClick={() => { setSelectedUser(user); setIsViewDetailsOpen(true); }}
                              >
                                <Eye className="w-4 h-4 text-gray-500" />
                              </Button>

                              {/* Reset Password */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Reset Password"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setResetMode('birthdate');
                                  setNewPasswordInput('');
                                  setIsResetPasswordOpen(true);
                                }}
                              >
                                <Key className="w-4 h-4 text-blue-600" />
                              </Button>

                              {/* Block / Unblock */}
                              {user.isBlocked ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  title="Unblock Account"
                                  onClick={() => { setSelectedUser(user); setIsUnblockDialogOpen(true); }}
                                >
                                  <Unlock className="w-4 h-4 text-[#2D5016]" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  title="Block Account"
                                  onClick={() => { setSelectedUser(user); setBlockReason(''); setIsBlockDialogOpen(true); }}
                                >
                                  <Ban className="w-4 h-4 text-red-600" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-gray-400">
                          No accounts found matching your search.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-gray-400">
                Showing {filteredUsers.length} of {users.length} accounts.
                {' '}Student accounts are managed (created) exclusively by the Registrar.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 2 – Create Institutional Account
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="create-account" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Form */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserPlus className="w-5 h-5 text-[#8B1538]" />
                  New Institutional Account
                </CardTitle>
                <CardDescription>
                  Creates accounts for Registrar and Admin roles only.
                  Credentials are generated automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Role */}
                <div className="space-y-1.5">
                  <Label>Role <span className="text-red-600">*</span></Label>
                  <Select
                    value={createForm.role}
                    onValueChange={(v) => setCreateForm({ ...createForm, role: v as UserRole })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select institutional role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Registrar">
                        <div className="flex items-center gap-2"><ClipboardList className="w-4 h-4 text-blue-700" /> Registrar</div>
                      </SelectItem>
                      <SelectItem value="Admin">
                        <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-[#8B1538]" /> Admin</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Names */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>First Name <span className="text-red-600">*</span></Label>
                    <Input
                      placeholder="e.g. Juan"
                      value={createForm.firstName}
                      onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Middle Name <span className="text-gray-400 text-xs">(optional)</span></Label>
                    <Input
                      placeholder="e.g. Santos"
                      value={createForm.middleName}
                      onChange={(e) => setCreateForm({ ...createForm, middleName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name <span className="text-red-600">*</span></Label>
                    <Input
                      placeholder="e.g. Dela Cruz"
                      value={createForm.lastName}
                      onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                    />
                  </div>
                </div>

                {/* Birthdate */}
                <div className="space-y-1.5">
                  <Label>Date of Birth <span className="text-red-600">*</span></Label>
                  <Input
                    type="date"
                    value={createForm.birthdate}
                    onChange={(e) => setCreateForm({ ...createForm, birthdate: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-gray-400">Used to auto-generate the initial password (dd-mm-yyyy format).</p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleCreateAccount}
                    className="bg-[#8B1538] hover:bg-[#6c102c]"
                    disabled={!createForm.role || !createForm.firstName.trim() || !createForm.lastName.trim() || !createForm.birthdate}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Account
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCreateForm({ role: '', firstName: '', middleName: '', lastName: '', birthdate: '' })}
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview + Info Panel */}
            <div className="lg:col-span-2 space-y-4">

              {/* Live Preview */}
              <Card className="border-dashed border-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-600 flex items-center gap-1.5">
                    <Eye className="w-4 h-4" />
                    Credential Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {previewEmail || previewPassword ? (
                    <>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Generated Email</p>
                        <p className="text-sm font-mono font-medium text-gray-800 break-all bg-gray-50 px-3 py-2 rounded border">
                          {previewEmail || <span className="text-gray-400 italic">Fill in names above</span>}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Initial Password</p>
                        <p className="text-sm font-mono font-medium text-gray-800 bg-gray-50 px-3 py-2 rounded border">
                          {previewPassword || <span className="text-gray-400 italic">Select birthdate above</span>}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 italic text-center py-4">
                      Fill in the form to preview generated credentials.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Format Info */}
              <Card className="bg-[#8B1538]/5 border-[#8B1538]/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-[#8B1538] flex items-center gap-1.5">
                    <Info className="w-4 h-4" />
                    Automated Format Rules
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-gray-700">
                  <div className="space-y-1.5">
                    <p className="font-medium text-xs text-gray-500 uppercase tracking-wide">Email</p>
                    <p className="font-mono text-xs bg-white px-2 py-1.5 rounded border">
                      [F.Initial][M.Initial][lastname]@nsdgam.edu.ph
                    </p>
                    <p className="text-xs text-gray-500">e.g. Juan B. Dela Cruz → <strong>JBdelacruz@nsdgam.edu.ph</strong></p>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    <p className="font-medium text-xs text-gray-500 uppercase tracking-wide">Password</p>
                    <p className="font-mono text-xs bg-white px-2 py-1.5 rounded border">
                      dd-mm-yyyy (from birthdate)
                    </p>
                    <p className="text-xs text-gray-500">e.g. March 20, 1985 → <strong>20-03-1985</strong></p>
                  </div>
                </CardContent>
              </Card>

              {/* Who can create what */}
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Account Creation Policy
                  </p>
                  <ul className="text-xs text-amber-700 space-y-1.5">
                    <li className="flex items-start gap-1.5">
                      <Shield className="w-3 h-3 mt-0.5 shrink-0 text-[#8B1538]" />
                      <span><strong>Admin</strong> creates: Registrar and Admin accounts.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <ClipboardList className="w-3 h-3 mt-0.5 shrink-0 text-blue-700" />
                      <span><strong>Registrar</strong> creates: Student accounts only — after receiving admission documents face-to-face.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <GraduationCap className="w-3 h-3 mt-0.5 shrink-0 text-gray-600" />
                      <span>Student credentials are sent to the email provided during admission.</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══════════════ DIALOGS ═══════════════ */}

      {/* View Details */}
      <Dialog open={isViewDetailsOpen} onOpenChange={setIsViewDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-gray-600" />
              Account Details
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 pb-2 border-b">
                <div className="w-10 h-10 rounded-full bg-[#8B1538]/10 flex items-center justify-center">
                  {getRoleIcon(selectedUser.role)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedUser.name}</p>
                  <Badge className={`text-xs mt-0.5 ${getRoleBadgeClass(selectedUser.role)}`}>{selectedUser.role}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="font-medium break-all">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Status</p>
                  <p className={`font-medium ${selectedUser.isBlocked ? 'text-red-600' : 'text-[#2D5016]'}`}>
                    {selectedUser.isBlocked ? 'Blocked' : selectedUser.status}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Account Created</p>
                  <p className="font-medium">{selectedUser.createdDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Created By</p>
                  <p className="font-medium">{selectedUser.createdBy}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Last Login</p>
                  <p className="font-medium">{selectedUser.lastLogin}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Failed Attempts</p>
                  <p className={`font-medium ${selectedUser.failedAttempts > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                    {selectedUser.failedAttempts}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Resetting password for <strong>{selectedUser?.name}</strong> ({selectedUser?.role})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Mode selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setResetMode('birthdate')}
                className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  resetMode === 'birthdate'
                    ? 'bg-[#8B1538] text-white border-[#8B1538]'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <RefreshCw className="w-4 h-4 mx-auto mb-1" />
                Reset to Birthdate
              </button>
              <button
                onClick={() => setResetMode('manual')}
                className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  resetMode === 'manual'
                    ? 'bg-[#8B1538] text-white border-[#8B1538]'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Lock className="w-4 h-4 mx-auto mb-1" />
                Set New Password
              </button>
            </div>

            {resetMode === 'birthdate' ? (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-sm">
                  Password will be reset to: <strong className="font-mono">{selectedUser ? generatePassword(selectedUser.birthdate) : '—'}</strong>
                  <br /><span className="text-xs">Format: dd-mm-yyyy based on registered birthdate</span>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-1.5">
                <Label>New Password <span className="text-red-600">*</span></Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Enter new password (min. 6 characters)"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400">The user will be required to use this password on their next login.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsResetPasswordOpen(false); setNewPasswordInput(''); }}>Cancel</Button>
            <Button
              onClick={handleResetPassword}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={resetMode === 'manual' && newPasswordInput.trim().length < 6}
            >
              <Key className="w-4 h-4 mr-2" />
              Confirm Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Account */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-600" />
              Block Account
            </DialogTitle>
            <DialogDescription>
              Block access for <strong>{selectedUser?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <Alert className="bg-red-50 border-red-200">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 text-sm">
              The user will immediately lose access to the system. They cannot log in until an Admin unblocks their account.
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label>Reason for Blocking <span className="text-gray-400 text-xs">(optional)</span></Label>
            <Input
              placeholder="e.g. Multiple failed login attempts reported"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBlockDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBlockAccount} variant="destructive">
              <Ban className="w-4 h-4 mr-2" />
              Block Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unblock Account */}
      <Dialog open={isUnblockDialogOpen} onOpenChange={setIsUnblockDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-[#2D5016]" />
              Unblock Account
            </DialogTitle>
            <DialogDescription>
              Restore access for <strong>{selectedUser?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 text-sm">
              The account will be unblocked immediately and failed login attempts will be reset to 0. The user can log in right away.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3 bg-gray-50">
            <div>
              <p className="text-xs text-gray-400">Name</p>
              <p className="font-medium">{selectedUser?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Role</p>
              <p className="font-medium">{selectedUser?.role}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Failed Attempts</p>
              <p className="font-semibold text-red-600">{selectedUser?.failedAttempts}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Email</p>
              <p className="font-medium text-xs break-all">{selectedUser?.email}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUnblockDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUnblockAccount} className="bg-[#2D5016] hover:bg-[#1f3810]">
              <Unlock className="w-4 h-4 mr-2" />
              Unblock Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Created Success */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#2D5016]">
              <CheckCircle2 className="w-5 h-5" />
              Account Created Successfully
            </DialogTitle>
            <DialogDescription>
              The institutional account has been created. Share credentials securely with the user.
            </DialogDescription>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-gray-50 divide-y">
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-400 mb-0.5">Full Name</p>
                  <p className="font-semibold text-gray-900">{createdCredentials.name}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-400 mb-0.5">Role</p>
                  <Badge className={`text-xs ${getRoleBadgeClass(createdCredentials.role as UserRole)}`}>
                    {createdCredentials.role}
                  </Badge>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Email / Username</p>
                    <p className="font-mono text-sm font-medium text-gray-900">{createdCredentials.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => copyToClipboard(createdCredentials.email, 'Email')}
                  >
                    <Copy className="w-4 h-4 text-gray-500" />
                  </Button>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Initial Password</p>
                    <p className="font-mono text-sm font-medium text-gray-900">
                      {showCreatedPassword ? createdCredentials.password : '••••••••••'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setShowCreatedPassword(!showCreatedPassword)}
                    >
                      {showCreatedPassword ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => copyToClipboard(createdCredentials.password, 'Password')}
                    >
                      <Copy className="w-4 h-4 text-gray-500" />
                    </Button>
                  </div>
                </div>
              </div>

              <Alert className="bg-amber-50 border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 text-xs">
                  Share these credentials securely. The user should change their password after first login. The initial password follows the dd-mm-yyyy birthdate format.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => { setIsSuccessDialogOpen(false); setCreatedCredentials(null); setShowCreatedPassword(false); }}
              className="bg-[#8B1538] hover:bg-[#6c102c]"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}