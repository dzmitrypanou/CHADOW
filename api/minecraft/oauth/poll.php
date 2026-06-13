<?php
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../includes/minecraft_oauth_helpers.php';

minecraft_oauth_send_cors_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit();
}

$sessionId = isset($_GET['session']) ? trim((string) $_GET['session']) : '';
if (!minecraft_oauth_is_valid_session_id($sessionId)) {
    echo json_encode([
        'success' => false,
        'status' => 'expired',
        'error' => 'Некорректная сессия',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

$result = minecraft_oauth_poll_session($sessionId);
echo json_encode(array_merge(['success' => $result['ok']], $result), JSON_UNESCAPED_UNICODE);
