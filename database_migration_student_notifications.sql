-- Student notification read-state (optional migration; API also auto-creates this table).
USE intellidocs_db;

CREATE TABLE IF NOT EXISTS student_notification_reads (
  user_id INT NOT NULL,
  notification_key VARCHAR(160) NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, notification_key),
  INDEX idx_notif_reads_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
