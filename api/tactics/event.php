<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, X-Tactics-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    tactics_json_error('Метод не поддерживается', 405);
}

user_require_csrf_ajax();

$lang = abs_detect_lang();
$input = tactics_read_json_input();
$publicId = trim((string) ($input['public_id'] ?? ''));
$eventType = trim((string) ($input['event_type'] ?? ''));
$slideId = trim((string) ($input['slide_id'] ?? ''));
$payload = is_array($input['payload'] ?? null) ? $input['payload'] : [];

if (!tactics_public_id_valid($publicId)) {
    tactics_json_error($lang === 'en' ? 'Invalid room code' : 'Некорректный код комнаты');
}

$token = trim((string) ($input['ws_token'] ?? $_SERVER['HTTP_X_TACTICS_TOKEN'] ?? ''));
if ($token === '') {
    tactics_json_error($lang === 'en' ? 'Token required' : 'Требуется токен', 401);
}

$row = tactics_fetch_row($userDb, $publicId, true);
if (!$row) {
    tactics_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
}

$tokenPayload = tactics_verify_room_token($userDb, $token, $row);
if ($tokenPayload === null) {
    tactics_json_error($lang === 'en' ? 'Unauthorized' : 'Нет доступа', 401);
}

$clientId = trim((string) ($tokenPayload['cid'] ?? ''));
$nickname = tactics_sanitize_nickname((string) ($tokenPayload['nick'] ?? 'Guest'));
if ($clientId === '') {
    tactics_json_error($lang === 'en' ? 'Invalid client' : 'Некорректный клиент', 400);
}

try {
    if ($eventType === 'cursor') {
        $roomData = tactics_parse_room_data($row['room_data'] ?? null);
        $canShare = tactics_user_can_share_cursor($roomData);
        $visible = !empty($payload['visible']);
        if (!$canShare && $visible) {
            echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
            exit();
        }
        tactics_update_presence_cursor($userDb, $publicId, $clientId, $nickname, $slideId, $payload);
        echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($eventType === 'ping') {
        $eventId = tactics_push_room_event($userDb, $publicId, $clientId, 'ping', $slideId, $payload);
        echo json_encode(['success' => true, 'event_id' => $eventId], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($eventType === 'nick_color') {
        $color = tactics_sanitize_nick_color((string) ($payload['color'] ?? ''));
        if ($color === null) {
            tactics_json_error($lang === 'en' ? 'Invalid color' : 'Некорректный цвет');
        }
        tactics_update_presence_nick_color($userDb, $publicId, $clientId, $nickname, $color);
        echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
        exit();
    }

    tactics_json_error($lang === 'en' ? 'Unsupported event' : 'Неподдерживаемое событие');
} catch (Throwable $e) {
    tactics_json_error('Ошибка сервера', 500);
}
