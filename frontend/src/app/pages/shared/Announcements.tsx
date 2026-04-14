import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { mockAnnouncements } from '../../data/mockData';
import { Bell, Calendar, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function Announcements() {
  const { user } = useAuth();

  const getRelevantAnnouncements = () => {
    if (!user) return mockAnnouncements;
    
    return mockAnnouncements.filter((announcement) => {
      if (announcement.target === 'Whole School') return true;
      if (user.role === 'student' && announcement.target === 'Students') return true;
      if (
        (user.role === 'registrar' || user.role === 'admin') &&
        announcement.target === 'Teachers'
      ) {
        return true;
      }
      return false;
    });
  };

  const announcements = getRelevantAnnouncements();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Announcements</h2>
        <p className="text-gray-600">Important school announcements and updates</p>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.map((announcement) => (
          <Card key={announcement.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-indigo-600" />
                  <div>
                    <CardTitle>{announcement.title}</CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {announcement.author}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(announcement.date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </span>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant={announcement.priority === 'high' ? 'destructive' : 'secondary'}>
                    {announcement.priority}
                  </Badge>
                  <Badge variant="outline">{announcement.target}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{announcement.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {announcements.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No announcements at this time</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
