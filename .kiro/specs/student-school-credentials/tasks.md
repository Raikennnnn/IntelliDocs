# Implementation Plan: Student School Credentials

## Overview

This plan turns the design into incremental, code-only steps for the IntelliDocs PHP backend (CodeIgniter-style `api/*.php` files) and React/TypeScript frontend. Work proceeds bottom-up: schema migration first, then the pure `Username_Generator`, then the registrar approve flow, then auth (login + change-password), then `Student_API` adjustments, then the frontend `First_Login_Guard` and public-page privacy audit. Property-based tests are written close to the code they exercise (PHP via Eris, TS via fast-check) so regressions surface early.

## Tasks

- [x] 1. Add credentials schema migration and lazy-bootstrap helper
  - [x] 1.1 Author `database_migration_credentials.sql` migration script
    - Create the SQL file at the repo root alongside the existing migrations
    - Add `ALTER TABLE users ADD COLUMN` statements for `first_name`, `middle_name`, `last_name`, `extension_name`, `school_username`, `must_change_password` per the design
    - Add `ALTER TABLE users ADD UNIQUE INDEX uniq_users_school_username (school_username)`
    - Document run-order header comment referencing the prior migrations
    - _Requirements: 1.1, 3.1, 3.2, 7.5_

  - [x] 1.2 Implement `ensureCredentialsSchema(PDO $pdo)` helper
    - Add the helper at the top of `api/registrar_application_detail.php` mirroring `ensureEnrollmentSchema()` from `api/student_enrollment.php`
    - Guard each column add with `columnExists($pdo, 'users', $col)` and skip silently if `users` table is absent
    - Guard the unique index add with an `INFORMATION_SCHEMA.STATISTICS` lookup
    - Call the helper once immediately after the role check, before any handler dispatch
    - _Requirements: 1.5, 3.2, 7.5_

  - [ ]* 1.3 Write smoke test asserting migration adds columns and preserves rows
    - Add `tests/api/CredentialsMigrationTest.php`
    - Seed a row, run the migration, assert the new columns exist with NULL / 0 defaults and the seeded row is unchanged
    - _Requirements: 1.5, 3.2, 7.5_

- [x] 2. Implement and test the `Username_Generator`
  - [x] 2.1 Implement `generateSchoolUsername` and `resolveSchoolUsernameCollision` in `api/username_generator.php`
    - Create the new file `api/username_generator.php` with no DB access in `generateSchoolUsername`
    - Implement the transliterate → lowercase → strip-non-letters → concatenate `fi + mi + ln` → truncate-to-32 algorithm from the design
    - Return `[null, 'invalid_name']` when first or last name yields no ASCII letters
    - Implement `resolveSchoolUsernameCollision(PDO, string, ?int)` looping `N = 2, 3, ...` with a 1000-attempt defensive cap
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.3, 3.4_

  - [ ]* 2.2 Write property test for username structure rule
    - Create `tests/api/UsernameGeneratorPropertyTest.php` using Eris
    - **Property 1: Username structure follows the initials-plus-lastname rule**
    - **Validates: Requirements 2.1**

  - [ ]* 2.3 Write property test for username output shape invariant
    - Add to `tests/api/UsernameGeneratorPropertyTest.php`
    - **Property 2: Username output shape invariant**
    - **Validates: Requirements 2.2, 2.3, 2.5**

  - [ ]* 2.4 Write property test for letter-free input rejection
    - Add to `tests/api/UsernameGeneratorPropertyTest.php`
    - **Property 3: Username generator rejects letter-free inputs**
    - **Validates: Requirements 2.4**

  - [ ]* 2.5 Write property test for username generator determinism
    - Add to `tests/api/UsernameGeneratorPropertyTest.php`
    - **Property 4: Username generator is deterministic**
    - **Validates: Requirements 2.6**

  - [ ]* 2.6 Write property test for collision resolution and global uniqueness
    - Create `tests/api/CollisionResolverPropertyTest.php`
    - **Property 5: Collision resolver picks the smallest unused suffix and preserves global uniqueness**
    - **Validates: Requirements 3.3, 3.4**

