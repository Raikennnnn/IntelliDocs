import { Link, useLocation, useNavigate } from 'react-router';
import { LogOut, Menu, X, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { clearAuthStorage } from '../lib/api';
import { Button } from '../components/ui/button';
import { useEffect, useState, ReactNode } from 'react';
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
import { cn } from '../components/ui/utils';

interface DashboardLayoutProps {
  children: ReactNode;
  navigation: Array<{ name: string; path: string; icon: React.ComponentType<{ className?: string }> }>;
}

export function DashboardLayout({ children, navigation }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  const handleLogout = async () => {
    localStorage.removeItem('studentEnrollmentLocked');
    await logout();
    clearAuthStorage();
    navigate('/login');
  };

  const navLinks = (
    <nav className="space-y-1">
      {navigation.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          onClick={() => setMobileNavOpen(false)}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-700 transition-colors hover:bg-red-50 hover:text-[#8B1538]',
            location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
              ? 'bg-red-50 font-medium text-[#8B1538]'
              : '',
          )}
        >
          <item.icon className="h-5 w-5 shrink-0" />
          <span>{item.name}</span>
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-gray-50">
      <header className="z-30 shrink-0 border-b border-gray-200 bg-[#8B1538] shadow-md">
        <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-white hover:bg-white/10 md:hidden"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-1 shadow-md">
              <img
                src={schoolLogo}
                alt="Nuestra Señora De Guia Academy"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-white sm:text-lg">
                Nuestra Señora De Guia Academy
              </h1>
              <p className="truncate text-xs capitalize text-white/80 sm:text-sm">{user?.role} Portal</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="hidden text-right md:block">
              <p className="max-w-[180px] truncate text-sm font-medium text-white lg:max-w-none">
                {user?.name}
              </p>
              <p className="max-w-[180px] truncate text-xs text-green-100 lg:max-w-none">{user?.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleLogout()}
              className="border-white bg-white text-[#8B1538] hover:bg-green-50"
            >
              <LogOut className="mr-0 h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {mobileNavOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-gray-200 bg-white p-4 pt-20 shadow-xl transition-transform duration-200 ease-out md:static md:z-auto md:w-64 md:max-w-none md:shrink-0 md:translate-x-0 md:pt-4 md:shadow-none',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          )}
        >
          {navLinks}
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6">
          {children}
        </main>
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
