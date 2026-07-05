<?php
declare(strict_types=1);

function activityLogColumnExists(PDO $pdo, string $table, string $column): bool
{
    static $cache = [];
    $key = $table . '.' . $column;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column
         LIMIT 1'
    );
    $stmt->execute([':table' => $table, ':column' => $column]);
    $cache[$key] = (bool)$stmt->fetchColumn();
    return $cache[$key];
}

/**
 * Build a schema-safe OR search clause for activity_logs + users join.
 *
 * @param array<string, string> $params
 */
function buildActivityLogSearchWhere(PDO $pdo, string $search, array &$params, string $al = 'al', string $u = 'u'): string
{
    $like = '%' . $search . '%';
    $parts = [];
    $i = 0;

    $add = static function (string $expr) use (&$parts, &$params, $like, &$i): void {
        $key = ':log_search_' . $i++;
        $parts[] = $expr . ' LIKE ' . $key;
        $params[$key] = $like;
    };

    $add("{$al}.action");
    $add("{$al}.module");
    $add("CAST({$al}.actor_user_id AS CHAR)");
    $add("CAST({$al}.target_id AS CHAR)");
    $add("CAST({$al}.details_json AS CHAR)");

    if (activityLogColumnExists($pdo, 'activity_logs', 'ip_address')) {
        $add("{$al}.ip_address");
    }

    foreach (['full_name', 'username', 'email', 'first_name', 'last_name', 'school_username'] as $col) {
        if (activityLogColumnExists($pdo, 'users', $col)) {
            $add("{$u}.{$col}");
        }
    }

    return '(' . implode(' OR ', $parts) . ')';
}

/** Schema-safe display name for the actor user joined from `users`. */
function buildActivityLogActorNameSelect(PDO $pdo, string $userAlias = 'u'): string
{
    $parts = [];
    foreach (['full_name', 'username', 'email', 'first_name', 'last_name', 'school_username'] as $col) {
        if (activityLogColumnExists($pdo, 'users', $col)) {
            $parts[] = "{$userAlias}.{$col}";
        }
    }
    if ($parts === []) {
        return "'System' AS actor_name";
    }

    return 'COALESCE(' . implode(', ', $parts) . ", 'System') AS actor_name";
}