- [x] 3. Checkpoint - validate schema and generator
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extend the registrar approve flow to issue credentials
  - [x] 4.1 Add schema-guard short-circuit and conflict check at top of approve branch
    - In `api/registrar_application_detail.php`, inside the `approve` branch, check `columnExists` for each new credential column and return HTTP 503 `schema_not_migrated` with `details.missing` listing absent columns
    - Read the target user row and return HTTP 409 `credentials_already_issued` when `users.school_username` is non-NULL
    - _Requirements: 1.5, 4.5, 7.5_

  - [x] 4.2 Parse name parts and date of birth from `enrollment_steps.form_data`
    - Extract `givenName`, `middleName`, `lastName`, `extensionName`, `dateOfBirth` from the latest enrollment step's form data
    - Validate `dateOfBirth` parses as `YYYY-MM-DD`; return HTTP 422 `missing_birth_date` otherwise (no DB write)
    - Format the temporary password as `mm-dd-yyyy` with zero-padded month and day
    - _Requirements: 4.2, 4.3, 4.3a_

  - [x] 4.3 Wire `Username_Generator` into approve and resolve collisions
    - `require_once 'username_generator.php'` and call `generateSchoolUsername`; on error return HTTP 422 `invalid_name` (no DB write)
    - Call `resolveSchoolUsernameCollision($pdo, $candidate)` to obtain the final value
    - _Requirements: 2.1, 3.3, 3.4, 4.2, 4.6_

  - [x] 4.4 Perform credential issuance inside a single DB transaction
    - Begin transaction, backfill `users.first_name|middle_name|last_name|extension_name` from form data
    - Write `users.school_username`, `users.password = password_hash(temporaryPassword, PASSWORD_DEFAULT)`, `users.must_change_password = 1`
    - Best-effort update `enrollments.status = 'approved'` and `registrar_remarks`; on failure keep credential writes and surface `status_transition: "failed"` warning
    - Commit
    - _Requirements: 1.2, 4.2, 4.3, 4.4, 4.4a_

  - [x] 4.5 Build the approve response payload
    - Return `success: true` with `school_username`, `email_delivery` (filled by 4.7), `status_transition`, optional `warnings`
    - Ensure the cleartext temporary password is never present in the response
    - _Requirements: 4.4, 4.4a, 5.5_

  - [ ]* 4.6 Write property test for credential issuance round-trip
    - Create `tests/api/IssueCredentialsPropertyTest.php` using an in-memory PDO double
    - **Property 7: Credential issuance round-trip**
    - **Validates: Requirements 4.2, 4.3, 4.4, 7.1, 7.4**

  - [ ]* 4.7 Write property test for issuance error preserves state
    - Add to `tests/api/IssueCredentialsPropertyTest.php`
    - **Property 8: Issuance error preserves state**
    - **Validates: Requirements 4.3, 4.5, 4.6**

  - [ ]* 4.8 Write property test for downstream-failure tolerance
    - Add to `tests/api/IssueCredentialsPropertyTest.php`
    - **Property 9: Downstream failures do not roll back credentials**
    - **Validates: Requirements 4.4, 5.4**

  - [ ]* 4.9 Write property test for schema-guard fail-closed behavior
    - Create `tests/api/SchemaGuardPropertyTest.php` parameterized over subsets of credential columns reported absent by a PDO double
    - **Property 18: Registrar approve fails closed when the credentials schema is not migrated**
    - **Validates: Requirements 1.5, 4.5, 7.5**

- [x] 5. Implement Welcome_Email rendering and queueing
  - [x] 5.1 Add Welcome_Email template renderer
    - Add a `renderWelcomeEmail(array $vars): array` helper (returns `['subject' => ..., 'body' => ...]`) in `api/registrar_application_detail.php` or a small `api/welcome_email.php` file
    - Use the plain-text template from the design with `{first_name}`, `{school_username}`, `{temporary_password}`, `{app_host}` placeholders; no HTML
    - Read `APP_PUBLIC_URL` for the host
    - _Requirements: 5.2, 5.3_

  - [x] 5.2 Queue and dispatch the Welcome_Email after credential commit
    - After the transaction commits in 4.4, call `queueEmail(...)` and `processSingleQueuedEmail(...)` from `api/mailer.php`
    - On send failure, log via existing logging facility, set `email_delivery: "failed"`, append `welcome_email_not_sent` to the response `warnings`, do NOT roll back credentials
    - On success, set `email_delivery: "sent"`
    - _Requirements: 5.1, 5.4_

  - [x] 5.3 Add `issue_credentials` activity log entry
    - Call `appLogEvent(action="issue_credentials", module="registrar", target_type="user", target_id=<user_id>, details_json={ school_username, email_delivery, status_transition, warnings })`
    - Ensure the temporary password is never written into `details_json`
    - _Requirements: 5.5_

  - [ ]* 5.4 Write property test for Welcome_Email body contents
    - Create `tests/api/WelcomeEmailRenderingPropertyTest.php`
    - **Property 10: Welcome email body contains required pieces and is plain text**
    - **Validates: Requirements 5.2, 5.3, 9.3**

  - [ ]* 5.5 Write property test asserting temporary password is never persisted outside the email
    - Create `tests/api/IssueCredentialsLeakPropertyTest.php`
    - **Property 11: Temporary password is never persisted outside the email**
    - **Validates: Requirements 5.5**

