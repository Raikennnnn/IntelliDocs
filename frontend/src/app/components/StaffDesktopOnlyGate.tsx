import { Link } from 'react-router';
import { Monitor, Smartphone } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStaffDesktopViewport } from '../hooks/useStaffDesktopViewport';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type StaffDesktopOnlyGateProps = {
  children: ReactNode;
  portalLabel?: string;
};

export function StaffDesktopOnlyGate({ children, portalLabel = 'Staff' }: StaffDesktopOnlyGateProps) {
  const allowed = useStaffDesktopViewport();
  const { user, logout } = useAuth();

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md border-[#8B1538]/20 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#8B1538]/10 text-[#8B1538]">
            <Smartphone className="h-7 w-7" aria-hidden />
          </div>
          <CardTitle className="text-xl text-gray-900">Desktop computer required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-gray-600">
          <p>
            The <span className="font-semibold text-gray-900">{portalLabel} portal</span> is not
            available on phones or tablets. Please sign in from a laptop or desktop computer.
          </p>
          <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
            <Monitor className="h-4 w-4 shrink-0 text-[#2D5016]" aria-hidden />
            <span>Student enrollment can still be completed on mobile devices.</span>
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
            <Button asChild variant="outline" className="border-gray-300">
              <Link to="/landing">Back to homepage</Link>
            </Button>
            {user ? (
              <Button
                type="button"
                className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
                onClick={() => void logout()}
              >
                Sign out
              </Button>
            ) : (
              <Button asChild className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white">
                <Link to="/login">Student login</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
