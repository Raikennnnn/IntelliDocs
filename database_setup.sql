-- IntelliDocs Database Setup
-- Run in phpMyAdmin: CREATE DATABASE intellidocs_db; → Import

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

-- Default Admin / IT account (password: admin123)
-- Password hash generated using PHP password_hash('admin123', PASSWORD_BCRYPT)
INSERT INTO users (username, email, password, full_name)
SELECT 'admin_it', 'admin@nsdga.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin / IT'
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'admin@nsdga.com'
);
INSERT INTO admin_users (user_id, username) SELECT id, username FROM users WHERE email = 'admin@nsdga.com' AND NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = users.id);

-- Default Registrar account (password: registrar123)
INSERT INTO users (username, email, password, full_name)
SELECT 'registrar', 'registrar@nsdga.com', '$2y$10$Yy2PXytfSc6j2QqOlF0ClOwe5.m592UpNXYzBIXaLPJryoUkju4dG', 'Registrar'
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
  expires_at TIMESTAMP,
  used TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Test student
INSERT INTO users (username, email, password, full_name) VALUES (
  'student1', 
  'student1@example.com',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
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
