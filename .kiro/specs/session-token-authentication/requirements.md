# Requirements Document

## Introduction

The IntelliDocs application currently authenticates protected API requests by reading the
`X-User-Id` header — an integer that any captured request can replay forever. Logout only
clears the React `localStorage`; the server retains no session state, so a captured request
remains usable after logout, after idle expiry, and from any IP. A tester who learns or
guesses another user's numeric ID can fully impersonate that user from Postman, because
the role gate (`getUserRole` in `api/user_role.php`) trusts the header-supplied identity.

This feature replaces header-based identity with a server-issued, opaque, cryptographically
random session token. Every protected endpoint resolves the actor from the token (never
from a client-supplied user ID), tokens are revocable on logout and password change,
sessions expire on idle timeout, and every authentication outcome is recorded in
`activity_logs`. The acceptance bar from the test plan is ≥99% invalidation of
expired/logged-out sessions and ≥99% enforcement of role-based access control with
no impersonation possible via captured or guessed user IDs.

The migration follows the codebase's established "feature-detect-only" pattern
(see `api/auth.php` lines 218-275 and `api/user_role.php`): when the new `sessions` table
is absent on a deployment, login still succeeds and endpoints fall back to the legacy
header path so the system security-degrades rather than fails closed.

## Glossary

- **Token_Service**: The PHP module responsible for generating, hashing, validating,
  refreshing, and revoking session tokens. New file: `api/session_token.php`.
- **Auth_API**: The login/logout/change-password endpoint at `api/auth.php`.
- **Auth_Guard**: The drop-in replacement for `runAuthenticatedSecurityGuards` exposed
  as `requireAuthenticatedActor($pdo)`. Resolves the actor from the token, runs the
  existing idle/rate/hours checks against the session row, and returns
  `[id, role, sessionId]`.
- **Protected_Endpoint**: Any `api/*.php` file that performs an authenticated operation,
  including but not limited to `documents.php`, `student_enrollment.php`,
  `document_file.php`, `ai_verify_document.php`, `school_year.php`,
  `registrar_application_detail.php`, `registrar_announcements.php`,
  `registrar_announcement_image.php`, `registrar_document_review.php`,
  `admin_overview.php`, `admin_reports.php`, and `auth.php` action `change_password`.
- **Sessions_Table**: The MySQL table `sessions` storing one row per issued token, with
  columns `id`, `token_hash`, `user_id`, `created_at`, `last_activity_at`, `expires_at`,
  `revoked_at`, `ip_address`, `user_agent`.
- **Session_Token**: A 64-character lowercase hexadecimal string returned to the client
  exactly once on login. The plaintext value is never stored; the SHA-256 hash is stored
  in `Sessions_Table.token_hash`.
- **Authorization_Header**: The HTTP request header `Authorization: Bearer <token>`
  carrying the `Session_Token`.
- **Legacy_Header**: The HTTP request header `X-User-Id` carrying the user's numeric ID,
  used by the pre-migration authentication scheme.
- **Idle_Timeout_Minutes**: The integer environment variable
  `SESSION_IDLE_TIMEOUT_MINUTES`, default 30, controlling idle expiry.
- **Absolute_Lifetime_Hours**: The integer environment variable
  `SESSION_ABSOLUTE_LIFETIME_HOURS`, default 12, controlling maximum session age from
  `created_at`.
- **API_Client**: The React frontend `request()` wrapper in
  `frontend/src/app/lib/api.ts` plus `AuthContext.tsx` and `DashboardLayout.tsx`.
- **Audit_Log**: The existing `activity_logs` table written via `appLogEvent` in
  `api/logging.php`.
- **Login_Throttle**: The existing failed-login-attempt counter in `login_attempts`,
  configured by `AUTH_LOGIN_FAILURE_THRESHOLD` (default 5) and
  `AUTH_LOGIN_FAILURE_WINDOW_MINUTES` (default 15).

## Requirements

### Requirement 1: Sessions Table Bootstrap

**User Story:** As a developer deploying IntelliDocs, I want the sessions table to be
created automatically on first authenticated request, so that I do not need a manual
migration step on XAMPP.

