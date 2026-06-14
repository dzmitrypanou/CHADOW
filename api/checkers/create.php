<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    checkers_json_error('Метод не поддерживается', 405);
}

user_require_csrf_ajax();

$input = checkers_read_json_input();
$lang = checkers_resolve_lang($input);
$nickname = checkers_normalize_player_name((string) ($input['nickname'] ?? ''));
if ($nickname === '') {
    $nickname = checkers_default_nickname($userDb, $lang);
}
if (!checkers_player_name_valid($nickname)) {
    checkers_json_error($lang === 'en'
        ? 'Nickname: 2–32 characters (letters, digits, _-.).'
        : 'Ник: 2–32 символа (буквы, цифры, _-.).');
}

$clientId = checkers_sanitize_client_id((string) ($input['client_id'] ?? ''));

try {
    $publicId = checkers_generate_public_id();
    $registered = checkers_ws_register_room($userDb, $publicId, $clientId, $nickname);
    if (!$registered['ok']) {
        $err = $registered['error'] ?? 'ws_error';
        if ($err === 'ws_unreachable') {
            checkers_json_error($lang === 'en'
                ? 'Realtime server is unavailable. Try again later.'
                : 'Сервер realtime недоступен. Попробуйте позже.', 503);
        }
        checkers_json_error($lang === 'en' ? 'Could not create room' : 'Не удалось создать комнату', 500);
    }

    echo json_encode([
        'success' => true,
        'data' => checkers_format_session($userDb, $publicId, $clientId, $nickname, 'white', $lang),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    checkers_json_error($lang === 'en' ? 'Server error' : 'Ошибка сервера', 500);
}
