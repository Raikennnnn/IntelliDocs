import { createBrowserRouter, Navigate } from 'react-router';
import { Suspense, type ReactNode } from 'react';
import { ErrorBoundary, NotFound } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RouteLoading } from './components/RouteLoading';
import { DashboardLayout, studentNavigation, registrarNavigation, adminNavigation } from './layouts/DashboardLayout';
import { useRolePermissions } from './context/RolePermissionsContext';
import * as Pages from './routePages';

function withRouteSuspense(node: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{node}</Suspense>;
}

// Route wrapper with layout
function RouteWithLayout({ children, navigation }: { children: ReactNode; navigation: any[] }) {
  const { filterNavigation, loaded } = useRolePermissions();
  const visibleNav = loaded ? filterNavigation(navigation) : navigation;
  return (
    <DashboardLayout navigation={visibleNav}>
      <Suspense fallback={<RouteLoading />}>{children}</Suspense>
    </DashboardLayout>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/landing" replace />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/login',
    element: withRouteSuspense(<Pages.Login />),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/forgot-password',
    element: withRouteSuspense(<Pages.ForgotPasswordPage />),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/student-login',
    element: withRouteSuspense(<Pages.Login />),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/registrar-login',
    element: withRouteSuspense(<Pages.Login />),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/admin-login',
    element: withRouteSuspense(<Pages.Login />),
    errorElement: <ErrorBoundary />,
  },
  // Student Routes (prefixed /student/... to match registrar/admin URLs)
  {
    path: '/student/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['student']}>
        <RouteWithLayout navigation={studentNavigation}>
          <Pages.StudentDashboard />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/student/enrollment',
    element: (
      <ProtectedRoute allowedRoles={['student']}>
        <RouteWithLayout navigation={studentNavigation}>
          <Pages.StudentEnrollment />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/student/application-status',
    element: (
      <ProtectedRoute allowedRoles={['student']}>
        <RouteWithLayout navigation={studentNavigation}>
          <Pages.ApplicationStatus />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/student/notifications',
    element: (
      <ProtectedRoute allowedRoles={['student']}>
        <RouteWithLayout navigation={studentNavigation}>
          <Pages.Notifications />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/student/profile',
    element: (
      <ProtectedRoute allowedRoles={['student']}>
        <RouteWithLayout navigation={studentNavigation}>
          <Pages.StudentProfile />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/student/announcements',
    element: (
      <ProtectedRoute allowedRoles={['student']}>
        <RouteWithLayout navigation={studentNavigation}>
          <Pages.Announcements />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    // Forced-first-login password change (Requirements 7.2, 7.3).
    // Rendered without `RouteWithLayout` so the user is not exposed to the
    // dashboard chrome before they have rotated the temporary password.
    // `ProtectedRoute` special-cases this exact path so the First_Login_Guard
    // does not redirect away from it.
    path: '/student/change-password',
    element: withRouteSuspense(
      <ProtectedRoute allowedRoles={['student']}>
        <Pages.ChangePassword />
      </ProtectedRoute>,
    ),
    errorElement: <ErrorBoundary />,
  },
  { path: '/dashboard', element: <Navigate to="/student/dashboard" replace /> },
  { path: '/enrollment', element: <Navigate to="/student/enrollment" replace /> },
  { path: '/application-status', element: <Navigate to="/student/application-status" replace /> },
  { path: '/notifications', element: <Navigate to="/student/notifications" replace /> },
  { path: '/profile', element: <Navigate to="/student/profile" replace /> },
  { path: '/announcements', element: <Navigate to="/student/announcements" replace /> },
  // Registrar Routes
  {
    path: '/registrar/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['registrar']}>
        <RouteWithLayout navigation={registrarNavigation}>
          <Pages.RegistrarDashboard />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/registrar/applications',
    element: (
      <ProtectedRoute allowedRoles={['registrar']}>
        <RouteWithLayout navigation={registrarNavigation}>
          <Pages.Applications />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/registrar/students',
    element: (
      <ProtectedRoute allowedRoles={['registrar']}>
        <RouteWithLayout navigation={registrarNavigation}>
          <Pages.RegistrarStudents />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/registrar/sections',
    element: (
      <ProtectedRoute allowedRoles={['registrar']}>
        <RouteWithLayout navigation={registrarNavigation}>
          <Pages.RegistrarSections />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/registrar/review-documents',
    element: (
      <ProtectedRoute allowedRoles={['registrar']}>
        <RouteWithLayout navigation={registrarNavigation}>
          <Pages.ReviewDocuments />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/registrar/review-documents/:applicationId',
    element: (
      <ProtectedRoute allowedRoles={['registrar']}>
        <RouteWithLayout navigation={registrarNavigation}>
          <Pages.ReviewDocuments />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/registrar/ai-verification',
    element: (
      <ProtectedRoute allowedRoles={['registrar']}>
        <RouteWithLayout navigation={registrarNavigation}>
          <Pages.AIVerification />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/registrar/reports',
    element: (
      <ProtectedRoute allowedRoles={['registrar']}>
        <RouteWithLayout navigation={registrarNavigation}>
          <Pages.Reports />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/registrar/activity-logs',
    element: (
      <ProtectedRoute allowedRoles={['registrar']}>
        <RouteWithLayout navigation={registrarNavigation}>
          <Pages.RegistrarActivityLogs />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/registrar/announcements',
    element: (
      <ProtectedRoute allowedRoles={['registrar']}>
        <RouteWithLayout navigation={registrarNavigation}>
          <Pages.Announcements />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  // Admin Routes
  {
    path: '/admin/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <RouteWithLayout navigation={adminNavigation}>
          <Pages.AdminDashboard />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/admin/user-management',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <RouteWithLayout navigation={adminNavigation}>
          <Pages.UserManagement />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/admin/students',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <RouteWithLayout navigation={adminNavigation}>
          <Pages.AdminStudents />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/admin/reports',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <RouteWithLayout navigation={adminNavigation}>
          <Pages.AdminReports />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/admin/activity-logs',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <RouteWithLayout navigation={adminNavigation}>
          <Pages.AdminActivityLogs />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/admin/security-monitoring',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <RouteWithLayout navigation={adminNavigation}>
          <Pages.SecurityMonitoring />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/admin/system-settings',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <RouteWithLayout navigation={adminNavigation}>
          <Pages.SystemSettings />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/admin/school-year',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <RouteWithLayout navigation={adminNavigation}>
          <Pages.SchoolYearManagement />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/admin/announcements',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <RouteWithLayout navigation={adminNavigation}>
          <Pages.Announcements />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  // Public Routes
  {
    path: '/landing',
    element: withRouteSuspense(<Pages.LandingPage />),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/about',
    element: withRouteSuspense(<Pages.AboutPage />),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/admissions/strands/:strandSlug',
    element: withRouteSuspense(<Pages.StrandInfoPage />),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/admissions',
    element: withRouteSuspense(<Pages.AdmissionsPage />),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/contact',
    element: withRouteSuspense(<Pages.ContactPage />),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/events',
    element: withRouteSuspense(<Pages.EventsPage />),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/application-form',
    element: withRouteSuspense(<Pages.ApplicationForm />),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/registration',
    element: withRouteSuspense(<Pages.RegistrationPage />),
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/legal/:docId',
    element: withRouteSuspense(<Pages.LegalDocumentPage />),
    errorElement: <ErrorBoundary />,
  },
  // Error Handling
  {
    path: '*',
    element: <NotFound />,
    errorElement: <ErrorBoundary />,
  },
]);