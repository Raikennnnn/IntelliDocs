import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Search, FileText, CheckCircle2, XCircle, Eye, User, BookOpen, Upload, ClipboardCheck, Users, Calendar, Mail, Phone, MapPin, CheckCircle } from 'lucide-react';
import { mockStudentDocuments, mockStrands } from '../../data/mockData';

type StudentTab = {
  id: string;
  label: string;
  icon: React.ElementType;
};

const studentTabs: StudentTab[] = [
  { id: 'personal', label: 'Personal Information', icon: User },
  { id: 'academic', label: 'Academic Background', icon: BookOpen },
  { id: 'requirements', label: 'Requirements Upload', icon: Upload },
  { id: 'review', label: 'Review & Submit', icon: ClipboardCheck }
];

export function PrincipalStudentRecords() {
  const [selectedStrand, setSelectedStrand] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeStudentTab, setActiveStudentTab] = useState('personal');

  // Get available sections for selected strand
  const getAvailableSections = () => {
    if (!selectedStrand) return [];
    const strand = mockStrands.find(s => s.name === selectedStrand);
    return strand?.sections || [];
  };

  // Filter students based on selected section and search query
  const filteredStudents = mockStudentDocuments.filter((student) => {
    const matchesStrand = !selectedStrand || student.section.startsWith(selectedStrand);
    const matchesSection = !selectedSection || student.section.includes(selectedSection);
    
    // Determine school year based on grade level
    const studentSchoolYear = student.gradeLevel === '11' ? '2024-2025' : '2025-2026';
    const matchesSchoolYear = !selectedSchoolYear || studentSchoolYear === selectedSchoolYear;
    
    const matchesSearch = !searchQuery ||
      student.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.lrn.includes(searchQuery);
    
    // Only show HUMSS and TVL students
    const studentStrand = student.section.split(' ')[0];
    const isAllowedStrand = studentStrand === 'HUMSS' || studentStrand === 'TVL';
    
    return matchesStrand && matchesSection && matchesSchoolYear && matchesSearch && isAllowedStrand;
  });

  const handleViewStudent = (student: any) => {
    setSelectedStudent(student);
    setActiveStudentTab('personal');
    setIsDialogOpen(true);
  };

  const getStatusIcon = (status: string) => {
    return status === 'Available' ? (
      <CheckCircle2 className="w-4 h-4 text-green-600" />
    ) : (
      <XCircle className="w-4 h-4 text-red-600" />
    );
  };

  const getStatusBadge = (status: string) => {
    return status === 'Available' ? (
      <Badge className="bg-green-600 text-white">Complete</Badge>
    ) : (
      <Badge className="bg-red-600 text-white">Missing</Badge>
    );
  };

  const totalComplete = filteredStudents.filter(s => 
    s.form137 === 'Available' && 
    s.form138 === 'Available' && 
    s.goodMoral === 'Available'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Student Records</h2>
        <p className="text-gray-600">
          Access student records organized by strand and section
        </p>
      </div>

      {/* Filters Selection - Dropdown Style */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Student Records</CardTitle>
          <CardDescription>Select strand and section to view student documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Row 1: Search */}
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Student</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by name or LRN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                />
              </div>
            </div>

            {/* Row 2: Strand and Section Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              {/* Strand Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Strand</label>
                <Select 
                  value={selectedStrand || 'all'} 
                  onValueChange={(val) => {
                    setSelectedStrand(val === 'all' ? null : val);
                    setSelectedSection(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Strands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Strands</SelectItem>
                    <SelectItem value="HUMSS">HUMSS - Humanities and Social Sciences</SelectItem>
                    <SelectItem value="TVL">TVL - Technical-Vocational-Livelihood</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Section Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                <Select 
                  value={selectedSection || 'all'} 
                  onValueChange={(val) => setSelectedSection(val === 'all' ? null : val)}
                  disabled={!selectedStrand}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedStrand ? "All Sections" : "Select Strand first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {getAvailableSections().map((section, index) => (
                      <SelectItem key={`${section}-${index}`} value={section}>
                        {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* School Year Dropdown */}
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
                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                    <SelectItem value="2024-2025">2024-2025</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reset Button Row */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedStrand(null);
                  setSelectedSection(null);
                  setSelectedSchoolYear(null);
                }}
              >
                Reset All Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{filteredStudents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Documents Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#2D5016]">{totalComplete}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Documents Incomplete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {filteredStudents.length - totalComplete}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {filteredStudents.length > 0 
                ? Math.round((totalComplete / filteredStudents.length) * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Records Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#8B1538]" />
                Student Document Records
              </CardTitle>
              <CardDescription>View student information and document completion status</CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              {filteredStudents.length} Students
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>LRN</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="text-center">Form 137</TableHead>
                <TableHead className="text-center">Form 138</TableHead>
                <TableHead className="text-center">Good Moral</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student, index) => {
                  const isComplete = 
                    student.form137 === 'Available' && 
                    student.form138 === 'Available' && 
                    student.goodMoral === 'Available';

                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{student.lrn}</TableCell>
                      <TableCell className="font-medium">{student.studentName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{student.section}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusIcon(student.form137)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusIcon(student.form138)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusIcon(student.goodMoral)}
                      </TableCell>
                      <TableCell className="text-center">
                        {isComplete ? (
                          <Badge className="bg-[#2D5016]">Complete</Badge>
                        ) : (
                          <Badge className="bg-orange-600">Incomplete</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewStudent(student)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No student records found matching your criteria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Student Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle>Student Details & Records</DialogTitle>
            <DialogDescription>
              Complete student information and document status (View Only)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Student Header */}
            <div className="flex items-center gap-4 pb-4 border-b">
              <div className="w-16 h-16 rounded-full bg-[#8B1538] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                {selectedStudent?.studentName?.charAt(0)}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900">{selectedStudent?.studentName}</h3>
                <p className="text-xs text-gray-600 font-mono mt-0.5">LRN: {selectedStudent?.lrn}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">{selectedStudent?.section}</Badge>
                  <Badge className="text-xs bg-[#2D5016] hover:bg-[#2D5016]">Enrolled</Badge>
                  <Badge variant="outline" className="text-xs">Grade {selectedStudent?.gradeLevel || '12'}</Badge>
                </div>
              </div>
            </div>

            {/* Main Content - 2 Column Layout */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-5">
                {/* Personal Information */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#8B1538]"/>
                    Personal Information
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"/>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Birth Date</p>
                        <p className="text-sm font-medium text-gray-900">N/A</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Student Type</p>
                      <p className="text-sm font-medium text-gray-900">Regular</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"/>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Address</p>
                        <p className="text-sm font-medium text-gray-900">N/A</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#8B1538]"/>
                    Contact Information
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"/>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Email Address</p>
                        <p className="text-sm font-medium text-gray-900 break-all">N/A</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"/>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Contact Number</p>
                        <p className="text-sm font-medium text-gray-900">N/A</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Guardian Information */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#8B1538]"/>
                    Guardian Information
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500">Guardian Name</p>
                      <p className="text-sm font-medium text-gray-900">N/A</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"/>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Guardian Contact</p>
                        <p className="text-sm font-medium text-gray-900">N/A</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-5">
                {/* Academic Information */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#8B1538]"/>
                    Academic Information
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <p className="text-xs text-gray-500">School Year</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedStudent?.gradeLevel === '11' ? '2024-2025' : '2025-2026'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Grade Level</p>
                      <p className="text-sm font-medium text-gray-900">Grade {selectedStudent?.gradeLevel || '12'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Strand</p>
                      <p className="text-sm font-medium text-gray-900">{selectedStudent?.section?.split(' ')[0] || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Section</p>
                      <p className="text-sm font-medium text-gray-900">{selectedStudent?.section}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Enrollment Date</p>
                      <p className="text-sm font-medium text-gray-900">N/A</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Enrollment Status</p>
                      <Badge className="bg-[#2D5016] hover:bg-[#2D5016]">Enrolled</Badge>
                    </div>
                  </div>
                </div>

                {/* Submitted Documents */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#8B1538]"/>
                    Submitted Documents
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs py-2 font-semibold">Document Name</TableHead>
                          <TableHead className="text-xs py-2 font-semibold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow key="form137">
                          <TableCell className="py-2.5 text-xs font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"/>
                              <span>Form 137</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            {selectedStudent?.form137 === 'Available' ? (
                              <div className="flex items-center gap-1.5 text-green-700">
                                <CheckCircle className="w-3.5 h-3.5"/>
                                <span className="text-xs font-medium">Available</span>
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-orange-700">Missing</span>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow key="form138">
                          <TableCell className="py-2.5 text-xs font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"/>
                              <span>Form 138</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            {selectedStudent?.form138 === 'Available' ? (
                              <div className="flex items-center gap-1.5 text-green-700">
                                <CheckCircle className="w-3.5 h-3.5"/>
                                <span className="text-xs font-medium">Available</span>
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-orange-700">Missing</span>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow key="goodMoral">
                          <TableCell className="py-2.5 text-xs font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"/>
                              <span>Certificate of Good Moral</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            {selectedStudent?.goodMoral === 'Available' ? (
                              <div className="flex items-center gap-1.5 text-green-700">
                                <CheckCircle className="w-3.5 h-3.5"/>
                                <span className="text-xs font-medium">Available</span>
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-orange-700">Missing</span>
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Empty State */}
      {!selectedStrand && filteredStudents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">Select a strand to view student records</p>
            <p className="text-sm text-gray-500 mt-1">Use the dropdown menus above to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}