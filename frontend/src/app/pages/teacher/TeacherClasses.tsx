import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Users, BookOpen, Calendar } from 'lucide-react';

export function TeacherClasses() {
  const classes = [
    {
      id: 1,
      subject: 'General Mathematics',
      section: 'HUMSS-A',
      gradeLevel: '11',
      students: 35,
      schedule: 'Mon, Wed, Fri 8:00-9:30 AM',
      room: 'Room 201'
    },
    {
      id: 2,
      subject: 'Statistics and Probability',
      section: 'HUMSS-A',
      gradeLevel: '12',
      students: 32,
      schedule: 'Tue, Thu 10:00-11:30 AM',
      room: 'Room 203'
    },
    {
      id: 3,
      subject: 'General Mathematics',
      section: 'TVL-B',
      gradeLevel: '11',
      students: 38,
      schedule: 'Mon, Wed, Fri 1:00-2:30 PM',
      room: 'Room 205'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Class & Sections</h2>
        <p className="text-gray-600">Manage your assigned classes and sections</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
            <BookOpen className="w-4 h-4 text-[#8B1538]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{classes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="w-4 h-4 text-[#2D5016]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {classes.reduce((sum, c) => sum + c.students, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sections</CardTitle>
            <Calendar className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(classes.map(c => c.section)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Classes List */}
      <div className="grid gap-4">
        {classes.map((cls) => (
          <Card key={cls.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{cls.subject}</CardTitle>
                  <CardDescription className="mt-1">
                    Grade {cls.gradeLevel} - {cls.section}
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  <Users className="w-3 h-3 mr-1" />
                  {cls.students} Students
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Schedule</p>
                  <p className="font-medium">{cls.schedule}</p>
                </div>
                <div>
                  <p className="text-gray-600">Room</p>
                  <p className="font-medium">{cls.room}</p>
                </div>
                <div>
                  <p className="text-gray-600">Enrollment</p>
                  <p className="font-medium">{cls.students}/40 students</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}