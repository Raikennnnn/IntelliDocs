-- Documents upload storage migration
-- Run this once on existing databases if needed.

CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NULL,
  enrollment_id INT NULL,
  type VARCHAR(120) NULL,
  filename VARCHAR(255) NULL,
  original_name VARCHAR(255) NULL,
  mime_type VARCHAR(120) NULL,
  file_size BIGINT NULL,
  file_path VARCHAR(500) NULL,
  ai_status VARCHAR(40) DEFAULT 'pending',
  ai_score DECIMAL(5,2) NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add columns safely for older schemas
SET @schema := DATABASE();

SET @sql := IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = @schema AND table_name = 'documents' AND column_name = 'enrollment_id'
  ),
  'SELECT 1',
  'ALTER TABLE documents ADD COLUMN enrollment_id INT NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = @schema AND table_name = 'documents' AND column_name = 'mime_type'
  ),
  'SELECT 1',
  'ALTER TABLE documents ADD COLUMN mime_type VARCHAR(120) NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = @schema AND table_name = 'documents' AND column_name = 'file_size'
  ),
  'SELECT 1',
  'ALTER TABLE documents ADD COLUMN file_size BIGINT NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = @schema AND table_name = 'documents' AND column_name = 'file_path'
  ),
  'SELECT 1',
  'ALTER TABLE documents ADD COLUMN file_path VARCHAR(500) NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

