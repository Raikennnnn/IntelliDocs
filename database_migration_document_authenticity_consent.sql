-- Student declaration that uploaded enrollment documents are genuine (one row per enrollment).
-- Run: mysql -u root intellidocs_db < database_migration_document_authenticity_consent.sql

CREATE TABLE IF NOT EXISTS enrollment_document_authenticity_consents (
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
