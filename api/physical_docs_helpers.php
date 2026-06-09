<?php
declare(strict_types=1);

/**
 * Shared physical-document checklist helpers used by registrar and student APIs.
 */

if (!function_exists('physicalRequirementCatalog')) {
    function physicalRequirementCatalog(string $enrollmentStatus = ''): array
    {
        return [
            ['key' => 'psa_birth_certificate', 'label' => 'PSA Birth Certificate (original)', 'required' => true, 'transferee_only' => false],
            ['key' => 'psa_birth_photocopy_x2', 'label' => 'PSA Birth Certificate (2 photocopies)', 'required' => true, 'transferee_only' => false],
            ['key' => 'report_card_sf9', 'label' => 'Grade 10 Report Card (SF9)', 'required' => true, 'transferee_only' => false],
            ['key' => 'good_moral', 'label' => 'Good Moral Certificate', 'required' => true, 'transferee_only' => false],
            ['key' => 'form_137', 'label' => 'SF10 / Form 137', 'required' => true, 'transferee_only' => false],
            ['key' => 'photo_2x2', 'label' => '2x2 Picture (white background, original)', 'required' => true, 'transferee_only' => false],
            ['key' => 'photo_2x2_x2', 'label' => '2x2 Picture (2 pcs, white background)', 'required' => true, 'transferee_only' => false],
            ['key' => 'tor', 'label' => 'Transcript of Records (TOR)', 'required' => true, 'transferee_only' => true],
        ];
    }
}

if (!function_exists('isTransfereeFromEnrollmentSteps')) {
    function isTransfereeFromEnrollmentSteps(string $enrollmentStepsJson): bool
    {
        $decoded = json_decode($enrollmentStepsJson, true);
        if (!is_array($decoded)) {
            return false;
        }
        $fd = $decoded['form_data'] ?? [];
        if (!is_array($fd)) {
            return false;
        }
        $status = strtolower(trim((string)($fd['enrollmentStatus'] ?? '')));
        if ($status === 'transferee') {
            return true;
        }
        $type = strtolower(trim((string)($fd['enrollmentType'] ?? '')));
        if ($type === 'transferee' || $type === 'transfer') {
            return true;
        }
        return !empty($fd['isTransferee']);
    }
}

if (!function_exists('physicalDocsCatalogForEnrollment')) {
    function physicalDocsCatalogForEnrollment(string $enrollmentStepsJson, string $enrollmentStatus = ''): array
    {
        $rawCatalog = physicalRequirementCatalog($enrollmentStatus);
        $isTransferee = isTransfereeFromEnrollmentSteps($enrollmentStepsJson);

        return array_values(array_filter(
            $rawCatalog,
            static fn ($entry) => !$entry['transferee_only'] || $isTransferee
        ));
    }
}

if (!function_exists('allRequiredPhysicalDocsReceived')) {
    /**
     * @param array<string, bool> $receivedByKey
     */
    function allRequiredPhysicalDocsReceived(array $catalog, array $receivedByKey): bool
    {
        foreach ($catalog as $entry) {
            if (!$entry['required']) {
                continue;
            }
            if (empty($receivedByKey[$entry['key']])) {
                return false;
            }
        }

        return true;
    }
}

if (!function_exists('enrollmentPhysicalDocsComplete')) {
    function enrollmentPhysicalDocsComplete(
        PDO $pdo,
        int $enrollmentId,
        ?string $completedAt,
        string $enrollmentStepsJson,
        string $enrollmentStatus = ''
    ): bool {
        if (!empty($completedAt)) {
            return true;
        }
        if (!function_exists('tableExists') || !tableExists($pdo, 'enrollment_physical_docs')) {
            return false;
        }

        $catalog = physicalDocsCatalogForEnrollment($enrollmentStepsJson, $enrollmentStatus);
        $stmt = $pdo->prepare(
            'SELECT requirement_key, received
               FROM enrollment_physical_docs
              WHERE enrollment_id = :id'
        );
        $stmt->execute([':id' => $enrollmentId]);
        $receivedByKey = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $receivedByKey[(string)$row['requirement_key']] = (int)$row['received'] === 1;
        }

        return allRequiredPhysicalDocsReceived($catalog, $receivedByKey);
    }
}

