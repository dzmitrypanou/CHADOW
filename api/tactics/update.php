<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    tactics_json_error('Метод не поддерживается', 405);
}

user_require_csrf_ajax();

$lang = abs_detect_lang();
$input = tactics_read_json_input();
$publicId = trim((string) ($input['public_id'] ?? ''));
if (!tactics_public_id_valid($publicId)) {
    tactics_json_error($lang === 'en' ? 'Invalid room code' : 'Некорректный код комнаты');
}

$accessToken = tactics_resolve_access_token($input);
$userId = user_current_id();
$expectedRevision = isset($input['revision']) ? (int) $input['revision'] : null;

try {
    $row = tactics_fetch_row($userDb, $publicId, true);
    if (!$row) {
        tactics_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
    }

    $editCheck = tactics_assert_can_edit($row, $accessToken, $userId, $userDb);
    if (!$editCheck['ok']) {
        tactics_json_error($lang === 'en' ? 'No edit permission' : 'Нет прав на редактирование', 403);
    }

    $isOwner = tactics_resolve_is_owner($row, $accessToken, $userId, $userDb);
    $tokenClientId = tactics_token_client_id($accessToken, $userDb, $publicId);
    $oldRoomData = tactics_parse_room_data($row['room_data'] ?? null);

    $currentRevision = (int) ($row['revision'] ?? 1);
    if ($expectedRevision !== null && $expectedRevision > 0 && $expectedRevision !== $currentRevision) {
        tactics_json_error($lang === 'en' ? 'Room was updated elsewhere' : 'Комната обновлена в другом окне', 409);
    }

    $sets = ['revision = ?', 'last_active_at = CURRENT_TIMESTAMP'];
    $params = [];
    $newRevision = $currentRevision + 1;
    $params[] = $newRevision;

    if (isset($input['room_data'])) {
        $roomValidation = tactics_validate_room_data($input['room_data']);
        if (!$roomValidation['ok']) {
            if (($roomValidation['error'] ?? '') === 'mixed_games') {
                tactics_json_error($lang === 'en'
                    ? 'All maps in a room must belong to the same game'
                    : 'Все карты комнаты должны быть из одной игры');
            }
            tactics_json_error($lang === 'en' ? 'Invalid room data' : 'Некорректные данные комнаты');
        }
        $newRoomData = $roomValidation['data'];

        if (!$isOwner && tactics_draw_settings_changed($oldRoomData, $newRoomData)) {
            tactics_json_error($lang === 'en' ? 'Only the room creator can change draw settings' : 'Менять права рисования может только создатель комнаты', 403);
        }

        if (!$isOwner && tactics_room_slides_structure_changed($oldRoomData, $newRoomData)) {
            if (!tactics_user_can_draw($oldRoomData, $tokenClientId, $isOwner)) {
                tactics_json_error($lang === 'en' ? 'Only the room creator can change maps' : 'Менять карты может только создатель комнаты', 403);
            }
            if (tactics_room_slides_ids_removed($oldRoomData, $newRoomData)) {
                tactics_json_error($lang === 'en' ? 'Only the room creator can delete maps' : 'Удалять карты может только создатель комнаты', 403);
            }
        }

        if (tactics_room_data_canvas_changed($oldRoomData, $newRoomData)
            && !tactics_user_can_draw($newRoomData, $tokenClientId, $isOwner)) {
            tactics_json_error($lang === 'en' ? 'No draw permission' : 'Нет прав на рисование', 403);
        }

        $sets[] = 'room_data = ?';
        $params[] = json_encode($newRoomData, JSON_UNESCAPED_UNICODE);
    }

    if (array_key_exists('visibility', $input)) {
        $visibility = trim((string) $input['visibility']);
        if (!tactics_visibility_valid($visibility)) {
            tactics_json_error($lang === 'en' ? 'Invalid visibility' : 'Некорректная видимость');
        }
        if (!$isOwner) {
            tactics_json_error($lang === 'en' ? 'Only the room creator can change visibility' : 'Менять видимость может только создатель комнаты', 403);
        }
        $sets[] = 'visibility = ?';
        $params[] = $visibility;
        if ($visibility === 'open') {
            $sets[] = 'password_hash = NULL';
        }
    }

    if (isset($input['password']) && trim((string) $input['password']) !== '') {
        $password = (string) $input['password'];
        if (strlen($password) > TACTICS_PASSWORD_MAX_LEN) {
            tactics_json_error($lang === 'en' ? 'Password too long' : 'Слишком длинный пароль');
        }
        if (!$isOwner) {
            tactics_json_error($lang === 'en' ? 'Only the room creator can change password' : 'Менять пароль может только создатель комнаты', 403);
        }
        $sets[] = 'password_hash = ?';
        $params[] = password_hash($password, PASSWORD_DEFAULT);
    }

    if (count($params) <= 1) {
        tactics_json_error($lang === 'en' ? 'Nothing to update' : 'Нет данных для обновления');
    }

    $params[] = $publicId;
    $params[] = $currentRevision;

    $userDb->query(
        'UPDATE tactics_rooms SET ' . implode(', ', $sets) . ' WHERE public_id = ? AND revision = ?',
        $params
    );

    $updated = tactics_fetch_row($userDb, $publicId, true);
    if (!$updated || (int) ($updated['revision'] ?? 0) !== $newRevision) {
        tactics_json_error($lang === 'en' ? 'Conflict while saving' : 'Конфликт при сохранении', 409);
    }

    echo json_encode([
        'success' => true,
        'data' => tactics_format_item($updated, true, true),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    tactics_json_error('Ошибка сервера', 500);
}
