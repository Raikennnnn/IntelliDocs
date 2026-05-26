import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { apiFetch } from '../lib/api';
// Real backend API integration - mocks removed

type UserRole = 'student' | 'registrar' | 'admin';

/**
 * AuthUser carries the authenticated user's identity payload returned by
 * `api/auth.php` after a successful login. The shape mirrors the
 * `student-school-credentials` design's AuthUser interface.
 *
 * Note: `id` is kept as `string` for backwards compatibility with the rest of
 * the frontend (apiFetch sends `X-User-Id` as a string, ProtectedRoute reads
 * the stored id as a string). The design's `id: number` is honored on the
 * wire — `buildUserFromBackend` accepts either and stringifies on storage.
 *
 * All fields beyond `id`, `username`, `email`, `role`, and `name` are
 * optional so older login responses (and stored sessions saved before this
 * feature shipped) continue to deserialize cleanly. Missing string fields
 * default to `null` and `must_change_password` defaults to `false`.
 */
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  school_username?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  extension_name?: string | null;
  role: UserRole;
  must_change_password?: boolean;
  /** Legacy display-name field; kept so existing UI that reads `user.name` keeps working. */
  name: string;
  [key: string]: any;
}

/** Internal alias preserved so the existing implementation keeps compiling. */
type User = AuthUser;

/** DB may return `applicant`; student portal routes expect `student`. */
function toPortalRole(role: string | undefined): UserRole {
  const r = (role || '').toLowerCase();
  if (r === 'registrar' || r === 'admin') return r;
  if (r === 'student' || r === 'applicant') return 'student';
  return 'student';
}

function nullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
  return s === '' ? null : s;
}

function buildUserFromBackend(backendUser: Record<string, unknown>): User {
  return {
    id: String(backendUser.id ?? ''),
    username: String(backendUser.username ?? ''),
    role: toPortalRole(backendUser.role as string | undefined),
    name: String(backendUser.full_name ?? backendUser.name ?? ''),
    email: String(backendUser.email ?? ''),
    school_username: nullableString(backendUser.school_username),
    full_name: nullableString(backendUser.full_name),
    first_name: nullableString(backendUser.first_name),
    middle_name: nullableString(backendUser.middle_name),
    last_name: nullableString(backendUser.last_name),
    extension_name: nullableString(backendUser.extension_name),
    must_change_password: backendUser.must_change_password === true,
  };
}

function normalizeStoredUser(raw: unknown): User | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const idCandidate = obj.id ?? obj.userId ?? obj.user_id;
  if (idCandidate == null || String(idCandidate).trim() === '') {
    return null;
  }
  return {
    id: String(idCandidate),
    username: String(obj.username ?? ''),
    role: toPortalRole(obj.role as string | undefined),
    name: String(obj.name ?? obj.full_name ?? ''),
    email: String(obj.email ?? ''),
    school_username: nullableString(obj.school_username),
    full_name: nullableString(obj.full_name),
    first_name: nullableString(obj.first_name),
    middle_name: nullableString(obj.middle_name),
    last_name: nullableString(obj.last_name),
    extension_name: nullableString(obj.extension_name),
    must_change_password: obj.must_change_password === true,
  };
}

/**
 * Result returned by `AuthContext.login`.
 *
 * - `ok` indicates whether the login succeeded.
 * - `user` is populated on success.
 * - `errorCode` carries the backend's `error` (or `code`) field on failure so
 *   callers can distinguish a generic credential failure from the throttle
 *   response (`account_locked` / `code: "throttled"`) without re-parsing the
 *   network call. Per the design's auth response shape, the throttle response
 *   is HTTP 401 with `{ error: "account_locked", code: "throttled" }`.
 */
export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; user?: undefined; errorCode?: string };

