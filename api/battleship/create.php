<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    battleship_json_error('Метод не поддерживается', 405);
}

user_require_csrf_ajax();

$input = battleship_read_json_input();
$lang = battleship_resolve_lang($input);
$nickname = battleship_normalize_player_name((string) ($input['nickname'] ?? ''));
if ($nickname === '') {
    $nickname = battleship_default_nickname($userDb, $lang);
}
if (!battleship_player_name_valid($nickname)) {
    battleship_json_error($lang === 'en'
        ? 'Nickname: 2–32 characters (letters, digits, _-.).'
        : 'Ник: 2–32 символа (буквы, цифры, _-.).');
}

$clientId = battleship_sanitize_client_id((string) ($input['client_id'] ?? ''));
$boardSize = battleship_normalize_board_size($input['board_size'] ?? 10);

try {
    $publicId = battleship_generate_public_id();
    $registered = battleship_ws_register_room($userDb, $publicId, $clientId, $nickname, $boardSize);
    if (!$registered['ok']) {
        $err = $registered['error'] ?? 'ws_error';
        if ($err === 'ws_unreachable') {
            battleship_json_error($lang === 'en'
                ? 'Realtime server is unavailable. Try again later.'
                : 'Сервер realtime недоступен. Попробуйте позже.', 503);
        }
        battleship_json_error($lang === 'en' ? 'Could not create room' : 'Не удалось создать комнату', 500);
    }

    echo json_encode([
        'success' => true,
        'data' => battleship_format_session(
            $userDb,
            $publicId,
            $clientId,
            $nickname,
            'host',
            $lang,
            (int) ($registered['board_size'] ?? $boardSize)
        ),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    battleship_json_error($lang === 'en' ? 'Server error' : 'Ошибка сервера', 500);
}
