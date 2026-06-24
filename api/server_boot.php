<?php
declare(strict_types=1);

/**
 * Server boot epoch — sessions created before the latest bump are rejected.
 * Bumped by scripts/restart_droplet_services.sh (and deploy_all) on restart.
 */

if (!function_exists('serverBootEpochPath')) {
    function serverBootEpochPath(): string
    {
        return dirname(__DIR__) . '/var/server_boot_epoch';
    }
}

if (!function_exists('readServerBootEpoch')) {
    function readServerBootEpoch(): int
    {
        $path = serverBootEpochPath();
        if (!is_readable($path)) {
            return 0;
        }
        $raw = trim((string)file_get_contents($path));
        if ($raw === '' || !ctype_digit($raw)) {
            return 0;
        }
        return (int)$raw;
    }
}

if (!function_exists('bumpServerBootEpoch')) {
    function bumpServerBootEpoch(): int
    {
        $path = serverBootEpochPath();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $epoch = time();
        file_put_contents($path, (string)$epoch, LOCK_EX);
        return $epoch;
    }
}

if (!function_exists('sessionInvalidatedByServerRestart')) {
    function sessionInvalidatedByServerRestart(string $sessionCreatedAt): bool
    {
        $flag = strtolower(trim((string)(getenv('SESSION_INVALIDATE_ON_RESTART') ?: '1')));
        if (in_array($flag, ['0', 'false', 'no', 'off'], true)) {
            return false;
        }
        $boot = readServerBootEpoch();
        if ($boot <= 0) {
            return false;
        }
        $created = strtotime($sessionCreatedAt);
        if ($created === false) {
            return false;
        }
        return $created < $boot;
    }
}
