import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  UsersRound,
  UserPlus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: "Student" | "Registrar" | "Admin";
  status: "Active" | "Inactive";
  lastLogin: string;
  createdDate: string;
}

type UserConfirmAction =
  | { type: "deactivate"; user: User }
  | { type: "activate"; user: User }
  | { type: "delete"; user: User }
  | { type: "saveEdit"; user: User };

export function UserManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [roleFilter, setRoleFilter] = useState<"All" | "Admin" | "Registrar" | "Student">("All");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "Registrar",
    password: "",
  });
  const [pendingAction, setPendingAction] = useState<UserConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadUsers = async () => {
    const res = await apiFetch('/api/admin/users');
    const text = await res.text();
    let json: any = {};
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Server returned an invalid response');
    }
    if (!res.ok || !json.success) {
      throw new Error(json.error || `Failed to load users (${res.status})`);
    }
    const rows = Array.isArray(json.users) ? json.users : [];
    setUsers(rows.map((u: any) => ({
      id: String(u.id ?? ''),
      name: String(u.name ?? ''),
      email: String(u.email ?? ''),
      role: (u.role ?? 'Student') as User['role'],
      status: (u.status ?? 'Active') as User['status'],
      lastLogin: String(u.lastLogin ?? 'Never'),
      createdDate: u.createdDate
        ? new Date(String(u.createdDate)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'N/A',
    })));
  };

  useEffect(() => {
    loadUsers().catch((e) => {
      toast.error(e instanceof Error ? e.message : 'Failed to load users');
    });
  }, []);

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      const username = newUser.email.split('@')[0];
      const role = newUser.role.toLowerCase();
      const res = await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_user',
          username,
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.name,
          role,
        }),
      });
      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('Server returned an invalid response');
      }
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to create user (${res.status})`);
      }
      toast.success(`User ${newUser.name} has been added successfully`);
      setShowAddUser(false);
      setNewUser({ name: "", email: "", role: "Registrar", password: "" });
      await loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create user');
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowAddUser(false); // Close add user form if open
  };

  const performSaveEdit = async (user: User) => {
    const original = users.find((u) => u.id === user.id);
    const payloadUser =
      original?.role === "Student" ? { ...user, role: "Student" as const } : user;
    const res = await apiFetch('/api/admin/users', {
      method: 'PUT',
      body: JSON.stringify({
        id: payloadUser.id,
        name: payloadUser.name,
        email: payloadUser.email,
        role: payloadUser.role,
        status: payloadUser.status,
      }),
    });
    const text = await res.text();
    let json: any = {};
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Server returned an invalid response');
    }
    if (!res.ok || !json.success) {
      throw new Error(json.error || `Failed to update user (${res.status})`);
    }
    toast.success(json.message || `User ${user.name} has been updated successfully`);
    setEditingUser(null);
    await loadUsers();
  };

  const requestSaveEdit = () => {
    if (!editingUser) return;
    if (!editingUser.name || !editingUser.email) {
      toast.error("Please fill in all required fields");
      return;
    }
    const original = users.find((u) => u.id === editingUser.id);
    if (original?.status === "Active" && editingUser.status === "Inactive") {
      setPendingAction({ type: "saveEdit", user: editingUser });
      return;
    }
    void performSaveEdit(editingUser).catch((e) => {
      toast.error(e instanceof Error ? e.message : "Failed to update user");
    });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
  };

  const performDeactivateUser = async (user: User) => {
    const res = await apiFetch('/api/admin/users', {
      method: 'PUT',
      body: JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role, status: 'Inactive' }),
    });
    const text = await res.text();
    const json = JSON.parse(text);
    if (!res.ok || !json.success) throw new Error(json.error || `Failed (${res.status})`);
    toast.success(`User ${user.name} has been deactivated`);
    await loadUsers();
  };

  const performActivateUser = async (user: User) => {
    const res = await apiFetch('/api/admin/users', {
      method: 'PUT',
      body: JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role, status: 'Active' }),
    });
    const text = await res.text();
    const json = JSON.parse(text);
    if (!res.ok || !json.success) throw new Error(json.error || `Failed (${res.status})`);
    toast.success(`User ${user.name} has been activated`);
    await loadUsers();
  };

  const performDeleteUser = async (user: User) => {
    const res = await apiFetch('/api/admin/users', {
      method: 'DELETE',
      body: JSON.stringify({ id: user.id }),
    });
    const text = await res.text();
    let json: any = {};
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Server returned an invalid response');
    }
    if (!res.ok || !json.success) {
      if (json.error === 'rate_limited' || json.code === 'rapid_actions') {
        throw new Error('Too many changes in a short time. Wait a minute and try again.');
      }
      throw new Error(json.error || `Failed to delete user (${res.status})`);
    }
    toast.success(`User ${user.name} has been deleted`);
    await loadUsers();
  };

  const handleConfirmPendingAction = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      if (pendingAction.type === 'deactivate') {
        await performDeactivateUser(pendingAction.user);
      } else if (pendingAction.type === 'activate') {
        await performActivateUser(pendingAction.user);
      } else if (pendingAction.type === 'delete') {
        await performDeleteUser(pendingAction.user);
      } else {
        await performSaveEdit(pendingAction.user);
      }
      setPendingAction(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDialogCopy = pendingAction
    ? pendingAction.type === 'delete'
      ? {
          title: 'Delete user account?',
          description: `You are about to permanently delete "${pendingAction.user.name}" (${pendingAction.user.email}). This cannot be undone and will remove their access to the system.`,
          actionLabel: actionLoading ? 'Deleting…' : 'Delete user',
          actionClass: 'bg-red-600 hover:bg-red-600/90 text-white',
        }
      : pendingAction.type === 'deactivate' || pendingAction.type === 'saveEdit'
        ? {
            title: 'Deactivate user account?',
            description: `Deactivate "${pendingAction.user.name}" (${pendingAction.user.email})? They will not be able to log in until the account is activated again.`,
            actionLabel: actionLoading ? 'Deactivating…' : 'Deactivate user',
            actionClass: 'bg-yellow-600 hover:bg-yellow-600/90 text-white',
          }
        : {
            title: 'Activate user account?',
            description: `Activate "${pendingAction.user.name}" (${pendingAction.user.email})? They will be able to log in again.`,
            actionLabel: actionLoading ? 'Activating…' : 'Activate user',
            actionClass: 'bg-[#2D5016] hover:bg-[#2D5016]/90 text-white',
          }
    : null;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Admin":
        return "bg-[#8B1538]";
      case "Registrar":
        return "bg-[#2D5016]";
      case "Student":
        return "bg-blue-600";
      default:
        return "bg-gray-600";
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(user => roleFilter === "All" || user.role === roleFilter);

  const editingUserOriginalRole = editingUser
    ? users.find((u) => u.id === editingUser.id)?.role
    : undefined;
  const isStudentRoleLocked = editingUserOriginalRole === "Student";

  const stats = {
    total: users.length,
    students: users.filter((u) => u.role === "Student").length,
    registrars: users.filter((u) => u.role === "Registrar").length,
    admins: users.filter((u) => u.role === "Admin").length,
    active: users.filter((u) => u.status === "Active").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            User Management
          </h2>
          <p className="text-gray-600">Manage system users and roles</p>
        </div>
        <Button
          onClick={() => setShowAddUser(!showAddUser)}
          className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add New User
        </Button>
      </div>

      {/* Add User Form */}
      {showAddUser && (
        <Card className="border-[#8B1538]">
          <CardHeader>
            <CardTitle>Add New User</CardTitle>
            <CardDescription>Create a staff account (admin or registrar). Students register through the enrollment portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, name: e.target.value })
                  }
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  placeholder="user@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <select
                  id="role"
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
                >
                  <option value="Registrar">Registrar</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  placeholder="Enter password"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleAddUser}
                className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Create User
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddUser(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit User Form */}
      {editingUser && (
        <Card className="border-blue-600">
          <CardHeader>
            <CardTitle>Edit User</CardTitle>
            <CardDescription>Update user information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  value={editingUser.name}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, name: e.target.value })
                  }
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email Address *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, email: e.target.value })
                  }
                  placeholder="user@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role *</Label>
                {isStudentRoleLocked ? (
                  <>
                    <Input id="edit-role" value="Student" disabled className="bg-gray-50" />
                    <p className="text-xs text-gray-500">
                      Student accounts cannot be promoted to admin or registrar. Create a separate staff account if needed.
                    </p>
                  </>
                ) : (
                  <select
                    id="edit-role"
                    value={editingUser.role}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, role: e.target.value as "Student" | "Registrar" | "Admin" })
                    }
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  >
                    <option value="Registrar">Registrar</option>
                    <option value="Admin">Admin</option>
                  </select>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status *</Label>
                <select
                  id="edit-status"
                  value={editingUser.status}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, status: e.target.value as "Active" | "Inactive" })
                  }
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={requestSaveEdit}
                className="bg-blue-600 hover:bg-blue-600/90 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelEdit}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      <div className="stat-grid">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-600">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {stats.students}
              </p>
              <p className="text-sm text-gray-600">Students</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#2D5016]">
                {stats.registrars}
              </p>
              <p className="text-sm text-gray-600">Registrars</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#8B1538]">
                {stats.admins}
              </p>
              <p className="text-sm text-gray-600">Admins</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {stats.active}
              </p>
              <p className="text-sm text-gray-600">Active</p>
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
              placeholder="Search by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>All Users ({filteredUsers.length})</CardTitle>
          <CardDescription>Manage user accounts and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Role Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
            <Button
              variant={roleFilter === "All" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("All")}
              className={roleFilter === "All" ? "bg-gray-900" : ""}
            >
              All ({users.length})
            </Button>
            <Button
              variant={roleFilter === "Admin" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("Admin")}
              className={roleFilter === "Admin" ? "bg-[#8B1538] hover:bg-[#8B1538]/90" : ""}
            >
              Admin ({users.filter(u => u.role === 'Admin').length})
            </Button>
            <Button
              variant={roleFilter === "Registrar" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("Registrar")}
              className={roleFilter === "Registrar" ? "bg-[#2D5016] hover:bg-[#2D5016]/90" : ""}
            >
              Registrar ({users.filter(u => u.role === 'Registrar').length})
            </Button>
            <Button
              variant={roleFilter === "Student" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("Student")}
              className={roleFilter === "Student" ? "bg-blue-600 hover:bg-blue-600/90" : ""}
            >
              Student ({users.filter(u => u.role === 'Student').length})
            </Button>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No users found
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100 hover:bg-gray-100">
                    <TableHead className="font-semibold border-r border-gray-200">Name</TableHead>
                    <TableHead className="font-semibold border-r border-gray-200 min-w-[200px]">Email</TableHead>
                    <TableHead className="font-semibold border-r border-gray-200 text-center">Role</TableHead>
                    <TableHead className="font-semibold border-r border-gray-200 text-center">Status</TableHead>
                    <TableHead className="font-semibold border-r border-gray-200">Last Login</TableHead>
                    <TableHead className="font-semibold border-r border-gray-200">Created</TableHead>
                    <TableHead className="font-semibold text-center min-w-[220px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user, index) => (
                    <TableRow
                      key={user.id}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50/80"}
                    >
                      <TableCell className="font-medium text-gray-900 border-r border-gray-200">
                        {user.name}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 border-r border-gray-200 whitespace-normal">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-center border-r border-gray-200">
                        <Badge className={getRoleBadgeColor(user.role)}>{user.role}</Badge>
                      </TableCell>
                      <TableCell className="text-center border-r border-gray-200">
                        <Badge
                          className={
                            user.status === "Active" ? "bg-green-600" : "bg-gray-600"
                          }
                        >
                          {user.status === "Active" ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 border-r border-gray-200">
                        {user.lastLogin}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 border-r border-gray-200">
                        {user.createdDate}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          {user.status === "Active" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-yellow-600 text-yellow-600 hover:bg-yellow-600 hover:text-white"
                              onClick={() => setPendingAction({ type: 'deactivate', user })}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                              onClick={() => setPendingAction({ type: 'activate', user })}
                            >
                              Activate
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                            onClick={() => setPendingAction({ type: 'delete', user })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !actionLoading) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialogCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialogCopy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmDialogCopy?.actionClass}
              disabled={actionLoading}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmPendingAction();
              }}
            >
              {confirmDialogCopy?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}