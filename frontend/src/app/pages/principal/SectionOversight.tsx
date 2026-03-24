import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Edit, UserPlus, BookOpen, UserCheck, Search, Users as UsersIcon, GraduationCap } from 'lucide-react';
import { mockSectionsWithAssignments, mockTeachers, mockStrands } from '../../data/mockData';
import { toast } from 'sonner';

export function SectionOversight() {
  const [sections, setSections] = useState(mockSectionsWithAssignments);
  const [editingSection, setEditingSection] = useState<any>(null);
  const [selectedAdviser, setSelectedAdviser] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterStrand, setFilterStrand] = useState<string>('all');
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Subject Assignment States
  const [isSubjectAssignOpen, setIsSubjectAssignOpen] = useState(false);
  const [assignGradeLevel, setAssignGradeLevel] = useState<string>('');
  const [assignSection, setAssignSection] = useState<string>('');
  const [assignSubject, setAssignSubject] = useState<string>('');
  const [assignTeacher, setAssignTeacher] = useState<string>('');
  const [assignSubTeacher, setAssignSubTeacher] = useState<string>('none');
  const [assignAdviser, setAssignAdviser] = useState<string>('none');

  // Get available subjects for selected section
  const getAvailableSubjects = () => {
    if (!assignSection) return [];
    const section = sections.find(s => s.name === assignSection);
    return section?.subjectTeachers.map((st: any) => st.subject) || [];
  };

  // Get sections for selected grade level
  const getSectionsForGrade = () => {
    if (!assignGradeLevel) return [];
    return sections.filter(s => s.gradeLevel === assignGradeLevel);
  };

  const handleAssignSubjectTeacher = () => {
    if (!assignGradeLevel || !assignSection || !assignSubject || !assignTeacher) {
      toast.error('Please fill in all fields');
      return;
    }

    const teacher = mockTeachers.find(t => t.id === assignTeacher);
    if (!teacher) return;

    setSections((prev) =>
      prev.map((section) => {
        if (section.name === assignSection) {
          const updatedSubjectTeachers = section.subjectTeachers.map((st: any) =>
            st.subject === assignSubject ? { ...st, teacher: teacher.name } : st
          );
          return { ...section, subjectTeachers: updatedSubjectTeachers };
        }
        return section;
      })
    );

    toast.success(`${teacher.name} assigned to ${assignSubject} in ${assignSection}`);
    
    // Reset form
    setIsSubjectAssignOpen(false);
    setAssignGradeLevel('');
    setAssignSection('');
    setAssignSubject('');
    setAssignTeacher('');
    setAssignSubTeacher('none');
    setAssignAdviser('none');
  };

  const handleAssignAdviser = (sectionId: string) => {
    if (!selectedAdviser) {
      toast.error('Please select an adviser');
      return;
    }

    const teacher = mockTeachers.find((t) => t.id === selectedAdviser);
    if (!teacher) return;

    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, adviser: teacher.name, adviserId: teacher.id }
          : section
      )
    );

    toast.success(`${teacher.name} assigned as adviser to ${editingSection?.name}`);
    setIsDialogOpen(false);
    setSelectedAdviser('');
  };

  // Filter sections
  const filteredSections = sections.filter(section => {
    const matchesStrand = filterStrand === 'all' || section.strand === filterStrand;
    const matchesGrade = filterGradeLevel === 'all' || section.gradeLevel === filterGradeLevel;
    const matchesSearch = !searchQuery || 
      section.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.adviser.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.room.toLowerCase().includes(searchQuery.toLowerCase());
    const isAllowedStrand = section.strand === 'HUMSS' || section.strand === 'TVL';
    return matchesStrand && matchesGrade && matchesSearch && isAllowedStrand;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Section Oversight</h2>
        <p className="text-gray-600">Manage academic assignments: Sections, Subjects, and Advisories</p>
      </div>

      {/* Filter Card */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Sections</CardTitle>
          <CardDescription>Search and filter sections by strand and grade level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Section</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by section name, adviser, or room..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                />
              </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              {/* Strand Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Strand</label>
                <Select value={filterStrand} onValueChange={setFilterStrand}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Strands</SelectItem>
                    <SelectItem value="HUMSS">HUMSS</SelectItem>
                    <SelectItem value="TVL">TVL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Grade Level Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Grade Level</label>
                <Select value={filterGradeLevel} onValueChange={setFilterGradeLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    <SelectItem value="11">Grade 11</SelectItem>
                    <SelectItem value="12">Grade 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reset Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setFilterStrand('all');
                  setFilterGradeLevel('all');
                }}
              >
                Reset All Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Sections</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#8B1538]">{filteredSections.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">
              {filteredSections.reduce((sum, s) => sum + s.studentCount, 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Teachers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#2D5016]">{mockTeachers.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Advisers Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">
              {mockTeachers.filter((t) => t.isAdviser).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sections Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#8B1538]" />
                Section Assignments
              </CardTitle>
              <CardDescription>Manage section advisers and subject teacher assignments</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                {filteredSections.length} Sections
              </Badge>
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsSubjectAssignOpen(true)}
                className="bg-[#8B1538] hover:bg-[#6B1028]"
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                Assign Subject Teacher
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Section Name</TableHead>
                <TableHead>Strand</TableHead>
                <TableHead className="text-center">Grade</TableHead>
                <TableHead>Room</TableHead>
                <TableHead className="text-center">Capacity</TableHead>
                <TableHead>Adviser</TableHead>
                <TableHead className="text-center">Subject Teachers</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSections.length > 0 ? (
                filteredSections.map((section, index) => {
                  const capacity = section.capacity || 40; // Default capacity
                  const utilized = section.studentCount;
                  const utilization = Math.round((utilized / capacity) * 100);
                  const isNearCapacity = utilization >= 90;
                  const isFull = utilization >= 100;

                  return (
                    <TableRow key={section.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-semibold">{section.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{section.strand}</Badge>
                      </TableCell>
                      <TableCell className="text-center">Grade {section.gradeLevel}</TableCell>
                      <TableCell>{section.room}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge 
                            variant="outline" 
                            className={
                              isFull ? 'bg-red-50 border-red-500 text-red-700' :
                              isNearCapacity ? 'bg-orange-50 border-orange-500 text-orange-700' :
                              'bg-blue-50 border-blue-500'
                            }
                          >
                            {utilized}/{capacity}
                          </Badge>
                          <span className={`text-xs font-medium ${
                            isFull ? 'text-red-600' :
                            isNearCapacity ? 'text-orange-600' :
                            'text-gray-500'
                          }`}>
                            {utilization}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-[#2D5016]" />
                          <span className="text-sm">{section.adviser}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <UsersIcon className="w-4 h-4 mr-1" />
                              {section.subjectTeachers.length}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Subject Teachers - {section.name}</DialogTitle>
                              <DialogDescription>
                                Teachers assigned to subjects in this section
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Teacher</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {section.subjectTeachers.map((st: any, idx: number) => (
                                    <TableRow key={idx}>
                                      <TableCell className="font-medium">{st.subject}</TableCell>
                                      <TableCell>{st.teacher}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                      <TableCell className="text-center">
                        <Dialog open={isDialogOpen && editingSection?.id === section.id} onOpenChange={setIsDialogOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setEditingSection(section);
                                setSelectedAdviser(section.adviserId || '');
                              }}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Reassign
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reassign Adviser - {section.name}</DialogTitle>
                              <DialogDescription>
                                Assign or change the class adviser
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-4 py-4">
                              <div>
                                <Label className="text-sm font-medium">Current Adviser</Label>
                                <p className="text-sm text-gray-600 mt-1">{section.adviser}</p>
                              </div>

                              <div>
                                <Label className="text-sm font-medium mb-2 block">Select New Adviser</Label>
                                <Select value={selectedAdviser} onValueChange={setSelectedAdviser}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose a teacher" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {mockTeachers.map((teacher) => (
                                      <SelectItem key={teacher.id} value={teacher.id}>
                                        {teacher.name} - {teacher.department}
                                        {teacher.isAdviser && ' (Currently an Adviser)'}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <DialogFooter>
                              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button 
                                onClick={() => handleAssignAdviser(section.id)}
                                className="bg-[#8B1538] hover:bg-[#6B1028]"
                              >
                                <UserPlus className="w-4 h-4 mr-2" />
                                Reassign Adviser
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No sections found matching your filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Subject Assignment Dialog */}
      <Dialog open={isSubjectAssignOpen} onOpenChange={setIsSubjectAssignOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Subject Teacher</DialogTitle>
            <DialogDescription>
              Assign a teacher to a subject in a section
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">Grade Level</Label>
              <Select value={assignGradeLevel} onValueChange={setAssignGradeLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a grade level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="11">Grade 11</SelectItem>
                  <SelectItem value="12">Grade 12</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Section</Label>
              <Select value={assignSection} onValueChange={setAssignSection}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a section" />
                </SelectTrigger>
                <SelectContent>
                  {getSectionsForGrade().map((section) => (
                    <SelectItem key={section.name} value={section.name}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Subject</Label>
              <Select value={assignSubject} onValueChange={setAssignSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableSubjects().map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Teacher</Label>
              <Select value={assignTeacher} onValueChange={setAssignTeacher}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {mockTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Sub Teacher (Optional)</Label>
              <Select value={assignSubTeacher} onValueChange={setAssignSubTeacher}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a sub teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {mockTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Adviser (Optional)</Label>
              <Select value={assignAdviser} onValueChange={setAssignAdviser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an adviser" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {mockTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubjectAssignOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssignSubjectTeacher}
              className="bg-[#8B1538] hover:bg-[#6B1028]"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Assign Teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}