#### Acceptance Criteria

1. WHEN the Auth_API processes any request, THE Token_Service SHALL ensure the
   Sessions_Table exists with columns `id` (BIGINT AUTO_INCREMENT PRIMARY KEY),
   `token_hash` (CHAR(64) NOT NULL UNIQUE), `user_id` (INT NOT NULL),
   `created_at` (TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP),
   `last_activity_at` (TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP),
   `expires_at` (TIMESTAMP NOT NULL),
   `revoked_at` (TIMESTAMP NULL DEFAULT NULL),
   `ip_address` (VARCHAR(64) NULL),
   `user_agent` (VARCHAR(255) NULL),
   and indexes on `user_id`, `expires_at`, and `revoked_at`.
2. IF the `CREATE TABLE` statement fails because the database user lacks DDL privileges,
   THEN THE Token_Service SHALL log a single `session_table_unavailable` event to the
   Audit_Log and THE Auth_API SHALL fall through to the Legacy_Header authentication
   path for the remainder of the request.
3. THE Token_Service SHALL declare `token_hash` as the only UNIQUE constraint on the
   Sessions_Table to guarantee that hash collisions cannot create two sessions with the
   same plaintext token.

### Requirement 2: Token Generation at Login

**User Story:** As an authenticated user, I want the server to issue me a fresh,
unforgeable session token when I log in, so that captured user IDs cannot be reused to
impersonate me.

#### Acceptance Criteria

1. WHEN the Auth_API completes a successful login (action `login` returns
   `success: true`), THE Token_Service SHALL generate a Session_Token using
   `bin2hex(random_bytes(32))` and SHALL persist a row in the Sessions_Table containing
   the SHA-256 hex digest of the Session_Token, the authenticated `user_id`, the current
   timestamp in `created_at` and `last_activity_at`,
   `created_at + Absolute_Lifetime_Hours` in `expires_at`,
   the request's `REMOTE_ADDR` in `ip_address`, and the request's `User-Agent` (truncated
   to 255 characters) in `user_agent`.
2. WHEN the Auth_API returns a successful login response, THE Auth_API SHALL include the
   plaintext Session_Token in a top-level `token` field alongside the existing
   `success`, `user`, and `must_change_password` fields, preserving the existing
   response contract.
3. THE Token_Service SHALL store only the SHA-256 hash of the Session_Token, never the
   plaintext value.
4. WHEN a single login completes, THE Token_Service SHALL produce exactly one row in
   the Sessions_Table.
5. IF the Sessions_Table is unavailable per Requirement 1.2, THEN THE Auth_API SHALL
   omit the `token` field from the login response and SHALL set a
   `legacy_auth_only: true` field so the API_Client can detect the degraded mode.

### Requirement 3: Bearer Token Validation on Protected Endpoints

**User Story:** As a security tester, I want every protected endpoint to require proof
of identity, so that a captured or guessed user ID alone cannot access another user's
data.

#### Acceptance Criteria

1. WHEN a request arrives at a Protected_Endpoint, THE Auth_Guard SHALL read the
   Authorization_Header, extract the Bearer token, and resolve the actor by selecting
   the Sessions_Table row whose `token_hash` equals the SHA-256 hex digest of the
   submitted token.
2. WHEN the Auth_Guard finds a Sessions_Table row whose `revoked_at IS NULL`,
   `expires_at > NOW()`, and idle interval `(NOW() - last_activity_at)` is less than or
   equal to Idle_Timeout_Minutes, THE Auth_Guard SHALL return
   `[id, role, sessionId]` to the Protected_Endpoint and SHALL update
   `last_activity_at` to the current timestamp.
3. WHERE the request carries a valid Authorization_Header, THE Auth_Guard SHALL ignore
   the Legacy_Header entirely and SHALL resolve the actor's `user_id` from the
   Sessions_Table row, never from the Legacy_Header.
