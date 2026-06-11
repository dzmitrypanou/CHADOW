<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    bracket_json_error('Метод не поддерживается', 405);
}

user_require_ajax();
user_require_active($userDb);

$userId = user_current_id();

try {
    $rows = $userDb->fetchAll(
        'SELECT ' . bracket_sql_select_columns('b') . '
         FROM tournament_brackets b
         WHERE b.user_id = ?
         ORDER BY b.updated_at DESC, b.id DESC',
        [$userId]
    );

    $items = array_map(static function (array $row): array {
        return bracket_format_item($row, true, false);
    }, $rows);

    echo json_encode([
        'success' => true,
        'data' => $items,
        'count' => count($items),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    bracket_json_error('Ошибка сервера', 500);
}
