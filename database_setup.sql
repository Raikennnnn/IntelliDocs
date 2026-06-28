-- IntelliDocs Database Setup
-- FRESH INSTALL ONLY — run manually in phpMyAdmin when creating a new database.
-- WARNING: The next two lines DELETE ALL DATA in intellidocs_db.
-- Do NOT include this file in deploy_droplet.sh migrations.

DROP DATABASE IF EXISTS intellidocs_db;
CREATE DATABASE intellidocs_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE intellidocs_db;

-- Users: credentials + profile only. Roles live in admin_users | registrar_users | student_users.
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  email_verified_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE admin_users (
  user_id INT NOT NULL PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE registrar_users (
  user_id INT NOT NULL PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_registrar_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_users (
  user_id INT NOT NULL PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per user: Terms of Use + Privacy Policy + DPA at registration.
CREATE TABLE user_registration_consents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  terms_of_use_accepted TINYINT(1) NOT NULL DEFAULT 0,
  privacy_policy_accepted TINYINT(1) NOT NULL DEFAULT 0,
  dpa_accepted TINYINT(1) NOT NULL DEFAULT 0,
  accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'registration',
  UNIQUE KEY uniq_registration_consent_user (user_id),
  INDEX idx_registration_consent_at (accepted_at),
  CONSTRAINT fk_registration_consent_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per enrollment: student declares uploads are genuine (Requirements Upload step).
CREATE TABLE enrollment_document_authenticity_consents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  user_id INT NOT NULL,
  school_year VARCHAR(30) NULL,
  authenticity_confirmed TINYINT(1) NOT NULL DEFAULT 1,
  confirmed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'enrollment_step_4',
  UNIQUE KEY uniq_doc_auth_enrollment (enrollment_id),
  INDEX idx_doc_auth_user (user_id),
  INDEX idx_doc_auth_confirmed_at (confirmed_at),
  CONSTRAINT fk_doc_auth_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Admin / IT account (password: admin123)
-- Password hash generated with PHP: password_hash('admin123', PASSWORD_BCRYPT)
INSERT INTO users (username, email, password, full_name)
SELECT 'admin_it', 'admin@nsdga.com', '$2y$10$lzhXyjf7nNDrRU3nOxO.ber.rCZ.V0Ep74bQSyvGfLKIMmmSl7PTW', 'Admin / IT'
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'admin@nsdga.com'
);
INSERT INTO admin_users (user_id, username) SELECT id, username FROM users WHERE email = 'admin@nsdga.com' AND NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = users.id);

-- Default Registrar account (password: registrar123)
-- Password hash generated with PHP: password_hash('registrar123', PASSWORD_BCRYPT)
INSERT INTO users (username, email, password, full_name)
SELECT 'registrar', 'registrar@nsdga.com', '$2y$10$Jf09hgsKhOb9Dn5ymrN9QelhUj1QRk.BNN10SQy3sA3ZT31U4ke82', 'Registrar'
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE username = 'registrar' OR email = 'registrar@nsdga.com'
);
INSERT INTO registrar_users (user_id, username) SELECT id, username FROM users WHERE email = 'registrar@nsdga.com' AND NOT EXISTS (SELECT 1 FROM registrar_users WHERE user_id = users.id);

-- Students table
CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  student_number VARCHAR(20) UNIQUE,
  grade_level VARCHAR(10),
  section VARCHAR(10),
  status ENUM('active', 'pending', 'inactive') DEFAULT 'pending',
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Documents table
CREATE TABLE documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT,
  type VARCHAR(50),
  filename VARCHAR(255),
  original_name VARCHAR(255),
  ai_status ENUM('pending', 'verified', 'rejected', 'tampered') DEFAULT 'pending',
  ai_score DECIMAL(3,2),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- OTP table
CREATE TABLE otp_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100),
  code VARCHAR(6),
  purpose VARCHAR(20) NOT NULL DEFAULT 'registration',
  expires_at TIMESTAMP,
  used TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otp_guard_state (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  purpose VARCHAR(20) NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMP NULL DEFAULT NULL,
  last_failed_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_otp_guard_email_purpose (email, purpose),
  INDEX idx_otp_guard_locked (locked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Signup held until OTP verification (no users row until verify_otp succeeds)
CREATE TABLE pending_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL DEFAULT '',
  terms_privacy_accepted TINYINT(1) NOT NULL DEFAULT 1,
  dpa_accepted TINYINT(1) NOT NULL DEFAULT 1,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_pending_email (email),
  UNIQUE KEY uniq_pending_username (username),
  INDEX idx_pending_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Local security/activity logging (without SIEM)
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  action VARCHAR(120) NOT NULL,
  module VARCHAR(80) NOT NULL,
  target_type VARCHAR(80) NULL,
  target_id VARCHAR(120) NULL,
  status VARCHAR(40) NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  details_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_created_at (created_at),
  INDEX idx_activity_action (action),
  INDEX idx_activity_status (status),
  INDEX idx_activity_actor (actor_user_id)
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(120) NOT NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_email (email),
  INDEX idx_login_success (success),
  INDEX idx_login_attempted_at (attempted_at)
);

CREATE TABLE IF NOT EXISTS email_queue (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  recipient_email VARCHAR(190) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_text TEXT NOT NULL,
  status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  sent_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email_queue_status (status),
  INDEX idx_email_queue_created_at (created_at)
);

-- Test student (password: student123)
-- Password hash generated with PHP: password_hash('student123', PASSWORD_BCRYPT)
INSERT INTO users (username, email, password, full_name) VALUES (
  'student1', 
  'student1@example.com',
  '$2y$10$AAHdB/moPR0bZ/aAbL7t2.lC5wfXlnYPbtIdtzQxm3ajD4DFqvl2S',
  'John Doe'
);
INSERT INTO student_users (user_id, username) SELECT id, username FROM users WHERE username = 'student1' AND NOT EXISTS (SELECT 1 FROM student_users WHERE user_id = users.id);

INSERT INTO students (user_id, student_number, grade_level, section, status) VALUES (
  (SELECT id FROM users WHERE username = 'student1' LIMIT 1), 'NSGDA-001', '11-STEM', 'A', 'active'
);

SELECT 'IntelliDocs DB Ready! admin/admin123' as status;

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_documents_status ON documents(ai_status);
CREATE INDEX idx_students_status ON students(status);
