import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from './AuthContext';
import {
  filterNavigation,
  hasPathAccess,
  type RolePermissionMap,
} from '../lib/rolePermissions';

interface RolePermissionsContextValue {
  permissions: RolePermissionMap;
  loaded: boolean;
  hasPermission: (key: string) => boolean;
  hasPathAccess: (pathname: string) => boolean;
  filterNavigation: <T extends { path: string }>(items: T[]) => T[];
  reloadPermissions: () => Promise<void>;
}

const RolePermissionsContext = createContext<RolePermissionsContextValue | undefined>(undefined);

const EMPTY_PERMISSIONS: RolePermissionMap = {};

export function RolePermissionsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState<RolePermissionMap>(EMPTY_PERMISSIONS);
  const [loaded, setLoaded] = useState(false);

  const reloadPermissions = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setPermissions(EMPTY_PERMISSIONS);
      setLoaded(true);
      return;
    }

    try {
      const res = await apiFetch('/api/role-permissions');
      const data = await res.json();
      if (data?.success && data.permissions && typeof data.permissions === 'object') {
        setPermissions(data.permissions as RolePermissionMap);
      } else {
        setPermissions(EMPTY_PERMISSIONS);
      }
    } catch {
      setPermissions(EMPTY_PERMISSIONS);
    } finally {
      setLoaded(true);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    setLoaded(false);
    void reloadPermissions();
  }, [reloadPermissions, user?.id, user?.role]);

  const isAdmin = user?.role === 'admin';

  const hasPermission = useCallback(
    (key: string) => {
      return permissions[key] === true;
    },
    [permissions],
  );

  const checkPathAccess = useCallback(
    (pathname: string) => hasPathAccess(pathname, permissions, isAdmin),
    [permissions, isAdmin],
  );

  const filterNav = useCallback(
    <T extends { path: string }>(items: T[]) =>
      filterNavigation(items, permissions, isAdmin),
    [permissions, isAdmin],
  );

  const value = useMemo(
    () => ({
      permissions,
      loaded,
      hasPermission,
      hasPathAccess: checkPathAccess,
      filterNavigation: filterNav,
      reloadPermissions,
    }),
    [permissions, loaded, hasPermission, checkPathAccess, filterNav, reloadPermissions],
  );

  return (
    <RolePermissionsContext.Provider value={value}>{children}</RolePermissionsContext.Provider>
  );
}

export function useRolePermissions(): RolePermissionsContextValue {
  const ctx = useContext(RolePermissionsContext);
  if (!ctx) {
    throw new Error('useRolePermissions must be used within RolePermissionsProvider');
  }
  return ctx;
}
