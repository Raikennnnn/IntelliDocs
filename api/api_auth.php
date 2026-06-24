<?php
declare(strict_types=1);

/**
 * Resolve authenticated actor for protected API endpoints.
 *
 * @return array{id: int, role: string, session_id: int|null}
 */
function apiRequireActor(PDO $pdo, string $endpointLabel, bool $touchActivity = true): array
{
    require_once __DIR__ . '/session_token.php';
    return requireAuthenticatedActor($pdo, $endpointLabel, $touchActivity);
}
