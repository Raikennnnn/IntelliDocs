-- IntelliDocs: move roles from users.role into admin_users | registrar_users | student_users, then drop users.role.
-- Run in phpMyAdmin on intellidocs_db after backup. The app also runs this automatically via config/database.php.

USE intellidocs_db;

-- (Optional) normalize legacy ENUM first — or rely on PHP ensureUsersRoleEnum / ensureUsersRoleStrict.

CREATE TABLE IF NOT EXISTS admin_users (
  user_id INT NOT NULL PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registrar_users (
  user_id INT NOT NULL PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_registrar_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_users (
  user_id INT NOT NULL PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- If username column is missing on older installs:
-- ALTER TABLE admin_users ADD COLUMN username VARCHAR(64) NOT NULL DEFAULT '' AFTER user_id;
-- (repeat for registrar_users, student_users)

UPDATE users SET role = 'student' WHERE role IS NULL OR role = '' OR TRIM(COALESCE(role, '')) = '';
UPDATE users SET role = 'admin' WHERE LOWER(TRIM(role)) IN ('admin', 'administrator');
UPDATE users SET role = 'registrar' WHERE LOWER(TRIM(role)) = 'registrar';
UPDATE users SET role = 'student' WHERE LOWER(TRIM(role)) IN ('student', 'applicant');
UPDATE users SET role = 'registrar' WHERE LOWER(TRIM(role)) = 'teacher';
UPDATE users SET role = 'admin' WHERE LOWER(TRIM(role)) = 'principal';
UPDATE users SET role = 'student' WHERE LOWER(TRIM(role)) NOT IN ('admin', 'registrar', 'student');

DELETE FROM admin_users;
DELETE FROM registrar_users;
DELETE FROM student_users;

INSERT INTO admin_users (user_id, username)
SELECT u.id, u.username FROM users u WHERE LOWER(TRIM(u.role)) = 'admin';

INSERT INTO registrar_users (user_id, username)
SELECT u.id, u.username FROM users u WHERE LOWER(TRIM(u.role)) = 'registrar';

INSERT INTO student_users (user_id, username)
SELECT u.id, u.username FROM users u WHERE LOWER(TRIM(u.role)) = 'student';

INSERT IGNORE INTO student_users (user_id, username)
SELECT u.id, u.username FROM users u
WHERE NOT EXISTS (SELECT 1 FROM admin_users a WHERE a.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM registrar_users r WHERE r.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM student_users s WHERE s.user_id = u.id);

ALTER TABLE users DROP COLUMN role;
