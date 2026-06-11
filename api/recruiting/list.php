<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    recruiting_json_error('Метод не поддерживается', 405);
}

$query = [
    'post_type' => $_GET['post_type'] ?? '',
    'realm' => $_GET['realm'] ?? '',
    'q' => $_GET['q'] ?? '',
    'page' => $_GET['page'] ?? 1,
    'limit' => $_GET['limit'] ?? 20,
];

try {
    $result = recruiting_fetch_post_list($userDb, $query);
    if (!$result['success']) {
        recruiting_json_error((string) ($result['error'] ?? 'Ошибка запроса'));
    }

    header('Cache-Control: public, max-age=30, stale-while-revalidate=60');
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    recruiting_json_error('Ошибка сервера', 500);
}
