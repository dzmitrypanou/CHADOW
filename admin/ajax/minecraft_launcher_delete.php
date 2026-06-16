<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../includes/minecraft_helpers.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Неверный метод запроса'], JSON_UNESCAPED_UNICODE);
    exit();
}

admin_require_csrf_ajax();

if (!admin_is_admin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Недостаточно прав'], JSON_UNESCAPED_UNICODE);
    exit();
}

try {
    ensure_site_settings_table($db);
    $result = minecraft_admin_delete_launcher_file($db);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Ошибка сервера: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

if (!$result['ok']) {
    echo json_encode(['success' => false, 'error' => 'Файл лаунчера не найден'], JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode([
    'success' => true,
    'landing' => minecraft_get_landing_settings($db),
], JSON_UNESCAPED_UNICODE);
