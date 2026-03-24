import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { 
  Users, UserCircle, Search, Plus, Edit, Trash2, AlertCircle, 
  UserCheck, Calendar, Hash, CheckCircle, AlertTriangle, Settings 
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { useNavigate } from 'react-router';

type Strand = 'HUMSS' | 'TVL';

interface SectionData {
  id: string;
  name: string;
  students: number;
  adviser: string;
  adviserId: string;
  capacity: number;
  gradeLevel: '11' | '12';
  schoolYear: string;
  strand: Strand;
}

interface Teacher {
  id: string;
  name: string;
  currentSections: number;
}

export function Sections() {
  const navigate = useNavigate();
  const [selectedStrand, setSelectedStrand] = useState<Strand | null>(null);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string | null>(null);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<'11' | '12' | null>(null);
  const [selectedSectionName, setSelectedSectionName] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SectionData | null>(null);

  // Form state for creating/editing sections
  const [formData, setFormData] = useState({
    name: '',
    capacity: 45,
    gradeLevel: '11' as '11' | '12',
    schoolYear: '2025-2026',
    strand: 'HUMSS' as Strand
  });

  const strands: Array<{ name: Strand; fullName: string }> = [
    { name: 'HUMSS', fullName: 'Humanities and Social Sciences' },
    { name: 'TVL', fullName: 'Technical-Vocational-Livelihood' }
  ];

  const schoolYears = [
    '2024-2025',
    '2025-2026',
    '2026-2027',
    '2027-2028'
  ];

  // Available teachers for adviser assignment
  const [availableTeachers] = useState<Teacher[]>([
    { id: 'T001', name: 'Ms. Maria Santos', currentSections: 1 },
    { id: 'T002', name: 'Mr. Juan Dela Cruz', currentSections: 1 },
    { id: 'T003', name: 'Ms. Lisa Ramos', currentSections: 1 },
    { id: 'T004', name: 'Ms. Ana Garcia', currentSections: 1 },
    { id: 'T005', name: 'Mr. Pedro Reyes', currentSections: 1 },
    { id: 'T006', name: 'Ms. Carmen Lopez', currentSections: 1 },
    { id: 'T007', name: 'Mr. Roberto Cruz', currentSections: 1 },
    { id: 'T008', name: 'Ms. Sofia Martinez', currentSections: 1 },
    { id: 'T009', name: 'Mr. Carlos Mendoza', currentSections: 1 },
    { id: 'T010', name: 'Mr. Jose Mendoza', currentSections: 1 },
    { id: 'T011', name: 'Ms. Rosa Garcia', currentSections: 1 },
    { id: 'T012', name: 'Mr. Mark Gonzales', currentSections: 1 },
    { id: 'T013', name: 'Ms. Elena Reyes', currentSections: 0 },
    { id: 'T014', name: 'Mr. Antonio Santos', currentSections: 0 },
    { id: 'T015', name: 'Ms. Patricia Cruz', currentSections: 0 }
  ]);

  const [sections, setSections] = useState<SectionData[]>([
    // Grade 12 - SY 2025-2026
    { id: 'SEC001', name: 'Mabini', students: 42, adviser: 'Ms. Maria Santos', adviserId: 'T001', capacity: 45, gradeLevel: '12', schoolYear: '2025-2026', strand: 'HUMSS' },
    { id: 'SEC002', name: 'Rizal', students: 38, adviser: 'Mr. Juan Dela Cruz', adviserId: 'T002', capacity: 45, gradeLevel: '12', schoolYear: '2025-2026', strand: 'HUMSS' },
    { id: 'SEC003', name: 'Bonifacio', students: 40, adviser: 'Ms. Lisa Ramos', adviserId: 'T003', capacity: 45, gradeLevel: '11', schoolYear: '2025-2026', strand: 'HUMSS' },
    { id: 'SEC004', name: 'Aguinaldo', students: 40, adviser: 'Ms. Ana Garcia', adviserId: 'T004', capacity: 45, gradeLevel: '12', schoolYear: '2025-2026', strand: 'TVL' },
    { id: 'SEC005', name: 'Jacinto', students: 38, adviser: 'Mr. Pedro Reyes', adviserId: 'T005', capacity: 45, gradeLevel: '12', schoolYear: '2025-2026', strand: 'TVL' },
    { id: 'SEC006', name: 'Gomez', students: 36, adviser: 'Ms. Carmen Lopez', adviserId: 'T006', capacity: 45, gradeLevel: '11', schoolYear: '2025-2026', strand: 'TVL' },
    { id: 'SEC007', name: 'Luna', students: 42, adviser: 'Mr. Roberto Cruz', adviserId: 'T007', capacity: 45, gradeLevel: '12', schoolYear: '2025-2026', strand: 'HUMSS' },
    { id: 'SEC008', name: 'Del Pilar', students: 40, adviser: 'Ms. Sofia Martinez', adviserId: 'T008', capacity: 45, gradeLevel: '12', schoolYear: '2025-2026', strand: 'HUMSS' },
    { id: 'SEC009', name: 'Silang', students: 38, adviser: 'Mr. Carlos Mendoza', adviserId: 'T009', capacity: 45, gradeLevel: '11', schoolYear: '2025-2026', strand: 'HUMSS' },
    { id: 'SEC010', name: 'Burgos', students: 35, adviser: 'Mr. Jose Mendoza', adviserId: 'T010', capacity: 45, gradeLevel: '12', schoolYear: '2025-2026', strand: 'TVL' },
    { id: 'SEC011', name: 'Ponce', students: 32, adviser: 'Ms. Rosa Garcia', adviserId: 'T011', capacity: 45, gradeLevel: '12', schoolYear: '2025-2026', strand: 'TVL' },
    { id: 'SEC012', name: 'Lopez', students: 30, adviser: 'Mr. Mark Gonzales', adviserId: 'T012', capacity: 45, gradeLevel: '11', schoolYear: '2025-2026', strand: 'TVL' },
    
    // Grade 11 - SY 2025-2026 (Additional sections)
    { id: 'SEC013', name: 'Aquino', students: 35, adviser: '', adviserId: '', capacity: 45, gradeLevel: '11', schoolYear: '2025-2026', strand: 'HUMSS' },
    { id: 'SEC014', name: 'Osmeña', students: 28, adviser: 'Ms. Elena Reyes', adviserId: 'T013', capacity: 40, gradeLevel: '11', schoolYear: '2025-2026', strand: 'TVL' },
    { id: 'SEC015', name: 'Quezon', students: 30, adviser: '', adviserId: '', capacity: 45, gradeLevel: '11', schoolYear: '2025-2026', strand: 'HUMSS' },
    { id: 'SEC016', name: 'Laurel', students: 22, adviser: 'Mr. Antonio Santos', adviserId: 'T014', capacity: 40, gradeLevel: '11', schoolYear: '2025-2026', strand: 'TVL' },
    
    // Grade 12 - SY 2024-2025 (Previous year)
    { id: 'SEC017', name: 'Mabini', students: 45, adviser: 'Ms. Patricia Cruz', adviserId: 'T015', capacity: 45, gradeLevel: '12', schoolYear: '2024-2025', strand: 'HUMSS' },
    { id: 'SEC018', name: 'Rizal', students: 43, adviser: 'Ms. Maria Santos', adviserId: 'T001', capacity: 45, gradeLevel: '12', schoolYear: '2024-2025', strand: 'HUMSS' },
    { id: 'SEC019', name: 'Bonifacio', students: 44, adviser: 'Mr. Juan Dela Cruz', adviserId: 'T002', capacity: 45, gradeLevel: '12', schoolYear: '2024-2025', strand: 'TVL' },
    { id: 'SEC020', name: 'Luna', students: 42, adviser: 'Ms. Lisa Ramos', adviserId: 'T003', capacity: 45, gradeLevel: '12', schoolYear: '2024-2025', strand: 'HUMSS' },
    
    // Grade 11 - SY 2024-2025
    { id: 'SEC021', name: 'Aguinaldo', students: 40, adviser: 'Ms. Ana Garcia', adviserId: 'T004', capacity: 45, gradeLevel: '11', schoolYear: '2024-2025', strand: 'HUMSS' },
    { id: 'SEC022', name: 'Jacinto', students: 38, adviser: 'Mr. Pedro Reyes', adviserId: 'T005', capacity: 45, gradeLevel: '11', schoolYear: '2024-2025', strand: 'TVL' },
    
    // Grade 11 - SY 2026-2027 (Future year - newly created)
    { id: 'SEC023', name: 'Mabini', students: 0, adviser: '', adviserId: '', capacity: 45, gradeLevel: '11', schoolYear: '2026-2027', strand: 'HUMSS' },
    { id: 'SEC024', name: 'Rizal', students: 0, adviser: '', adviserId: '', capacity: 45, gradeLevel: '11', schoolYear: '2026-2027', strand: 'HUMSS' },
    { id: 'SEC025', name: 'Bonifacio', students: 0, adviser: '', adviserId: '', capacity: 40, gradeLevel: '11', schoolYear: '2026-2027', strand: 'TVL' },
    { id: 'SEC026', name: 'Luna', students: 0, adviser: '', adviserId: '', capacity: 40, gradeLevel: '11', schoolYear: '2026-2027', strand: 'HUMSS' },
    { id: 'SEC027', name: 'Burgos', students: 0, adviser: '', adviserId: '', capacity: 40, gradeLevel: '11', schoolYear: '2026-2027', strand: 'TVL' },
  ]);

  const students = [
    { id: 1, name: 'Juan Dela Cruz', lrn: '123456789012', gradeLevel: 12, sectionId: 'SEC001', gender: 'M' },
    { id: 2, name: 'Maria Clara', lrn: '123456789016', gradeLevel: 12, sectionId: 'SEC001', gender: 'F' },
    { id: 3, name: 'Jose Rizal Jr.', lrn: '123456789017', gradeLevel: 12, sectionId: 'SEC001', gender: 'M' },
    { id: 4, name: 'Ana Santos', lrn: '123456789018', gradeLevel: 12, sectionId: 'SEC001', gender: 'F' },
    { id: 5, name: 'Carlos Reyes', lrn: '123456789019', gradeLevel: 12, sectionId: 'SEC001', gender: 'M' },
    { id: 6, name: 'Isabella Garcia', lrn: '123456789020', gradeLevel: 12, sectionId: 'SEC001', gender: 'F' },
    { id: 7, name: 'Miguel Torres', lrn: '123456789021', gradeLevel: 12, sectionId: 'SEC001', gender: 'M' },
    { id: 8, name: 'Sofia Lopez', lrn: '123456789022', gradeLevel: 12, sectionId: 'SEC001', gender: 'F' },
  ];

  const resetForm = () => {
    setFormData({
      name: '',
      capacity: 45,
      gradeLevel: '11',
      schoolYear: '2025-2026',
      strand: 'HUMSS'
    });
  };

  const handleCreateSection = () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Section name is required');
      return;
    }
    if (formData.capacity < 1 || formData.capacity > 100) {
      toast.error('Capacity must be between 1 and 100');
      return;
    }

    // Check for duplicate section name in same strand
    const duplicate = sections.find(
      s => s.name.toLowerCase() === formData.name.toLowerCase() && 
           s.strand === formData.strand &&
           s.schoolYear === formData.schoolYear
    );
    if (duplicate) {
      toast.error(`Section "${formData.name}" already exists for ${formData.strand} in ${formData.schoolYear}`);
      return;
    }

    const newSection: SectionData = {
      id: `SEC${String(sections.length + 1).padStart(3, '0')}`,
      name: formData.name,
      students: 0,
      adviser: '',
      adviserId: '',
      capacity: formData.capacity,
      gradeLevel: formData.gradeLevel,
      schoolYear: formData.schoolYear,
      strand: formData.strand
    };

    setSections([...sections, newSection]);
    toast.success(`Section ${formData.strand}-${formData.name} created successfully!`);
    setIsCreateDialogOpen(false);
    resetForm();
  };

  const handleEditSection = () => {
    if (!editingSection) return;

    // Validation
    if (formData.capacity < editingSection.students) {
      toast.error(`Capacity cannot be less than current students (${editingSection.students})`);
      return;
    }

    setSections(sections.map(s => 
      s.id === editingSection.id 
        ? {
            ...s,
            capacity: formData.capacity,
            gradeLevel: formData.gradeLevel,
            schoolYear: formData.schoolYear
          }
        : s
    ));

    toast.success(`Section ${editingSection.strand}-${editingSection.name} updated successfully!`);
    setIsEditDialogOpen(false);
    setEditingSection(null);
    resetForm();
  };

  const handleDeleteSection = (section: SectionData) => {
    if (section.students > 0) {
      toast.error(`Cannot delete section with enrolled students. Please transfer ${section.students} students first.`);
      return;
    }

    setSections(sections.filter(s => s.id !== section.id));
    toast.success(`Section ${section.strand}-${section.name} deleted successfully!`);
  };

  const openEditDialog = (section: SectionData) => {
    setEditingSection(section);
    setFormData({
      name: section.name,
      capacity: section.capacity,
      gradeLevel: section.gradeLevel,
      schoolYear: section.schoolYear,
      strand: section.strand
    });
    setIsEditDialogOpen(true);
  };

  const getCapacityStatus = (students: number, capacity: number) => {
    const percentage = (students / capacity) * 100;
    if (percentage >= 100) return { color: 'text-red-600', status: 'FULL', badge: 'destructive' as const };
    if (percentage >= 90) return { color: 'text-orange-600', status: 'NEARLY FULL', badge: 'outline' as const };
    if (percentage >= 75) return { color: 'text-yellow-600', status: 'FILLING UP', badge: 'outline' as const };
    return { color: 'text-green-600', status: 'AVAILABLE', badge: 'outline' as const };
  };

  // Get unique section names for filter
  const uniqueSectionNames = Array.from(new Set(sections.map(s => s.name))).sort();

  const filteredSections = sections.filter(section => {
    const matchesStrand = !selectedStrand || section.strand === selectedStrand;
    const matchesSchoolYear = !selectedSchoolYear || section.schoolYear === selectedSchoolYear;
    const matchesGradeLevel = !selectedGradeLevel || section.gradeLevel === selectedGradeLevel;
    const matchesSectionName = !selectedSectionName || section.name === selectedSectionName;
    const matchesSearch = !searchQuery || 
      section.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.adviser.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStrand && matchesSchoolYear && matchesGradeLevel && matchesSectionName && matchesSearch;
  });

  const selectedSectionData = selectedSection 
    ? sections.find(s => s.id === selectedSection)
    : null;

  const filteredStudents = selectedSection
    ? students.filter(student => student.sectionId === selectedSection)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Section Management</h2>
          <p className="text-gray-600">Create and manage sections with capacity control</p>
        </div>
        <Button 
          onClick={() => navigate('/registrar/section-setup')}
          className="bg-[#2D5016] hover:bg-[#1D3010]"
        >
          <Settings className="w-4 h-4 mr-2" />
          Section Setup
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Sections</CardTitle>
          <CardDescription>Filter by strand or search sections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Strand</label>
              <Select 
                value={selectedStrand || 'all'} 
                onValueChange={(val) => setSelectedStrand(val === 'all' ? null : val as Strand)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Strands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Strands</SelectItem>
                  {strands.map((strand) => (
                    <SelectItem key={strand.name} value={strand.name}>
                      {strand.name} - {strand.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">School Year</label>
              <Select 
                value={selectedSchoolYear || 'all'} 
                onValueChange={(val) => setSelectedSchoolYear(val === 'all' ? null : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All School Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All School Years</SelectItem>
                  {schoolYears.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Grade Level</label>
              <Select 
                value={selectedGradeLevel || 'all'} 
                onValueChange={(val) => setSelectedGradeLevel(val === 'all' ? null : val as '11' | '12')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Grade Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grade Levels</SelectItem>
                  <SelectItem value="11">Grade 11</SelectItem>
                  <SelectItem value="12">Grade 12</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Section Name</label>
              <Select 
                value={selectedSectionName || 'all'} 
                onValueChange={(val) => setSelectedSectionName(val === 'all' ? null : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Section Names" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Section Names</SelectItem>
                  {uniqueSectionNames.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search by section name or adviser..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#8B1538]" />
                All Sections
              </CardTitle>
              <CardDescription>
                {selectedStrand ? `${selectedStrand} Sections` : 'All Strands'} • SY 2025-2026
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              {filteredSections.length} Sections
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Section Name</TableHead>
                <TableHead>Strand</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Adviser</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>School Year</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSections.length > 0 ? (
                filteredSections.map((section) => {
                  const capacityInfo = getCapacityStatus(section.students, section.capacity);
                  const isFull = section.students >= section.capacity;
                  
                  return (
                    <TableRow key={section.id} className={isFull ? 'bg-red-50' : ''}>
                      <TableCell className="font-semibold">
                        {section.strand}-{section.name}
                        {isFull && (
                          <Badge variant="destructive" className="ml-2 text-xs">FULL</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{section.strand}</Badge>
                      </TableCell>
                      <TableCell>Grade {section.gradeLevel}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-gray-500" />
                        {section.adviser || <span className="text-gray-400 italic">Unassigned</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${capacityInfo.color}`}>
                            {section.students}/{section.capacity}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({Math.round((section.students / section.capacity) * 100)}%)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={capacityInfo.badge} className={capacityInfo.color}>
                          {capacityInfo.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Calendar className="w-3 h-3" />
                          {section.schoolYear}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedSection(section.id)}
                          >
                            <Users className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openEditDialog(section)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteSection(section)}
                            disabled={section.students > 0}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No sections found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Section Details View */}
      {selectedSectionData && (
        <div className="space-y-4">
          {/* Section Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Section</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#8B1538]">
                  {selectedSectionData.strand} - {selectedSectionData.name}
                </div>
                <p className="text-sm text-gray-500 mt-1">Grade {selectedSectionData.gradeLevel}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Class Adviser</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-gray-900">
                  {selectedSectionData.adviser || <span className="text-gray-400 italic">Unassigned</span>}
                </div>
                {!selectedSectionData.adviser && (
                  <p className="text-xs text-gray-500 mt-1">Awaiting Principal assignment</p>
                )}
              </CardContent>
            </Card>

            <Card className={selectedSectionData.students >= selectedSectionData.capacity ? 'border-red-300 bg-red-50' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Enrollment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {selectedSectionData.students}/{selectedSectionData.capacity}
                </div>
                {selectedSectionData.students >= selectedSectionData.capacity && (
                  <Alert className="mt-2 bg-red-100 border-red-300">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 text-xs">
                      Section is at full capacity
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Available Slots</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#2D5016]">
                  {Math.max(0, selectedSectionData.capacity - selectedSectionData.students)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round((selectedSectionData.students / selectedSectionData.capacity) * 100)}% filled
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Student Roster */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#8B1538]" />
                    Student Roster
                  </CardTitle>
                  <CardDescription>
                    {selectedSectionData.strand} - {selectedSectionData.name} • SY {selectedSectionData.schoolYear}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedSection(null)}
                  >
                    Close View
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>LRN</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-center">Gender</TableHead>
                    <TableHead className="text-center">Grade Level</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student, index) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell className="font-mono text-sm">{student.lrn}</TableCell>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={student.gender === 'M' ? 'bg-blue-50' : 'bg-pink-50'}>
                            {student.gender === 'M' ? 'Male' : 'Female'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{student.gradeLevel}</TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="sm">
                            <UserCircle className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No students enrolled in this section
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Section Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Section</DialogTitle>
            <DialogDescription>
              Add a new section with capacity limits and adviser assignment
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Strand <span className="text-red-600">*</span></Label>
              <Select value={formData.strand} onValueChange={(val) => setFormData({...formData, strand: val as Strand})}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {strands.map((strand) => (
                    <SelectItem key={strand.name} value={strand.name}>
                      {strand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Section Name <span className="text-red-600">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Mabini, Rizal"
                className="mt-2"
              />
            </div>

            <div>
              <Label>Grade Level <span className="text-red-600">*</span></Label>
              <Select value={formData.gradeLevel} onValueChange={(val) => setFormData({...formData, gradeLevel: val as '11' | '12'})}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="11">Grade 11</SelectItem>
                  <SelectItem value="12">Grade 12</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>School Year <span className="text-red-600">*</span></Label>
              <Select value={formData.schoolYear} onValueChange={(val) => setFormData({...formData, schoolYear: val})}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Capacity <span className="text-red-600">*</span></Label>
              <Input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value) || 0})}
                min="1"
                max="100"
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum students allowed (1-100)</p>
            </div>
          </div>

          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-900">
              <strong>Note:</strong> Section adviser will be assigned by the Principal after section creation. Once created, section name cannot be changed.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSection} className="bg-[#2D5016] hover:bg-[#1f3810]">
              <Plus className="w-4 h-4 mr-2" />
              Create Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Section Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Section - {editingSection?.strand}-{editingSection?.name}</DialogTitle>
            <DialogDescription>
              Update section capacity, grade level, and school year
            </DialogDescription>
          </DialogHeader>

          {editingSection && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Current enrollment: <strong>{editingSection.students} students</strong>. 
                  Capacity cannot be reduced below current enrollment.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Capacity <span className="text-red-600">*</span></Label>
                  <Input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value) || 0})}
                    min={editingSection.students}
                    max="100"
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum: {editingSection.students} (current students)
                  </p>
                </div>

                <div>
                  <Label>Grade Level <span className="text-red-600">*</span></Label>
                  <Select value={formData.gradeLevel} onValueChange={(val) => setFormData({...formData, gradeLevel: val as '11' | '12'})}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="11">Grade 11</SelectItem>
                      <SelectItem value="12">Grade 12</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>School Year <span className="text-red-600">*</span></Label>
                  <Select value={formData.schoolYear} onValueChange={(val) => setFormData({...formData, schoolYear: val})}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolYears.map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-900">
                  <strong>Note:</strong> Section adviser assignment is managed by the Principal.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSection} className="bg-[#8B1538] hover:bg-[#6c102c]">
              <CheckCircle className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}