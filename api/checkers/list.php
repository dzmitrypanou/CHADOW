<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    checkers_json_error('Метод не поддерживается', 405);
}

$lang = checkers_resolve_lang($_GET);

try {
    $listed = checkers_ws_list_lobbies(50);
    if (!$listed['ok']) {
        if (($listed['error'] ?? '') === 'ws_unreachable') {
            checkers_json_error($lang === 'en'
                ? 'Realtime server is unavailable.'
                : 'Сервер realtime недоступен.', 503);
        }
        checkers_json_error($lang === 'en' ? 'Could not load lobbies' : 'Не удалось загрузить лобби', 500);
    }

    $items = [];
    foreach ($listed['lobbies'] as $row) {
        if (!is_array($row)) {
            continue;
        }
        $item = checkers_format_lobby_item($row, $lang);
        if ($item !== null) {
            $items[] = $item;
        }
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'lobbies' => $items,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    checkers_json_error($lang === 'en' ? 'Server error' : 'Ошибка сервера', 500);
}
