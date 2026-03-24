import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Calendar } from '../../components/ui/calendar';
import { mockStrands, mockStudentsBySection } from '../../data/mockData';
import { Users, Save, Search, Download, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function TeacherAttendance() {
  const [selectedStrand, setSelectedStrand] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<{ [key: string]: string }>({});
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('2025-2026');
  const [selectedSemester, setSelectedSemester] = useState<string>('1st Semester');

  const handleSaveAttendance = () => {
    toast.success('Attendance saved successfully!');
  };

  const handleSubmitAttendance = () => {
    toast.success('Attendance submitted for approval!');
  };

  const handleDownloadPDF = () => {
    toast.success('Attendance report downloaded successfully!', {
      description: `${selectedStrand} - ${selectedSection} • ${selectedSchoolYear} • ${selectedSemester}`
    });
  };

  const handleAttendanceChange = (studentId: string, status: string) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Get available sections for selected strand
  const getAvailableSections = () => {
    if (!selectedStrand) return [];
    const strand = mockStrands.find(s => s.name === selectedStrand);
    return strand?.sections || [];
  };

  // Get students for selected section
  const getSectionStudents = () => {
    if (!selectedStrand || !selectedSection) return { male: [], female: [] };
    const sectionKey = `${selectedStrand}-${selectedSection}`;
    const allStudents = mockStudentsBySection[sectionKey as keyof typeof mockStudentsBySection] || [];
    
    // Separate by gender
    const male = allStudents.filter(student => student.gender === 'M');
    const female = allStudents.filter(student => student.gender === 'F');
    
    return { male, female };
  };

  const students = getSectionStudents();
  
  // Filter students based on search
  const filterStudents = (studentList: any[]) => {
    if (!searchQuery) return studentList;
    return studentList.filter(student => 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.lrn.includes(searchQuery)
    );
  };

  const filteredMaleStudents = filterStudents(students.male);
  const filteredFemaleStudents = filterStudents(students.female);
  const totalStudents = students.male.length + students.female.length;
  
  const currentDate = format(selectedDate, 'EEEE, MMMM d, yyyy');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Attendance Management</h2>
        <p className="text-gray-600">Track student attendance by strand and section</p>
      </div>

      {/* Selection Filters - Dropdown Style */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Filters</CardTitle>
          <CardDescription>Choose filters to mark attendance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Row 1: Date, School Year, Semester */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <CalendarIcon className="w-4 h-4 inline mr-1" />
                  Attendance Date
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'dd-MM-yy') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

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

            {/* Row 2: Strand and Section Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              {/* Strand Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Strand</label>
                <Select 
                  value={selectedStrand || ''} 
                  onValueChange={(val) => {
                    setSelectedStrand(val);
                    setSelectedSection(null);
                    setAttendanceData({});
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
                  onValueChange={(val) => {
                    setSelectedSection(val);
                    setAttendanceData({});
                  }}
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

            {/* Search Bar Row (Only show when strand and section are selected) */}
            {selectedStrand && selectedSection && totalStudents > 0 && (
              <div className="flex items-center gap-4 pt-4 border-t">
                <div className="flex-1 max-w-md">
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
                
                <div className="flex items-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery('')}
                    disabled={!searchQuery}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Navigation & Action Controls */}
      {selectedStrand && selectedSection && totalStudents > 0 && (
        <Card className="sticky top-0 z-10 bg-white shadow-md">
          <CardContent className="py-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              {/* Gender Selection Tabs */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 mr-2">View Students:</span>
                <Button
                  variant={selectedGender === 'male' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedGender('male')}
                  className={selectedGender === 'male' ? 'bg-blue-600 hover:bg-blue-700' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Male Students ({students.male.length})
                </Button>
                <Button
                  variant={selectedGender === 'female' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedGender('female')}
                  className={selectedGender === 'female' ? 'bg-pink-600 hover:bg-pink-700' : 'border-pink-300 text-pink-700 hover:bg-pink-50'}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Female Students ({students.female.length})
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSaveAttendance}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button 
                  size="sm"
                  onClick={handleSubmitAttendance}
                  className="bg-[#8B1538] hover:bg-[#8B1538]/90"
                >
                  Submit
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownloadPDF}
                  className="bg-[#8B1538] hover:bg-[#8B1538]/90"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Male Students Attendance Table */}
      {selectedStrand && selectedSection && selectedGender === 'male' && filteredMaleStudents.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Male Students - Attendance Sheet
                </CardTitle>
                <CardDescription>
                  {selectedStrand} - {selectedSection} • {currentDate}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-sm bg-blue-50 border-blue-200">
                {filteredMaleStudents.length} Male Students
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-blue-50">
                  <tr className="border-b-2 border-gray-300">
                    <th className="p-3 text-center border border-gray-300 font-semibold bg-blue-100 min-w-[50px]">#</th>
                    <th className="p-3 text-left border border-gray-300 font-semibold bg-blue-50 min-w-[200px]">Student Name</th>
                    <th className="p-3 text-left border border-gray-300 font-semibold bg-blue-50 min-w-[150px]">Student Number (LRN)</th>
                    <th className="p-3 text-center border border-gray-300 font-semibold bg-blue-100 min-w-[160px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaleStudents.map((student, index) => (
                    <tr key={student.id} className="border-b hover:bg-blue-50/30 transition-colors">
                      <td className="p-3 border border-gray-300 text-center font-semibold text-gray-600 bg-blue-50">
                        {index + 1}
                      </td>
                      <td className="p-3 border border-gray-300 font-medium">
                        {student.name}
                      </td>
                      <td className="p-3 border border-gray-300 text-gray-600">
                        {student.lrn}
                      </td>
                      <td className="p-3 border border-gray-300">
                        <div className="flex justify-center">
                          <Select
                            value={attendanceData[student.id] || 'present'}
                            onValueChange={(value) => handleAttendanceChange(student.id, value)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-green-600"></span>
                                  Present
                                </span>
                              </SelectItem>
                              <SelectItem value="absent">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-red-600"></span>
                                  Absent
                                </span>
                              </SelectItem>
                              <SelectItem value="late">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-orange-600"></span>
                                  Late
                                </span>
                              </SelectItem>
                              <SelectItem value="excuse">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-yellow-600"></span>
                                  Excuse
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Female Students Attendance Table */}
      {selectedStrand && selectedSection && selectedGender === 'female' && filteredFemaleStudents.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-pink-600" />
                  Female Students - Attendance Sheet
                </CardTitle>
                <CardDescription>
                  {selectedStrand} - {selectedSection} • {currentDate}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-sm bg-pink-50 border-pink-200">
                {filteredFemaleStudents.length} Female Students
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-pink-50">
                  <tr className="border-b-2 border-gray-300">
                    <th className="p-3 text-center border border-gray-300 font-semibold bg-pink-100 min-w-[50px]">#</th>
                    <th className="p-3 text-left border border-gray-300 font-semibold bg-pink-50 min-w-[200px]">Student Name</th>
                    <th className="p-3 text-left border border-gray-300 font-semibold bg-pink-50 min-w-[150px]">Student Number (LRN)</th>
                    <th className="p-3 text-center border border-gray-300 font-semibold bg-pink-100 min-w-[160px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFemaleStudents.map((student, index) => (
                    <tr key={student.id} className="border-b hover:bg-pink-50/30 transition-colors">
                      <td className="p-3 border border-gray-300 text-center font-semibold text-gray-600 bg-pink-50">
                        {index + 1}
                      </td>
                      <td className="p-3 border border-gray-300 font-medium">
                        {student.name}
                      </td>
                      <td className="p-3 border border-gray-300 text-gray-600">
                        {student.lrn}
                      </td>
                      <td className="p-3 border border-gray-300">
                        <div className="flex justify-center">
                          <Select
                            value={attendanceData[student.id] || 'present'}
                            onValueChange={(value) => handleAttendanceChange(student.id, value)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-green-600"></span>
                                  Present
                                </span>
                              </SelectItem>
                              <SelectItem value="absent">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-red-600"></span>
                                  Absent
                                </span>
                              </SelectItem>
                              <SelectItem value="late">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-orange-600"></span>
                                  Late
                                </span>
                              </SelectItem>
                              <SelectItem value="excuse">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-yellow-600"></span>
                                  Excuse
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {selectedStrand && selectedSection && totalStudents === 0 && (
        <Card>
          <CardContent className="text-center py-10">
            <p className="text-gray-500">No students found in this section.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}