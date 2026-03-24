import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { mockTeacherGrades, mockClassList } from '../../data/mockData';
import { Users, BookOpen, Calendar, BarChart3, Clock } from 'lucide-react';

export function TeacherDashboard() {
  const { user } = useAuth();
  
  const totalStudents = mockClassList.length * (user?.assignedSections?.length || 1);
  const pendingGrades = mockTeacherGrades.filter(g => g.q4 === null).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Welcome, {user?.name}!</h2>
        <p className="text-gray-600">Teacher Portal Overview</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            {/* Square Profile Photo */}
            <div className="relative">
              <img 
                src={user?.photo} 
                alt={user?.name}
                className="w-24 h-24 object-cover rounded-lg border-2 border-[#8B1538] shadow-md"
              />
            </div>
            {/* User Info */}
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900">{user?.name}</h3>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <p><strong>Employee ID:</strong> {user?.employeeId}</p>
                <p><strong>Email:</strong> {user?.email}</p>
                <p><strong>Assigned Subjects:</strong> {user?.assignedSubjects?.join(', ')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">Across all sections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Sections</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.assignedSections?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Active sections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Subjects</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.assignedSubjects?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Subjects teaching</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Grades</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingGrades}</div>
            <p className="text-xs text-muted-foreground">Need submission</p>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Sections */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Sections</CardTitle>
          <CardDescription>Your current teaching assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {user?.assignedSections?.map((section: string) => (
              <div key={section} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">TVL - A</p>
                  <p className="text-sm text-gray-600">Section</p>
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Assigned Subjects */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Subjects</CardTitle>
          <CardDescription>Subjects you are currently teaching</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {user?.assignedSubjects?.map((subject: string) => (
              <div key={subject} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="font-medium">{subject}</p>
                    <p className="text-sm text-gray-600">{user?.assignedSections?.length || 0} sections</p>
                  </div>
                </div>
                <Badge variant="default">Teaching</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 border-l-4 border-indigo-600 bg-indigo-50">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="font-medium">Attendance recorded for HUMSS 12-A</p>
                <p className="text-sm text-gray-600">Today, 9:30 AM</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border-l-4 border-green-600 bg-green-50">
              <BookOpen className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium">Grades submitted for Q3</p>
                <p className="text-sm text-gray-600">Yesterday, 3:45 PM</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}