4. IF the Authorization_Header is missing AND the Sessions_Table exists AND the Legacy
   migration window flag `AUTH_ALLOW_LEGACY_HEADER` is set to `0`, THEN THE Auth_Guard
   SHALL respond with HTTP 401 and JSON body `{ success: false, error: "unauthorized",
   code: "missing_token" }`.
5. WHERE the Authorization_Header is missing AND `AUTH_ALLOW_LEGACY_HEADER` defaults to
   `1` (the migration window default), THE Auth_Guard SHALL fall back to the
   Legacy_Header path so existing endpoints keep working before they adopt the new
   guard.
6. IF the Authorization_Header is present but the submitted token does not match any
   Sessions_Table row, THEN THE Auth_Guard SHALL respond with HTTP 401 and JSON body
   `{ success: false, error: "unauthorized", code: "invalid_token" }`.

### Requirement 4: Idle Expiry Tied to the Session Row

**User Story:** As a security officer, I want idle session expiry to be tied to the
issued token rather than to the user record, so that a second active session for the
same user does not silently extend the first one's lifetime.

#### Acceptance Criteria

1. WHEN the Auth_Guard validates a Session_Token, THE Auth_Guard SHALL compute idle
   time as `NOW() - sessions.last_activity_at` for the resolved session row only.
2. IF the resolved session's idle time exceeds `Idle_Timeout_Minutes * 60` seconds,
   THEN THE Auth_Guard SHALL respond with HTTP 401 and JSON body
   `{ success: false, error: "session_expired", code: "session_expired",
   details: { idle_minutes: <integer> } }` and SHALL NOT update `last_activity_at`.
3. IF the resolved session's `expires_at` is less than or equal to the current
   timestamp, THEN THE Auth_Guard SHALL respond with HTTP 401 and JSON body
   `{ success: false, error: "session_expired", code: "session_expired",
   details: { reason: "absolute_lifetime" } }`.
4. THE Auth_Guard SHALL NOT read or write the legacy `users.last_activity_at` column
   when validating a token-bearing request.
5. WHEN a request is rejected for idle expiry per Acceptance Criterion 2 or 3, THE
   Token_Service SHALL set `revoked_at = NOW()` on the session row before responding.

### Requirement 5: Logout Revokes the Session Server-Side

**User Story:** As a user clicking the Logout button, I want my session invalidated on
the server, so that a captured pre-logout request cannot be replayed afterwards.

#### Acceptance Criteria

1. WHEN the Auth_API receives a request with action `logout` and a valid
   Authorization_Header, THE Auth_API SHALL set `revoked_at = NOW()` on the matching
   Sessions_Table row and SHALL return HTTP 200 with body
   `{ success: true, message: "logged_out" }`.
2. WHEN any subsequent request arrives with the same Session_Token, THE Auth_Guard
   SHALL respond with HTTP 401 and JSON body
   `{ success: false, error: "session_revoked", code: "session_revoked" }`.
3. WHEN the Auth_API receives action `logout` without a valid Authorization_Header,
   THE Auth_API SHALL return HTTP 200 with body
   `{ success: true, message: "logged_out" }` so the client logout flow is idempotent
   and does not leak whether the token was already revoked.
4. THE Auth_API SHALL NOT delete Sessions_Table rows on logout; revocation SHALL be
   performed by setting `revoked_at` so the audit trail and replay-detection metadata
   remain queryable.

### Requirement 6: Password Change Revokes All Sessions for the User

**User Story:** As a user whose credentials may have been compromised, I want changing
my password to invalidate every active session on every device, so that an attacker
holding a stolen token loses access immediately.

#### Acceptance Criteria

1. WHEN the Auth_API completes a successful `change_password` action for a user, THE
   Token_Service SHALL set `revoked_at = NOW()` on every Sessions_Table row where
   `user_id` equals that user's id AND `revoked_at IS NULL`.
2. WHEN the Auth_API completes a successful `change_password` action invoked by the
   user themselves with a valid Authorization_Header, THE Auth_API SHALL issue a fresh
   Session_Token for that user per Requirement 2 and SHALL return the new token in the
   response body, so the user is not logged out of the tab that just changed the
   password.
