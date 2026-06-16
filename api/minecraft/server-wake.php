<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/ensure_site_settings.php';
require_once __DIR__ . '/../../includes/minecraft_helpers.php';

try {
    $db = Database::getInstance();
    ensure_site_settings_table($db);

    $settings = minecraft_get_settings($db);
    if (!$settings['enabled']) {
        echo json_encode(['success' => true, 'woken' => []], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $serverId = isset($_GET['serverId']) ? trim((string) $_GET['serverId']) : null;
    if ($serverId === '') {
        $serverId = null;
    }

    $wake = minecraft_wake_launcher_servers($db, $serverId);
    echo json_encode([
        'success' => true,
        'reason' => $wake['reason'],
        'woken' => $wake['woken'],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Server error',
    ], JSON_UNESCAPED_UNICODE);
}
