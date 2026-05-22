/** Sends session cookies + X-User-Id from localStorage (needed when PHP session cookie is not forwarded via Vite). */

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

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
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
  });
}
