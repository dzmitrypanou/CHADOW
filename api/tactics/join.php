<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    tactics_json_error('Метод не поддерживается', 405);
}

user_require_csrf_ajax();

$input = tactics_read_json_input();
$lang = abs_resolve_lang($input);
$publicId = trim((string) ($input['public_id'] ?? ''));
if (!tactics_public_id_valid($publicId)) {
    tactics_json_error($lang === 'en' ? 'Invalid room code' : 'Некорректный код комнаты');
}

$password = isset($input['password']) ? (string) $input['password'] : null;
$nickname = tactics_sanitize_nickname((string) ($input['nickname'] ?? 'Guest'));
$clientId = trim((string) ($input['client_id'] ?? ''));
if ($clientId === '' || !preg_match('/^[a-zA-Z0-9_-]{8,64}$/', $clientId)) {
    $clientId = 'c' . bin2hex(random_bytes(8));
}

try {
    $row = tactics_fetch_row($userDb, $publicId, true);
    if (!$row) {
        tactics_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
    }

    $userId = user_current_id();
    $accessToken = tactics_resolve_access_token($input);
    $access = tactics_assert_can_access_room($row, $password, $userId, $accessToken, $userDb);
    if (!$access['ok']) {
        if (!empty($access['needs_password'])) {
            if (($access['error'] ?? '') === 'wrong_password') {
                tactics_json_error($lang === 'en' ? 'Incorrect password' : 'Неверный пароль', 403);
            }
            tactics_json_error($lang === 'en' ? 'Password required' : 'Требуется пароль', 403);
        }
        tactics_json_error($lang === 'en' ? 'Access denied' : 'Нет доступа', 403);
    }

    tactics_touch_room($userDb, $publicId);

    $isOwner = $userId !== null && isset($row['user_id']) && (int) $row['user_id'] === $userId;
    if (!$isOwner) {
        $existingToken = tactics_resolve_access_token($input);
        if ($existingToken !== null && $existingToken !== '') {
            $tokenPayload = tactics_verify_room_token($userDb, $existingToken, $row);
            if ($tokenPayload !== null && ($tokenPayload['role'] ?? '') === 'owner') {
                $isOwner = true;
            }
        }
    }

    $inputNickname = tactics_sanitize_nickname((string) ($input['nickname'] ?? ''));
    $nicknameChange = !empty($input['nickname_change']);

    if (!$isOwner && $nicknameChange && $inputNickname !== '') {
        $nickname = $inputNickname;
    } elseif ($userId !== null) {
        $roomData = json_decode((string) ($row['room_data'] ?? ''), true);
        if (!is_array($roomData)) {
            $roomData = [];
        }
        $roomGame = tactics_room_primary_game($roomData);
        $profile = user_login_row($userDb, $userId);
        if (!$isOwner && !tactics_is_generic_guest_nickname($inputNickname)) {
            $nickname = $inputNickname;
        } else {
            $nickname = tactics_resolve_user_nickname(
                $profile,
                $lang,
                $roomGame,
                (string) ($input['nickname'] ?? ''),
                true
            );
        }
    } elseif (!tactics_is_generic_guest_nickname($inputNickname)) {
        $nickname = $inputNickname;
    } else {
        $existingNickname = tactics_fetch_presence_nickname($userDb, $publicId, $clientId);
        if ($existingNickname !== null && !tactics_is_generic_guest_nickname($existingNickname)) {
            $nickname = $existingNickname;
        } else {
            $nickname = tactics_allocate_guest_nickname($userDb, $publicId, $clientId, $lang);
        }
    }

    echo json_encode([
        'success' => true,
        'data' => tactics_format_response($row, $userDb, $clientId, $nickname, $isOwner),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    tactics_json_error('Ошибка сервера', 500);
}
