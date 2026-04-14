import { createBrowserRouter, Navigate } from 'react-router';
import { ErrorBoundary, NotFound } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout, studentNavigation, registrarNavigation, adminNavigation } from './layouts/DashboardLayout';
import { type ReactNode } from 'react';

// Auth pages
import { Login } from './pages/auth/Login';

// Student pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentEnrollment } from './pages/student/StudentEnrollment';
import { ApplicationStatus } from './pages/student/ApplicationStatus';
import { StudentProfile } from './pages/student/StudentProfile';

// Registrar pages
import { RegistrarDashboard } from './pages/registrar/RegistrarDashboard';
import { Applications } from './pages/registrar/Applications';
import { ReviewDocuments } from './pages/registrar/ReviewDocuments';
import { AIVerification } from './pages/registrar/AIVerification';
import { Reports } from './pages/registrar/Reports';
import { ActivityLogs as RegistrarActivityLogs } from './pages/registrar/ActivityLogs';

// Admin pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UserManagement } from './pages/admin/UserManagement';
import { Reports as AdminReports } from './pages/admin/Reports';
import { ActivityLogs as AdminActivityLogs } from './pages/admin/ActivityLogs';
import { SystemSettings } from './pages/admin/SystemSettings';
import { SchoolYearManagement } from './pages/admin/SchoolYearManagement';

// Shared pages
import { Announcements } from './pages/shared/Announcements';

// Public pages
import { LandingPage } from './pages/public/LandingPage';
import { AboutPage } from './pages/public/AboutPage';
import { AdmissionsPage } from './pages/public/AdmissionsPage';
import { ContactPage } from './pages/public/ContactPage';
import { ApplicationForm } from './pages/public/ApplicationForm';
import { RegistrationPage } from './pages/public/RegistrationPage';

// Route wrapper with layout
function RouteWithLayout({ children, navigation }: { children: ReactNode; navigation: any[] }) {
  return <DashboardLayout navigation={navigation}>{children}</DashboardLayout>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/landing" replace />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/login',
    element: <Login />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/student-login',
    element: <Login />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/registrar-login',
    element: <Login />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/admin-login',
    element: <Login />,
    errorElement: <ErrorBoundary />,
  },
  // Student Routes (prefixed /student/... to match registrar/admin URLs)
  {
    path: '/student/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['student']}>
        <RouteWithLayout navigation={studentNavigation}>
          <StudentDashboard />
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
          <StudentEnrollment />
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
          <ApplicationStatus />
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
          <StudentProfile />
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
          <Announcements />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  { path: '/dashboard', element: <Navigate to="/student/dashboard" replace /> },
  { path: '/enrollment', element: <Navigate to="/student/enrollment" replace /> },
  { path: '/application-status', element: <Navigate to="/student/application-status" replace /> },
  { path: '/profile', element: <Navigate to="/student/profile" replace /> },
  { path: '/announcements', element: <Navigate to="/student/announcements" replace /> },
  // Registrar Routes
  {
    path: '/registrar/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['registrar']}>
        <RouteWithLayout navigation={registrarNavigation}>
          <RegistrarDashboard />
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
          <Applications />
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
          <ReviewDocuments />
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
          <ReviewDocuments />
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
          <AIVerification />
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
          <Reports />
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
          <RegistrarActivityLogs />
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
          <Announcements />
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
          <AdminDashboard />
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
          <UserManagement />
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
          <AdminReports />
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
          <AdminActivityLogs />
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
          <SystemSettings />
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
          <SchoolYearManagement />
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
          <Announcements />
        </RouteWithLayout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  // Public Routes
  {
    path: '/landing',
    element: <LandingPage />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/about',
    element: <AboutPage />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/admissions',
    element: <AdmissionsPage />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/contact',
    element: <ContactPage />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/application-form',
    element: <ApplicationForm />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/registration',
    element: <RegistrationPage />,
    errorElement: <ErrorBoundary />,
  },
  // Error Handling
  {
    path: '*',
    element: <NotFound />,
    errorElement: <ErrorBoundary />,
  },
]);