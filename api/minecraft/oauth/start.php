<?php
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../config/ensure_site_settings.php';
require_once __DIR__ . '/../../../includes/minecraft_oauth_helpers.php';

minecraft_oauth_send_cors_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit();
}

$provider = isset($_REQUEST['provider']) ? (string) $_REQUEST['provider'] : 'wg';

try {
    $db = Database::getInstance();
    ensure_site_settings_table($db);
    $result = minecraft_oauth_create_session($db, $provider);
} catch (Throwable $e) {
    error_log('minecraft oauth start: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Server error',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

if (!$result['ok']) {
    echo json_encode([
        'success' => false,
        'error' => $result['error'] ?? 'Не удалось начать вход',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode([
    'success' => true,
    'session' => $result['session'] ?? '',
    'loginUrl' => $result['loginUrl'] ?? '',
], JSON_UNESCAPED_UNICODE);
