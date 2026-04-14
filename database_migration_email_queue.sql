-- IntelliDocs email queue migration
-- Run on intellidocs_db for automatic OTP email sending pipeline

USE intellidocs_db;

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
