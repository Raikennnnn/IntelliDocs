<?php
declare(strict_types=1);

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

require_once __DIR__ . '/logging.php';

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table LIMIT 1');
    $stmt->execute([':table' => $table]);
    return (bool)$stmt->fetchColumn();
}

function columnExists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column LIMIT 1');
    $stmt->execute([':table' => $table, ':column' => $column]);
    return (bool)$stmt->fetchColumn();
}

function requireUserId(): int
{
    $uid = (int)($_SERVER['HTTP_X_USER_ID'] ?? 0);
    if ($uid <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Missing user context']);
        exit;
    }
    return $uid;
}

function ensureDocumentsSchema(PDO $pdo): void
{
    if (!tableExists($pdo, 'documents')) {
        $pdo->exec(
            'CREATE TABLE documents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NULL,
                enrollment_id INT NULL,
                type VARCHAR(120) NULL,
                filename VARCHAR(255) NULL,
                original_name VARCHAR(255) NULL,
                mime_type VARCHAR(120) NULL,
                file_size BIGINT NULL,
                file_path VARCHAR(500) NULL,
                ai_status VARCHAR(40) DEFAULT "pending",
                ai_score DECIMAL(5,2) NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )'
        );
    }

    $columns = [
        'student_id' => 'INT NULL',
        'enrollment_id' => 'INT NULL',
        'type' => 'VARCHAR(120) NULL',
        'filename' => 'VARCHAR(255) NULL',
        'original_name' => 'VARCHAR(255) NULL',
        'mime_type' => 'VARCHAR(120) NULL',
        'file_size' => 'BIGINT NULL',
        'file_path' => 'VARCHAR(500) NULL',
        'ai_status' => 'VARCHAR(40) DEFAULT "pending"',
        'ai_score' => 'DECIMAL(5,2) NULL',
        'uploaded_at' => 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    ];

    foreach ($columns as $name => $ddl) {
        if (!columnExists($pdo, 'documents', $name)) {
            $pdo->exec("ALTER TABLE documents ADD COLUMN {$name} {$ddl}");
        }
    }
}

function resolveEnrollmentId(PDO $pdo, int $userId, ?int $providedId): int
{
    if ($providedId !== null && $providedId > 0) {
        return $providedId;
    }
    if (!tableExists($pdo, 'enrollments')) {
        return 0;
    }
    $stmt = $pdo->prepare('SELECT id FROM enrollments WHERE user_id = :user_id ORDER BY id DESC LIMIT 1');
    $stmt->execute([':user_id' => $userId]);
    $row = $stmt->fetch();
    return (int)($row['id'] ?? 0);
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$userId = requireUserId();

ensureDocumentsSchema($pdo);

if ($method === 'GET') {
    try {
        $enrollmentId = isset($_GET['enrollment_id']) ? (int)$_GET['enrollment_id'] : null;
        $enrollmentId = resolveEnrollmentId($pdo, $userId, $enrollmentId);

        if ($enrollmentId > 0 && columnExists($pdo, 'documents', 'enrollment_id')) {
            $stmt = $pdo->prepare('
                SELECT id, type, original_name, filename, ai_status, uploaded_at, file_path, file_size, mime_type
                FROM documents
                WHERE enrollment_id = :enrollment_id
                ORDER BY id DESC
            ');
            $stmt->execute([':enrollment_id' => $enrollmentId]);
            $rows = $stmt->fetchAll() ?: [];
        } else {
            // Fallback path if enrollment_id is unavailable on this schema.
            $rows = [];
        }

        echo json_encode(['success' => true, 'documents' => $rows]);
        exit;
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to load documents']);
        exit;
    }
}

if ($method === 'POST') {
    if (!isset($_FILES['file'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No file uploaded']);
        exit;
    }

    $documentType = trim((string)($_POST['document_type'] ?? 'Document'));
    $providedEnrollmentId = isset($_POST['enrollment_id']) ? (int)$_POST['enrollment_id'] : null;
    $enrollmentId = resolveEnrollmentId($pdo, $userId, $providedEnrollmentId);

    $file = $_FILES['file'];
    if (!is_array($file) || (int)($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid file upload']);
        exit;
    }

    $tmpPath = (string)$file['tmp_name'];
    $originalName = (string)($file['name'] ?? 'document');
    $size = (int)($file['size'] ?? 0);
    if ($size <= 0 || $size > 5 * 1024 * 1024) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'File size must be between 1 byte and 5MB']);
        exit;
    }

    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $allowed = ['pdf', 'jpg', 'jpeg', 'png'];
    if (!in_array($ext, $allowed, true)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Only PDF, JPG, JPEG, PNG are allowed']);
        exit;
    }

    $safeBase = preg_replace('/[^A-Za-z0-9._-]/', '_', pathinfo($originalName, PATHINFO_FILENAME));
    $finalName = date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '_' . $safeBase . '.' . $ext;
    $relativeDir = 'uploads/documents/' . $userId;
    $absoluteDir = dirname(__DIR__) . '/' . $relativeDir;
    if (!is_dir($absoluteDir) && !mkdir($absoluteDir, 0777, true) && !is_dir($absoluteDir)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to create upload directory']);
        exit;
    }
    $absolutePath = $absoluteDir . '/' . $finalName;
    if (!move_uploaded_file($tmpPath, $absolutePath)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to store uploaded file']);
        exit;
    }

    $mimeType = (string)($file['type'] ?? '');
    $relativeFilePath = $relativeDir . '/' . $finalName;

    try {
        $sql = '
            INSERT INTO documents (enrollment_id, type, filename, original_name, mime_type, file_size, file_path, ai_status)
            VALUES (:enrollment_id, :type, :filename, :original_name, :mime_type, :file_size, :file_path, :ai_status)
        ';
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':enrollment_id' => $enrollmentId > 0 ? $enrollmentId : null,
            ':type' => $documentType,
            ':filename' => $finalName,
            ':original_name' => $originalName,
            ':mime_type' => $mimeType,
            ':file_size' => $size,
            ':file_path' => $relativeFilePath,
            ':ai_status' => 'pending',
        ]);

        $docId = (int)$pdo->lastInsertId();
        appLogEvent($pdo, 'document_upload', 'student', 'success', $userId, 'document', (string)$docId, [
            'document_type' => $documentType,
            'enrollment_id' => $enrollmentId,
        ]);

        echo json_encode([
            'success' => true,
            'document' => [
                'id' => $docId,
                'type' => $documentType,
                'original_name' => $originalName,
                'filename' => $finalName,
                'file_path' => $relativeFilePath,
                'uploaded_at' => date('Y-m-d H:i:s'),
                'ai_status' => 'pending',
            ],
        ]);
        exit;
    } catch (Throwable $e) {
        if (is_file($absolutePath)) {
            @unlink($absolutePath);
        }
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to save document record']);
        exit;
    }
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
