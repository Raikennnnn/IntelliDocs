-- Registrar manual document review
-- Adds a per-document flag the registrar toggles independently of AI verification.
-- Idempotent: re-running is a no-op via columnExists guards in the application layer.

USE intellidocs_db;

ALTER TABLE documents ADD COLUMN registrar_reviewed TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN reviewed_at TIMESTAMP NULL;
ALTER TABLE documents ADD COLUMN reviewed_by INT NULL;
