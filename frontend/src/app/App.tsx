import { AuthProvider } from './context/AuthContext';
import { SchoolYearProvider } from './context/SchoolYearContext';
import { Toaster } from './components/ui/sonner';
import { RouterProvider } from 'react-router';
import { router } from './routes';

export default function App() {
  return (
    <AuthProvider>
      <SchoolYearProvider>
        <RouterProvider router={router} />
        <Toaster />
      </SchoolYearProvider>
    </AuthProvider>
  );
}