interface AuthContextType {
  user: User | null;
  /**
   * Authenticate with either a personal email or a school username.
   *
   * The first argument is named `credential` to match the wire field — the
   * backend accepts the same value via either field for backwards
   * compatibility (see registrar approve / auth design).
   */
  login: (credential: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  isAuthenticated: boolean;
  /**
   * Mutate a small, allow-listed slice of the persisted user object.
   *
   * Includes `must_change_password` so the change-password screen
   * (`pages/student/ChangePassword.tsx`) can clear the forced-first-login
   * flag locally after the backend confirms the rotation, letting the
   * `First_Login_Guard` stop redirecting on the very next navigation
   * without requiring a full re-login round trip.
   */
  patchUser: (fields: Partial<Pick<User, 'name' | 'email' | 'must_change_password'>>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Initialize from localStorage after mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        const normalized = normalizeStoredUser(parsed);
        if (!normalized) {
          // Old/stale user objects can miss ID; clear to avoid API calls without X-User-Id.
          localStorage.removeItem('user');
          setUser(null);
          return;
        }
        setUser(normalized);
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Persist user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const login = async (credential: string, password: string): Promise<LoginResult> => {
    try {
      const response = await apiFetch('/api/auth', {
        method: 'POST',
        // Send the new `credential` field per the student-school-credentials
        // design. The backend accepts either `credential` or the legacy
        // `email` field (task 7.2), so this remains backwards compatible if
        // an older API is deployed alongside this client.
        body: JSON.stringify({ action: 'login', credential, password }),
      });

      const data = await response.json().catch(() => null) as
        | { success?: boolean; user?: Record<string, unknown>; must_change_password?: boolean; error?: string; code?: string }
        | null;

      if (data && data.success && data.user) {
        const nextUser = buildUserFromBackend(data.user);
        // Per design, `must_change_password` is returned at the top level of
        // the login response (not nested under `user`). Hydrate it onto the
        // AuthUser so the First_Login_Guard can read it from a single place.
        // Older login responses without this field default to false.
        if (typeof data.must_change_password === 'boolean') {
          nextUser.must_change_password = data.must_change_password;
        }
        // Persist before returning so navigated routes (ProtectedRoute) always see storage.
        localStorage.setItem('user', JSON.stringify(nextUser));
        setUser(nextUser);
        return { ok: true, user: nextUser };
      }
      // Surface the backend's error code so the UI can render a throttle
      // message distinct from a generic invalid-credentials message. Prefer
      // `code` (e.g. "throttled") then fall back to `error`.
      const errorCode = data?.code || data?.error;
      return { ok: false, errorCode };
    } catch (error) {
      console.error('Login error:', error);
      return { ok: false };
    }
  };

  const logout = () => {
    setUser(null);
  };

  const patchUser = (
    fields: Partial<Pick<User, 'name' | 'email' | 'must_change_password'>>,
  ) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...fields };
      // Persist synchronously so a navigation that follows this call (e.g.
      // the change-password screen redirecting to /student/dashboard) sees
      // the updated flag in localStorage. The persist-on-change effect
      // would otherwise run on the next tick, and ProtectedRoute reads
      // localStorage at mount — leaving must_change_password=true visible
      // to the guard and bouncing the user right back to this screen.
      try {
        localStorage.setItem('user', JSON.stringify(next));
      } catch {
        // ignore — the effect below will retry on the next render.
      }
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, patchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context !== undefined) return context;

  // Fallback: avoid hard-crashing the app if a route/layout is rendered outside the provider.
  // This can happen during router error rendering or mis-wired layout trees.
  const fallbackUser = (() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      return normalizeStoredUser(JSON.parse(raw));
    } catch {
      return null;
    }
  })();

  return {
    user: fallbackUser,
    isAuthenticated: !!fallbackUser,
    login: async (): Promise<LoginResult> => ({ ok: false }),
    logout: () => {
      try {
        localStorage.removeItem('user');
      } catch {
        // ignore
      }
    },
    patchUser: () => {},
  };
}