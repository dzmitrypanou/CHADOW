<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    tactics_json_error('Метод не поддерживается', 405);
}

user_require_csrf_ajax();

$input = tactics_read_json_input();
$lang = abs_resolve_lang($input);
$validation = tactics_validate_create_input($input, $lang);
if (!$validation['ok']) {
    tactics_json_error($validation['error'] ?? 'Некорректные данные');
}

$data = $validation['data'];
$userId = user_current_id();

if ($userId === null) {
    $rateError = tactics_guest_create_rate_check($lang);
    if ($rateError !== null) {
        tactics_json_error($rateError, 429);
    }
}

if ($userId !== null && !user_is_active($userDb)) {
    tactics_json_error($lang === 'en' ? 'Account disabled' : 'Аккаунт отключён', 403);
}

try {
    $publicId = tactics_generate_public_id($userDb);
    $roomJson = json_encode($data['room_data'], JSON_UNESCAPED_UNICODE);

    $userDb->insert(
        'INSERT INTO tactics_rooms
            (public_id, user_id, title, visibility, password_hash, room_data, revision, last_active_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)',
        [
            $publicId,
            $userId,
            $data['title'],
            $data['visibility'],
            $data['password_hash'],
            $roomJson,
        ]
    );

    if ($userId === null) {
        tactics_guest_create_rate_register();
    }

    $row = tactics_fetch_row($userDb, $publicId, true);
    if (!$row) {
        tactics_json_error('Ошибка сервера', 500);
    }

    $isOwner = true;
    $profile = $userId !== null ? user_login_row($userDb, $userId) : null;
    $nickname = tactics_resolve_user_nickname(
        $profile,
        $lang,
        $data['game'],
        $data['nickname'],
        $userId !== null
    );
    echo json_encode([
        'success' => true,
        'data' => tactics_format_response($row, $userDb, $data['client_id'], $nickname, $isOwner),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    tactics_json_error('Ошибка сервера', 500);
}
