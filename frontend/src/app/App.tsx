import { AuthProvider } from './context/AuthContext';
import { RolePermissionsProvider } from './context/RolePermissionsContext';
import { SchoolYearProvider } from './context/SchoolYearContext';
import { Toaster } from './components/ui/sonner';
import { ScrollToTop } from './components/ScrollToTop';
import { RouterProvider } from 'react-router';
import { router } from './routes';

export default function App() {
  return (
    <AuthProvider>
      <RolePermissionsProvider>
        <SchoolYearProvider>
          <ScrollToTop />
          <RouterProvider router={router} />
          <Toaster />
        </SchoolYearProvider>
      </RolePermissionsProvider>
    </AuthProvider>
  );
}