import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { apiFetch } from '../lib/api';
// Real backend API integration - mocks removed

type UserRole = 'student' | 'registrar' | 'admin';

interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
  email: string;
  [key: string]: any;
}

/** DB may return `applicant`; student portal routes expect `student`. */
function toPortalRole(role: string | undefined): UserRole {
  const r = (role || '').toLowerCase();
  if (r === 'registrar' || r === 'admin') return r;
  if (r === 'student' || r === 'applicant') return 'student';
  return 'student';
}

function buildUserFromBackend(backendUser: Record<string, unknown>): User {
  return {
    id: String(backendUser.id ?? ''),
    username: String(backendUser.username ?? ''),
    role: toPortalRole(backendUser.role as string | undefined),
    name: String(backendUser.full_name ?? backendUser.name ?? ''),
    email: String(backendUser.email ?? ''),
  };
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; user?: User }>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Initialize from localStorage after mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Persist user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const login = async (email: string, password: string): Promise<{ ok: boolean; user?: User }> => {
    try {
      const response = await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'login', email, password }),
      });

      const data = await response.json();

      if (data.success && data.user) {
        const nextUser = buildUserFromBackend(data.user as Record<string, unknown>);
        // Persist before returning so navigated routes (ProtectedRoute) always see storage.
        localStorage.setItem('user', JSON.stringify(nextUser));
        setUser(nextUser);
        return { ok: true, user: nextUser };
      }
      return { ok: false };
    } catch (error) {
      console.error('Login error:', error);
      return { ok: false };
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}