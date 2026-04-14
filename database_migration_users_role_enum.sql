-- IntelliDocs: normalize users.role to three app roles only (admin, registrar, student).
-- Run once on existing databases (phpMyAdmin or mysql CLI). Safe to re-run after values are already migrated.
-- Legacy mapping:
--   applicant  -> student
--   teacher    -> registrar (school staff; adjust manually if you prefer admin)
--   principal  -> admin

USE intellidocs_db;

UPDATE users SET role = 'student' WHERE role IN ('applicant');
UPDATE users SET role = 'registrar' WHERE role IN ('teacher');
UPDATE users SET role = 'admin' WHERE role IN ('principal');

ALTER TABLE users
  MODIFY COLUMN role ENUM('admin', 'registrar', 'student') NOT NULL DEFAULT 'student';

-- Optional: also run database_migration_users_role_strict.sql to backfill NULL/empty roles to student.
