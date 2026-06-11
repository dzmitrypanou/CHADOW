<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    tactics_json_error('Метод не поддерживается', 405);
}

user_require_ajax();
user_require_active($userDb);

$lang = abs_detect_lang();
$userId = user_current_id();

try {
    $rows = tactics_fetch_user_rooms($userDb, (int) $userId);

    $items = array_map(static function (array $row) use ($lang): array {
        return tactics_format_profile_item($row, $lang);
    }, $rows);

    echo json_encode([
        'success' => true,
        'data' => $items,
        'count' => count($items),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    tactics_json_error('Ошибка сервера', 500);
}
