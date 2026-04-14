import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

function getValidStoredUser(): any | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    const id = parsed?.id ?? parsed?.userId ?? parsed?.user_id ?? parsed?.user?.id ?? parsed?.user?.userId ?? parsed?.user?.user_id;
    if (id == null || String(id).trim() === '') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = getValidStoredUser();
    if (!userData) {
      try {
        localStorage.removeItem('user');
      } catch {
        // ignore
      }
    }
    setUser(userData);
    setLoading(false);
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
