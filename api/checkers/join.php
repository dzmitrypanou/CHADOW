<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    checkers_json_error('Метод не поддерживается', 405);
}

user_require_csrf_ajax();

$input = checkers_read_json_input();
$lang = checkers_resolve_lang($input);
$publicId = strtoupper(trim((string) ($input['public_id'] ?? '')));
if (!checkers_public_id_valid($publicId)) {
    checkers_json_error($lang === 'en' ? 'Invalid room code' : 'Некорректный код комнаты');
}

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
$wsToken = trim((string) ($input['ws_token'] ?? ''));

if ($wsToken !== '') {
    $payload = checkers_verify_signed_token($userDb, $wsToken, $publicId);
    if ($payload !== null && ($payload['cid'] ?? '') === $clientId) {
        $color = (string) ($payload['color'] ?? '');
        $savedNick = (string) ($payload['nick'] ?? $nickname);
        if ($savedNick !== '') {
            $nickname = $savedNick;
        }

        $joined = checkers_ws_join_room($userDb, $publicId, $clientId, $nickname);
        if (!$joined['ok'] && ($joined['error'] ?? '') === 'Room not found' && $color === 'white') {
            $registered = checkers_ws_register_room($userDb, $publicId, $clientId, $nickname);
            if (!$registered['ok']) {
                $err = $registered['error'] ?? 'ws_error';
                if ($err === 'ws_unreachable') {
                    checkers_json_error($lang === 'en'
                        ? 'Realtime server is unavailable. Try again later.'
                        : 'Сервер realtime недоступен. Попробуйте позже.', 503);
                }
                checkers_json_error($lang === 'en' ? 'Could not join room' : 'Не удалось войти в комнату', 500);
            }
            $joined = ['ok' => true, 'status' => 'waiting', 'color' => 'white'];
        } elseif (!$joined['ok']) {
            $err = $joined['error'] ?? 'ws_error';
            if ($err === 'Room not found') {
                checkers_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
            }
            if ($err === 'Room full') {
                checkers_json_error($lang === 'en' ? 'Room is full' : 'Комната уже занята', 409);
            }
            if ($err === 'ws_unreachable') {
                checkers_json_error($lang === 'en'
                    ? 'Realtime server is unavailable. Try again later.'
                    : 'Сервер realtime недоступен. Попробуйте позже.', 503);
            }
            checkers_json_error($lang === 'en' ? 'Could not join room' : 'Не удалось войти в комнату', 500);
        }

        if (($joined['color'] ?? '') === 'white' || ($joined['color'] ?? '') === 'black') {
            $color = (string) $joined['color'];
        }

        echo json_encode([
            'success' => true,
            'data' => checkers_format_session(
                $userDb,
                $publicId,
                $clientId,
                $nickname,
                $color,
                $lang
            ),
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }
}

try {
    $joined = checkers_ws_join_room($userDb, $publicId, $clientId, $nickname);
    if (!$joined['ok']) {
        $err = $joined['error'] ?? 'ws_error';
        if ($err === 'Room not found') {
            checkers_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
        }
        if ($err === 'Room full') {
            checkers_json_error($lang === 'en' ? 'Room is full' : 'Комната уже занята', 409);
        }
        if ($err === 'ws_unreachable') {
            checkers_json_error($lang === 'en'
                ? 'Realtime server is unavailable. Try again later.'
                : 'Сервер realtime недоступен. Попробуйте позже.', 503);
        }
        checkers_json_error($lang === 'en' ? 'Could not join room' : 'Не удалось войти в комнату', 500);
    }

    $color = (string) ($joined['color'] ?? 'black');
    if ($color !== 'white' && $color !== 'black') {
        $color = 'black';
    }

    echo json_encode([
        'success' => true,
        'data' => checkers_format_session($userDb, $publicId, $clientId, $nickname, $color, $lang),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    checkers_json_error($lang === 'en' ? 'Server error' : 'Ошибка сервера', 500);
}