if (!function_exists('batchEnrollmentPhysicalDocsComplete')) {
    /**
     * @param list<array<string, mixed>> $rows enrollment rows with enrollment_id, enrollment_steps, physical_docs_completed_at
     * @return array<int, bool>
     */
    function batchEnrollmentPhysicalDocsComplete(PDO $pdo, array $rows): array
    {
        $result = [];
        $pendingIds = [];

        foreach ($rows as $row) {
            $enrollmentId = (int)($row['enrollment_id'] ?? 0);
            if ($enrollmentId <= 0) {
                continue;
            }
            if (!empty($row['physical_docs_completed_at'])) {
                $result[$enrollmentId] = true;
                continue;
            }
            $pendingIds[] = $enrollmentId;
            $result[$enrollmentId] = false;
        }

        if ($pendingIds === [] || !function_exists('tableExists') || !tableExists($pdo, 'enrollment_physical_docs')) {
            return $result;
        }

        $receivedByEnrollment = [];
        $placeholders = implode(',', array_fill(0, count($pendingIds), '?'));
        $stmt = $pdo->prepare(
            "SELECT enrollment_id, requirement_key, received
               FROM enrollment_physical_docs
              WHERE enrollment_id IN ($placeholders)"
        );
        $stmt->execute($pendingIds);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $docRow) {
            $enrollmentId = (int)$docRow['enrollment_id'];
            $key = (string)$docRow['requirement_key'];
            if (!isset($receivedByEnrollment[$enrollmentId])) {
                $receivedByEnrollment[$enrollmentId] = [];
            }
            $receivedByEnrollment[$enrollmentId][$key] = (int)$docRow['received'] === 1;
        }

        foreach ($rows as $row) {
            $enrollmentId = (int)($row['enrollment_id'] ?? 0);
            if ($enrollmentId <= 0 || !empty($row['physical_docs_completed_at'])) {
                continue;
            }
            $catalog = physicalDocsCatalogForEnrollment(
                (string)($row['enrollment_steps'] ?? '{}'),
                strtolower(trim((string)($row['enrollment_status'] ?? '')))
            );
            $result[$enrollmentId] = allRequiredPhysicalDocsReceived(
                $catalog,
                $receivedByEnrollment[$enrollmentId] ?? []
            );
        }

        return $result;
    }
}

if (!function_exists('ensurePhysicalDocsRows')) {
    /**
     * Lazy-seed checklist rows for an enrollment. Idempotent: existing rows are left alone.
     *
     * @param list<array{key: string, label: string}> $catalog
     */
    function ensurePhysicalDocsRows(PDO $pdo, int $enrollmentId, array $catalog): void
    {
        if (!function_exists('tableExists') || !tableExists($pdo, 'enrollment_physical_docs')) {
            return;
        }

        $existingStmt = $pdo->prepare('SELECT requirement_key FROM enrollment_physical_docs WHERE enrollment_id = :id');
        $existingStmt->execute([':id' => $enrollmentId]);
        $existing = array_flip(array_map('strval', $existingStmt->fetchAll(PDO::FETCH_COLUMN) ?: []));

        $insertStmt = $pdo->prepare(
            'INSERT INTO enrollment_physical_docs (enrollment_id, requirement_key, requirement_label, received)
             VALUES (:eid, :key, :label, 0)'
        );
        foreach ($catalog as $item) {
            if (isset($existing[$item['key']])) {
                continue;
            }
            $insertStmt->execute([
                ':eid' => $enrollmentId,
                ':key' => $item['key'],
                ':label' => $item['label'],
            ]);
        }
    }
}

