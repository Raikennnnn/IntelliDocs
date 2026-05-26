# Requirements Document

## Introduction

This feature is Batch 1 of the mentor-feedback work for IntelliDocs, the school enrollment system used by Nuestra Senora De Guia Academy (NSDGA). It introduces a first-class identity model for student users by (a) adding structured name columns to the `users` table, (b) issuing a system-assigned `school_username` when a registrar approves an enrollment application, (c) sending a transactional welcome email containing the school username and a temporary password through Brevo, (d) allowing students to log in with either their personal email or the assigned school username, and (e) forcing a password change on the student's first login after credentials are issued. The feature also performs a privacy audit so that student names never appear on unauthenticated public pages.

The change is additive: it does not break existing seeded accounts, all new columns are nullable with safe defaults, and welcome-email failures must not roll back credential issuance.

## Glossary

- **System**: The IntelliDocs application as a whole (CodeIgniter 4 backend, React/Vite frontend, Flask AI service).
- **Auth_API**: The PHP endpoint at `api/auth.php` that handles login and session creation.
- **Registrar_API**: The PHP endpoint at `api/registrar_application_detail.php` that exposes the registrar's per-application approval action.
- **Username_Generator**: The backend component (a PHP function inside the `api/` layer) that derives a `school_username` from a student's name parts.
- **Mailer**: The Brevo-backed transactional mail component implemented in `api/mailer.php`.
- **Welcome_Email**: The transactional email sent to a student when credentials are first issued. Contains the school username, the temporary password, and instructions to log in and change the password.
- **Student_API**: The PHP endpoint at `api/student_me.php` that returns the authenticated student's identity payload.
- **Public_Page**: Any frontend route that is reachable without an authenticated session (landing, about, admissions, contact, registration, login).
- **First_Login_Guard**: The frontend logic that intercepts post-login navigation when `must_change_password = 1` and routes the user to the password-change screen.
- **School_Username**: The system-assigned identifier stored in `users.school_username`. ASCII-only, lowercased, no punctuation, of the form `{firstInitial}{middleInitial}{lastName}` with an optional numeric suffix for collisions.
- **Personal_Email**: The student-supplied email address stored in `users.email`. Used for login and is the address Welcome_Email is delivered to.
- **Temporary_Password**: A password derived from the student's date of birth at credential-issuance time, formatted as `mm-dd-yyyy` (zero-padded month and day, four-digit year, hyphen separators). Stored as a hash in `users.password` and delivered once via Welcome_Email. Example: a student born September 11, 2004 yields `09-11-2004`.
- **Must_Change_Password_Flag**: The boolean column `users.must_change_password` (TINYINT(1), default 0) that is set to 1 when credentials are issued and cleared to 0 when the user submits a new password.

## Requirements

### Requirement 1: Structured Name Columns on Users

**User Story:** As a registrar, I want student names stored in dedicated database columns, so that the System can query and display names without parsing the enrollment form JSON blob.

#### Acceptance Criteria

1. THE System SHALL add the columns `first_name VARCHAR(100) NULL`, `middle_name VARCHAR(100) NULL`, `last_name VARCHAR(100) NULL`, and `extension_name VARCHAR(20) NULL` to the `users` table.
2. WHEN a student submits an enrollment form, THE System SHALL backfill `users.first_name`, `users.middle_name`, `users.last_name`, and `users.extension_name` from the corresponding `form_data.givenName`, `form_data.middleName`, `form_data.lastName`, and `form_data.extensionName` values for the submitting user.
3. WHEN the Student_API returns the authenticated student's identity payload AND `users.first_name` is non-NULL, THE Student_API SHALL return the value of `users.first_name`, `users.middle_name`, `users.last_name`, and `users.extension_name` as the `first_name`, `middle_name`, `last_name`, and `extension_name` fields.
4. WHEN the Student_API returns the authenticated student's identity payload AND `users.first_name` is NULL, THE Student_API SHALL fall back to deriving `first_name`, `middle_name`, `last_name`, and `extension_name` from the latest `enrollments.enrollment_steps` JSON blob for that user.
5. THE System SHALL preserve all existing rows in the `users` table without populating the new columns at migration time.

### Requirement 2: School Username Generation

**User Story:** As a student, I want a memorable school-issued username that follows a predictable rule, so that I can share it with school staff without confusion.

#### Acceptance Criteria

1. WHEN the Username_Generator is invoked with a first name, an optional middle name, and a last name, THE Username_Generator SHALL produce a candidate username equal to the lowercased ASCII concatenation of the first character of the first name, the first character of the middle name (or empty string if no middle name is provided), and the last name with all whitespace and punctuation removed.
2. THE Username_Generator SHALL transliterate non-ASCII characters in name inputs to their closest ASCII equivalents before applying the rule in Acceptance Criterion 1.
3. THE Username_Generator SHALL truncate any candidate username longer than 32 characters to its first 32 characters.
4. IF a name input contains no ASCII letters after transliteration, THEN THE Username_Generator SHALL return an error and the System SHALL NOT assign a school_username.
5. THE Username_Generator SHALL produce output matching the regular expression `^[a-z][a-z0-9]{0,30}[a-z0-9]$` for any non-error result of length at least 2.
6. WHEN the Username_Generator is invoked twice with the same first name, middle name, and last name inputs, THE Username_Generator SHALL produce the same candidate username both times (deterministic).

