import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { User, Mail, Phone, MapPin, Users, BookOpen } from 'lucide-react';

export function StudentProfile() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Student Profile</h2>
        <p className="text-gray-600">View your academic profile and personal information</p>
      </div>

      {/* Profile Header with Photo */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <Avatar className="h-32 w-32 border-4 border-[#8B1538] rounded-lg">
              <AvatarImage src={user?.photo} alt={user?.name} />
              <AvatarFallback className="bg-[#8B1538] text-white text-4xl">
                {user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-center md:text-left flex-1">
              <h3 className="text-2xl font-bold text-gray-900">{user?.name}</h3>
              <p className="text-gray-600 mt-1">{user?.email}</p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                <Badge variant="default" className="bg-[#8B1538]">{user?.enrollmentStatus}</Badge>
                <Badge variant="secondary">{user?.strand}</Badge>
                <Badge variant="outline">{user?.section}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">LRN</p>
                  <p className="font-semibold">{user?.lrn}</p>
                </div>
                <div>
                  <p className="text-gray-600">Student ID</p>
                  <p className="font-semibold">{user?.id}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Your basic details (view-only)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Full Name</p>
                <p className="font-medium">{user?.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600">LRN</p>
                <p className="font-medium">{user?.lrn}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Email Address</p>
                <p className="font-medium">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Contact Number</p>
                <p className="font-medium">09123456789</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Address</p>
                <p className="font-medium">Manila, Philippines</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Date of Birth</p>
                <p className="font-medium">January 15, 2008</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parent/Guardian Information */}
      <Card>
        <CardHeader>
          <CardTitle>Parent/Guardian Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Guardian Name</p>
                <p className="font-medium">Pedro Dela Cruz</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Guardian Contact</p>
                <p className="font-medium">09187654321</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Guardian Email</p>
                <p className="font-medium">pedro.delacruz@email.com</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Relationship</p>
                <p className="font-medium">Father</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Academic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Academic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Grade Level</p>
              <p className="font-medium">Grade 12</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Strand</p>
              <Badge variant="secondary">{user?.strand}</Badge>
            </div>
            <div>
              <p className="text-sm text-gray-600">Section</p>
              <p className="font-medium">{user?.section}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">School Year</p>
              <p className="font-medium">{user?.schoolYear}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <Badge variant="default">{user?.enrollmentStatus}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Academic History */}
      <Card>
        <CardHeader>
          <CardTitle>Academic History</CardTitle>
          <CardDescription>Previous school years</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Grade 11 - HUMSS</p>
                  <p className="text-sm text-gray-600">SY 2024-2025</p>
                </div>
                <Badge variant="default">Passed</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-gray-600">
            <strong>Note:</strong> To update your personal information, please submit a request to the Registrar's Office.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}