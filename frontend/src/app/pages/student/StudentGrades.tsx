import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { mockGrades } from '../../data/mockData';
import { SchoolYearFilter } from '../../components/SchoolYearFilter';
import { useState } from 'react';

export function StudentGrades() {
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('2025-2026');
  const [selectedSemester, setSelectedSemester] = useState('1st Semester');
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<'11' | '12'>('11');
  
  // Filter grades based on selections (mock data already includes schoolYear, semester, gradeLevel, status)
  const filteredGrades = mockGrades.filter(grade => 
    grade.schoolYear === selectedSchoolYear &&
    grade.semester === selectedSemester &&
    grade.gradeLevel === Number(selectedGradeLevel)
  );
  
  const averageGrade = filteredGrades.length > 0 
    ? (filteredGrades.reduce((sum, g) => sum + g.final, 0) / filteredGrades.length).toFixed(2)
    : '0.00';

  const passedCount = filteredGrades.filter(g => g.status === 'Passed').length;
  const failedCount = filteredGrades.filter(g => g.status === 'Failed').length;
  const incompleteCount = filteredGrades.filter(g => g.status === 'Incomplete').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Passed':
        return <Badge className="bg-[#2D5016] hover:bg-[#2D5016]">Passed</Badge>;
      case 'Failed':
        return <Badge className="bg-red-600 hover:bg-red-600">Failed</Badge>;
      case 'Incomplete':
        return <Badge className="bg-orange-600 hover:bg-orange-600">Incomplete</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">My Grades</h2>
        <p className="text-gray-600">View your academic performance</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Options</CardTitle>
          <CardDescription>Select school year, grade level, and semester</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* School Year Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                School Year <span className="text-red-600">*</span>
              </label>
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

            {/* Grade Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grade Level <span className="text-red-600">*</span>
              </label>
              <Select value={selectedGradeLevel} onValueChange={(val) => setSelectedGradeLevel(val as '11' | '12')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="11">Grade 11</SelectItem>
                  <SelectItem value="12">Grade 12</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Semester Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Semester <span className="text-red-600">*</span>
              </label>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1st Semester">
                    {selectedGradeLevel === '11' ? 'Grade 11 - 1st Semester' : 'Grade 12 - 1st Semester'}
                  </SelectItem>
                  <SelectItem value="2nd Semester">
                    {selectedGradeLevel === '11' ? 'Grade 11 - 2nd Semester' : 'Grade 12 - 2nd Semester'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Grade Summary - {selectedGradeLevel === '11' ? 'Grade 11' : 'Grade 12'} ({selectedSemester})</CardTitle>
          <CardDescription>Overall academic performance for SY {selectedSchoolYear}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Subjects</p>
              <p className="text-2xl font-bold">{filteredGrades.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Average Grade</p>
              <p className="text-2xl font-bold text-[#8B1538]">{averageGrade}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Passed</p>
              <p className="text-2xl font-bold text-[#2D5016]">{passedCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600">{failedCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Incomplete</p>
              <p className="text-2xl font-bold text-orange-600">{incompleteCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grades Table */}
      <Card>
        <CardHeader>
          <CardTitle>Grades Per Subject</CardTitle>
          <CardDescription>
            Detailed view of your grades for {selectedGradeLevel === '11' ? 'Grade 11' : 'Grade 12'} - {selectedSemester}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredGrades.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead className="text-center">1st Term</TableHead>
                  <TableHead className="text-center">2nd Term</TableHead>
                  <TableHead className="text-center">Final Grade</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGrades.map((grade) => {
                  // Calculate 1st Term (average of Q1 and Q2)
                  const firstTerm = ((grade.q1 + grade.q2) / 2).toFixed(1);
                  // Calculate 2nd Term (average of Q3 and Q4)
                  const secondTerm = ((grade.q3 + grade.q4) / 2).toFixed(1);
                  
                  return (
                    <TableRow key={grade.id}>
                      <TableCell className="font-medium">{grade.subject}</TableCell>
                      <TableCell className="text-gray-600">{grade.teacher}</TableCell>
                      <TableCell className="text-center">{firstTerm}</TableCell>
                      <TableCell className="text-center">{secondTerm}</TableCell>
                      <TableCell className="text-center font-bold text-[#8B1538]">{grade.final}</TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(grade.status)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No grades available for the selected school year, grade level, and semester.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}