3. WHEN an admin-triggered password reset (any future endpoint that mutates
   `users.password`) succeeds, THE Token_Service SHALL revoke every Sessions_Table row
   for the affected `user_id` per Acceptance Criterion 1.

### Requirement 7: Frontend Stores and Sends the Token

**User Story:** As a user of the React frontend, I want the app to remember my session
token across page reloads and attach it to every API call, so that my logged-in
experience is uninterrupted while remaining secure.

#### Acceptance Criteria

1. WHEN the API_Client receives a successful login response containing a `token` field,
   THE API_Client SHALL persist the token under `localStorage` key
   `session_token` alongside the existing `user` object.
2. WHEN the API_Client issues any request via the `request()` wrapper in
   `frontend/src/app/lib/api.ts`, THE API_Client SHALL set
   `Authorization: Bearer <token>` on the outgoing request whenever
   `localStorage.session_token` is a non-empty string.
3. WHILE both `Authorization` and `X-User-Id` headers are sent, THE API_Client SHALL
   continue to send the Legacy_Header during the migration window so endpoints not yet
   updated keep working; the server resolves identity from the token per Requirement
   3.3.
4. WHEN the API_Client receives an HTTP 401 response with `code` equal to
   `session_expired`, `session_revoked`, `invalid_token`, or `missing_token`, THE
   API_Client SHALL remove `session_token` and `user` from `localStorage` and SHALL
   navigate to `/login` with a query string indicating the reason.
5. WHEN the user clicks Logout in `DashboardLayout.tsx`, THE API_Client SHALL POST
   `{ action: "logout" }` to `api/auth.php` with the current Authorization_Header,
   THEN remove `session_token` and `user` from `localStorage`, THEN navigate to
   `/login`.
6. THE API_Client SHALL clear `session_token` from `localStorage` whenever the
   `user` object is cleared, so a partially-cleared client cannot keep authenticating
   with a token whose user record is gone.

### Requirement 8: Token Resists Header Tampering

**User Story:** As a security tester, I want the server to ignore a tampered
`X-User-Id` header when a valid token is presented, so that I cannot impersonate
another user by pairing my own token with someone else's user ID.

#### Acceptance Criteria

1. WHEN a request carries a valid Authorization_Header AND a Legacy_Header whose value
   does not match the Sessions_Table row's `user_id`, THE Auth_Guard SHALL resolve the
   actor's `id` and `role` strictly from the Sessions_Table row and the role tables
   (`admin_users`/`registrar_users`/`student_users`).
2. WHEN the Auth_Guard detects a request whose Authorization_Header `user_id` differs
   from the Legacy_Header value, THE Auth_Guard SHALL log an
   `auth_header_mismatch` event to the Audit_Log with `actor_user_id` set to the
   token-resolved id and `details_json` recording both the token-resolved id and the
   header-claimed id.
3. THE Auth_Guard SHALL NOT use the Legacy_Header to look up role membership when an
   Authorization_Header is present and valid.

### Requirement 9: Wire Format and Error Codes

**User Story:** As a frontend developer, I want a stable contract for authentication
errors, so that I can route the user to the right screen without parsing English text.

#### Acceptance Criteria

1. THE Auth_Guard SHALL return JSON responses whose `code` field is exactly one of
   `missing_token`, `invalid_token`, `session_expired`, `session_revoked`, or
   `auth_disabled` for every authentication-related rejection.
2. THE Auth_Guard SHALL set the HTTP status to `401` for every value of `code`
   enumerated in Acceptance Criterion 1.
3. WHEN the Auth_Guard returns `session_expired`, THE Auth_Guard SHALL include a
   `details.idle_minutes` integer or a `details.reason` string equal to
   `"absolute_lifetime"` so the client can distinguish the two expiry causes.
4. THE Auth_API SHALL return a successful login response whose top-level shape is
   `{ success: true, token: <string|null>, user: { ... existing fields ... },
   must_change_password: <boolean> }`, preserving every existing field of the `user`
   object documented in `api/auth.php` lines 311-323.

