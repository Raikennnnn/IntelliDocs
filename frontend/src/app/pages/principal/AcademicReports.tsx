import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { FileText, Search, TrendingUp, Users, Download, FileSpreadsheet } from 'lucide-react';
import { mockStrands, mockSectionsWithAssignments, mockStudentGrades, mockAcademicReportsData } from '../../data/mockData';
import { toast } from 'sonner';

export function AcademicReports() {
  const [selectedStrand, setSelectedStrand] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('all');
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('2025-2026');
  const [selectedSemester, setSelectedSemester] = useState<string>('1st Semester');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleExportPDF = () => {
    toast.success('Academic report exported to PDF successfully!', {
      description: `${selectedStrand} - ${selectedSection} • ${selectedSchoolYear} • ${selectedSemester}`
    });
  };

  const handleExportExcel = () => {
    toast.success('Academic report exported to Excel successfully!', {
      description: `${selectedStrand} - ${selectedSection} • ${selectedSchoolYear} • ${selectedSemester}`
    });
  };

  // Get sections for selected strand
  const getAvailableSections = () => {
    if (!selectedStrand) return [];
    const strand = mockStrands.find(s => s.name === selectedStrand);
    return strand?.sections || [];
  };

  // Get students for selected section
  const getStudentsForSection = () => {
    if (!selectedStrand || !selectedSection) return [];
    const sectionKey = `${selectedStrand} ${mockSectionsWithAssignments.find(s => 
      s.strand === selectedStrand && s.name.includes(selectedSection)
    )?.gradeLevel}-${selectedSection}`;
    
    // Combine main student grades with additional academic reports data
    const allStudents = [...mockStudentGrades, ...mockAcademicReportsData];
    
    return allStudents.filter((student) => {
      const matchesSection = student.section.includes(selectedSection || '');
      const matchesSearch = !searchQuery || 
        student.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.lrn.includes(searchQuery);
      const matchesGender = selectedGender === 'all' || student.gender === selectedGender;
      const matchesGradeLevel = selectedGradeLevel === 'all' || student.gradeLevel === selectedGradeLevel;
      return matchesSection && matchesSearch && matchesGender && matchesGradeLevel;
    });
  };

  const students = getStudentsForSection();
  const sectionInfo = selectedStrand && selectedSection 
    ? mockSectionsWithAssignments.find(s => s.strand === selectedStrand && s.name.includes(selectedSection))
    : null;

  // Calculate average grade for section
  const calculateSectionAverage = () => {
    if (students.length === 0) return 0;
    const total = students.reduce((sum, student) => {
      const subjectAvg = student.subjects.reduce((s, sub) => s + (sub.final || 0), 0) / student.subjects.length;
      return sum + subjectAvg;
    }, 0);
    return (total / students.length).toFixed(2);
  };

  const passingRate = students.length > 0 
    ? ((students.filter(s => s.overallAverage >= 75).length / students.length) * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Academic Reports</h2>
        <p className="text-gray-600">View student academic performance by strand and section</p>
      </div>

      {/* Selection Filters - Dropdown Style */}
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>Choose filters to view academic performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Row 1: School Year and Semester */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* School Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">School Year</label>
                <Select value={selectedSchoolYear} onValueChange={setSelectedSchoolYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-2025">SY 2024-2025</SelectItem>
                    <SelectItem value="2025-2026">SY 2025-2026</SelectItem>
                    <SelectItem value="2026-2027">SY 2026-2027</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Semester */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1st Semester">1st Semester</SelectItem>
                    <SelectItem value="2nd Semester">2nd Semester</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Strand and Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              {/* Strand Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Strand</label>
                <Select 
                  value={selectedStrand || ''} 
                  onValueChange={(val) => {
                    setSelectedStrand(val);
                    setSelectedSection(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Strand" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockStrands.map((strand) => (
                      <SelectItem key={strand.name} value={strand.name}>
                        {strand.name} - {strand.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Section Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                <Select 
                  value={selectedSection || ''} 
                  onValueChange={setSelectedSection}
                  disabled={!selectedStrand}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedStrand ? "Select Section" : "Select Strand first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableSections().map((section) => (
                      <SelectItem key={section} value={section}>
                        {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Gender and Grade Level Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              {/* Gender Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Gender</label>
                <Select value={selectedGender} onValueChange={setSelectedGender}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Students</SelectItem>
                    <SelectItem value="Male">Boys Only</SelectItem>
                    <SelectItem value="Female">Girls Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Grade Level Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Grade Level</label>
                <Select value={selectedGradeLevel} onValueChange={setSelectedGradeLevel}>
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
          </div>
        </CardContent>
      </Card>

      {/* Section Statistics */}
      {selectedStrand && selectedSection && sectionInfo && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Section</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#8B1538]">{sectionInfo.name}</div>
              <p className="text-sm text-gray-500 mt-1">{sectionInfo.adviser}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{students.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Section Average</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#2D5016]">{calculateSectionAverage()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Passing Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{passingRate}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Student Grades Table */}
      {selectedStrand && selectedSection && students.length > 0 && (
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#8B1538]" />
                  Student Academic Performance
                </CardTitle>
                <CardDescription className="mt-1">
                  {selectedStrand} - {selectedSection} • {selectedSchoolYear} • {selectedSemester} (View Only)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {students.length} {students.length === 1 ? 'Student' : 'Students'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  className="gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>LRN</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead className="text-center">Grade Level</TableHead>
                  <TableHead className="text-center">Overall Average</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student, index) => (
                  <TableRow key={student.studentId}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{student.lrn}</TableCell>
                    <TableCell className="font-medium">{student.studentName}</TableCell>
                    <TableCell className="text-center">Grade {student.gradeLevel}</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="outline"
                        className={student.overallAverage >= 90 ? 'bg-green-50 border-green-500' : 
                                  student.overallAverage >= 85 ? 'bg-blue-50 border-blue-500' : 
                                  student.overallAverage >= 75 ? 'bg-yellow-50 border-yellow-500' : 
                                  'bg-red-50 border-red-500'}
                      >
                        {student.overallAverage.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={student.overallAverage >= 75 ? 'bg-[#2D5016]' : 'bg-red-600'}>
                        {student.overallAverage >= 75 ? 'Passed' : 'Failed'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSelectedStudent(student);
                          setIsDialogOpen(true);
                        }}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!selectedStrand && (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">Select a strand and section to view academic reports</p>
            <p className="text-sm text-gray-500 mt-1">Use the dropdown menus above to get started</p>
          </CardContent>
        </Card>
      )}

      {selectedStrand && selectedSection && students.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">No student records found for this section</p>
          </CardContent>
        </Card>
      )}

      {/* Student Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedStudent && (
            <>
              <DialogHeader>
                <DialogTitle>Academic Record - {selectedStudent.studentName}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Student Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">LRN</p>
                    <p className="font-semibold">{selectedStudent.lrn}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Section</p>
                    <p className="font-semibold">{selectedStudent.section}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Grade Level</p>
                    <p className="font-semibold">Grade {selectedStudent.gradeLevel}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Gender</p>
                    <p className="font-semibold">{selectedStudent.gender}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Overall Average</p>
                    <p className="font-semibold text-xl text-[#2D5016]">{selectedStudent.overallAverage.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Academic Status</p>
                    <Badge className={selectedStudent.overallAverage >= 75 ? 'bg-[#2D5016]' : 'bg-red-600'}>
                      {selectedStudent.overallAverage >= 75 ? 'Passed' : 'Failed'}
                    </Badge>
                  </div>
                </div>

                {/* Subject Grades */}
                <div>
                  <h3 className="font-semibold mb-3 text-lg">Subject Grades - {selectedSchoolYear} • {selectedSemester}</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">Subject</TableHead>
                          <TableHead className="text-center font-semibold">Q1</TableHead>
                          <TableHead className="text-center font-semibold">Q2</TableHead>
                          <TableHead className="text-center font-semibold">Q3</TableHead>
                          <TableHead className="text-center font-semibold">Q4</TableHead>
                          <TableHead className="text-center font-semibold">Final</TableHead>
                          <TableHead className="text-center font-semibold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedStudent.subjects.map((subject: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{subject.subject}</TableCell>
                            <TableCell className="text-center">{subject.q1}</TableCell>
                            <TableCell className="text-center">{subject.q2}</TableCell>
                            <TableCell className="text-center">{subject.q3}</TableCell>
                            <TableCell className="text-center">{subject.q4}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="font-semibold">{subject.final}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={subject.status === 'Passed' ? 'bg-[#2D5016]' : 'bg-red-600'}>
                                {subject.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}