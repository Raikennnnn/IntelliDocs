export type RolePermissionMap = Record<string, boolean>;

/** Path → permission key. Dashboard and announcements are always visible. */
export const NAV_PATH_PERMISSIONS: Record<string, string> = {
  '/student/enrollment': 'uploadDocuments',
  '/student/application-status': 'viewApplicationStatus',
  '/student/profile': 'editProfile',
  '/registrar/applications': 'viewApplications',
  '/registrar/students': 'viewApplications',
  '/registrar/sections': 'viewApplications',
  '/registrar/review-documents': 'viewApplications',
  '/registrar/ai-verification': 'viewAIResults',
  '/registrar/reports': 'generateReports',
  '/registrar/referral-ledger': 'viewApplications',
  '/registrar/activity-logs': 'viewApplications',
  '/admin/user-management': 'manageUsers',
  '/admin/students': 'manageUsers',
  '/admin/reports': 'viewReports',
  '/admin/activity-logs': 'viewActivityLogs',
  '/admin/security-monitoring': 'viewActivityLogs',
  '/admin/system-settings': 'configureSystem',
  '/admin/school-year': 'configureSystem',
};

/** Routes that are allowed when the user has any listed permission. */
export const ROUTE_ANY_PERMISSIONS: Record<string, string[]> = {
  '/admin/system-settings': ['configureSystem', 'manageRoles'],
};

export function permissionForPath(pathname: string): string | null {
  if (ROUTE_ANY_PERMISSIONS[pathname]) {
    return null;
  }
  if (NAV_PATH_PERMISSIONS[pathname]) {
    return NAV_PATH_PERMISSIONS[pathname];
  }
  if (pathname.startsWith('/registrar/review-documents')) {
    return 'viewApplications';
  }
  return null;
}

export function anyPermissionsForPath(pathname: string): string[] | null {
  if (ROUTE_ANY_PERMISSIONS[pathname]) {
    return ROUTE_ANY_PERMISSIONS[pathname];
  }
  return null;
}

export function hasPathAccess(
  pathname: string,
  permissions: RolePermissionMap,
  isAdmin = false,
): boolean {
  const anyKeys = anyPermissionsForPath(pathname);
  if (anyKeys) {
    if (isAdmin) {
      return anyKeys.some((key) => permissions[key] === true);
    }
    return anyKeys.some((key) => permissions[key] === true);
  }

  const key = permissionForPath(pathname);
  if (!key) {
    return true;
  }
  if (isAdmin) {
    return permissions[key] === true;
  }
  return permissions[key] === true;
}

export function filterNavigation<T extends { path: string }>(
  items: T[],
  permissions: RolePermissionMap,
  isAdmin = false,
): T[] {
  return items.filter((item) => hasPathAccess(item.path, permissions, isAdmin));
}
