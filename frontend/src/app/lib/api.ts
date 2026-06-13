/** API client: Bearer session token + legacy X-User-Id during migration. */

const SESSION_TOKEN_KEY = 'session_token';

export function getSessionToken(): string | null {
  try {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) return null;
    const normalized = token.trim();
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null): void {
  try {
    if (token && token.trim()) {
      localStorage.setItem(SESSION_TOKEN_KEY, token.trim());
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

export function clearAuthStorage(): void {
  try {
    localStorage.removeItem('user');
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function getStoredUserId(): string | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw) as {
      id?: string | number;
      userId?: string | number;
      user_id?: string | number;
      user?: { id?: string | number; userId?: string | number; user_id?: string | number };
    };

    const candidate =
      u.id ??
      u.userId ??
      u.user_id ??
      u.user?.id ??
      u.user?.userId ??
      u.user?.user_id;

    if (candidate == null) return null;
    const normalized = String(candidate).trim();
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

const AUTH_REDIRECT_CODES = new Set([
  'session_expired',
  'session_revoked',
  'invalid_token',
  'missing_token',
]);

/** Resolve announcement / public upload URLs (works in Vite dev and XAMPP). */
export function publicAssetUrl(url: string | null | undefined): string | null {
  if (url == null || url === '') return null;
  if (/^https?:\/\//i.test(url)) return url;

  const path = url.startsWith('/') ? url : `/${url}`;
  const env = import.meta.env as { DEV?: boolean; VITE_PUBLIC_BASE?: string };
  const configuredBase = (env.VITE_PUBLIC_BASE ?? '').replace(/\/$/, '');

  if (path.startsWith('/IntelliDocs/public/')) {
    return path;
  }

  if (path.startsWith('/uploads/')) {
    const base = configuredBase || '/IntelliDocs/public';
    return `${base}${path}`;
  }

  if (path.startsWith('/api/announcement-image')) {
    const base = configuredBase || (env.DEV ? '' : '/IntelliDocs/public');
    return base ? `${base}${path}` : path;
  }

  return path;
}

export function formatApiError(
  data: { error?: string; code?: string } | null | undefined,
  fallback: string,
): string {
  if (!data) return fallback;
  if (data.error === 'rate_limited' || data.code === 'rapid_actions') {
    return 'Too many actions in a short time. Wait about a minute and try again.';
  }
  return data.error || fallback;
}

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getSessionToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const uid = getStoredUserId();
  if (uid) {
    headers.set('X-User-Id', uid);
  }
  const body = init?.body;
  if (body != null && typeof body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  }).then(async (response) => {
    if (response.status === 401) {
      try {
        const cloned = response.clone();
        const data = await cloned.json().catch(() => null) as { code?: string } | null;
        const code = data?.code;
        if (code && AUTH_REDIRECT_CODES.has(code)) {
          clearAuthStorage();
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.assign(`/login?reason=${encodeURIComponent(code)}`);
          }
        } else if (code === 'session_expired') {
          clearAuthStorage();
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.assign('/login?reason=session_expired');
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    return response;
  });
}

/** Parse API JSON; detect nginx/PHP HTML error pages (common on long AI verify). */
export async function parseApiJson<T>(
  res: Response,
): Promise<
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; raw?: string }
> {
  const status = res.status;
  const text = await res.text();
  const trimmed = text.trim();
  if (trimmed.startsWith("<!") || trimmed.toLowerCase().startsWith("<html")) {
    if (status === 504 || /gateway timeout/i.test(trimmed)) {
      return {
        ok: false,
        status,
        error:
          "Server timed out (504) while running OCR. SF10 can take 2–3 minutes — run scripts/configure_nginx_ai_timeouts.sh on the droplet.",
      };
    }
    return {
      ok: false,
      status,
      error: `Server returned HTML instead of JSON (HTTP ${status}). Check nginx/PHP error logs.`,
    };
  }
  if (!trimmed) {
    return { ok: false, status, error: `Empty response from server (HTTP ${status})` };
  }
  try {
    return { ok: true, status, data: JSON.parse(text) as T };
  } catch {
    return {
      ok: false,
      status,
      error: `Invalid JSON from server (HTTP ${status})`,
      raw: trimmed.slice(0, 200),
    };
  }
}
