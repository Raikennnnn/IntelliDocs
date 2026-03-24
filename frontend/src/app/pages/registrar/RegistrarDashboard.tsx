import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Users, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';

export function RegistrarDashboard() {
  // Mock data for strand quotas
  const strands = [
    {
      name: 'STEM',
      fullName: 'Science, Technology, Engineering and Mathematics',
      totalApplications: 720,
      enrolledStudents: 680,
      color: 'blue'
    },
    {
      name: 'HUMSS',
      fullName: 'Humanities and Social Sciences',
      totalApplications: 650,
      enrolledStudents: 620,
      color: 'green'
    },
    {
      name: 'ABM',
      fullName: 'Accountancy, Business and Management',
      totalApplications: 580,
      enrolledStudents: 550,
      color: 'purple'
    },
    {
      name: 'TVL-ICT',
      fullName: 'Information and Communications Technology',
      totalApplications: 420,
      enrolledStudents: 400,
      color: 'cyan'
    },
    {
      name: 'TVL-EIM',
      fullName: 'Electrical Installation and Maintenance',
      totalApplications: 380,
      enrolledStudents: 360,
      color: 'orange'
    },
    {
      name: 'TVL-BPP/FBS',
      fullName: 'Bread and Pastry Production / Food & Beverage Services',
      totalApplications: 350,
      enrolledStudents: 330,
      color: 'pink'
    }
  ];

  // Overall quota is 4,000 students
  const overallQuota = 4000;
  const totalEnrolled = strands.reduce((sum, s) => sum + s.enrolledStudents, 0);
  const totalApplications = strands.reduce((sum, s) => sum + s.totalApplications, 0);

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-600';
    if (percentage >= 75) return 'bg-orange-500';
    return 'bg-[#2D5016]';
  };

  const getStatusColor = (remaining: number) => {
    if (remaining <= 5) return 'text-red-600';
    if (remaining <= 15) return 'text-orange-600';
    return 'text-[#2D5016]';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Registrar Dashboard</h2>
        <p className="text-gray-600">Student Information System Overview</p>
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-900">
                {totalApplications}
              </div>
              <Users className="w-8 h-8 text-[#8B1538]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-[#2D5016]">
                {totalEnrolled}
              </div>
              <CheckCircle className="w-8 h-8 text-[#2D5016]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Overall Quota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-900">
                {overallQuota}
              </div>
              <TrendingUp className="w-8 h-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Remaining Slots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-orange-600">
                {overallQuota - totalEnrolled}
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Strand Overview */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Strand Enrollment Overview</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {strands.map((strand) => {
            const remainingSlots = overallQuota - totalEnrolled;
            const percentageFilled = (totalEnrolled / overallQuota) * 100;
            
            return (
              <Card key={strand.name} className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold text-[#8B1538]">
                        {strand.name}
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">{strand.fullName}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-full bg-${strand.color}-100 flex items-center justify-center`}>
                      <Users className={`w-6 h-6 text-${strand.color}-600`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Total Applications</p>
                      <p className="text-2xl font-bold text-gray-900">{strand.totalApplications}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Enrolled Students</p>
                      <p className="text-2xl font-bold text-[#2D5016]">{strand.enrolledStudents}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Quota</p>
                      <p className="text-2xl font-bold text-blue-900">{overallQuota}</p>
                    </div>
                    <div className={`${remainingSlots <= 5 ? 'bg-red-50' : remainingSlots <= 15 ? 'bg-orange-50' : 'bg-gray-50'} p-3 rounded-lg`}>
                      <p className="text-xs text-gray-600 mb-1">Remaining Slots</p>
                      <p className={`text-2xl font-bold ${getStatusColor(remainingSlots)}`}>
                        {remainingSlots}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Capacity</span>
                      <span className="text-sm font-bold text-gray-900">
                        {percentageFilled.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-3 rounded-full transition-all ${getProgressColor(percentageFilled)}`}
                        style={{ width: `${percentageFilled}%` }}
                      />
                    </div>
                    {percentageFilled >= 90 && (
                      <p className="text-xs text-red-600 font-medium mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Nearly full - Limited slots remaining
                      </p>
                    )}
                    {percentageFilled >= 75 && percentageFilled < 90 && (
                      <p className="text-xs text-orange-600 font-medium mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Approaching capacity
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      
    </div>
  );
}