- [x] 6. Checkpoint - validate registrar approve flow end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Extend `api/auth.php` login to accept email or school_username with throttling
  - [x] 7.1 Add defensive column guards on the auth path
    - In `api/auth.php` login action, check `columnExists($pdo, 'users', 'school_username')` before the school-username lookup; skip the second lookup branch when absent
    - Check `columnExists($pdo, 'users', 'must_change_password')` before reading the flag; default to `false` when absent
    - Do NOT call any `ALTER TABLE` from the auth path
    - _Requirements: Pres.3 (preservation requirement)_

  - [x] 7.2 Implement throttle pre-check using `login_attempts`
    - Compute `lookup_value = lowercase(trim(credential or email))`
    - Read `AUTH_LOGIN_FAILURE_THRESHOLD` (default 5) and `AUTH_LOGIN_FAILURE_WINDOW_MINUTES` (default 15) from env
    - Count failed `login_attempts` rows where `email = lookup_value` AND `success = 0` AND `attempted_at >= NOW() - INTERVAL <window> MINUTE`
    - When count `>= threshold`, insert a failed attempt and return HTTP 401 `account_locked` with `code: "throttled"`
    - Skip throttle when `login_attempts` table is absent (existing pattern)
    - _Requirements: 11.1, 11.2, 11.4, 11.5_

  - [x] 7.3 Implement dual-identifier user lookup
    - Read `credential` (fallback to legacy `email` field) from request; reject empty with 422
    - First `SELECT ... FROM users WHERE email = :v LIMIT 1`; if no row, retry `WHERE school_username = :v LIMIT 1` (only when column guard from 7.1 passed)
    - On no row OR `password_verify` fail, insert a failed `login_attempts` row and return generic 401 `invalid_credentials` with identical body shape in both cases
    - _Requirements: 6.1, 6.3, 6.4, 11.1_

  - [x] 7.4 Issue success response and clear failed-attempt window
    - Insert `login_attempts(email=lookup_value, success=1)`
    - `UPDATE login_attempts SET success = 1 WHERE email = :v AND success = 0 AND attempted_at >= NOW() - INTERVAL <window> MINUTE` to clear the window
    - Return `user` payload (id, username, email, school_username, full_name, first_name, middle_name, last_name, extension_name, role) plus `must_change_password` boolean
    - _Requirements: 6.2, 7.1, 7.4, 11.3_

  - [ ]* 7.5 Write property test for login by email and by school_username
    - Create `tests/api/AuthLookupPropertyTest.php`
    - **Property 12: Login by email and login by school_username resolve to the same identity**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 7.6 Write property test for indistinguishable auth-failure responses
    - Add to `tests/api/AuthLookupPropertyTest.php`
    - **Property 13: Auth failure responses are indistinguishable**
    - **Validates: Requirements 6.3, 6.4**

  - [ ]* 7.7 Write property test for login throttle blocking
    - Create `tests/api/LoginThrottlePropertyTest.php`
    - **Property 15: Login throttle blocks attempts above the threshold within the window**
    - **Validates: Requirements 11.1, 11.2, 11.4**

  - [ ]* 7.8 Write property test for throttle reset on success
    - Add to `tests/api/LoginThrottlePropertyTest.php`
    - **Property 16: Successful login resets the throttle counter**
    - **Validates: Requirements 11.3**

  - [ ]* 7.9 Write example test for env-overridable threshold
    - Add to `tests/api/LoginThrottlePropertyTest.php` (or a sibling example test)
    - Set `AUTH_LOGIN_FAILURE_THRESHOLD=3` and assert the threshold is honored
    - _Requirements: 11.5_