### Requirement 3: School Username Storage and Uniqueness

**User Story:** As a system administrator, I want school usernames to be unique across the user base, so that each student has a single unambiguous identifier.

#### Acceptance Criteria

1. THE System SHALL add the column `school_username VARCHAR(32) NULL UNIQUE` to the `users` table.
2. THE `users.school_username` column SHALL default to NULL for every row at migration time and for every newly created user before credential issuance.
3. WHEN credential issuance produces a candidate username that already exists in `users.school_username` for any other row, THE System SHALL append the smallest integer N >= 2 such that the resulting concatenation `{candidate}{N}` does not exist in `users.school_username` and SHALL store that suffixed value.
4. THE System SHALL enforce that for any two distinct rows in `users`, the values of `school_username` are either both NULL or are not equal.
5. WHERE the regular UI is used, THE System SHALL treat `users.school_username` as immutable once set and SHALL reject any update request to that column from a non-admin role.

### Requirement 4: Approve and Issue Credentials Action

**User Story:** As a registrar, I want a single "Approve & Issue Credentials" action on a pending application, so that I can approve a student and provision their school account in one step.

#### Acceptance Criteria

1. WHEN the registrar views a pending application's detail view, THE System SHALL display an "Approve & Issue Credentials" action.
2. WHEN the registrar invokes the "Approve & Issue Credentials" action on an application whose owning user has `users.school_username` equal to NULL, THE Registrar_API SHALL derive the student's first, middle, and last name from the enrollment form data, invoke the Username_Generator, resolve any collision per Requirement 3, and write the resolved value to `users.school_username` for the owning user.
3. WHEN the "Approve & Issue Credentials" action successfully assigns a school_username, THE Registrar_API SHALL derive the Temporary_Password by reading the student's date of birth from the enrollment form data, formatting it as `mm-dd-yyyy` per the Temporary_Password definition, hashing the result using the System's standard password hash function, writing the hash to `users.password`, and setting `users.must_change_password` to 1.
3a. IF the enrollment form data does not contain a parseable date of birth in `YYYY-MM-DD` format, THEN THE Registrar_API SHALL return an error indicating the application is missing a valid birth date and SHALL NOT modify `users.school_username`, `users.password`, `users.must_change_password`, or the application's status.
4. WHEN the "Approve & Issue Credentials" action successfully assigns credentials, THE Registrar_API SHALL attempt to transition the application's status to `approved`.
4a. IF the application's status transition to `approved` fails after credentials have been assigned, THEN THE Registrar_API SHALL keep the assigned `users.school_username`, `users.password`, and `users.must_change_password` values intact and SHALL return a success response that includes a warning indicating the status transition did not complete.
5. IF the "Approve & Issue Credentials" action is invoked on an application whose owning user already has a non-NULL `users.school_username`, THEN THE Registrar_API SHALL return an error indicating credentials have already been issued and SHALL NOT modify `users.school_username`, `users.password`, or `users.must_change_password`.
6. IF the Username_Generator returns an error per Requirement 2 Acceptance Criterion 4, THEN THE Registrar_API SHALL return an error describing the missing or invalid name input and SHALL NOT change the application's status.

### Requirement 5: Welcome Email Delivery

**User Story:** As a newly approved student, I want to receive a welcome email with my school username and temporary password, so that I can log in to the system for the first time.

#### Acceptance Criteria

1. WHEN credential issuance per Requirement 4 succeeds, THE Mailer SHALL send a Welcome_Email to the value of `users.email` for the owning user.
2. THE Welcome_Email SHALL contain a greeting addressed to the student's first name, the assigned `school_username`, the cleartext Temporary_Password, and instructions describing how to log in and change the password.
3. THE Welcome_Email SHALL be sent in plain-text, multi-line format readable without HTML rendering.
4. IF the Mailer fails to deliver the Welcome_Email, THEN THE System SHALL log the failure, SHALL keep the assigned `users.school_username`, `users.password`, `users.must_change_password`, and application status changes intact, and SHALL return a success response to the registrar that includes a warning indicating the email did not send.
5. THE System SHALL NOT include the Temporary_Password in any persisted log line or in any response payload other than the Welcome_Email body.

### Requirement 6: Login Accepts Email or School Username

**User Story:** As a student, I want to sign in with either my personal email or my school username, so that I can use whichever identifier I remember.

#### Acceptance Criteria

