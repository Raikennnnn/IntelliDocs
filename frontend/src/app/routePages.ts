import { lazy, type ComponentType } from 'react';

function lazyNamed<T extends Record<string, ComponentType<unknown>>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) {
  return lazy(() => loader().then((m) => ({ default: m[exportName] as ComponentType<unknown> })));
}

export const Login = lazyNamed(() => import('./pages/auth/Login'), 'Login');
export const ForgotPasswordPage = lazyNamed(() => import('./pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage');

export const StudentDashboard = lazyNamed(() => import('./pages/student/StudentDashboard'), 'StudentDashboard');
export const StudentEnrollment = lazyNamed(() => import('./pages/student/StudentEnrollment'), 'StudentEnrollment');
export const ApplicationStatus = lazyNamed(() => import('./pages/student/ApplicationStatus'), 'ApplicationStatus');
export const Notifications = lazyNamed(() => import('./pages/student/Notifications'), 'Notifications');
export const StudentProfile = lazyNamed(() => import('./pages/student/StudentProfile'), 'StudentProfile');
export const ChangePassword = lazyNamed(() => import('./pages/student/ChangePassword'), 'ChangePassword');

export const RegistrarDashboard = lazyNamed(() => import('./pages/registrar/RegistrarDashboard'), 'RegistrarDashboard');
export const Applications = lazyNamed(() => import('./pages/registrar/Applications'), 'Applications');
export const ReviewDocuments = lazyNamed(() => import('./pages/registrar/ReviewDocuments'), 'ReviewDocuments');
export const AIVerification = lazyNamed(() => import('./pages/registrar/AIVerification'), 'AIVerification');
export const Reports = lazyNamed(() => import('./pages/registrar/Reports'), 'Reports');
export const RegistrarActivityLogs = lazyNamed(() => import('./pages/registrar/ActivityLogs'), 'ActivityLogs');
export const RegistrarStudents = lazyNamed(() => import('./pages/registrar/Students'), 'Students');
export const RegistrarSections = lazyNamed(() => import('./pages/registrar/Sections'), 'Sections');

export const AdminDashboard = lazyNamed(() => import('./pages/admin/AdminDashboard'), 'AdminDashboard');
export const UserManagement = lazyNamed(() => import('./pages/admin/UserManagement'), 'UserManagement');
export const AdminStudents = lazyNamed(() => import('./pages/admin/Students'), 'Students');
export const AdminReports = lazyNamed(() => import('./pages/admin/Reports'), 'Reports');
export const AdminActivityLogs = lazyNamed(() => import('./pages/admin/ActivityLogs'), 'ActivityLogs');
export const SecurityMonitoring = lazyNamed(() => import('./pages/admin/SecurityMonitoring'), 'SecurityMonitoring');
export const SystemSettings = lazyNamed(() => import('./pages/admin/SystemSettings'), 'SystemSettings');
export const SchoolYearManagement = lazyNamed(() => import('./pages/admin/SchoolYearManagement'), 'SchoolYearManagement');

export const Announcements = lazyNamed(() => import('./pages/shared/Announcements'), 'Announcements');

export const LandingPage = lazyNamed(() => import('./pages/public/LandingPage'), 'LandingPage');
export const AboutPage = lazyNamed(() => import('./pages/public/AboutPage'), 'AboutPage');
export const AdmissionsPage = lazyNamed(() => import('./pages/public/AdmissionsPage'), 'AdmissionsPage');
export const StrandInfoPage = lazyNamed(() => import('./pages/public/StrandInfoPage'), 'StrandInfoPage');
export const ContactPage = lazyNamed(() => import('./pages/public/ContactPage'), 'ContactPage');
export const EventsPage = lazyNamed(() => import('./pages/public/EventsPage'), 'EventsPage');
export const ApplicationForm = lazyNamed(() => import('./pages/public/ApplicationForm'), 'ApplicationForm');
export const RegistrationPage = lazyNamed(() => import('./pages/public/RegistrationPage'), 'RegistrationPage');
export const LegalDocumentPage = lazyNamed(() => import('./pages/public/LegalDocumentPage'), 'LegalDocumentPage');
