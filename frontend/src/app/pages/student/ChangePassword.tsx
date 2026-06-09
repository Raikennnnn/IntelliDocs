import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { apiFetch, setSessionToken } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Alert, AlertDescription } from '../../components/ui/alert';
import schoolLogo from '../../../assets/logo.png';
import homePageImage from '../../../assets/homepage-Bxdbuq6s.png';

import { MIN_PASSWORD_LENGTH, validatePassword } from '../../lib/passwordPolicy';

/**
 * Default destination when the user lands on the change-password screen
 * directly (no `from` location was carried through). Matches the rest of
 * the student portal's post-login default.
 */
const DEFAULT_REDIRECT = '/student/dashboard';

/**
 * Map a backend error code from `api/auth.php` `change_password` into a
 * human-readable message. Unknown codes fall back to a generic message.
 */
function describeChangePasswordError(code: string | null | undefined): string {
  switch (code) {
    case 'password_too_short':
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    case 'password_too_weak':
      return 'Password must include letters and numbers and cannot be a single repeated character.';
    case 'Missing user context':
    case 'missing_actor':
      return 'Your session has expired. Please log in again.';
    default:
      return 'Failed to change password. Please try again.';
  }
}

/**
 * Forced-first-login password change screen (Requirements 7.2, 7.3).
 *
 * Flow:
 *   1. The `First_Login_Guard` (in `ProtectedRoute`) redirects any student
 *      with `must_change_password === true` here, preserving the originally
 *      requested location in `location.state.from`.
 *   2. The user enters a new password (twice). Client-side validation
 *      mirrors the backend `password_too_short` rule (length >= 8) and adds
 *      a confirm-password match check that has no backend equivalent.
 *   3. On submit we POST to `/api/auth` with
 *      `{ action: 'change_password', new_password }`. The endpoint clears
 *      `users.must_change_password` server-side and returns
 *      `{ success: true, must_change_password: false }`.
 *   4. We mirror that flag clear into `AuthContext` via `patchUser` so the
 *      guard stops redirecting on the next navigation, then send the user
 *      to the originally requested route (or `/student/dashboard`).
 */
export function ChangePassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, patchUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // The originally requested route is carried by the guard via
  // `Navigate` state. When absent (direct URL hit, refresh, etc.) we fall
  // back to the student dashboard.
  const fromState = (location.state as { from?: { pathname?: string } } | null)?.from;
  const redirectTarget =
    fromState?.pathname && fromState.pathname !== '/student/change-password'
      ? fromState.pathname
      : DEFAULT_REDIRECT;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.ok) {
      setError(passwordCheck.message);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'change_password',
          new_password: newPassword,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; must_change_password?: boolean; token?: string | null; error?: string }
        | null;

      if (!response.ok || !data?.success) {
        // 401 with `Missing user context` means the X-User-Id header was
        // absent — most likely the local session was wiped. Send the user
        // back to login rather than looping the change-password screen.
        if (response.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        setError(
          data?.message ||
            describeChangePasswordError(data?.error),
        );
        return;
      }

      // Clear the forced-change flag in the auth context (and therefore
      // in the persisted user object) so the First_Login_Guard lets the
      // next navigation through. `patchUser` accepts `must_change_password`
      // per the AuthContext contract for this feature.
      patchUser({ must_change_password: false });
      if (data.token) {
        setSessionToken(data.token);
      }
      // Defense in depth: write the cleared flag straight to localStorage
      // as well. ProtectedRoute reads localStorage on mount, and if for any
      // reason this component happens to be rendered outside an
      // AuthProvider (router error boundaries, layout reshuffles), the
      // fallback `useAuth()` returns a no-op `patchUser`. Without this
      // direct write, the navigation below would land on a route whose
      // ProtectedRoute reads stale `must_change_password: true` from
      // storage and bounces the user right back here, clearing the form
      // with no visible feedback.
      try {
        const raw = localStorage.getItem('user');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            parsed.must_change_password = false;
            localStorage.setItem('user', JSON.stringify(parsed));
          }
        }
      } catch {
        // localStorage may be blocked / quota-exceeded; the patchUser call
        // above remains the primary path.
      }
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      console.error('Change password error:', err);
      setError('Failed to change password. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-white">
      {/* Background image — same treatment as the Login screen for visual
          continuity since this screen is the first thing a new student sees. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img
          alt=""
          className="absolute h-full left-0 top-0 w-full object-cover scale-110"
          src={homePageImage}
        />
      </div>
      <div className="absolute inset-0 bg-[rgba(72,0,21,0.32)]" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 w-full bg-[#8B1538] h-[63px] shadow-md z-10 flex items-center px-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10">
            <img alt="School Logo" className="w-full h-full object-contain" src={schoolLogo} />
          </div>
          <div>
            <p className="font-bold text-lg text-white leading-tight">
              Nuestra Señora De Guia
            </p>
            <p className="font-semibold text-xs text-white">Academy of Marikina</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-24">
        <div className="bg-white/85 backdrop-blur-sm border border-gray-300 rounded-lg shadow-lg w-full max-w-[527px] p-8">
          <div className="space-y-6">
            <div>
              <h2 className="font-bold text-2xl text-[#101828] mb-2">Set a New Password</h2>
              <p className="font-normal text-sm text-black">
                {user?.school_username ? (
                  <>
                    Welcome,{' '}
                    <span className="font-semibold">{user.school_username}</span>. For your
                    security, please replace the temporary password before continuing.
                  </>
                ) : (
                  'For your security, please replace the temporary password before continuing.'
                )}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label className="block font-medium text-sm text-black">New Password</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  className="w-full h-12 bg-[#F9FAFB] border-[#D1D5DC] border rounded-lg px-3 text-sm placeholder:text-[#6B7280] focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                />
              </div>

              <div className="space-y-2">
                <label className="block font-medium text-sm text-black">Confirm New Password</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  className="w-full h-12 bg-[#F9FAFB] border-[#D1D5DC] border rounded-lg px-3 text-sm placeholder:text-[#6B7280] focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
                  placeholder="Re-enter your new password"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 bg-[#8B1538] hover:bg-[#8B1538]/90 text-white text-base font-semibold rounded-lg disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Update Password'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
