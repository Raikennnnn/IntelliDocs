-- Background AI verification jobs (queued when student submits enrollment).
-- Run on intellidocs_db after deploy.

USE intellidocs_db;

CREATE TABLE IF NOT EXISTS ai_verification_jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  enrollment_id INT NULL,
  doc_type VARCHAR(40) NOT NULL DEFAULT '',
  status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error VARCHAR(500) NULL,
  queued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ai_job_document (document_id),
  INDEX idx_ai_job_status_queued (status, queued_at),
  INDEX idx_ai_job_enrollment (enrollment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
