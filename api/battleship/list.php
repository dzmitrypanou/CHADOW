<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    battleship_json_error('Метод не поддерживается', 405);
}

$lang = battleship_resolve_lang($_GET);

try {
    $listed = battleship_ws_list_lobbies(50);
    if (!$listed['ok']) {
        if (($listed['error'] ?? '') === 'ws_unreachable') {
            battleship_json_error($lang === 'en'
                ? 'Realtime server is unavailable.'
                : 'Сервер realtime недоступен.', 503);
        }
        battleship_json_error($lang === 'en' ? 'Could not load lobbies' : 'Не удалось загрузить лобби', 500);
    }

    $items = [];
    foreach ($listed['lobbies'] as $row) {
        if (!is_array($row)) {
            continue;
        }
        $item = battleship_format_lobby_item($row, $lang);
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
    battleship_json_error($lang === 'en' ? 'Server error' : 'Ошибка сервера', 500);
}
