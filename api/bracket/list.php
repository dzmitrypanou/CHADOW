<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    bracket_json_error('Метод не поддерживается', 405);
}

require_once __DIR__ . '/../../includes/lang.php';

$query = [
    'q' => $_GET['q'] ?? '',
    'page' => $_GET['page'] ?? 1,
    'limit' => $_GET['limit'] ?? 20,
    'lang' => abs_detect_lang(),
];

try {
    $result = bracket_fetch_list($userDb, $query);
    if (!$result['success']) {
        bracket_json_error((string) ($result['error'] ?? 'Ошибка запроса'));
    }

    header('Cache-Control: public, max-age=30, stale-while-revalidate=60');
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    bracket_json_error('Ошибка сервера', 500);
}
