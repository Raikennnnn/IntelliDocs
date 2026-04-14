-- IntelliDocs logging migration (SIEM-free)
-- Run on intellidocs_db to enable in-app audit/security logs

USE intellidocs_db;

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
