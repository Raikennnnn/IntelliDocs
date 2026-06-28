import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { apiFetch, clearAuthStorage, setSessionToken } from '../lib/api';

type UserRole = 'student' | 'registrar' | 'admin';

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
  name: string;
  [key: string]: unknown;
}

type User = AuthUser;

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

function persistAuthUser(user: User, token?: string | null): void {
  localStorage.setItem('user', JSON.stringify(user));
  if (token !== undefined) {
    setSessionToken(token);
  }
}

type AuthLoginResponse = {
  success?: boolean;
  requires_otp?: boolean;
  user?: Record<string, unknown>;
  must_change_password?: boolean;
  token?: string | null;
  email?: string;
  email_masked?: string;
  otp_delivery?: string;
  dev_otp?: string;
  error?: string;
  code?: string;
};

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; user?: undefined; errorCode?: string; errorMessage?: string }
  | {
      ok: false;
      requiresOtp: true;
      email: string;
      emailMasked?: string;
      otpDelivery?: string;
      devOtp?: string;
    };

export type VerifyLoginOtpResult =
  | { ok: true; user: User }
  | { ok: false; errorCode?: string; errorMessage?: string };

interface AuthContextType {
  user: User | null;
  login: (credential: string, password: string) => Promise<LoginResult>;
  verifyLoginOtp: (email: string, otp: string) => Promise<VerifyLoginOtpResult>;
  resendLoginOtp: (credential: string) => Promise<{ ok: boolean; message?: string; devOtp?: string; errorCode?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  patchUser: (fields: Partial<Pick<User, 'name' | 'email' | 'must_change_password'>>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function applyLoginPayload(data: AuthLoginResponse): User | null {
  if (!data.success || !data.user) return null;
  const nextUser = buildUserFromBackend(data.user);
  if (typeof data.must_change_password === 'boolean') {
    nextUser.must_change_password = data.must_change_password;
  }
  persistAuthUser(nextUser, data.token ?? null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth-session-changed'));
    window.dispatchEvent(new Event('school-year-settings-changed'));
  }
  return nextUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const normalized = normalizeStoredUser(JSON.parse(storedUser));
        if (!normalized) {
          clearAuthStorage();
          setUser(null);
          return;
        }
        setUser(normalized);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-session-changed'));
        }
      } catch {
        clearAuthStorage();
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }, [user]);

  const login = async (credential: string, password: string): Promise<LoginResult> => {
    try {
      const response = await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'login', credential, password }),
      });

      const data = (await response.json().catch(() => null)) as AuthLoginResponse | null;
      if (!data) return { ok: false };

      if (data.success && data.requires_otp) {
        return {
          ok: false,
          requiresOtp: true,
          email: String(data.email ?? credential),
          emailMasked: data.email_masked,
          otpDelivery: data.otp_delivery,
          devOtp: data.dev_otp,
        };
      }

      if (data.success && data.user) {
        const nextUser = applyLoginPayload(data);
        if (!nextUser) return { ok: false };
        setUser(nextUser);
        return { ok: true, user: nextUser };
      }

      return { ok: false, errorCode: data.code || data.error, errorMessage: data.message || data.error };
    } catch (error) {
      console.error('Login error:', error);
      return { ok: false, errorCode: 'network_error' };
    }
  };

  const verifyLoginOtp = async (email: string, otp: string): Promise<VerifyLoginOtpResult> => {
    try {
      const response = await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'verify_login_otp', email, otp }),
      });
      const data = (await response.json().catch(() => null)) as (AuthLoginResponse & {
        attempts_remaining?: number;
        retry_after_minutes?: number;
      }) | null;
      if (data?.success && data.user) {
        const nextUser = applyLoginPayload(data);
        if (!nextUser) return { ok: false, errorCode: 'invalid_otp' };
        setUser(nextUser);
        return { ok: true, user: nextUser };
      }
      if (!data) {
        return { ok: false, errorCode: 'server_error' };
      }
      return {
        ok: false,
        errorCode: data.code || data.error || 'invalid_otp',
        errorMessage: data.error,
      };
    } catch (error) {
      console.error('Login OTP error:', error);
      return { ok: false, errorCode: 'server_error' };
    }
  };

  const resendLoginOtp = async (credential: string) => {
    try {
      const response = await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'resend_login_otp', email: credential }),
      });
      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
        dev_otp?: string;
        error?: string;
        code?: string;
      } | null;
      if (data?.success) {
        return { ok: true, message: data.message, devOtp: data.dev_otp };
      }
      return { ok: false, errorCode: data?.code || data?.error || 'resend_failed' };
    } catch {
      return { ok: false, errorCode: 'server_error' };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch {
      // still clear client session
    }
    clearAuthStorage();
    setUser(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth-session-changed'));
    }
  };

  const patchUser = (
    fields: Partial<Pick<User, 'name' | 'email' | 'must_change_password'>>,
  ) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...fields };
      try {
        localStorage.setItem('user', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, verifyLoginOtp, resendLoginOtp, logout, isAuthenticated: !!user, patchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context !== undefined) return context;

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
    verifyLoginOtp: async (): Promise<VerifyLoginOtpResult> => ({ ok: false }),
    resendLoginOtp: async () => ({ ok: false }),
    logout: async () => {
      clearAuthStorage();
    },
    patchUser: () => {},
  };
}
