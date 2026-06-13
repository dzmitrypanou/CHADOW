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

$version = isset($_POST['mc_pack_version']) ? trim((string) $_POST['mc_pack_version']) : '';

try {
    ensure_site_settings_table($db);
    $result = minecraft_admin_delete_client_pack($db, $version);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Ошибка сервера: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

if (!$result['ok']) {
    $errors = [
        'invalid_version' => 'Некорректная версия',
        'not_found' => 'Архив для этой версии не найден',
    ];
    $key = (string) ($result['error'] ?? 'not_found');
    echo json_encode([
        'success' => false,
        'error' => $errors[$key] ?? 'Ошибка удаления',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode([
    'success' => true,
    'packs' => minecraft_get_client_packs($db),
], JSON_UNESCAPED_UNICODE);
