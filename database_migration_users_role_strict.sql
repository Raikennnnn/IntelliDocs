-- IntelliDocs: single-table roles — backfill empty/NULL roles and enforce NOT NULL DEFAULT 'student'.
-- Run on intellidocs_db after database_migration_users_role_enum.sql (or alone if enum already 3 values).
-- Safe to run multiple times.

USE intellidocs_db;

-- Blank / NULL → student (fixes phpMyAdmin rows with empty role)
UPDATE users
SET role = 'student'
WHERE role IS NULL OR role = '' OR TRIM(COALESCE(role, '')) = '';

-- Normalize labels (handles VARCHAR or mixed case)
UPDATE users SET role = 'admin' WHERE LOWER(TRIM(role)) IN ('admin', 'administrator');
UPDATE users SET role = 'registrar' WHERE LOWER(TRIM(role)) = 'registrar';
UPDATE users SET role = 'student' WHERE LOWER(TRIM(role)) IN ('student', 'applicant');
UPDATE users SET role = 'registrar' WHERE LOWER(TRIM(role)) = 'teacher';
UPDATE users SET role = 'admin' WHERE LOWER(TRIM(role)) = 'principal';

-- Anything else → student
UPDATE users SET role = 'student' WHERE LOWER(TRIM(role)) NOT IN ('admin', 'registrar', 'student');

ALTER TABLE users
  MODIFY COLUMN role ENUM('admin', 'registrar', 'student') NOT NULL DEFAULT 'student';
