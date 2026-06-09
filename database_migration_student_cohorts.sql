-- Separate enrolled Grade 11, enrolled Grade 12, and applicants in student_cohorts.
-- Run on intellidocs_db after database_migration_student_portal.sql.
-- Safe to re-run (CREATE TABLE IF NOT EXISTS; drops legacy views if present).

USE intellidocs_db;

-- Materialized cohort index (one row per enrollment).
CREATE TABLE IF NOT EXISTS student_cohorts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  enrollment_id INT NOT NULL,
  cohort_type ENUM('applicant', 'enrolled_grade_11', 'enrolled_grade_12') NOT NULL,
  school_year VARCHAR(20) NOT NULL DEFAULT '',
  grade_level VARCHAR(10) NOT NULL DEFAULT '',
  strand VARCHAR(50) NULL,
  enrollment_status VARCHAR(40) NOT NULL DEFAULT '',
  display_name VARCHAR(200) NULL,
  email VARCHAR(120) NULL,
  school_username VARCHAR(80) NULL,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_student_cohorts_enrollment (enrollment_id),
  INDEX idx_student_cohorts_type_sy (cohort_type, school_year),
  INDEX idx_student_cohorts_user (user_id),
  CONSTRAINT fk_student_cohorts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_cohorts_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Legacy convenience views (no longer created). Drop if an older migration left them.
DROP VIEW IF EXISTS v_student_applicants;
DROP VIEW IF EXISTS v_student_enrolled_grade_11;
DROP VIEW IF EXISTS v_student_enrolled_grade_12;
