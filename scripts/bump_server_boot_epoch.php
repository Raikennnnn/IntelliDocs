<?php
declare(strict_types=1);

/**
 * Bump server boot epoch — all sessions created before this moment become invalid.
 * Run on droplet restart: php scripts/bump_server_boot_epoch.php
 */

require_once __DIR__ . '/../api/server_boot.php';

$epoch = bumpServerBootEpoch();
echo "OK: server_boot_epoch={$epoch}\n";