### Requirement 10: Backward Compatibility During Rollout

**User Story:** As an operator running an environment that has not yet received the
new schema, I want logins to keep working and existing protected endpoints to keep
serving requests, so that the rollout does not require a synchronized migration.

#### Acceptance Criteria

1. IF the Sessions_Table cannot be created or accessed, THEN THE Auth_API SHALL serve
   a successful login response with `token: null` and `legacy_auth_only: true`, and
   THE Auth_Guard SHALL fall back to the Legacy_Header path on every Protected_Endpoint
   for the duration of the request.
2. WHILE the environment variable `AUTH_ALLOW_LEGACY_HEADER` is set to `1` (default),
   THE Auth_Guard SHALL accept requests that carry only a Legacy_Header and no
   Authorization_Header and SHALL invoke the existing
   `runAuthenticatedSecurityGuards($pdo, $userId, $endpointLabel)` behavior.
3. WHEN the environment variable `AUTH_ALLOW_LEGACY_HEADER` is set to `0`, THE
   Auth_Guard SHALL reject requests carrying only a Legacy_Header per Requirement 3.4.
4. THE Token_Service SHALL NOT remove or rename the legacy `users.last_activity_at`
   column; the column remains untouched so existing reads in `security_guard.php` and
   `admin_overview.php` keep functioning during rollout.
5. WHEN a Protected_Endpoint adopts the new `requireAuthenticatedActor($pdo)` helper,
   THE helper SHALL return a tuple/array of three values
   (`id: int`, `role: string`, `sessionId: int|null`) so a single search-and-replace
   can swap `runAuthenticatedSecurityGuards` for the new helper without restructuring
   the caller.

### Requirement 11: Idle Activity Refresh

**User Story:** As an active user, I want the idle clock to reset whenever I make a
request, so that a busy work session does not get logged out mid-task.

#### Acceptance Criteria

1. WHEN the Auth_Guard validates a Session_Token successfully and the request is
   accepted (no expiry, no revocation), THE Token_Service SHALL update the session
   row's `last_activity_at` to the current timestamp before the Protected_Endpoint
   returns.
2. THE Token_Service SHALL NOT update `last_activity_at` for requests rejected by the
   Auth_Guard.
3. THE Token_Service SHALL NOT extend `expires_at` on activity refresh; the absolute
   lifetime stays anchored to `created_at + Absolute_Lifetime_Hours`.

### Requirement 12: Audit Logging of Authentication Outcomes

**User Story:** As an admin reviewing the activity log, I want every authentication
outcome recorded with consistent action names, so that I can compute the ≥99%
invalidation rate and detect replay attempts.

#### Acceptance Criteria

1. WHEN the Auth_API issues a Session_Token on successful login, THE Auth_API SHALL
   write an `activity_logs` row with `action = 'login_success'`, `module = 'auth'`,
   `status = 'success'`, `actor_user_id = <user id>`, `target_type = 'session'`,
   `target_id = <session id>`, and `details_json` containing the `ip_address` and a
   truncated `user_agent`.
2. WHEN the Auth_API revokes a session via action `logout`, THE Auth_API SHALL write
   an `activity_logs` row with `action = 'logout_success'`, `module = 'auth'`,
   `status = 'success'`, `actor_user_id = <user id>`, `target_type = 'session'`,
   `target_id = <session id>`.
3. WHEN the Auth_Guard rejects a request because the session row's idle interval or
   `expires_at` has elapsed, THE Auth_Guard SHALL write an `activity_logs` row with
   `action = 'session_expired'`, `module = 'auth'`, `status = 'failed'`,
   `actor_user_id = <session.user_id>`, `target_type = 'session'`,
   `target_id = <session id>`.
4. WHEN the Auth_Guard rejects a request because `revoked_at IS NOT NULL`, THE
   Auth_Guard SHALL write an `activity_logs` row with `action = 'session_replay_blocked'`,
   `module = 'auth'`, `status = 'failed'`, `actor_user_id = <session.user_id>`,
   `target_type = 'session'`, `target_id = <session id>`, and `details_json` containing
   the request `ip_address` and `user_agent`.
