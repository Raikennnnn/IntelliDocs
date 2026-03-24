import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { BarChart3, TrendingUp, TrendingDown, FileText } from 'lucide-react';

export function TeacherReports() {
  const reports = [
    {
      id: 1,
      title: 'First Quarter Grade Report',
      subject: 'General Mathematics',
      section: 'HUMSS-A',
      period: 'Q1 2025-2026',
      average: 87.5,
      passRate: 94,
      date: '2025-10-15'
    },
    {
      id: 2,
      title: 'Attendance Summary',
      subject: 'Statistics and Probability',
      section: 'HUMSS-A',
      period: 'January 2026',
      average: 92.3,
      passRate: 100,
      date: '2026-01-31'
    },
    {
      id: 3,
      title: 'Performance Analysis',
      subject: 'General Mathematics',
      section: 'TVL-B',
      period: 'Q1 2025-2026',
      average: 85.2,
      passRate: 92,
      date: '2025-10-20'
    }
  ];

  const statistics = [
    { label: 'Average Class Performance', value: '86.7%', trend: 'up', change: '+2.3%' },
    { label: 'Overall Pass Rate', value: '95.3%', trend: 'up', change: '+1.5%' },
    { label: 'Attendance Rate', value: '93.8%', trend: 'down', change: '-0.5%' },
    { label: 'Submitted Reports', value: '12/15', trend: 'up', change: '+3' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Reports & Analytics</h2>
        <p className="text-gray-600">View and generate academic reports for your classes</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statistics.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              {stat.trend === 'up' ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className={`text-xs mt-1 ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {stat.change} from last period
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>Your submitted and pending reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-start gap-3 flex-1">
                  <FileText className="w-5 h-5 text-[#8B1538] mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{report.title}</p>
                      <Badge variant={report.status === 'Submitted' ? 'default' : 'secondary'}>
                        {report.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {report.subject} - {report.section}
                    </p>
                    <p className="text-sm text-gray-500">{report.period}</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm text-gray-600">Class Average</p>
                  <p className="text-lg font-bold text-[#2D5016]">{report.average}%</p>
                  <p className="text-sm text-gray-600 mt-1">Pass Rate: {report.passRate}%</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Analysis</CardTitle>
          <CardDescription>Overview of student performance across all classes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Excellent (90-100)</p>
                <p className="text-2xl font-bold text-green-700">28 students</p>
                <p className="text-xs text-gray-600">26.7%</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Good (80-89)</p>
                <p className="text-2xl font-bold text-blue-700">45 students</p>
                <p className="text-xs text-gray-600">42.9%</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">Needs Improvement</p>
                <p className="text-2xl font-bold text-orange-700">5 students</p>
                <p className="text-xs text-gray-600">4.8%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Reports</CardTitle>
          <CardDescription>Create new reports for your classes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#8B1538] hover:bg-red-50 transition-colors text-left">
              <BarChart3 className="w-5 h-5 text-[#8B1538] mb-2" />
              <p className="font-medium">Grade Distribution Report</p>
              <p className="text-sm text-gray-600">Analyze grade patterns</p>
            </button>
            <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#8B1538] hover:bg-red-50 transition-colors text-left">
              <FileText className="w-5 h-5 text-[#8B1538] mb-2" />
              <p className="font-medium">Attendance Report</p>
              <p className="text-sm text-gray-600">Generate attendance summary</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}