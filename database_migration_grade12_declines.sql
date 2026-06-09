-- Track students who decline Grade 12 continuation for an open enrollment school year.

-- Safe to re-run.



USE intellidocs_db;



CREATE TABLE IF NOT EXISTS student_grade12_declines (

  id INT AUTO_INCREMENT PRIMARY KEY,

  user_id INT NOT NULL,

  from_school_year VARCHAR(20) NOT NULL DEFAULT '',

  target_school_year VARCHAR(20) NOT NULL,

  declined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_grade12_decline_user_target (user_id, target_school_year),

  INDEX idx_grade12_decline_target (target_school_year),

  CONSTRAINT fk_grade12_decline_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

