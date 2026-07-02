import { Link, useLocation, useNavigate } from 'react-router';
import { LogOut, GraduationCap, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { clearAuthStorage } from '../lib/api';
import { Button } from '../components/ui/button';
import { ReactNode, useEffect, useState } from 'react';
import schoolLogo from '../../assets/logo.png';
import { SessionKeepalive } from '../components/SessionKeepalive';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';
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
import { useStudentLocaleOptional } from '../context/StudentLocaleContext';
import { STUDENT_NAV_PATH_KEYS } from '../lib/studentLocale';
import { StudentLanguageToggle } from '../components/student/StudentLanguageToggle';

interface DashboardLayoutProps {
  children: ReactNode;
  navigation: Array<{ name: string; path: string; icon: React.ComponentType<{ className?: string }> }>;
  studentPortal?: boolean;
}

function DashboardNavLinks({
  navigation,
  location,
  onNavigate,
  studentLocale,
}: {
  navigation: DashboardLayoutProps['navigation'];
  location: ReturnType<typeof useLocation>;
  onNavigate?: () => void;
  studentLocale: ReturnType<typeof useStudentLocaleOptional>;
}) {
  return (
    <nav className="space-y-1">
      {navigation.map((item) => {
        const active =
          location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
        const labelKey = STUDENT_NAV_PATH_KEYS[item.path];
        const label =
          studentLocale && labelKey ? studentLocale.t(labelKey) : item.name;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-700 transition-colors hover:bg-red-50 hover:text-[#8B1538]${
              active ? ' bg-red-50 font-medium text-[#8B1538]' : ''
            }`}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="text-sm sm:text-base">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardLayout({ children, navigation, studentPortal = false }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const studentLocale = useStudentLocaleOptional();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    localStorage.removeItem('studentEnrollmentLocked');
    await logout();
    clearAuthStorage();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SessionKeepalive />
      <header className="fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-[#8B1538] shadow-md">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-white hover:bg-white/10 lg:hidden"
              aria-label="Open menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white p-1 shadow-md sm:h-10 sm:w-10">
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
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {studentPortal && studentLocale ? <StudentLanguageToggle /> : null}
            <div className="hidden max-w-[180px] text-right md:block lg:max-w-none">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <p className="truncate text-xs text-green-100">{user?.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleLogout()}
              className="border-white bg-white px-2 text-[#8B1538] hover:bg-green-50 sm:px-3"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">
                {studentLocale ? studentLocale.t('nav.logout') : 'Logout'}
              </span>
            </Button>
          </div>
        </div>
      </header>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(100vw-2rem,18rem)] p-0">
          <SheetHeader className="border-b border-gray-200 px-4 py-4 text-left">
            <SheetTitle className="text-base text-[#8B1538]">
              {studentLocale ? studentLocale.t('nav.menu') : 'Menu'}
            </SheetTitle>
            <p className="text-xs text-gray-500 capitalize">
              {studentLocale ? studentLocale.t('nav.portal') : `${user?.role} portal`}
            </p>
          </SheetHeader>
          <div className="overflow-y-auto p-4">
            {studentPortal && studentLocale ? (
              <div className="mb-4">
                <StudentLanguageToggle variant="drawer" className="w-full [&_button]:flex-1" />
              </div>
            ) : null}
            <DashboardNavLinks
              navigation={navigation}
              location={location}
              onNavigate={() => setMobileNavOpen(false)}
              studentLocale={studentLocale}
            />
          </div>
        </SheetContent>
      </Sheet>

      <aside className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] w-64 overflow-y-auto border-r border-gray-200 bg-white p-4 lg:block">
        <DashboardNavLinks navigation={navigation} location={location} studentLocale={studentLocale} />
      </aside>

      <main className="min-h-screen overflow-x-hidden pt-14 sm:pt-16 lg:ml-64">
        <div className="page-shell p-4 sm:p-6">{children}</div>
      </main>
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
