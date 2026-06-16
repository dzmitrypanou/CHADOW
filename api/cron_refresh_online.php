<?php

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'method_not_allowed'], JSON_UNESCAPED_UNICODE);
    exit();
}

$expectedToken = getenv('ONLINE_CRON_TOKEN');
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

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/online_service.php';

try {
    $service = new OnlineService(Database::getInstance());
    $result = $service->runScheduledRefresh(false);

    echo json_encode([
        'success' => (bool) ($result['success'] ?? false),
        'skipped' => !empty($result['skipped']),
        'fetched_at' => $result['fetched_at'] ?? null,
        'rate_limited' => !empty($result['rate_limited']),
        'error' => $result['error'] ?? null,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'server_error'], JSON_UNESCAPED_UNICODE);
}
