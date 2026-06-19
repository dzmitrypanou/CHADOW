<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../includes/site_users_admin_helpers.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Неверный метод запроса'], JSON_UNESCAPED_UNICODE);
    exit();
}

admin_require_csrf_ajax();

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$activeRaw = isset($_POST['is_active']) ? (string) $_POST['is_active'] : '';
$active = in_array($activeRaw, ['1', 'true', 'yes'], true);

$result = site_users_admin_set_active($db, $id, $active);

if (empty($result['success'])) {
    $errors = [
        'invalid_id' => 'Некорректный id',
        'not_found' => 'Пользователь не найден',
    ];
    $key = (string) ($result['error'] ?? '');
    echo json_encode([
        'success' => false,
        'error' => $errors[$key] ?? 'Ошибка сервера',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode([
    'success' => true,
    'id' => (int) $result['id'],
    'username' => (string) ($result['username'] ?? ''),
    'is_active' => !empty($result['is_active']),
    'stats' => site_users_admin_fetch_stats($db),
], JSON_UNESCAPED_UNICODE);
