-- Student school credentials migration
-- =============================================================================
-- Adds the columns the student-school-credentials feature needs on the users
-- table: structured name parts (first_name, middle_name, last_name,
-- extension_name), the system-assigned school_username identifier (with a
-- unique index), and the must_change_password flag for forced first-login
-- password rotation.
--
-- Run order (each step is idempotent; safe to re-run on an already-migrated
-- DB):
--   1. database_setup.infinityfree.sql        -- base schema (users, documents,
--                                                role tables, and on newer
--                                                snapshots: activity_logs,
--                                                login_attempts, email_queue)
--   2. database_migration_logging.sql         -- only if step 1 was an older
--                                                snapshot lacking activity_logs
--                                                and login_attempts
--   3. database_migration_email_queue.sql     -- only if step 1 was an older
--                                                snapshot lacking email_queue
--   4. database_migration_student_portal.sql  -- creates enrollments and adds
--                                                profile columns to users
--                                                (REQUIRED prerequisite)
--   5. database_migration_credentials.sql     -- THIS FILE
--
-- Idempotency: each ALTER below is also guarded at the application layer by
-- ensureCredentialsSchema() in api/registrar_application_detail.php, which
-- skips columns/indexes that already exist. When run as raw SQL, duplicate
-- column / duplicate index errors on a second run are expected and can be
-- safely ignored.
--
-- Non-breaking: every new column is NULL or DEFAULT 0 and no UPDATE runs at
-- migration time, so existing rows in users (including admin@nsdga.com,
-- registrar@nsdga.com, student1@example.com) are preserved unchanged.
-- =============================================================================

USE intellidocs_db;

ALTER TABLE users ADD COLUMN first_name VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN middle_name VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN last_name VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN extension_name VARCHAR(20) NULL;
ALTER TABLE users ADD COLUMN school_username VARCHAR(32) NULL;
ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE users ADD UNIQUE INDEX uniq_users_school_username (school_username);
