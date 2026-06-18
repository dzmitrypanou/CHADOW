<?php

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'method_not_allowed'], JSON_UNESCAPED_UNICODE);
    exit();
}

$expectedToken = getenv('RESERVES_CRON_TOKEN');
if (!is_string($expectedToken) || $expectedToken === '') {
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'cron_not_configured'], JSON_UNESCAPED_UNICODE);
    exit();
}

$token = isset($_GET['token']) ? (string) $_GET['token'] : '';
if ($token === '' || !hash_equals($expectedToken, $token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'forbidden'], JSON_UNESCAPED_UNICODE);
    exit();
}

require_once __DIR__ . '/../includes/cli_env.php';
chadow_load_cli_env();

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/ensure_clan_reserves.php';
require_once __DIR__ . '/../includes/clan_reserve_helpers.php';
require_once __DIR__ . '/../includes/clan_reserve_service.php';

try {
    $db = Database::getInstance();
    ensure_clan_reserves_tables($db);
    chadow_sync_reserves_cli_env($db);
    $service = new ClanReserveService($db);
    $summary = $service->runDueRules(new DateTimeImmutable('now', new DateTimeZone('UTC')));

    echo json_encode([
        'success' => true,
        'summary' => $summary,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'server_error'], JSON_UNESCAPED_UNICODE);
}
