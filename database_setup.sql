-- IntelliDocs Database Setup
-- Run in phpMyAdmin: CREATE DATABASE intellidocs_db; → Import

DROP DATABASE IF EXISTS intellidocs_db;
CREATE DATABASE intellidocs_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE intellidocs_db;

-- Users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  role ENUM('admin', 'registrar', 'teacher', 'principal', 'student', 'applicant') DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Admin user (password: admin123)
INSERT INTO users (username, email, password, full_name, role) VALUES (
  'admin', 
  'admin@nsdga.com', 
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'Admin User', 
  'admin'
);

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

-- Test student
INSERT INTO users (username, email, password, full_name, role) VALUES (
  'student1', 
  'student1@example.com',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'John Doe',
  'student'
);

INSERT INTO students (user_id, student_number, grade_level, section, status) VALUES (
  LAST_INSERT_ID(), 'NSGDA-001', '11-STEM', 'A', 'active'
);

SELECT 'IntelliDocs DB Ready! admin/admin123' as status;

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_documents_status ON documents(ai_status);
CREATE INDEX idx_students_status ON students(status);
