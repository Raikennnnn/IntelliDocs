import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { 
  Calendar,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Save,
  Clock,
  Power,
  PowerOff,
  Info
} from 'lucide-react';

// Mock School Years Data
const initialSchoolYears = [
  { 
    id: 1, 
    year: '2025-2026', 
    status: 'Active', 
    startDate: '2025-06-01', 
    endDate: '2026-03-31',
    enrolledStudents: 1247,
    createdBy: 'Dr. Maria Santos',
    createdDate: '2025-05-15'
  },
  { 
    id: 2, 
    year: '2024-2025', 
    status: 'Inactive', 
    startDate: '2024-06-01', 
    endDate: '2025-03-31',
    enrolledStudents: 1189,
    createdBy: 'Dr. Maria Santos',
    createdDate: '2024-05-20'
  },
  { 
    id: 3, 
    year: '2023-2024', 
    status: 'Inactive', 
    startDate: '2023-06-01', 
    endDate: '2024-03-31',
    enrolledStudents: 1156,
    createdBy: 'Dr. Maria Santos',
    createdDate: '2023-05-18'
  },
];

export function SchoolYearManagement() {
  const [schoolYears, setSchoolYears] = useState(initialSchoolYears);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<any>(null);
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);
  
  const [newSchoolYear, setNewSchoolYear] = useState({
    year: '',
    startDate: '',
    endDate: '',
    status: 'Inactive'
  });

  const activeSchoolYear = schoolYears.find(sy => sy.status === 'Active');

  const handleCreateSchoolYear = () => {
    // Validation
    if (!newSchoolYear.year || !newSchoolYear.startDate || !newSchoolYear.endDate) {
      alert('Please fill in all required fields');
      return;
    }

    // Create new school year
    const newSY = {
      id: schoolYears.length + 1,
      year: newSchoolYear.year,
      startDate: newSchoolYear.startDate,
      endDate: newSchoolYear.endDate,
      status: 'Inactive',
      enrolledStudents: 0,
      createdBy: 'Dr. Maria Santos', // Would be current user
      createdDate: new Date().toISOString().split('T')[0]
    };

    setSchoolYears([newSY, ...schoolYears]);
    setIsCreateDialogOpen(false);
    
    // Reset form
    setNewSchoolYear({
      year: '',
      startDate: '',
      endDate: '',
      status: 'Inactive'
    });
  };

  const handleActivateSchoolYear = (schoolYear: any) => {
    setSelectedYear(schoolYear);
    setIsActivateDialogOpen(true);
  };

  const confirmActivateSchoolYear = () => {
    // Deactivate all school years first
    const updatedYears = schoolYears.map(sy => ({
      ...sy,
      status: sy.id === selectedYear.id ? 'Active' : 'Inactive'
    }));
    
    setSchoolYears(updatedYears);
    setIsActivateDialogOpen(false);
    setSelectedYear(null);
  };

  const handleDeactivateSchoolYear = (schoolYear: any) => {
    if (window.confirm(`Are you sure you want to deactivate School Year ${schoolYear.year}? This will prevent new enrollments.`)) {
      const updatedYears = schoolYears.map(sy => ({
        ...sy,
        status: sy.id === schoolYear.id ? 'Inactive' : sy.status
      }));
      
      setSchoolYears(updatedYears);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">School Year Management</h2>
        <p className="text-gray-600">Create, activate, and manage school year cycles</p>
      </div>

      {/* Active School Year Alert */}
      {activeSchoolYear ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-green-900">Active School Year: {activeSchoolYear.year}</p>
            <p className="text-sm text-green-700 mt-1">
              Current period: {new Date(activeSchoolYear.startDate).toLocaleDateString()} - {new Date(activeSchoolYear.endDate).toLocaleDateString()}
            </p>
            <p className="text-sm text-green-700">
              Total enrolled students: {activeSchoolYear.enrolledStudents}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeactivateSchoolYear(activeSchoolYear)}
            className="border-red-600 text-red-600 hover:bg-red-50"
          >
            <PowerOff className="w-4 h-4 mr-2" />
            Deactivate
          </Button>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">No Active School Year</p>
            <p className="text-sm text-red-700 mt-1">
              ⚠️ WARNING: Enrollment cannot proceed without an active school year. Please activate a school year to enable enrollments.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total School Years</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{schoolYears.length}</div>
            <p className="text-xs text-gray-500 mt-1">All time records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active School Year</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#2D5016]">
              {activeSchoolYear ? '1' : '0'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Currently accepting enrollments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Current Enrollment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#8B1538]">
              {activeSchoolYear?.enrolledStudents || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Students this year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Inactive Years</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-600">
              {schoolYears.filter(sy => sy.status === 'Inactive').length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Archived records</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#8B1538]" />
                School Year Records
              </CardTitle>
              <CardDescription>Manage academic year cycles and enrollment periods</CardDescription>
            </div>
            <Button 
              className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create School Year
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Critical Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">School Year Control Policy</p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Only ONE school year can be active at a time</li>
                <li>Enrollment requests REQUIRE an active school year</li>
                <li>Activating a new school year automatically deactivates the previous one</li>
                <li>Only Admin role can manage school years</li>
              </ul>
            </div>
          </div>

          {/* School Years Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">School Year</TableHead>
                  <TableHead className="font-semibold">Start Date</TableHead>
                  <TableHead className="font-semibold">End Date</TableHead>
                  <TableHead className="font-semibold text-center">Status</TableHead>
                  <TableHead className="font-semibold text-center">Enrolled Students</TableHead>
                  <TableHead className="font-semibold">Created By</TableHead>
                  <TableHead className="font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schoolYears.map((sy) => (
                  <TableRow key={sy.id} className={sy.status === 'Active' ? 'bg-green-50' : ''}>
                    <TableCell className="font-semibold text-gray-900">{sy.year}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(sy.startDate).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(sy.endDate).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {sy.status === 'Active' ? (
                        <Badge className="bg-[#2D5016] hover:bg-[#2D5016] text-white">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-600">
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-2xl font-bold text-gray-900">{sy.enrolledStudents}</span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{sy.createdBy}</TableCell>
                    <TableCell className="text-center">
                      {sy.status === 'Inactive' ? (
                        <Button
                          size="sm"
                          onClick={() => handleActivateSchoolYear(sy)}
                          className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
                        >
                          <Power className="w-4 h-4 mr-1" />
                          Activate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeactivateSchoolYear(sy)}
                          className="border-red-600 text-red-600 hover:bg-red-50"
                        >
                          <PowerOff className="w-4 h-4 mr-1" />
                          Deactivate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create School Year Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New School Year</DialogTitle>
            <DialogDescription>
              Define a new academic year period. The school year will be created as inactive by default.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* School Year */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                School Year <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., 2026-2027"
                value={newSchoolYear.year}
                onChange={(e) => setNewSchoolYear({ ...newSchoolYear, year: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
              />
              <p className="text-xs text-gray-500 mt-1">Format: YYYY-YYYY (e.g., 2026-2027)</p>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={newSchoolYear.startDate}
                  onChange={(e) => setNewSchoolYear({ ...newSchoolYear, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={newSchoolYear.endDate}
                  onChange={(e) => setNewSchoolYear({ ...newSchoolYear, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                />
              </div>
            </div>

            {/* Info Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Important Notice</p>
                <p className="mt-1">The new school year will be created as <strong>Inactive</strong>. You must manually activate it when ready to accept enrollments.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSchoolYear}
              className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              Create School Year
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate Confirmation Dialog */}
      <Dialog open={isActivateDialogOpen} onOpenChange={setIsActivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate School Year {selectedYear?.year}?</DialogTitle>
            <DialogDescription>
              This action will deactivate all other school years and make {selectedYear?.year} the active enrollment period.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">This will:</p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Deactivate {activeSchoolYear?.year || 'the current active school year'}</li>
                  <li>Set {selectedYear?.year} as the active school year</li>
                  <li>Allow new enrollments for {selectedYear?.year}</li>
                  <li>Update all system filters to show {selectedYear?.year} by default</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmActivateSchoolYear}
              className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
            >
              <Power className="w-4 h-4 mr-2" />
              Activate School Year
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}