1. WHEN the Auth_API receives a login request with a credential value and a password, THE Auth_API SHALL look up a user whose `users.email` equals the credential value, then if no user is found SHALL look up a user whose `users.school_username` equals the lowercased credential value.
2. WHEN the Auth_API resolves a user by either lookup AND the supplied password verifies against `users.password`, THE Auth_API SHALL create a session for that user and SHALL return the same identity payload regardless of which identifier was supplied.
3. IF the Auth_API receives a login request whose credential value matches no row by either lookup, THEN THE Auth_API SHALL return an authentication-failed response and SHALL NOT disclose which lookup failed.
4. IF the Auth_API receives a login request whose credential value matches a row but whose password does not verify, THEN THE Auth_API SHALL return an authentication-failed response indistinguishable from the response in Acceptance Criterion 3.

### Requirement 7: Force Password Change on First Login

**User Story:** As a student receiving a temporary password, I want to be required to set a new password before I can use the dashboard, so that the temporary password is not reused.

#### Acceptance Criteria

1. WHEN the Auth_API returns a successful login response AND the resolved user has `users.must_change_password` equal to 1, THE Auth_API SHALL include a `must_change_password` boolean field equal to true in the response payload.
2. WHEN the frontend receives an authentication response with `must_change_password` equal to true, THE First_Login_Guard SHALL route the user to the password-change screen and SHALL prevent navigation to any other authenticated route until the password is changed.
3. WHEN a user submits a new password through the password-change screen AND the new password satisfies the System's password validation rules, THE System SHALL update `users.password` to the hash of the new password and SHALL set `users.must_change_password` to 0.
4. WHEN `users.must_change_password` is 0 for a user, THE Auth_API SHALL include `must_change_password` equal to false in successful login responses for that user.
5. THE System SHALL add the column `must_change_password TINYINT(1) NOT NULL DEFAULT 0` to the `users` table and SHALL leave the value at 0 for every row that exists at migration time.

### Requirement 8: Public Page Privacy

**User Story:** As a student or guardian, I want my name to never appear on unauthenticated pages, so that my identity is not exposed to the public web.

#### Acceptance Criteria

1. THE System SHALL NOT render `users.full_name`, `users.first_name`, `users.middle_name`, `users.last_name`, or `users.extension_name` on any Public_Page response.
2. THE System SHALL NOT include any of the columns listed in Acceptance Criterion 1 in the response payload of any unauthenticated API endpoint.
3. WHEN a Public_Page needs to reference a student in copy or examples AND a generic placeholder is configured, THE Public_Page SHALL use that generic placeholder rather than a real student name.
4. IF a Public_Page would need to reference a student AND no generic placeholder is configured, THEN THE Public_Page SHALL omit the student reference entirely.

### Requirement 9: Personal Email Reuse

**User Story:** As an architect, I want the personal email to remain in the existing `users.email` column, so that we do not introduce a duplicate address column.

#### Acceptance Criteria

1. THE System SHALL continue to store the student-supplied personal email in `users.email`.
2. THE System SHALL NOT add a `personal_email` column to the `users` table.
3. THE System SHALL treat `users.school_username` as an identifier only and SHALL NOT format or transmit it as an email address.
4. WHEN a student registers a new account, THE System SHALL require a personal email and SHALL store the supplied value in `users.email`.

### Requirement 11: Login Throttling

**User Story:** As a system administrator, I want repeated failed login attempts to be throttled, so that the predictable Temporary_Password format cannot be brute-forced from a single source.

#### Acceptance Criteria

1. WHEN the Auth_API receives a login request whose credential value matches a row in `users.email` or `users.school_username` AND the supplied password fails to verify, THE Auth_API SHALL record the attempt in `login_attempts` with `success = 0`.
2. WHEN the Auth_API receives a login request AND there are 5 or more rows in `login_attempts` for the same `users.email` or `users.school_username` lookup value with `success = 0` and `attempted_at` within the last 15 minutes, THE Auth_API SHALL return an authentication-failed response indicating the account is temporarily locked and SHALL NOT verify the supplied password.
3. WHEN the Auth_API records a successful login for a given lookup value, THE Auth_API SHALL clear or invalidate prior failed attempts for that lookup value within the last 15 minutes so that the count from Acceptance Criterion 2 returns to zero.
4. THE lockout window described in Acceptance Criterion 2 SHALL be 15 minutes measured from the most recent failed attempt.
5. THE failed-attempt threshold described in Acceptance Criterion 2 SHALL be configurable via an environment variable, defaulting to 5.

**User Story:** As an operator, I want existing seeded and live user accounts to keep working unchanged, so that the migration does not lock anyone out.

#### Acceptance Criteria

1. THE System SHALL preserve the existing password hashes for `admin@nsdga.com`, `registrar@nsdga.com`, and `student1@example.com` across the migration.
2. THE System SHALL leave `users.school_username` equal to NULL and `users.must_change_password` equal to 0 for every student row that exists before this feature is deployed.
2a. WHERE the existing administrator account `admin@nsdga.com` already has a `school_username` value, THE System SHALL preserve that value during migration.
3. WHEN any existing user logs in with their current personal email and password after the migration, THE Auth_API SHALL return a successful authentication response and SHALL set `must_change_password` to false in that response.
