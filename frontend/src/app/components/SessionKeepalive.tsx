import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { apiFetch, getSessionToken } from '../lib/api';
import { useAuth } from '../context/AuthContext';

/** Polls the server so revoked/deactivated sessions are detected without user action. */
const KEEPALIVE_MS = 20_000;

export function SessionKeepalive() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated || location.pathname.startsWith('/login')) {
      return;
    }
    if (!getSessionToken()) {
      return;
    }

    let cancelled = false;

    const ping = () => {
      if (cancelled) {
        return;
      }
      void apiFetch('/api/session/ping').catch(() => {
        // apiFetch redirects on auth failures
      });
    };

    ping();
    const timer = window.setInterval(ping, KEEPALIVE_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        ping();
      }
    };
    window.addEventListener('focus', ping);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', ping);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated, location.pathname]);

  return null;
}
