import { Link, useNavigate } from 'react-router';
import { LogOut, Menu, X, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { useState, ReactNode } from 'react';
import schoolLogo from 'figma:asset/e11655a0bb448323cab4def085b422d71c615f64.png';
import { 
  Home, 
  ClipboardList, 
  User, 
  BookOpen, 
  Calendar, 
  FileText, 
  Bell, 
  Lock, 
  Users, 
  BarChart3, 
  FolderOpen, 
  School, 
  Settings, 
  Shield,
  Plus,
  CheckSquare,
  Activity,
  Brain,
  UsersRound
} from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
  navigation: Array<{ name: string; path: string; icon: any }>;
}

export function DashboardLayout({ children, navigation }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('user');
    logout();
    navigate('/login');
  };

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#8B1538] border-b border-gray-200 sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md p-1">
              <img 
                src={schoolLogo} 
                alt="Nuestra Señora De Guia Academy" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="font-bold text-white text-lg">Nuestra Señora De Guia Academy</h1>
              <p className="text-sm text-white/80 capitalize">{user?.role} Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-green-100">{user?.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="bg-white text-[#8B1538] hover:bg-green-50 border-white">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-64px)] p-4">
          <nav className="space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-red-50 hover:text-[#8B1538] transition-colors"
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// Navigation configurations for each role
export const studentNavigation = [
  { name: 'Dashboard', path: '/student/dashboard', icon: Home },
  { name: 'Enrollment', path: '/student/enrollment', icon: ClipboardList },
  { name: 'Application Status', path: '/student/application-status', icon: CheckSquare },
];

export const registrarNavigation = [
  { name: 'Dashboard', path: '/registrar/dashboard', icon: Home },
  { name: 'Applications', path: '/registrar/applications', icon: ClipboardList },
  { name: 'Reports', path: '/registrar/reports', icon: BarChart3 },
];

export const adminNavigation = [
  { name: 'Dashboard', path: '/admin/dashboard', icon: Home },
  { name: 'User Management', path: '/admin/user-management', icon: UsersRound },
  { name: 'Reports', path: '/admin/reports', icon: BarChart3 },
  { name: 'Activity Logs', path: '/admin/activity-logs', icon: Activity },
  { name: 'System Settings', path: '/admin/system-settings', icon: Settings },
];