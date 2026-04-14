-- Optional: app_settings is created automatically by the API (school_year_helpers.php).
-- Run this if you prefer to provision the table manually.

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
    setting_value TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Active enrollment period (YYYY-YYYY). Empty value = enrollment closed by admin.
-- If no row exists, the API falls back to a computed school year from the current date.
