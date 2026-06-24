import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { apiFetch, clearAuthStorage, getSessionToken } from '../lib/api';
import { useAuth } from '../context/AuthContext';

/** How often we validate the session (does not extend idle clock). */
const KEEPALIVE_MS = 20_000;
/** Must match server SESSION_IDLE_TIMEOUT_MINUTES default (30). */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** Throttle activity touches so mousemove does not spam the API. */
const TOUCH_THROTTLE_MS = 45_000;

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;

function redirectSessionExpired(): void {
  clearAuthStorage();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login?reason=session_expired');
  }
}

export function SessionKeepalive() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const lastActivityRef = useRef(Date.now());
  const lastTouchRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated || location.pathname.startsWith('/login')) {
      return;
    }
    if (!getSessionToken()) {
      return;
    }

    let cancelled = false;
    lastActivityRef.current = Date.now();

    const touchSession = () => {
      if (cancelled) {
        return;
      }
      const now = Date.now();
      if (now - lastTouchRef.current < TOUCH_THROTTLE_MS) {
        return;
      }
      lastTouchRef.current = now;
      void apiFetch('/api/session/touch').catch(() => {
        // apiFetch redirects on auth failures
      });
    };

    const recordActivity = () => {
      lastActivityRef.current = Date.now();
      touchSession();
    };

    const validateSession = () => {
      if (cancelled) {
        return;
      }
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= IDLE_TIMEOUT_MS) {
        redirectSessionExpired();
        return;
      }
      void apiFetch('/api/session/ping').catch(() => {
        // apiFetch redirects on auth failures
      });
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        recordActivity();
        validateSession();
      }
    };

    validateSession();
    const timer = window.setInterval(validateSession, KEEPALIVE_MS);

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, recordActivity, { passive: true });
    }
    window.addEventListener('focus', recordActivity);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, recordActivity);
      }
      window.removeEventListener('focus', recordActivity);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated, location.pathname]);

  return null;
}
