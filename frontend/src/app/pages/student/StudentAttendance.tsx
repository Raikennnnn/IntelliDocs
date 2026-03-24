import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { mockAttendance } from '../../data/mockData';
import { Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';

export function StudentAttendance() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">My Attendance</h2>
        <p className="text-gray-600">Track your attendance record</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Days</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockAttendance.totalDays}</div>
            <p className="text-xs text-muted-foreground">School days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{mockAttendance.present}</div>
            <p className="text-xs text-muted-foreground">Days attended</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{mockAttendance.absent}</div>
            <p className="text-xs text-muted-foreground">Days missed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{mockAttendance.late}</div>
            <p className="text-xs text-muted-foreground">Times late</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Rate */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Attendance Rate</CardTitle>
          <CardDescription>Your attendance performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Attendance Rate</span>
              <span className="text-2xl font-bold text-indigo-600">{mockAttendance.attendanceRate}%</span>
            </div>
            <Progress value={mockAttendance.attendanceRate} className="h-3" />
          </div>
          <p className="text-sm text-gray-600">
            You have attended {mockAttendance.present} out of {mockAttendance.totalDays} school days.
            {mockAttendance.attendanceRate >= 95 && " Excellent attendance record!"}
            {mockAttendance.attendanceRate < 95 && mockAttendance.attendanceRate >= 85 && " Good attendance, keep it up!"}
          </p>
        </CardContent>
      </Card>

      {/* Attendance by Subject */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Per Subject</CardTitle>
          <CardDescription>Detailed attendance breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead className="text-center">Present</TableHead>
                <TableHead className="text-center">Absent</TableHead>
                <TableHead className="text-center">Total Classes</TableHead>
                <TableHead className="text-center">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAttendance.bySubject.map((subject) => {
                const rate = ((subject.present / subject.total) * 100).toFixed(1);
                return (
                  <TableRow key={subject.subject}>
                    <TableCell className="font-medium">{subject.subject}</TableCell>
                    <TableCell className="text-center text-green-600 font-medium">{subject.present}</TableCell>
                    <TableCell className="text-center text-red-600 font-medium">{subject.absent}</TableCell>
                    <TableCell className="text-center">{subject.total}</TableCell>
                    <TableCell className="text-center">
                      <div className="space-y-1">
                        <span className="font-bold text-indigo-600">{rate}%</span>
                        <Progress value={Number(rate)} className="h-2" />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
