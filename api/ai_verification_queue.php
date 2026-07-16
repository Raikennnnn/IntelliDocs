<?php
declare(strict_types=1);

/**
 * Background AI verification queue — enqueue on enrollment submit, process via CLI worker.
 */

require_once __DIR__ . '/ai_verify_runner.php';
require_once __DIR__ . '/logging.php';

function ensureAiVerificationQueueSchema(PDO $pdo): void
{
    static $ensured = false;
    if ($ensured) {
        return;
    }
    $ensured = true;

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS ai_verification_jobs (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            document_id INT NOT NULL,
            enrollment_id INT NULL,
            doc_type VARCHAR(40) NOT NULL DEFAULT '',
            status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
            attempts INT NOT NULL DEFAULT 0,
            max_attempts INT NOT NULL DEFAULT 3,
            last_error VARCHAR(500) NULL,
            queued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            started_at DATETIME NULL,
            completed_at DATETIME NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_ai_job_document (document_id),
            INDEX idx_ai_job_status_queued (status, queued_at),
            INDEX idx_ai_job_enrollment (enrollment_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

function documentMarkAiQueued(PDO $pdo, int $docId): void
{
    if ($docId <= 0 || !aiPersistColumnExists($pdo, 'ai_status')) {
        return;
    }
    $stmt = $pdo->prepare(
        "UPDATE documents SET ai_status = 'queued'
          WHERE id = :id
            AND LOWER(TRIM(COALESCE(ai_status, ''))) IN ('', 'pending')"
    );
    $stmt->execute([':id' => $docId]);
}

/**
 * Queue full AI verification for all image documents on an enrollment.
 *
 * @return array{queued: int, skipped: int, document_ids: list<int>}
 */
function enqueueEnrollmentAiVerificationJobs(PDO $pdo, int $enrollmentId, bool $forceRequeue = false): array
{
    ensureAiVerificationQueueSchema($pdo);
    ensureDocumentAiPersistenceSchema($pdo);

    if ($enrollmentId <= 0 || !enrollmentTableExists($pdo, 'documents')) {
        return ['queued' => 0, 'skipped' => 0, 'document_ids' => []];
    }

    $stmt = $pdo->prepare(
        'SELECT id, type, mime_type, file_path, ai_status, ai_security_json, ai_score
           FROM documents
          WHERE enrollment_id = :eid
          ORDER BY id ASC'
    );
    $stmt->execute([':eid' => $enrollmentId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $queued = 0;
    $skipped = 0;
    $docIds = [];

    $upsert = $pdo->prepare(
        'INSERT INTO ai_verification_jobs (
            document_id, enrollment_id, doc_type, status, attempts, max_attempts,
            last_error, queued_at, started_at, completed_at
        ) VALUES (
            :doc_id, :eid, :doc_type, "pending", 0, 3, NULL, NOW(), NULL, NULL
        )
        ON DUPLICATE KEY UPDATE
            enrollment_id = VALUES(enrollment_id),
            doc_type = VALUES(doc_type),
            status = IF(status = "processing", status, "pending"),
            attempts = IF(status = "processing", attempts, 0),
            last_error = IF(status = "processing", last_error, NULL),
            queued_at = IF(status = "processing", queued_at, NOW()),
            started_at = IF(status = "processing", started_at, NULL),
            completed_at = NULL'
    );

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $docId = (int)($row['id'] ?? 0);
        if ($docId <= 0) {
            continue;
        }

        $filePath = (string)($row['file_path'] ?? '');
        if (!documentIsAiVerifiableImage((string)($row['mime_type'] ?? ''), $filePath)) {
            $skipped++;
            continue;
        }

        $aiStatus = strtolower(trim((string)($row['ai_status'] ?? '')));
        $envelope = parseStoredAiVerifyEnvelope(isset($row['ai_security_json']) ? (string)$row['ai_security_json'] : null);
        if (
            !$forceRequeue
            && documentHasPersistedAiArtifacts($aiStatus, isset($row['ai_security_json']) ? (string)$row['ai_security_json'] : null, $row['ai_score'] ?? null)
            && !aiPersistedEnvelopeIsStale($envelope)
        ) {
            $skipped++;
            continue;
        }

        if ($aiStatus === 'processing') {
            $skipped++;
            continue;
        }

        $docType = mapDocumentTypeForAi((string)($row['type'] ?? ''));
        $upsert->execute([
            ':doc_id' => $docId,
            ':eid' => $enrollmentId,
            ':doc_type' => $docType,
        ]);
        documentMarkAiQueued($pdo, $docId);
        $queued++;
        $docIds[] = $docId;
    }

    return ['queued' => $queued, 'skipped' => $skipped, 'document_ids' => $docIds];
}

/**
 * Kick the queue worker without blocking the HTTP response (Linux droplet).
 */
function spawnAiVerificationQueueWorker(string $appRoot): void
{
    if (PHP_OS_FAMILY === 'Windows') {
        return;
    }

    $php = PHP_BINARY;
    if (!is_string($php) || $php === '') {
        $php = 'php';
    }
    $script = rtrim($appRoot, '/\\') . '/scripts/process_ai_verification_queue.php';
    if (!is_file($script)) {
        return;
    }

    $cmd = escapeshellarg($php) . ' ' . escapeshellarg($script) . ' --max=1 > /dev/null 2>&1 &';
    @exec($cmd);
}

/**
 * Claim and process up to $maxJobs pending verification jobs.
 *
 * @return array{processed: int, succeeded: int, failed: int, job_ids: list<int>}
 */
function processAiVerificationQueue(PDO $pdo, int $maxJobs = 1): array
{
    ensureAiVerificationQueueSchema($pdo);
    $maxJobs = max(1, min(10, $maxJobs));

    $processed = 0;
    $succeeded = 0;
    $failed = 0;
    $jobIds = [];

    for ($i = 0; $i < $maxJobs; $i++) {
        $pdo->beginTransaction();
        try {
            $claim = $pdo->query(
                'SELECT id, document_id, doc_type, attempts, max_attempts
                   FROM ai_verification_jobs
                  WHERE status = "pending" AND attempts < max_attempts
                  ORDER BY queued_at ASC, id ASC
                  LIMIT 1
                  FOR UPDATE'
            );
            $job = $claim ? $claim->fetch(PDO::FETCH_ASSOC) : false;
            if (!$job || !is_array($job)) {
                $pdo->rollBack();
                break;
            }

            $jobId = (int)($job['id'] ?? 0);
            $docId = (int)($job['document_id'] ?? 0);
            $docType = trim((string)($job['doc_type'] ?? ''));

            $mark = $pdo->prepare(
                'UPDATE ai_verification_jobs
                    SET status = "processing",
                        attempts = attempts + 1,
                        started_at = NOW(),
                        last_error = NULL
                  WHERE id = :id AND status = "pending"'
            );
            $mark->execute([':id' => $jobId]);
            if ($mark->rowCount() < 1) {
                $pdo->rollBack();
                continue;
            }
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('[ai_verification_queue] claim failed: ' . $e->getMessage());
            break;
        }

        $processed++;
        $jobIds[] = $jobId;

        $result = runDocumentAiVerification($pdo, $docId, [
            'doc_type' => $docType,
            'force_rerun' => false,
        ]);

        if (($result['ok'] ?? false) === true && empty($result['processing'])) {
            $pdo->prepare(
                'UPDATE ai_verification_jobs
                    SET status = "completed", completed_at = NOW(), last_error = NULL
                  WHERE id = :id'
            )->execute([':id' => $jobId]);
            $succeeded++;
            appLogEvent($pdo, 'ai_verify_queue_complete', 'system', 'success', null, 'document', (string)$docId, [
                'job_id' => $jobId,
                'cached' => !empty($result['cached']),
            ]);
            continue;
        }

        if (($result['ok'] ?? false) === true && !empty($result['processing'])) {
            $pdo->prepare(
                'UPDATE ai_verification_jobs
                    SET status = "completed", completed_at = NOW(), last_error = NULL
                  WHERE id = :id'
            )->execute([':id' => $jobId]);
            $succeeded++;
            continue;
        }

        $error = trim((string)($result['error'] ?? 'AI verification failed'));
        if (strlen($error) > 500) {
            $error = substr($error, 0, 497) . '...';
        }

        $attemptsStmt = $pdo->prepare('SELECT attempts, max_attempts FROM ai_verification_jobs WHERE id = :id LIMIT 1');
        $attemptsStmt->execute([':id' => $jobId]);
        $attemptRow = $attemptsStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $attempts = (int)($attemptRow['attempts'] ?? 0);
        $maxAttempts = (int)($attemptRow['max_attempts'] ?? 3);

        if ($attempts < $maxAttempts) {
            $pdo->prepare(
                'UPDATE ai_verification_jobs
                    SET status = "pending", last_error = :err, started_at = NULL
                  WHERE id = :id'
            )->execute([':id' => $jobId, ':err' => $error]);
            documentResetAiPending($pdo, $docId);
        } else {
            $pdo->prepare(
                'UPDATE ai_verification_jobs
                    SET status = "failed", last_error = :err, completed_at = NOW()
                  WHERE id = :id'
            )->execute([':id' => $jobId, ':err' => $error]);
            documentResetAiPending($pdo, $docId);
            $failed++;
        }

        appLogEvent($pdo, 'ai_verify_queue_failed', 'system', 'failed', null, 'document', (string)$docId, [
            'job_id' => $jobId,
            'error' => $error,
            'attempts' => $attempts,
        ]);
    }

    return [
        'processed' => $processed,
        'succeeded' => $succeeded,
        'failed' => $failed,
        'job_ids' => $jobIds,
    ];
}

/**
 * @return array{pending: int, processing: int, completed: int, failed: int}
 */
function aiVerificationQueueStats(PDO $pdo): array
{
    ensureAiVerificationQueueSchema($pdo);
    $row = $pdo->query(
        'SELECT
            SUM(status = "pending") AS pending,
            SUM(status = "processing") AS processing,
            SUM(status = "completed") AS completed,
            SUM(status = "failed") AS failed
           FROM ai_verification_jobs'
    )->fetch(PDO::FETCH_ASSOC) ?: [];

    return [
        'pending' => (int)($row['pending'] ?? 0),
        'processing' => (int)($row['processing'] ?? 0),
        'completed' => (int)($row['completed'] ?? 0),
        'failed' => (int)($row['failed'] ?? 0),
    ];
}
