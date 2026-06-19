<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../includes/site_users_admin_helpers.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit();
}

$result = site_users_admin_fetch_users($db, [
    'q' => $_GET['q'] ?? '',
    'provider' => $_GET['provider'] ?? '',
    'active' => $_GET['active'] ?? '',
    'page' => $_GET['page'] ?? 1,
    'per_page' => 50,
]);

if (empty($result['success'])) {
    $errors = [
        'invalid_provider' => 'Недопустимый способ входа',
        'invalid_active' => 'Недопустимый фильтр статуса',
        'db_error' => 'Ошибка базы данных',
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
    'data' => $result['data'] ?? [],
    'stats' => $result['stats'] ?? site_users_admin_fetch_stats($db),
    'pagination' => $result['pagination'] ?? null,
], JSON_UNESCAPED_UNICODE);
