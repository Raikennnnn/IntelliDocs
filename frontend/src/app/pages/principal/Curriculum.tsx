import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { BookOpen, Plus, Edit, Trash2, Calendar, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Fragment } from 'react';

type Strand = 'HUMSS' | 'TVL';

type SchoolYear = {
  id: number;
  year: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
};

export function Curriculum() {
  const [selectedStrand, setSelectedStrand] = useState<Strand>('HUMSS');
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('2025-2026');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddYearOpen, setIsAddYearOpen] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: '', units: '', quarter: '', gradeLevel: '11' });
  const [newYear, setNewYear] = useState({ year: '', startDate: '', endDate: '' });
  
  const [schoolYearsList, setSchoolYearsList] = useState<SchoolYear[]>([
    { id: 1, year: '2024-2025', isActive: false, startDate: 'August 2024', endDate: 'May 2025' },
    { id: 2, year: '2025-2026', isActive: true, startDate: 'August 2025', endDate: 'May 2026' },
    { id: 3, year: '2026-2027', isActive: false, startDate: 'August 2026', endDate: 'May 2027' }
  ]);

  const schoolYears = schoolYearsList.map(sy => sy.year);

  const curriculumData: Record<Strand, Record<string, any[]>> = {
    HUMSS: {
      '11': [
        { id: 11, name: 'Oral Communication', units: 2, quarter: '1st Quarter' },
        { id: 12, name: 'General Mathematics', units: 3, quarter: '1st Quarter' },
        { id: 13, name: 'Earth and Life Science', units: 3, quarter: '1st Quarter' },
        { id: 14, name: 'Introduction to World Religions', units: 3, quarter: '1st Quarter' },
        { id: 15, name: 'Creative Writing', units: 3, quarter: '2nd Quarter' },
        { id: 16, name: 'Philippine Politics and Governance', units: 3, quarter: '2nd Quarter' }
      ],
      '12': [
        { id: 17, name: 'Disciplines and Ideas in Social Sciences', units: 3, quarter: '1st Quarter' },
        { id: 18, name: 'Trends, Networks, and Critical Thinking', units: 3, quarter: '2nd Quarter' }
      ]
    },
    TVL: {
      '11': [
        { id: 19, name: 'Oral Communication', units: 2, quarter: '1st Quarter' },
        { id: 20, name: 'General Mathematics', units: 3, quarter: '1st Quarter' },
        { id: 21, name: 'Earth and Life Science', units: 3, quarter: '1st Quarter' },
        { id: 22, name: 'Entrepreneurship', units: 3, quarter: '1st Quarter' },
        { id: 23, name: 'Technical Writing', units: 2, quarter: '2nd Quarter' },
        { id: 24, name: 'Computer Programming', units: 3, quarter: '2nd Quarter' }
      ],
      '12': [
        { id: 25, name: 'Empowerment Technologies', units: 3, quarter: '1st Quarter' },
        { id: 26, name: 'Practical Research', units: 3, quarter: '2nd Quarter' }
      ]
    }
  };

  // Get all subjects for both grades organized by semester
  const getAllSubjects = () => {
    const grade11 = curriculumData[selectedStrand]['11'] || [];
    const grade12 = curriculumData[selectedStrand]['12'] || [];
    
    return [
      { grade: '11', quarter: '1st Quarter', subjects: grade11.filter(s => s.quarter === '1st Quarter') },
      { grade: '11', quarter: '2nd Quarter', subjects: grade11.filter(s => s.quarter === '2nd Quarter') },
      { grade: '12', quarter: '1st Quarter', subjects: grade12.filter(s => s.quarter === '1st Quarter') },
      { grade: '12', quarter: '2nd Quarter', subjects: grade12.filter(s => s.quarter === '2nd Quarter') }
    ];
  };

  const allSubjects = getAllSubjects();
  const totalSubjects = [...(curriculumData[selectedStrand]['11'] || []), ...(curriculumData[selectedStrand]['12'] || [])].length;

  const handleAddSubject = () => {
    if (!newSubject.name || !newSubject.units || !newSubject.quarter || !newSubject.gradeLevel) {
      toast.error('Please fill in all fields');
      return;
    }
    toast.success('Subject added successfully!');
    setIsAddOpen(false);
    setNewSubject({ name: '', units: '', quarter: '', gradeLevel: '11' });
  };

  const handleAddYear = () => {
    if (!newYear.year || !newYear.startDate || !newYear.endDate) {
      toast.error('Please fill in all fields');
      return;
    }
    const newId = schoolYearsList.length + 1;
    const newSchoolYear: SchoolYear = {
      id: newId,
      year: newYear.year,
      isActive: false,
      startDate: newYear.startDate,
      endDate: newYear.endDate
    };
    setSchoolYearsList([...schoolYearsList, newSchoolYear]);
    toast.success('School year added successfully!');
    setIsAddYearOpen(false);
    setNewYear({ year: '', startDate: '', endDate: '' });
  };

  const handleSetActiveYear = (id: number) => {
    setSchoolYearsList(schoolYearsList.map(sy => ({
      ...sy,
      isActive: sy.id === id
    })));
    toast.success('Active school year updated!');
  };

  const handleDeleteYear = (id: number) => {
    const year = schoolYearsList.find(sy => sy.id === id);
    if (year?.isActive) {
      toast.error('Cannot delete the active school year!');
      return;
    }
    setSchoolYearsList(schoolYearsList.filter(sy => sy.id !== id));
    toast.success('School year deleted successfully!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Curriculum Management</h2>
        <p className="text-gray-600">Manage school years, view and organize curriculum per strand and grade level</p>
      </div>

      {/* School Year Management */}
      <Card className="border-2 border-[#2D5016]">
        <CardHeader className="bg-green-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-[#2D5016]" />
              <div>
                <CardTitle className="text-[#2D5016]">School Year Management</CardTitle>
                <CardDescription className="mt-1">
                  Add, edit, and manage school years
                </CardDescription>
              </div>
            </div>
            <Dialog open={isAddYearOpen} onOpenChange={setIsAddYearOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#2D5016] hover:bg-[#1D3010]">
                  <Plus className="w-4 h-4 mr-2" />
                  Add School Year
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New School Year</DialogTitle>
                  <DialogDescription>
                    Create a new school year for the system
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>School Year</Label>
                    <Input
                      placeholder="e.g., 2027-2028"
                      value={newYear.year}
                      onChange={(e) => setNewYear({ ...newYear, year: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      placeholder="e.g., August 2027"
                      value={newYear.startDate}
                      onChange={(e) => setNewYear({ ...newYear, startDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      placeholder="e.g., May 2028"
                      value={newYear.endDate}
                      onChange={(e) => setNewYear({ ...newYear, endDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddYearOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddYear} className="bg-[#2D5016] hover:bg-[#1D3010]">
                    Add School Year
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School Year</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schoolYearsList.map((year) => (
                <TableRow key={year.id}>
                  <TableCell className="font-medium">{year.year}</TableCell>
                  <TableCell>{year.startDate}</TableCell>
                  <TableCell>{year.endDate}</TableCell>
                  <TableCell>
                    {year.isActive ? (
                      <Badge className="bg-[#2D5016]">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {!year.isActive && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSetActiveYear(year.id)}
                          className="text-[#2D5016] border-[#2D5016] hover:bg-green-50"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Set Active
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteYear(year.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Select Strand & School Year</CardTitle>
          <CardDescription>Choose strand and school year to view complete curriculum for Grade 11 and 12</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Strand</Label>
              <Select value={selectedStrand} onValueChange={(value) => setSelectedStrand(value as Strand)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Strand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HUMSS">HUMSS - Humanities and Social Sciences</SelectItem>
                  <SelectItem value="TVL">TVL - Technical-Vocational-Livelihood</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>School Year</Label>
              <Select value={selectedSchoolYear} onValueChange={setSelectedSchoolYear}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select School Year" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Selection Summary */}
      <Card className="border-2 border-[#8B1538]">
        <CardHeader className="bg-red-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-[#8B1538]" />
              <div>
                <CardTitle className="text-[#8B1538]">
                  {selectedStrand} - Complete Curriculum
                </CardTitle>
                <CardDescription className="mt-1">
                  {totalSubjects} subjects across Grade 11 and 12
                </CardDescription>
              </div>
            </div>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#2D5016] hover:bg-[#1D3010]">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Subject
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Subject</DialogTitle>
                  <DialogDescription>
                    Add a new subject to {selectedStrand} curriculum
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Grade Level</Label>
                    <Select value={newSubject.gradeLevel} onValueChange={(value) => setNewSubject({ ...newSubject, gradeLevel: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select grade level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="11">Grade 11</SelectItem>
                        <SelectItem value="12">Grade 12</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Subject Name</Label>
                    <Input
                      placeholder="e.g., Philippine History"
                      value={newSubject.name}
                      onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Units</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 3"
                      value={newSubject.units}
                      onChange={(e) => setNewSubject({ ...newSubject, units: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Quarter</Label>
                    <Select value={newSubject.quarter} onValueChange={(value) => setNewSubject({ ...newSubject, quarter: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select quarter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1st Quarter">1st Quarter</SelectItem>
                        <SelectItem value="2nd Quarter">2nd Quarter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddSubject} className="bg-[#2D5016] hover:bg-[#1D3010]">
                    Add Subject
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Subjects Table */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Subject List</CardTitle>
          <CardDescription>
            All curriculum subjects for {selectedStrand} - Grade 11 & 12
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Grade 11 */}
            <Card className="border-2 border-[#8B1538]">
              <CardHeader className="bg-red-50">
                <CardTitle className="text-[#8B1538] flex items-center gap-2">
                  <Badge className="bg-[#8B1538] text-lg px-3 py-1">Grade 11</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {/* 1st Quarter */}
                <div>
                  <div className="mb-3">
                    <h4 className="text-base font-semibold text-gray-700">1st Quarter</h4>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject Name</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(curriculumData[selectedStrand]['11'] || [])
                        .filter(s => s.quarter === '1st Quarter')
                        .map((subject) => (
                          <TableRow key={subject.id}>
                            <TableCell className="font-medium">{subject.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm">
                                  <Edit className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>

                {/* 2nd Quarter */}
                <div>
                  <div className="mb-3">
                    <h4 className="text-base font-semibold text-gray-700">2nd Quarter</h4>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject Name</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(curriculumData[selectedStrand]['11'] || [])
                        .filter(s => s.quarter === '2nd Quarter')
                        .map((subject) => (
                          <TableRow key={subject.id}>
                            <TableCell className="font-medium">{subject.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm">
                                  <Edit className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Grade 12 */}
            <Card className="border-2 border-[#2D5016]">
              <CardHeader className="bg-green-50">
                <CardTitle className="text-[#2D5016] flex items-center gap-2">
                  <Badge className="bg-[#2D5016] text-lg px-3 py-1">Grade 12</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {/* 1st Quarter */}
                <div>
                  <div className="mb-3">
                    <h4 className="text-base font-semibold text-gray-700">1st Quarter</h4>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject Name</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(curriculumData[selectedStrand]['12'] || [])
                        .filter(s => s.quarter === '1st Quarter')
                        .map((subject) => (
                          <TableRow key={subject.id}>
                            <TableCell className="font-medium">{subject.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm">
                                  <Edit className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>

                {/* 2nd Quarter */}
                <div>
                  <div className="mb-3">
                    <h4 className="text-base font-semibold text-gray-700">2nd Quarter</h4>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject Name</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(curriculumData[selectedStrand]['12'] || [])
                        .filter(s => s.quarter === '2nd Quarter')
                        .map((subject) => (
                          <TableRow key={subject.id}>
                            <TableCell className="font-medium">{subject.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm">
                                  <Edit className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}