<?php
declare(strict_types=1);

/*
 * Front controller — API requests only (/api/*).
 * The React SPA is served as index.html; direct /index.php without /api/ returns 404.
 */

define('FCPATH', __DIR__ . DIRECTORY_SEPARATOR);

if (getcwd() . DIRECTORY_SEPARATOR !== FCPATH) {
    chdir(FCPATH);
}

$minPhpVersion = '8.1';
if (version_compare(PHP_VERSION, $minPhpVersion, '<')) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Service Unavailable';
    exit(1);
}

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?? '';
if (preg_match('#/api(/|$)#', $requestPath)) {
    require_once FCPATH . 'api_index.php';
    exit;
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo 'Not Found';
exit;
