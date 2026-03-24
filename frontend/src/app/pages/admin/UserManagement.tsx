import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  UsersRound,
  UserPlus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  email: string;
  role: "Student" | "Registrar" | "Admin";
  status: "Active" | "Inactive";
  lastLogin: string;
  createdDate: string;
}

export function UserManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [roleFilter, setRoleFilter] = useState<"All" | "Admin" | "Registrar" | "Student">("All");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "Student",
    password: "",
  });

  // Mock users data
  const [users] = useState<User[]>([
    {
      id: "1",
      name: "Juan Dela Cruz",
      email: "juan.student@email.com",
      role: "Student",
      status: "Active",
      lastLogin: "March 18, 2026",
      createdDate: "March 15, 2026",
    },
    {
      id: "2",
      name: "Maria Cruz",
      email: "maria.registrar@nsdg.edu.ph",
      role: "Registrar",
      status: "Active",
      lastLogin: "March 18, 2026",
      createdDate: "January 10, 2026",
    },
    {
      id: "3",
      name: "Admin User",
      email: "admin@nsdg.edu.ph",
      role: "Admin",
      status: "Active",
      lastLogin: "March 18, 2026",
      createdDate: "January 5, 2026",
    },
    {
      id: "4",
      name: "Pedro Reyes",
      email: "pedro.student@email.com",
      role: "Student",
      status: "Active",
      lastLogin: "March 17, 2026",
      createdDate: "March 14, 2026",
    },
    {
      id: "5",
      name: "Carlos Mendoza",
      email: "carlos.student@email.com",
      role: "Student",
      status: "Inactive",
      lastLogin: "March 10, 2026",
      createdDate: "March 8, 2026",
    },
  ]);

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error("Please fill in all fields");
      return;
    }
    toast.success(`User ${newUser.name} has been added successfully`);
    setShowAddUser(false);
    setNewUser({ name: "", email: "", role: "Student", password: "" });
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowAddUser(false); // Close add user form if open
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;
    
    if (!editingUser.name || !editingUser.email) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    toast.success(`User ${editingUser.name} has been updated successfully`);
    setEditingUser(null);
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
  };

  const handleDeactivateUser = (userName: string) => {
    toast.success(`User ${userName} has been deactivated`);
  };

  const handleActivateUser = (userName: string) => {
    toast.success(`User ${userName} has been activated`);
  };

  const handleDeleteUser = (userName: string) => {
    toast.success(`User ${userName} has been deleted`);
  };

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
            <CardDescription>Create a new user account</CardDescription>
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
                  <option value="Student">Student</option>
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
                <select
                  id="edit-role"
                  value={editingUser.role}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, role: e.target.value as "Student" | "Registrar" | "Admin" })
                  }
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                >
                  <option value="Student">Student</option>
                  <option value="Registrar">Registrar</option>
                  <option value="Admin">Admin</option>
                </select>
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
                onClick={handleSaveEdit}
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
          <div className="flex gap-2 mb-4 pb-4 border-b">
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
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-4 border rounded-lg hover:border-[#8B1538] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {user.name}
                        </h3>
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {user.role}
                        </Badge>
                        <Badge
                          className={
                            user.status === "Active"
                              ? "bg-green-600"
                              : "bg-gray-600"
                          }
                        >
                          {user.status === "Active" ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {user.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="font-medium">{user.email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Last Login</p>
                          <p className="font-medium">{user.lastLogin}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Created</p>
                          <p className="font-medium">{user.createdDate}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      {user.status === "Active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-yellow-600 text-yellow-600 hover:bg-yellow-600 hover:text-white"
                          onClick={() => handleDeactivateUser(user.name)}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                          onClick={() => handleActivateUser(user.name)}
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                        onClick={() => handleDeleteUser(user.name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}