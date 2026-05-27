-- Physical document checklist for approved enrollments
-- =============================================================================
-- Adds the table the registrar uses to track which physical documents an
-- approved student has handed over in person, and extends the enrollment
-- status vocabulary with `enrolled` so we can distinguish:
--
--   pending / under_review : application is still being decided
--   approved               : decision made, credentials issued, but the
--                            student has not yet handed in physical docs
--   enrolled               : registrar received every required physical doc
--                            and clicked "Mark as enrolled"
--   rejected               : application denied
--
-- Each row in `enrollment_physical_docs` is one checklist item for one
-- enrollment.  Items are created lazily (the API inserts the canonical
-- list when the registrar opens an approved student for the first time)
-- so this migration only creates the schema; no data is seeded here.
--
-- Run order (each step is idempotent; safe to re-run on an already-migrated
-- DB):
--   1. database_setup.sql                 -- base schema
--   2. (any earlier database_migration_*.sql files)
--   3. database_migration_credentials.sql
--   4. database_migration_physical_docs.sql -- THIS FILE
-- =============================================================================

USE intellidocs_db;

CREATE TABLE IF NOT EXISTS enrollment_physical_docs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT NOT NULL,
    -- Stable slug identifying the requirement (e.g. "psa_birth_certificate",
    -- "report_card_sf9", "good_moral", "form_137", "tor", "photo_2x2",
    -- "psa_photocopy_x2", "photo_2x2_x2"). The API owns the canonical list;
    -- the column stores the slug so renaming the human label later is a
    -- pure UI change.
    requirement_key VARCHAR(64) NOT NULL,
    -- Human label captured at the moment the row was inserted so the
    -- registrar's audit trail keeps making sense even if we rename a
    -- requirement in the API.
    requirement_label VARCHAR(160) NOT NULL,
    received TINYINT(1) NOT NULL DEFAULT 0,
    received_at TIMESTAMP NULL DEFAULT NULL,
    received_by INT NULL,
    notes VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_enrollment_requirement (enrollment_id, requirement_key),
    INDEX idx_enrollment_received (enrollment_id, received)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
