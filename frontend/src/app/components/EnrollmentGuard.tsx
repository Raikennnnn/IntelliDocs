import { ReactNode } from 'react';
import { useEnrollmentAllowed, useSchoolYear } from '../context/SchoolYearContext';
import { AlertTriangle, Calendar, Lock } from 'lucide-react';
import { Card, CardContent } from './ui/card';

interface EnrollmentGuardProps {
  children: ReactNode;
  message?: string;
  showDetails?: boolean;
}

/**
 * EnrollmentGuard Component
 * 
 * Prevents enrollment-related actions when no active school year exists.
 * This enforces the critical rule: "Enrollment cannot proceed without an ACTIVE School Year"
 * 
 * Usage:
 * <EnrollmentGuard>
 *   <EnrollmentForm />
 * </EnrollmentGuard>
 */
export function EnrollmentGuard({ 
  children, 
  message,
  showDetails = true 
}: EnrollmentGuardProps) {
  const enrollmentAllowed = useEnrollmentAllowed();
  const { activeSchoolYear } = useSchoolYear();

  if (!enrollmentAllowed) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Lock className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Enrollment Currently Unavailable
              </h3>
              <p className="text-red-700 mb-4">
                {message || "No active school year is currently set. Enrollment cannot proceed without an active school year."}
              </p>
              
              {showDetails && (
                <div className="bg-white border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-800">
                      <p className="font-medium mb-2">What you need to know:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>An active school year must be set before accepting enrollments</li>
                        <li>Only Principal and Admin can activate school years</li>
                        <li>Contact your Principal or System Administrator to activate a school year</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2 text-sm text-red-700">
                <Calendar className="w-4 h-4" />
                <span>
                  Please contact the Principal or Admin to activate a school year
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If enrollment is allowed, render children normally
  return <>{children}</>;
}

/**
 * ActiveSchoolYearBanner Component
 * 
 * Shows the currently active school year at the top of pages
 */
export function ActiveSchoolYearBanner() {
  const { activeSchoolYear } = useSchoolYear();

  if (!activeSchoolYear) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-900">
            No Active School Year
          </p>
          <p className="text-xs text-red-700">
            Enrollment is currently disabled. Contact admin to activate a school year.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
      <Calendar className="w-5 h-5 text-green-600 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-green-900">
          Active School Year: {activeSchoolYear.year}
        </p>
        <p className="text-xs text-green-700">
          {activeSchoolYear.startDate && activeSchoolYear.endDate
            ? `${new Date(activeSchoolYear.startDate).toLocaleDateString()} - ${new Date(activeSchoolYear.endDate).toLocaleDateString()}`
            : 'Dates configured in School Year Management'}
        </p>
      </div>
      <div className="bg-green-600 text-white text-xs font-medium px-3 py-1 rounded-full">
        Active
      </div>
    </div>
  );
}
