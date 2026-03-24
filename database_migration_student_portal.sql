-- Student portal: enrollments + profile columns + document link
-- Run on intellidocs_db. If a line errors with "Duplicate column", skip that line.

USE intellidocs_db;

CREATE TABLE IF NOT EXISTS enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  grade_level VARCHAR(30) NULL,
  strand VARCHAR(50) NULL,
  school_year VARCHAR(30) NULL,
  status VARCHAR(40) DEFAULT 'pending',
  registrar_remarks TEXT NULL,
  enrollment_steps JSON NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_enrollments_user (user_id)
);

ALTER TABLE users ADD COLUMN date_of_birth DATE NULL;
ALTER TABLE users ADD COLUMN gender VARCHAR(20) NULL;
ALTER TABLE users ADD COLUMN phone VARCHAR(40) NULL;
ALTER TABLE users ADD COLUMN address VARCHAR(500) NULL;
ALTER TABLE users ADD COLUMN guardian_name VARCHAR(120) NULL;
ALTER TABLE users ADD COLUMN guardian_relationship VARCHAR(50) NULL;
ALTER TABLE users ADD COLUMN guardian_phone VARCHAR(40) NULL;
ALTER TABLE users ADD COLUMN guardian_email VARCHAR(120) NULL;
ALTER TABLE users ADD COLUMN guardian_occupation VARCHAR(120) NULL;

ALTER TABLE documents ADD COLUMN enrollment_id INT NULL;
ALTER TABLE documents ADD COLUMN doc_type VARCHAR(50) NULL;
ALTER TABLE documents ADD COLUMN filepath VARCHAR(500) NULL;
