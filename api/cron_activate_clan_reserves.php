<?php
require_once __DIR__ . '/bootstrap.php';

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

try {
    $service = new ClanReserveService($userDb);
    $summary = $service->runDueRules(new DateTimeImmutable('now', new DateTimeZone('UTC')));

    echo json_encode([
        'success' => true,
        'summary' => $summary,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'server_error'], JSON_UNESCAPED_UNICODE);
}
