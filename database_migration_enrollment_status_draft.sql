-- Add draft/cancelled to enrollments.status (code uses both; older DBs may only have pending+).
-- Run on intellidocs_db. Safe to re-run if column is already VARCHAR.

USE intellidocs_db;

-- If status is ENUM without draft/cancelled, expand it. If already VARCHAR, this is a no-op in practice.
ALTER TABLE enrollments
  MODIFY status ENUM(
    'draft',
    'pending',
    'under_review',
    'approved',
    'enrolled',
    'rejected',
    'cancelled'
  ) NOT NULL DEFAULT 'pending';

-- Repair rows where invalid 'draft' was stored as empty string under strict-off MySQL.
UPDATE enrollments SET status = 'draft' WHERE TRIM(COALESCE(status, '')) = '';
