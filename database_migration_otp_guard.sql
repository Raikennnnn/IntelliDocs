-- OTP reinforcement: failed-attempt tracking and lockout.
-- Safe to re-run (CREATE IF NOT EXISTS).

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

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
  setting_value TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default OTP validity to 5 minutes (admin can override in system settings).
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('otp_expiry_minutes', '5')
ON DUPLICATE KEY UPDATE setting_value = IF(setting_value IS NULL OR setting_value = '', '5', setting_value);
