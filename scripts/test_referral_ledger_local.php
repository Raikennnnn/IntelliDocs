<?php
declare(strict_types=1);

/**
 * Local smoke test for referral ledger list/search.
 * Run: php scripts/test_referral_ledger_local.php
 */

$root = dirname(__DIR__);
require_once $root . '/api/referral_promo_helpers.php';

$host = getenv('DB_HOST') ?: '127.0.0.1';
$name = getenv('DB_NAME') ?: 'intellidocs_db';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') ?: '';
$port = getenv('DB_PORT') ?: '3306';

$pdo = new PDO(
    "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
    $user,
    $pass,
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]
);

$sy = '2033-2034';

echo "=== list page 1 size 50 ===\n";
$all = listReferralPromoClaims($pdo, $sy, '', '', '', 50, 0);
echo 'claims=' . count($all['claims']) . ' matched=' . $all['matched'] . ' total_stat=' . $all['stats']['total'] . "\n";

echo "=== list page 2 size 50 ===\n";
$page2 = listReferralPromoClaims($pdo, $sy, '', '', '', 50, 50);
echo 'claims=' . count($page2['claims']) . ' first=' . ($page2['claims'][0]['controlNumber'] ?? '') . "\n";

echo "=== search 499 ===\n";
$search = listReferralPromoClaims($pdo, $sy, '499', '', '', 50, 0);
echo 'claims=' . count($search['claims']) . " matched=" . $search['matched'] . "\n";
foreach ($search['claims'] as $c) {
    echo '  ' . $c['controlNumber'] . "\n";
}

echo "OK\n";
