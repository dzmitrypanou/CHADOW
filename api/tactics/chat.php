<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, X-Tactics-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

$lang = abs_detect_lang();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $publicId = trim((string) ($_GET['public_id'] ?? ''));
    $sinceId = (int) ($_GET['since_id'] ?? 0);
    $token = trim((string) ($_GET['ws_token'] ?? $_SERVER['HTTP_X_TACTICS_TOKEN'] ?? ''));

    if (!tactics_public_id_valid($publicId)) {
        tactics_json_error($lang === 'en' ? 'Invalid room code' : 'Некорректный код комнаты');
    }

    if ($token === '') {
        tactics_json_error($lang === 'en' ? 'Token required' : 'Требуется токен', 401);
    }

    $tokenPayload = tactics_verify_signed_token($userDb, $token, $publicId);
    if ($tokenPayload === null) {
        tactics_json_error($lang === 'en' ? 'Unauthorized' : 'Нет доступа', 401);
    }

    $row = tactics_fetch_row($userDb, $publicId, true);
    if (!$row) {
        tactics_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
    }

    $messages = tactics_fetch_room_chat($userDb, $publicId, $sinceId, 100);
    echo json_encode([
        'success' => true,
        'messages' => $messages,
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    tactics_json_error($lang === 'en' ? 'Method not supported' : 'Метод не поддерживается', 405);
}

user_require_csrf_ajax();

$input = tactics_read_json_input();
$publicId = trim((string) ($input['public_id'] ?? ''));
$message = trim((string) ($input['message'] ?? ''));
$token = trim((string) ($input['ws_token'] ?? $_SERVER['HTTP_X_TACTICS_TOKEN'] ?? ''));

if (!tactics_public_id_valid($publicId)) {
    tactics_json_error($lang === 'en' ? 'Invalid room code' : 'Некорректный код комнаты');
}

if ($token === '') {
    tactics_json_error($lang === 'en' ? 'Token required' : 'Требуется токен', 401);
}

$tokenPayload = tactics_verify_signed_token($userDb, $token, $publicId);
if ($tokenPayload === null) {
    tactics_json_error($lang === 'en' ? 'Unauthorized' : 'Нет доступа', 401);
}

$clientId = trim((string) ($tokenPayload['cid'] ?? ''));
$nickname = tactics_sanitize_nickname((string) ($tokenPayload['nick'] ?? 'Guest'));
if ($clientId === '') {
    tactics_json_error($lang === 'en' ? 'Invalid client' : 'Некорректный клиент', 400);
}

$row = tactics_fetch_row($userDb, $publicId, true);
if (!$row) {
    tactics_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
}

if (!tactics_chat_rate_limit_ok($userDb, $publicId, $clientId)) {
    tactics_json_error($lang === 'en' ? 'Too fast' : 'Слишком часто', 429);
}

try {
    $messageId = tactics_insert_room_chat($userDb, $publicId, $clientId, $nickname, $message);
    if ($messageId <= 0) {
        tactics_json_error($lang === 'en' ? 'Empty message' : 'Пустое сообщение');
    }

    echo json_encode([
        'success' => true,
        'message' => [
            'id' => $messageId,
            'clientId' => $clientId,
            'nickname' => $nickname,
            'message' => tactics_sanitize_chat_message($message),
            'createdAt' => date('Y-m-d H:i:s.v'),
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    tactics_json_error($lang === 'en' ? 'Server error' : 'Ошибка сервера', 500);
}
