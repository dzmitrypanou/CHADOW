<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    battleship_json_error('Метод не поддерживается', 405);
}

user_require_csrf_ajax();

$input = battleship_read_json_input();
$lang = battleship_resolve_lang($input);
$publicId = strtoupper(trim((string) ($input['public_id'] ?? '')));
if (!battleship_public_id_valid($publicId)) {
    battleship_json_error($lang === 'en' ? 'Invalid room code' : 'Некорректный код комнаты');
}

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
$wsToken = trim((string) ($input['ws_token'] ?? ''));

if ($wsToken !== '') {
    $payload = battleship_verify_signed_token($userDb, $wsToken, $publicId);
    if ($payload !== null && ($payload['cid'] ?? '') === $clientId) {
        $color = (string) ($payload['color'] ?? '');
        $savedNick = (string) ($payload['nick'] ?? $nickname);
        if ($savedNick !== '') {
            $nickname = $savedNick;
        }

        $joined = battleship_ws_join_room($userDb, $publicId, $clientId, $nickname);
        if (!$joined['ok'] && ($joined['error'] ?? '') === 'Room not found' && $color === 'host') {
            $registered = battleship_ws_register_room($userDb, $publicId, $clientId, $nickname);
            if (!$registered['ok']) {
                $err = $registered['error'] ?? 'ws_error';
                if ($err === 'ws_unreachable') {
                    battleship_json_error($lang === 'en'
                        ? 'Realtime server is unavailable. Try again later.'
                        : 'Сервер realtime недоступен. Попробуйте позже.', 503);
                }
                battleship_json_error($lang === 'en' ? 'Could not join room' : 'Не удалось войти в комнату', 500);
            }
            $joined = [
                'ok' => true,
                'status' => 'waiting',
                'color' => 'host',
                'board_size' => (int) ($registered['board_size'] ?? 10),
            ];
        } elseif (!$joined['ok']) {
            $err = $joined['error'] ?? 'ws_error';
            if ($err === 'Room not found') {
                battleship_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
            }
            if ($err === 'Room full') {
                battleship_json_error($lang === 'en' ? 'Room is full' : 'Комната уже занята', 409);
            }
            if ($err === 'ws_unreachable') {
                battleship_json_error($lang === 'en'
                    ? 'Realtime server is unavailable. Try again later.'
                    : 'Сервер realtime недоступен. Попробуйте позже.', 503);
            }
            battleship_json_error($lang === 'en' ? 'Could not join room' : 'Не удалось войти в комнату', 500);
        }

        if (($joined['color'] ?? '') === 'host' || ($joined['color'] ?? '') === 'guest') {
            $color = (string) $joined['color'];
        }

        echo json_encode([
            'success' => true,
            'data' => battleship_format_session(
                $userDb,
                $publicId,
                $clientId,
                $nickname,
                $color,
                $lang,
                (int) ($joined['board_size'] ?? 10)
            ),
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }
}

try {
    $joined = battleship_ws_join_room($userDb, $publicId, $clientId, $nickname);
    if (!$joined['ok']) {
        $err = $joined['error'] ?? 'ws_error';
        if ($err === 'Room not found') {
            battleship_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
        }
        if ($err === 'Room full') {
            battleship_json_error($lang === 'en' ? 'Room is full' : 'Комната уже занята', 409);
        }
        if ($err === 'ws_unreachable') {
            battleship_json_error($lang === 'en'
                ? 'Realtime server is unavailable. Try again later.'
                : 'Сервер realtime недоступен. Попробуйте позже.', 503);
        }
        battleship_json_error($lang === 'en' ? 'Could not join room' : 'Не удалось войти в комнату', 500);
    }

    $color = (string) ($joined['color'] ?? 'guest');
    if ($color !== 'host' && $color !== 'guest') {
        $color = 'guest';
    }

    echo json_encode([
        'success' => true,
        'data' => battleship_format_session(
            $userDb,
            $publicId,
            $clientId,
            $nickname,
            $color,
            $lang,
            (int) ($joined['board_size'] ?? 10)
        ),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    battleship_json_error($lang === 'en' ? 'Server error' : 'Ошибка сервера', 500);
}
