<?php
declare(strict_types=1);

/**
 * Process background AI verification jobs.
 *
 * Usage:
 *   php scripts/process_ai_verification_queue.php
 *   php scripts/process_ai_verification_queue.php --max=3
 *
 * On the droplet, systemd timer runs this every 30s.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../api/ai_verification_queue.php';

$max = 1;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--max=')) {
        $max = (int)substr($arg, 6);
    }
}

$statsBefore = aiVerificationQueueStats($pdo);
$result = processAiVerificationQueue($pdo, $max);
$statsAfter = aiVerificationQueueStats($pdo);

echo 'AI verification queue' . PHP_EOL;
echo '  processed=' . (int)$result['processed']
    . ' succeeded=' . (int)$result['succeeded']
    . ' failed=' . (int)$result['failed'] . PHP_EOL;
echo '  pending=' . (int)$statsAfter['pending']
    . ' processing=' . (int)$statsAfter['processing']
    . ' completed=' . (int)$statsAfter['completed']
    . ' failed_total=' . (int)$statsAfter['failed'] . PHP_EOL;

if (!empty($result['job_ids'])) {
    echo '  job_ids=' . implode(',', array_map('strval', $result['job_ids'])) . PHP_EOL;
}

exit(($result['failed'] ?? 0) > 0 && ($result['succeeded'] ?? 0) === 0 ? 1 : 0);