if (!function_exists('carryForwardPhysicalDocsFromPriorEnrollment')) {
    /**
     * Copy received physical-doc flags from the student's prior enrolled SY so
     * returning Grade 12 students are not asked to resubmit admission originals.
     *
     * @param list<array{key: string, label: string, required?: bool}> $catalog
     */
    function carryForwardPhysicalDocsFromPriorEnrollment(
        PDO $pdo,
        int $userId,
        int $enrollmentId,
        array $enrollment,
        array $catalog
    ): bool {
        if (!function_exists('tableExists') || !tableExists($pdo, 'enrollment_physical_docs')) {
            return false;
        }

        if (!function_exists('priorEnrolledEnrollmentId')) {
            require_once __DIR__ . '/enrollment_status_helpers.php';
        }

        $priorEid = priorEnrolledEnrollmentId($pdo, $userId, $enrollmentId);
        if ($priorEid <= 0) {
            return false;
        }

        $priorStmt = $pdo->prepare(
            'SELECT school_year, status, enrollment_steps, physical_docs_completed_at
               FROM enrollments
              WHERE id = :id
              LIMIT 1'
        );
        $priorStmt->execute([':id' => $priorEid]);
        $priorRow = $priorStmt->fetch(PDO::FETCH_ASSOC);
        if (!$priorRow) {
            return false;
        }

        $currSy = trim((string)($enrollment['school_year'] ?? ''));
        $priorSy = trim((string)($priorRow['school_year'] ?? ''));
        if ($currSy !== '' && $priorSy !== '' && $currSy === $priorSy) {
            return false;
        }

        ensurePhysicalDocsRows($pdo, $enrollmentId, $catalog);

        $allowedKeys = [];
        foreach ($catalog as $entry) {
            $allowedKeys[(string)$entry['key']] = true;
        }

        $receivedStmt = $pdo->prepare(
            'SELECT requirement_key, received_at, received_by, notes
               FROM enrollment_physical_docs
              WHERE enrollment_id = :id AND received = 1'
        );
        $receivedStmt->execute([':id' => $priorEid]);
        $priorReceived = $receivedStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $changed = false;
        $updateStmt = $pdo->prepare(
            'UPDATE enrollment_physical_docs
                SET received = 1,
                    received_at = COALESCE(received_at, :received_at),
                    received_by = COALESCE(received_by, :received_by),
                    notes = CASE WHEN notes IS NULL OR TRIM(notes) = \'\' THEN :notes ELSE notes END
              WHERE enrollment_id = :eid
                AND requirement_key = :key
                AND received = 0'
        );
        foreach ($priorReceived as $row) {
            $key = (string)($row['requirement_key'] ?? '');
            if ($key === '' || !isset($allowedKeys[$key])) {
                continue;
            }
            $updateStmt->execute([
                ':eid' => $enrollmentId,
                ':key' => $key,
                ':received_at' => $row['received_at'] ?? null,
                ':received_by' => $row['received_by'] ?? null,
                ':notes' => $row['notes'] ?? null,
            ]);
            if ($updateStmt->rowCount() > 0) {
                $changed = true;
            }
        }

        $priorStatus = strtolower(trim((string)($priorRow['status'] ?? '')));
        $priorComplete = !empty($priorRow['physical_docs_completed_at']);
        if (!$priorComplete && in_array($priorStatus, ['approved', 'enrolled'], true)) {
            $priorComplete = enrollmentPhysicalDocsComplete(
                $pdo,
                $priorEid,
                null,
                (string)($priorRow['enrollment_steps'] ?? '{}'),
                $priorStatus
            );
        }

        if (!$priorComplete) {
            return $changed;
        }

        if (function_exists('columnExists') && columnExists($pdo, 'enrollments', 'physical_docs_completed_at')) {
            $completedAt = $priorRow['physical_docs_completed_at'] ?? date('Y-m-d H:i:s');
            $pdo->prepare(
                'UPDATE enrollments
                    SET physical_docs_completed_at = COALESCE(physical_docs_completed_at, :ts)
                  WHERE id = :id'
            )->execute([':id' => $enrollmentId, ':ts' => $completedAt]);
            $changed = true;
        }

        if (function_exists('columnExists') && columnExists($pdo, 'enrollments', 'physical_reminder_count')) {
            $pdo->prepare(
                'UPDATE enrollments SET physical_reminder_count = 0 WHERE id = :id'
            )->execute([':id' => $enrollmentId]);
        }

        syncEnrollmentPhysicalDocsCompletion(
            $pdo,
            $enrollmentId,
            $enrollment['physical_docs_completed_at'] ?? null,
            (string)($enrollment['enrollment_steps'] ?? '{}'),
            (string)($enrollment['status'] ?? '')
        );

        return $changed;
    }
}

if (!function_exists('carryForwardPhysicalDocsForEnrollment')) {
    function carryForwardPhysicalDocsForEnrollment(PDO $pdo, int $enrollmentId, ?array $enrollment = null): void
    {
        if ($enrollmentId <= 0 || !function_exists('tableExists') || !tableExists($pdo, 'enrollments')) {
            return;
        }

        if ($enrollment === null || (int)($enrollment['user_id'] ?? 0) <= 0) {
            $hasCompletedAt = function_exists('columnExists') && columnExists($pdo, 'enrollments', 'physical_docs_completed_at');
            $completedExpr = $hasCompletedAt ? 'physical_docs_completed_at' : 'NULL AS physical_docs_completed_at';
            $stmt = $pdo->prepare(
                "SELECT id, user_id, school_year, status, enrollment_steps, {$completedExpr}
                   FROM enrollments
                  WHERE id = :id
                  LIMIT 1"
            );
            $stmt->execute([':id' => $enrollmentId]);
            $enrollment = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        }

        if (!$enrollment) {
            return;
        }

        $userId = (int)($enrollment['user_id'] ?? 0);
        if ($userId <= 0) {
            return;
        }

        $catalog = physicalDocsCatalogForEnrollment(
            (string)($enrollment['enrollment_steps'] ?? '{}'),
            (string)($enrollment['status'] ?? '')
        );
        carryForwardPhysicalDocsFromPriorEnrollment($pdo, $userId, $enrollmentId, $enrollment, $catalog);
    }
}

if (!function_exists('syncEnrollmentPhysicalDocsCompletion')) {
    function syncEnrollmentPhysicalDocsCompletion(
        PDO $pdo,
        int $enrollmentId,
        ?string $completedAt,
        string $enrollmentStepsJson,
        string $enrollmentStatus = ''
    ): bool {
        $complete = enrollmentPhysicalDocsComplete(
            $pdo,
            $enrollmentId,
            $completedAt,
            $enrollmentStepsJson,
            $enrollmentStatus
        );

        if (!function_exists('columnExists') || !columnExists($pdo, 'enrollments', 'physical_docs_completed_at')) {
            return $complete;
        }

        if ($complete && empty($completedAt)) {
            $pdo->prepare(
                'UPDATE enrollments
                    SET physical_docs_completed_at = COALESCE(physical_docs_completed_at, NOW())
                  WHERE id = :id'
            )->execute([':id' => $enrollmentId]);
        } elseif (!$complete && !empty($completedAt)) {
            $pdo->prepare(
                'UPDATE enrollments SET physical_docs_completed_at = NULL WHERE id = :id'
            )->execute([':id' => $enrollmentId]);
        }

        return $complete;
    }
}