- [x] 8. Add `change_password` action and update Student_API
  - [x] 8.1 Implement `change_password` action in `api/auth.php`
    - Resolve actor via `getActorUser`; return 401 if missing
    - Validate `new_password` length `>= 8`
    - `UPDATE users SET password = :hash, must_change_password = 0 WHERE id = :id`
    - Log `appLogEvent(action="change_password", status="success", actor=$id)`
    - Return `{ success: true, must_change_password: false }`
    - _Requirements: 7.3_

  - [x] 8.2 Extend `api/student_me.php` profile response
    - Prefer `users.first_name|middle_name|last_name|extension_name` when non-NULL; fall back to `enrollment_steps.form_data` otherwise
    - Include `school_username` and `must_change_password` in the response
    - _Requirements: 1.3, 1.4, 7.1, 7.4_

  - [x] 8.3 Backfill name columns on student enrollment submission
    - In `api/student_enrollment.php` (or wherever enrollment submission updates `users`), backfill `users.first_name|middle_name|last_name|extension_name` from `form_data` for the submitting user
    - Guard with `columnExists` so older schemas are tolerated
    - _Requirements: 1.2_

  - [ ]* 8.4 Write property test for change_password round-trip
    - Create `tests/api/ChangePasswordPropertyTest.php`
    - **Property 14: Password change is a round trip**
    - **Validates: Requirements 7.3**

  - [ ]* 8.5 Write property test for Student_API name-source selection
    - Create `tests/api/StudentMeNameSelectionPropertyTest.php`
    - **Property 6: Student_API name selection prefers `users.*` when non-NULL, otherwise `form_data`**
    - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 9. Checkpoint - validate auth and student profile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Frontend: First_Login_Guard, change-password screen, AuthContext updates
  - [x] 10.1 Extend `AuthUser` type and `AuthContext` to carry credentials fields
    - Update `frontend/src/app/context/AuthContext.tsx` with the `AuthUser` interface from the design (`school_username`, name parts, `must_change_password`)
    - Hydrate `must_change_password` from the login response
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 10.2 Implement `First_Login_Guard` route wrapper
    - Wrap or extend `frontend/src/app/components/ProtectedRoute.tsx` so authenticated routes redirect to `/student/change-password` whenever `must_change_password === true`, except the change-password route itself
    - _Requirements: 7.2_

  - [x] 10.3 Build the change-password screen and wire to `auth.php`
    - Add `frontend/src/app/pages/student/ChangePassword.tsx` with a single new-password form (length validation matching backend)
    - On submit, call `apiFetch('/auth.php', { action: 'change_password', new_password })`
    - On success, update `AuthContext` to clear `must_change_password` and navigate to the originally requested route (or `/student` by default)
    - Register the route in the app router
    - _Requirements: 7.2, 7.3_

  - [x] 10.4 Update login form to send `credential` instead of `email`
    - Update the login UI/component to label the field "Email or School Username" and POST as `{ action: "login", credential, password }`
    - Display the throttle response with a generic "Too many failed attempts" message
    - _Requirements: 6.1, 11.2_

  - [ ]* 10.5 Write fast-check property test for First_Login_Guard routing
    - Add `frontend/src/app/components/__tests__/FirstLoginGuard.test.tsx`
    - Property: across arbitrary `AuthUser` values, the guard redirects to `/student/change-password` iff `must_change_password === true` AND the current path is not `/student/change-password`
    - _Requirements: 7.2_

- [x] 11. Public-page privacy audit
  - [x] 11.1 Add a backend allow-list helper for public response shaping
    - Add a small helper that strips `full_name`, `first_name`, `middle_name`, `last_name`, `extension_name` from any structure returned by an unauthenticated endpoint
    - Audit each `api/*.php` endpoint reachable without `X-User-Id` and apply the helper or replace `SELECT *` with explicit allow-listed columns
    - _Requirements: 8.1, 8.2_

  - [x] 11.2 Apply placeholder-or-omit policy on public frontend pages
    - Audit `frontend/src/app/pages/public/*` (landing, about, admissions, contact, registration, events, strand-info, application form) and remove or replace any `users.*name*` references
    - Read `PUBLIC_STUDENT_PLACEHOLDER` at build time; when set, render the placeholder; when unset, omit the reference entirely
    - _Requirements: 8.3, 8.4_

  - [ ]* 11.3 Write property test that public endpoints never expose name fields
    - Create `tests/api/PublicEndpointsPrivacyPropertyTest.php` parameterized over the public-endpoint allow-list
    - **Property 17: Public endpoints never expose name fields**
    - **Validates: Requirements 8.1, 8.2**

- [x] 12. Final checkpoint - ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP, but the property tests in particular are how the universal correctness properties from the design get verified — skipping them lowers confidence.
- Property test sub-tasks are placed adjacent to the implementation they verify so regressions surface as soon as the code lands.
- Each task references granular requirements clauses for traceability.
- The auth path stays additive and tolerant: it never calls `ALTER TABLE` and silently degrades when the credentials migration has not yet run, while the registrar approve path fails loud (HTTP 503 `schema_not_migrated`) when the schema is missing — that asymmetry is captured by Property 18.
- The Welcome_Email send and the post-credential `enrollments.status` update are both best-effort and surface via `warnings` rather than rolling back credential writes.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "2.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "4.1", "7.1"] },
    { "id": 2, "tasks": ["4.2", "4.3", "7.2", "8.3", "10.1", "11.1"] },
    { "id": 3, "tasks": ["4.4", "7.3", "8.1", "8.2", "10.4", "11.2"] },
    { "id": 4, "tasks": ["4.5", "5.1", "7.4", "10.2", "11.3"] },
    { "id": 5, "tasks": ["5.2", "5.3", "10.3"] },
    { "id": 6, "tasks": ["4.6", "4.7", "4.8", "4.9", "5.4", "5.5", "7.5", "7.6", "7.7", "7.8", "7.9", "8.4", "8.5", "10.5"] }
  ]
}
```
