import { useRouteError, useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { isChunkLoadError } from '../lib/chunkLoadRecovery';

export function ErrorBoundary() {
  const error = useRouteError() as { status?: number; statusText?: string; message?: string };
  const navigate = useNavigate();
  const errorMessage = String(error?.statusText || error?.message || 'An unexpected error occurred');
  const staleBundle = isChunkLoadError(errorMessage);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <div>
              <CardTitle>Oops! Something went wrong</CardTitle>
              <CardDescription>
                {error?.status === 404 ? 'Page not found' : 'An error occurred'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {staleBundle ? (
              <p className="text-sm text-gray-600">
                The app was updated on the server but your browser still has an older copy.
                Reload the page to load the latest files.
              </p>
            ) : (
              <p className="text-sm text-gray-600">{errorMessage}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {staleBundle ? (
                <Button
                  onClick={() => window.location.reload()}
                  className="bg-[#8B1538] hover:bg-[#8B1538]/90"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload app
                </Button>
              ) : null}
              <Button onClick={() => navigate(-1)} variant="outline">
                Go Back
              </Button>
              <Button onClick={() => navigate('/landing')} className="bg-[#8B1538]">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
            <div>
              <CardTitle>404 - Page Not Found</CardTitle>
              <CardDescription>
                The page you're looking for doesn't exist
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              The page you are trying to access may have been moved or doesn't exist.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => navigate(-1)} variant="outline">
                Go Back
              </Button>
              <Button onClick={() => navigate('/landing')} className="bg-[#8B1538]">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}