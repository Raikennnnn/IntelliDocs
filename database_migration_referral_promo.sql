-- Bring a Friend referral promo: one-time control numbers per school year.
-- Run on intellidocs_db.

USE intellidocs_db;

CREATE TABLE IF NOT EXISTS referral_promo_claims (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  school_year VARCHAR(30) NOT NULL,
  control_number CHAR(4) NOT NULL,
  enrollment_id INT NULL,
  referrer_name VARCHAR(120) NOT NULL,
  referrer_contact VARCHAR(20) NOT NULL,
  referrer_email VARCHAR(190) NOT NULL DEFAULT '',
  referrer_type VARCHAR(40) NOT NULL,
  referred_freebie_status ENUM('pending', 'eligible', 'given', 'void') NOT NULL DEFAULT 'pending',
  referrer_incentive_status ENUM('pending', 'eligible', 'void', 'paid') NOT NULL DEFAULT 'pending',
  first_semester_completed_at DATETIME NULL,
  void_reason VARCHAR(255) NULL,
  claimed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_referral_sy_control (school_year, control_number),
  INDEX idx_referral_enrollment (enrollment_id),
  INDEX idx_referral_incentive (referrer_incentive_status),
  INDEX idx_referral_freebie (referred_freebie_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
