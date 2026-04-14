<?php
// config/database.php - Native PHP DB Config
// Include in API files

require_once __DIR__ . '/../api/env_loader.php';
loadProjectEnv();
require_once __DIR__ . '/../api/user_role.php';

/**
 * Collapse legacy users.role values into admin | registrar | student only.
 * Runs when the column is still the old ENUM (teacher/principal/applicant).
 */
function ensureUsersRoleEnum(PDO $pdo): void
{
    try {
        $stmt = $pdo->query("
            SELECT COLUMN_TYPE
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'users'
              AND COLUMN_NAME = 'role'
            LIMIT 1
        ");
        $col = $stmt ? $stmt->fetchColumn() : false;
        if (!is_string($col) || $col === '') {
            return;
        }
        $needsMigrate = strpos($col, 'teacher') !== false
            || strpos($col, 'principal') !== false
            || strpos($col, 'applicant') !== false;
        if (!$needsMigrate) {
            return;
        }
        $pdo->exec("UPDATE users SET role = 'student' WHERE role IN ('applicant')");
        $pdo->exec("UPDATE users SET role = 'registrar' WHERE role IN ('teacher')");
        $pdo->exec("UPDATE users SET role = 'admin' WHERE role IN ('principal')");
        $pdo->exec("ALTER TABLE users MODIFY COLUMN role ENUM('admin','registrar','student') NOT NULL DEFAULT 'student'");
    } catch (Throwable $e) {
        // Do not block the app if migration cannot run (permissions, etc.).
    }
}

/**
 * Backfill NULL/empty roles to student, normalize legacy labels, enforce NOT NULL DEFAULT 'student'.
 * Run after ensureUsersRoleEnum so every row has a valid role.
 */
function ensureUsersRoleStrict(PDO $pdo): void
{
    try {
        $check = $pdo->query("
            SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'users'
              AND COLUMN_NAME = 'role'
            LIMIT 1
        ");
        if (!$check || !$check->fetchColumn()) {
            return;
        }

        $pdo->exec("UPDATE users SET role = 'student' WHERE role IS NULL OR role = '' OR TRIM(COALESCE(role, '')) = ''");

        $pdo->exec("UPDATE users SET role = 'admin' WHERE LOWER(TRIM(role)) IN ('admin', 'administrator')");
        $pdo->exec("UPDATE users SET role = 'registrar' WHERE LOWER(TRIM(role)) = 'registrar'");
        $pdo->exec("UPDATE users SET role = 'student' WHERE LOWER(TRIM(role)) IN ('student', 'applicant')");
        $pdo->exec("UPDATE users SET role = 'registrar' WHERE LOWER(TRIM(role)) = 'teacher'");
        $pdo->exec("UPDATE users SET role = 'admin' WHERE LOWER(TRIM(role)) = 'principal'");

        $pdo->exec("UPDATE users SET role = 'student' WHERE LOWER(TRIM(role)) NOT IN ('admin', 'registrar', 'student')");

        $pdo->exec("ALTER TABLE users MODIFY COLUMN role ENUM('admin','registrar','student') NOT NULL DEFAULT 'student'");
    } catch (Throwable $e) {
        // Do not block the app if migration cannot run (permissions, etc.).
    }
}

$host = '127.0.0.1';
$dbname = 'intellidocs_db';
$username = 'root';
$password = '';

try {
    // Prevent requests from hanging if MySQL is down/unreachable.
    // Note: some PHP builds do not expose PDO::MYSQL_ATTR_CONNECT_TIMEOUT;
    // use it only when available to avoid fatals.
    $pdoOptions = [
        // Generic PDO timeout (not always honored by mysql driver).
        PDO::ATTR_TIMEOUT => 3,
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    if (defined('PDO::MYSQL_ATTR_CONNECT_TIMEOUT')) {
        $pdoOptions[PDO::MYSQL_ATTR_CONNECT_TIMEOUT] = 3;
    }

    $pdo = new PDO(
        "mysql:host={$host};port=3306;dbname={$dbname};charset=utf8mb4",
        $username,
        $password,
        $pdoOptions
    );

    /**
     * First-run seeding: create required default privileged accounts
     * only when they do not already exist.
     */
    $tableExistsStmt = $pdo->query("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users' LIMIT 1");
    if ($tableExistsStmt && $tableExistsStmt->fetchColumn()) {
        ensureUsersRoleEnum($pdo);
        ensureUsersRoleStrict($pdo);
        ensureRoleTables($pdo);
        migrateUsersRoleToSplitTables($pdo);
        ensureRoleTablesUsernameColumn($pdo);
        syncRoleTableUsernamesFromUsers($pdo);
        // Ensure local in-app logging tables exist (SIEM-free logging).
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS activity_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                actor_user_id INT NULL,
                action VARCHAR(120) NOT NULL,
                module VARCHAR(80) NOT NULL,
                target_type VARCHAR(80) NULL,
                target_id VARCHAR(120) NULL,
                status VARCHAR(40) NOT NULL,
                ip_address VARCHAR(64) NULL,
                user_agent VARCHAR(255) NULL,
                details_json JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_activity_created_at (created_at),
                INDEX idx_activity_action (action),
                INDEX idx_activity_status (status),
                INDEX idx_activity_actor (actor_user_id)
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS login_attempts (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(120) NOT NULL,
                success TINYINT(1) NOT NULL DEFAULT 0,
                ip_address VARCHAR(64) NULL,
                user_agent VARCHAR(255) NULL,
                attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_login_email (email),
                INDEX idx_login_success (success),
                INDEX idx_login_attempted_at (attempted_at)
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS email_queue (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                recipient_email VARCHAR(190) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                body_text TEXT NOT NULL,
                status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
                attempts INT NOT NULL DEFAULT 0,
                last_error TEXT NULL,
                sent_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email_queue_status (status),
                INDEX idx_email_queue_created_at (created_at)
            )
        ");

        $defaultAccounts = [
            [
                'username' => 'admin_it',
                'email' => 'admin@nsdga.com',
                'full_name' => 'Admin / IT',
                'role' => 'admin',
                'password' => 'admin123',
            ],
            [
                'username' => 'registrar',
                'email' => 'registrar@nsdga.com',
                'full_name' => 'Registrar',
                'role' => 'registrar',
                'password' => 'registrar123',
            ],
        ];

        foreach ($defaultAccounts as $account) {
            $existsStmt = $pdo->prepare(
                'SELECT id FROM users WHERE email = :email LIMIT 1'
            );
            $existsStmt->execute([
                ':email' => $account['email'],
            ]);

            if ($existsStmt->fetch()) {
                continue;
            }

            insertUserWithRole(
                $pdo,
                $account['username'],
                $account['email'],
                password_hash($account['password'], PASSWORD_BCRYPT),
                $account['full_name'],
                $account['role']
            );
        }
    }
} catch(PDOException $e) {
    http_response_code(500);
    if (!headers_sent()) {
        header('Content-Type: application/json');
    }
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed',
        'details' => $e->getMessage(),
    ]);
    exit;
}
?>

