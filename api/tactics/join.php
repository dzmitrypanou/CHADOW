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
    $access = tactics_assert_can_access_room($row, $password, $userId);
    if (!$access['ok']) {
        if (!empty($access['needs_password'])) {
            tactics_json_error($lang === 'en' ? 'Password required' : 'Требуется пароль', 403);
        }
        tactics_json_error($lang === 'en' ? 'Access denied' : 'Нет доступа', 403);
    }

    tactics_touch_room($userDb, $publicId);
    $row = tactics_fetch_row($userDb, $publicId, true);

    if ($userId !== null) {
        $roomData = json_decode((string) ($row['room_data'] ?? ''), true);
        if (!is_array($roomData)) {
            $roomData = [];
        }
        $roomGame = tactics_room_primary_game($roomData);
        $profile = user_login_row($userDb, $userId);
        $nickname = tactics_resolve_user_nickname(
            $profile,
            $lang,
            $roomGame,
            (string) ($input['nickname'] ?? ''),
            true
        );
    }

    $isOwner = $userId !== null && isset($row['user_id']) && (int) $row['user_id'] === $userId;
    if (!$isOwner) {
        $existingToken = tactics_resolve_access_token($input);
        if ($existingToken !== null && $existingToken !== '') {
            $tokenPayload = tactics_verify_signed_token($userDb, $existingToken, $publicId);
            if ($tokenPayload !== null && ($tokenPayload['role'] ?? '') === 'owner') {
                $isOwner = true;
            }
        }
    }

    echo json_encode([
        'success' => true,
        'data' => tactics_format_response($row, $userDb, $clientId, $nickname, $isOwner),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    tactics_json_error('Ошибка сервера', 500);
}
