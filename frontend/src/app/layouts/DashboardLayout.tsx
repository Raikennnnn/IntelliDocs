import { Link, useLocation, useNavigate } from 'react-router';
import { LogOut, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { clearAuthStorage } from '../lib/api';
import { Button } from '../components/ui/button';
import { ReactNode } from 'react';
import schoolLogo from '../../assets/logo.png';
import {
  Home,
  ClipboardList,
  BookOpen,
  Calendar,
  Bell,
  Users,
  BarChart3,
  CheckSquare,
  Activity,
  Settings,
  Shield,
  UsersRound,
  Layers,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
  navigation: Array<{ name: string; path: string; icon: React.ComponentType<{ className?: string }> }>;
}

export function DashboardLayout({ children, navigation }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    localStorage.removeItem('studentEnrollmentLocked');
    await logout();
    clearAuthStorage();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-[#8B1538] shadow-md">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white p-1 shadow-md">
              <img
                src={schoolLogo}
                alt="Nuestra Señora De Guia Academy"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Nuestra Señora De Guia Academy</h1>
              <p className="text-sm capitalize text-white/80">{user?.role} Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-green-100">{user?.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleLogout()}
              className="border-white bg-white text-[#8B1538] hover:bg-green-50"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="min-h-[calc(100vh-64px)] w-64 border-r border-gray-200 bg-white p-4">
          <nav className="space-y-1">
            {navigation.map((item) => {
              const active =
                location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-colors hover:bg-red-50 hover:text-[#8B1538]${
                    active ? ' bg-red-50 font-medium text-[#8B1538]' : ''
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export const studentNavigation = [
  { name: 'Dashboard', path: '/student/dashboard', icon: Home },
  { name: 'Enrollment', path: '/student/enrollment', icon: ClipboardList },
  { name: 'Application Status', path: '/student/application-status', icon: CheckSquare },
  { name: 'Notifications', path: '/student/notifications', icon: Bell },
  { name: 'Announcements', path: '/student/announcements', icon: BookOpen },
];

export const registrarNavigation = [
  { name: 'Dashboard', path: '/registrar/dashboard', icon: Home },
  { name: 'Applications', path: '/registrar/applications', icon: ClipboardList },
  { name: 'Students', path: '/registrar/students', icon: Users },
  { name: 'Sections', path: '/registrar/sections', icon: Layers },
  { name: 'Reports', path: '/registrar/reports', icon: BarChart3 },
  { name: 'Announcements', path: '/registrar/announcements', icon: Bell },
];

export const adminNavigation = [
  { name: 'Dashboard', path: '/admin/dashboard', icon: Home },
  { name: 'School Year', path: '/admin/school-year', icon: Calendar },
  { name: 'User Management', path: '/admin/user-management', icon: UsersRound },
  { name: 'Students', path: '/admin/students', icon: GraduationCap },
  { name: 'Reports', path: '/admin/reports', icon: BarChart3 },
  { name: 'Activity Logs', path: '/admin/activity-logs', icon: Activity },
  { name: 'Security Monitoring', path: '/admin/security-monitoring', icon: Shield },
  { name: 'System Settings', path: '/admin/system-settings', icon: Settings },
  { name: 'Announcements', path: '/admin/announcements', icon: Bell },
];
