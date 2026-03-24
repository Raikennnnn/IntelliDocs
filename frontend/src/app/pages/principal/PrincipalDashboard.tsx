import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { mockAcademicPerformance, mockSections, mockStudents, mockTeachers } from '../../data/mockData';
import { Users, TrendingUp, School, GraduationCap } from 'lucide-react';
import { Progress } from '../../components/ui/progress';

export function PrincipalDashboard() {
  const totalStudents = mockAcademicPerformance.totalStudents;
  const totalSections = mockSections.length;
  const totalTeachers = mockTeachers?.length || 15;
  const passingRate = mockAcademicPerformance.passingRate;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Principal Dashboard</h2>
        <p className="text-gray-600">Institutional Overview and Academic Performance Monitoring</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrolled Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">SY 2025-2026</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sections</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSections}</div>
            <p className="text-xs text-muted-foreground">All strands</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTeachers}</div>
            <p className="text-xs text-muted-foreground">Faculty members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Passing Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{passingRate}%</div>
            <p className="text-xs text-muted-foreground">School average</p>
          </CardContent>
        </Card>
      </div>

      {/* Enrollment per Strand */}
      <Card>
        <CardHeader>
          <CardTitle>Enrollment per Strand</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockAcademicPerformance.byStrand.map((strand) => (
              <div key={strand.strand} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="w-20 justify-center bg-[#8B1538] text-white">{strand.strand}</Badge>
                    <span className="text-sm text-gray-600">{strand.students} students enrolled</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Average Grade</p>
                      <p className="font-bold text-[#2D5016]">{strand.averageGrade}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Passing Rate</p>
                      <p className="font-bold text-green-600">{strand.passingRate}%</p>
                    </div>
                  </div>
                </div>
                <Progress value={strand.passingRate} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}