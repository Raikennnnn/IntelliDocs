-- Single-table registration consents: user_registration_consents (one row per user).

-- After pulling this file, also run: php scripts/migrate_user_consents.php

-- Safe to re-run CREATE TABLE.



USE intellidocs_db;



CREATE TABLE IF NOT EXISTS user_registration_consents (

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

