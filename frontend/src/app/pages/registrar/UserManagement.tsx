import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus, Search, Edit2, Trash2, UserPlus, Eye, EyeOff, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher';
  status: 'active' | 'inactive';
  createdDate: string;
  lastLogin: string;
  section?: string;
  gradeLevel?: string;
  subject?: string;
}

export function UserManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'student' | 'teacher'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Form state
  const [accountType, setAccountType] = useState<'student' | 'teacher'>('student');
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    username: '',
    lrn: '',
    employeeId: '',
    gradeLevel: '',
    strand: '',
    section: '',
    department: '',
    subject: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      username: '',
      lrn: '',
      employeeId: '',
      gradeLevel: '',
      strand: '',
      section: '',
      department: '',
      subject: '',
    });
    setAccountType('student');
  };

  const handleCreateAccount = () => {
    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.username) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (accountType === 'student' && !formData.lrn) {
      toast.error('LRN is required for student accounts');
      return;
    }

    if (accountType === 'teacher' && !formData.employeeId) {
      toast.error('Employee ID is required for teacher accounts');
      return;
    }

    // Success
    const fullName = `${formData.firstName} ${formData.middleName} ${formData.lastName}`.replace(/\s+/g, ' ').trim();
    toast.success(`${accountType === 'student' ? 'Student' : 'Teacher'} account created successfully for ${fullName}`);
    
    // Reset and close
    resetForm();
    setIsCreateDialogOpen(false);
  };

  // Mock data for users
  const mockUsers: User[] = [
    {
      id: 'STU001',
      name: 'Maria Santos',
      email: 'ms@student.ndga.edu.ph',
      role: 'student',
      status: 'active',
      createdDate: '2024-08-15',
      lastLogin: '2024-02-20',
      gradeLevel: 'Grade 11',
      section: 'HUMSS-A'
    },
    {
      id: 'STU002',
      name: 'Juan Dela Cruz',
      email: 'jdc@student.ndga.edu.ph',
      role: 'student',
      status: 'active',
      createdDate: '2024-08-15',
      lastLogin: '2024-02-19',
      gradeLevel: 'Grade 12',
      section: 'TVL-B'
    },
    {
      id: 'STU003',
      name: 'Ana Reyes',
      email: 'ar@student.ndga.edu.ph',
      role: 'student',
      status: 'inactive',
      createdDate: '2024-08-10',
      lastLogin: '2024-01-30',
      gradeLevel: 'Grade 11',
      section: 'HUMSS-A'
    },
    {
      id: 'TCH001',
      name: 'Prof. Roberto Garcia',
      email: 'rg@teacher.ndga.edu.ph',
      role: 'teacher',
      status: 'active',
      createdDate: '2024-06-01',
      lastLogin: '2024-02-24',
      subject: 'Mathematics'
    },
    {
      id: 'TCH002',
      name: 'Prof. Elena Cruz',
      email: 'ec@teacher.ndga.edu.ph',
      role: 'teacher',
      status: 'active',
      createdDate: '2024-06-01',
      lastLogin: '2024-02-25',
      subject: 'English'
    },
    {
      id: 'TCH003',
      name: 'Prof. Miguel Torres',
      email: 'mt@teacher.ndga.edu.ph',
      role: 'teacher',
      status: 'active',
      createdDate: '2024-06-05',
      lastLogin: '2024-02-23',
      subject: 'Science'
    },
    {
      id: 'STU004',
      name: 'Sofia Martinez',
      email: 'sm@student.ndga.edu.ph',
      role: 'student',
      status: 'active',
      createdDate: '2024-08-18',
      lastLogin: '2024-02-24',
      gradeLevel: 'Grade 12',
      section: 'HUMSS-B'
    },
    {
      id: 'STU005',
      name: 'Carlos Lopez',
      email: 'cl@student.ndga.edu.ph',
      role: 'student',
      status: 'active',
      createdDate: '2024-08-20',
      lastLogin: '2024-02-25',
      gradeLevel: 'Grade 11',
      section: 'TVL-A'
    }
  ];

  const filteredUsers = mockUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const studentCount = mockUsers.filter(u => u.role === 'student').length;
  const teacherCount = mockUsers.filter(u => u.role === 'teacher').length;
  const activeCount = mockUsers.filter(u => u.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">User Management</h2>
          <p className="text-gray-600">Manage teacher and student accounts</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#8B1538] hover:bg-[#6B1028] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create New Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Account</DialogTitle>
              <DialogDescription>
                Create a new account for a teacher or student
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Account Type Selector */}
              <div className="space-y-2">
                <Label htmlFor="accountType">Account Type *</Label>
                <Select value={accountType} onValueChange={(value: 'student' | 'teacher') => setAccountType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Personal Information */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Personal Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      placeholder="Enter first name"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="middleName">Middle Name</Label>
                    <Input
                      id="middleName"
                      placeholder="Enter middle name"
                      value={formData.middleName}
                      onChange={(e) => handleInputChange('middleName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      placeholder="Enter last name"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Account Credentials */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Account Credentials</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      placeholder="Enter username"
                      value={formData.username}
                      onChange={(e) => handleInputChange('username', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={accountType === 'student' ? 'student@ndga.edu.ph' : 'teacher@ndga.edu.ph'}
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Student-specific fields */}
              {accountType === 'student' && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Student Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lrn">LRN (Learner Reference Number) *</Label>
                      <Input
                        id="lrn"
                        placeholder="Enter 12-digit LRN"
                        maxLength={12}
                        value={formData.lrn}
                        onChange={(e) => handleInputChange('lrn', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gradeLevel">Grade Level *</Label>
                      <Select value={formData.gradeLevel} onValueChange={(value) => handleInputChange('gradeLevel', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select grade level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Grade 11">Grade 11</SelectItem>
                          <SelectItem value="Grade 12">Grade 12</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="strand">Strand *</Label>
                      <Select value={formData.strand} onValueChange={(value) => handleInputChange('strand', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select strand" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HUMSS">HUMSS - Humanities and Social Sciences</SelectItem>
                          <SelectItem value="TVL">TVL - Technical-Vocational-Livelihood</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="section">Section</Label>
                      <Input
                        id="section"
                        placeholder="e.g., A, B, C"
                        value={formData.section}
                        onChange={(e) => handleInputChange('section', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Teacher-specific fields */}
              {accountType === 'teacher' && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Teacher Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="employeeId">Employee ID *</Label>
                      <Input
                        id="employeeId"
                        placeholder="Enter employee ID"
                        value={formData.employeeId}
                        onChange={(e) => handleInputChange('employeeId', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Select value={formData.department} onValueChange={(value) => handleInputChange('department', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Academic Affairs">Academic Affairs</SelectItem>
                          <SelectItem value="Mathematics">Mathematics</SelectItem>
                          <SelectItem value="Science">Science</SelectItem>
                          <SelectItem value="English">English</SelectItem>
                          <SelectItem value="Filipino">Filipino</SelectItem>
                          <SelectItem value="Social Studies">Social Studies</SelectItem>
                          <SelectItem value="Physical Education">Physical Education</SelectItem>
                          <SelectItem value="MAPEH">MAPEH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="subject">Primary Subject/Specialization</Label>
                      <Input
                        id="subject"
                        placeholder="e.g., Mathematics, English, Science"
                        value={formData.subject}
                        onChange={(e) => handleInputChange('subject', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Information Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> A temporary password will be automatically generated and sent to the user's email address. 
                  The user will be required to change their password upon first login.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsCreateDialogOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button 
                className="bg-[#8B1538] hover:bg-[#6B1028] text-white"
                onClick={handleCreateAccount}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Create Account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Account Creation Authority</p>
              <p className="text-sm text-blue-700 mt-1">
                As a Registrar, you can create and manage accounts for <strong>Teachers</strong> and <strong>Students</strong> only. 
                Principal and Admin/IT accounts are managed through higher-level administrative processes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{mockUsers.length}</div>
            <p className="text-xs text-gray-500 mt-1">All accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#2D5016]">{studentCount}</div>
            <p className="text-xs text-gray-500 mt-1">Active & Inactive</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Teachers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#8B1538]">{teacherCount}</div>
            <p className="text-xs text-gray-500 mt-1">Faculty members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{activeCount}</div>
            <p className="text-xs text-gray-500 mt-1">Currently active</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B1538] focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterRole === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterRole('all')}
                className={filterRole === 'all' ? 'bg-[#8B1538] hover:bg-[#6B1028]' : ''}
              >
                All Users
              </Button>
              <Button
                variant={filterRole === 'student' ? 'default' : 'outline'}
                onClick={() => setFilterRole('student')}
                className={filterRole === 'student' ? 'bg-[#2D5016] hover:bg-[#1D3010]' : ''}
              >
                Students
              </Button>
              <Button
                variant={filterRole === 'teacher' ? 'default' : 'outline'}
                onClick={() => setFilterRole('teacher')}
                className={filterRole === 'teacher' ? 'bg-[#8B1538] hover:bg-[#6B1028]' : ''}
              >
                Teachers
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Accounts ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">User ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Details</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Last Login</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{user.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        user.role === 'student' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.role === 'student' ? 'Student' : 'Teacher'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {user.role === 'student' ? (
                        <div>
                          <div className="font-medium">{user.gradeLevel}</div>
                          <div className="text-xs text-gray-500">{user.section}</div>
                        </div>
                      ) : (
                        <div className="font-medium">{user.subject}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        user.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.lastLogin}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                        >
                          <EyeOff className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No users found matching your search criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}