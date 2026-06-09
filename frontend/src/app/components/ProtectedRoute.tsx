import { Navigate, useLocation } from 'react-router';
import { useRolePermissions } from '../context/RolePermissionsContext';
import { anyPermissionsForPath, permissionForPath } from '../lib/rolePermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  /** Override automatic path-based permission check */
  requiredPermission?: string;
  /** Allow route when user has any of these permissions */
  requiredAnyPermissions?: string[];
}

/**
 * The path the First_Login_Guard redirects to when a user has been issued
 * credentials but has not yet rotated their temporary password.
 *
 * Hardcoded so the redirect target lines up with the route registered for
 * the change-password screen (task 10.3). Kept as a module-level constant so
 * the comparison and the `<Navigate to=...>` value can never drift.
 */
const CHANGE_PASSWORD_PATH = '/student/change-password';

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

/**
 * `ProtectedRoute` doubles as the First_Login_Guard for authenticated routes
 * (per the student-school-credentials design, task 10.2).
 *
 * Routing layers:
 *   1. Unauthenticated users are redirected to `/login`.
 *   2. Authenticated users whose role is not in `allowedRoles` are redirected
 *      to `/login`.
 *   3. Authenticated users with `must_change_password === true` are redirected
 *      to `/student/change-password` from anywhere except that page itself,
 *      so the change-password screen stays reachable and a refresh on it does
 *      not loop.
 *
 * The flag is read from the same `localStorage` user object hydrated by
 * `AuthContext`, so a successful login that returns `must_change_password`
 * triggers the guard immediately on the next protected navigation without
 * needing an extra context wiring.
 */
function dashboardPathForRole(role: string): string {
  if (role === 'registrar') return '/registrar/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  return '/student/dashboard';
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requiredPermission,
  requiredAnyPermissions,
}: ProtectedRouteProps) {
  const location = useLocation();
  const { loaded, hasPermission, hasPathAccess } = useRolePermissions();

  // Read the persisted user synchronously in render rather than in a
  // useEffect. The previous useEffect-based hydration captured a snapshot
  // of localStorage at *mount* time, which created a race condition during
  // route transitions: when the change-password screen successfully cleared
  // the `must_change_password` flag in localStorage and called navigate(),
  // the destination ProtectedRoute would mount and — depending on
  // microtask ordering — sometimes read the stale flag, redirecting the
  // user right back to the change-password screen and silently clearing
  // the form. Reading inline ensures every render sees the current value.
  const user = getValidStoredUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  // First_Login_Guard: when the backend has flagged the user for a forced
  // password change, every authenticated route except the change-password
  // screen redirects to it. Comparing against `location.pathname` (rather
  // than the full URL) lets query strings and hashes pass through.
  if (user.must_change_password === true && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  if (!loaded) {
    return null;
  }

  const anyKeys =
    requiredAnyPermissions ??
    anyPermissionsForPath(location.pathname) ??
    undefined;
  if (anyKeys && anyKeys.length > 0) {
    const allowed = anyKeys.some((key) => hasPermission(key));
    if (!allowed) {
      return <Navigate to={dashboardPathForRole(user.role)} replace />;
    }
  } else {
    const permKey = requiredPermission ?? permissionForPath(location.pathname);
    if (permKey && !hasPermission(permKey)) {
      return <Navigate to={dashboardPathForRole(user.role)} replace />;
    } else if (!permKey && !hasPathAccess(location.pathname)) {
      return <Navigate to={dashboardPathForRole(user.role)} replace />;
    }
  }

  return <>{children}</>;
}