5. WHEN the Auth_Guard rejects a request because the submitted token does not match
   any Sessions_Table row, THE Auth_Guard SHALL write an `activity_logs` row with
   `action = 'session_token_invalid'`, `module = 'auth'`, `status = 'failed'`,
   `actor_user_id = NULL`, `target_type = 'session'`, `target_id = NULL`, and
   `details_json` containing the request `ip_address` and `user_agent`.
6. THE Token_Service SHALL NOT write the plaintext token, the token hash, or any
   prefix of either to the `activity_logs` table.

### Requirement 13: Coverage of Currently Unguarded Endpoints

**User Story:** As a developer hardening the API surface, I want every protected
endpoint to run the Auth_Guard, so that no module silently trusts the Legacy_Header
without going through the session checks.

#### Acceptance Criteria

1. THE Auth_Guard SHALL be invoked at the top of every Protected_Endpoint listed in
   the Glossary, including `documents.php`, `student_enrollment.php`,
   `document_file.php`, `ai_verify_document.php`, `school_year.php`,
   `registrar_application_detail.php`, `registrar_announcements.php`,
   `registrar_announcement_image.php`, `registrar_document_review.php`,
   `admin_overview.php`, `admin_reports.php`, and `auth.php` action `change_password`,
   before any database read or write touches user-owned data.
2. WHEN a Protected_Endpoint requires a specific role, THE Protected_Endpoint SHALL
   call `getUserRole($pdo, <id from Auth_Guard>)` using the id returned by the
   Auth_Guard, never the value of the Legacy_Header.
3. WHERE the `requireAuthenticatedActor($pdo)` helper rejects the request, THE helper
   SHALL emit the JSON response and call `exit;` so the calling endpoint cannot
   accidentally continue execution after a failed authentication.

### Requirement 14: Security Acceptance Bar

**User Story:** As a project owner, I want the system to demonstrably block the two
attack-simulation scenarios at the contracted rate, so that the test plan can be
signed off.

#### Acceptance Criteria

1. WHEN a Session_Token is replayed against any Protected_Endpoint after the matching
   `logout_success` event has been recorded, THE Auth_Guard SHALL return HTTP 401 with
   `code = "session_revoked"` for at least 99 of every 100 such replays observed in
   the test harness.
2. WHEN a Session_Token is replayed against any Protected_Endpoint more than
   `Idle_Timeout_Minutes` after its last accepted use, THE Auth_Guard SHALL return
   HTTP 401 with `code = "session_expired"` for at least 99 of every 100 such replays
   observed in the test harness.
3. WHEN a request arrives at any Protected_Endpoint with a Legacy_Header set to a
   user ID different from the Authorization_Header's session owner, THE Auth_Guard
   SHALL resolve the actor as the token owner in 100 of every 100 such requests
   observed in the test harness.
4. WHEN a request arrives at any Protected_Endpoint with no Authorization_Header,
   only a Legacy_Header, AND `AUTH_ALLOW_LEGACY_HEADER = 0`, THE Auth_Guard SHALL
   return HTTP 401 with `code = "missing_token"` in 100 of every 100 such requests
   observed in the test harness.

### Requirement 15: Cleanup of Stale Session Rows

**User Story:** As an operator running the system long-term, I want expired session
rows to not accumulate forever, so that the `sessions` table stays a useful
audit/replay-detection store without growing unbounded.

#### Acceptance Criteria

1. WHEN the Auth_API processes a successful login, THE Token_Service SHALL delete
   Sessions_Table rows whose `expires_at` is older than 7 days AND whose `revoked_at`
   is older than 7 days, in a single best-effort statement.
2. IF the cleanup statement fails, THEN THE Token_Service SHALL attempt to log a
   single `session_cleanup_failed` event to the Audit_Log and SHALL continue the
   login flow regardless of whether that log write succeeds.
3. THE Token_Service SHALL NOT delete Sessions_Table rows whose `revoked_at` is
   within the last 7 days, so replay detection retains recent revocation history.
