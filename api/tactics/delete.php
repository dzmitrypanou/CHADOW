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

try {
    $row = tactics_fetch_row($userDb, $publicId, true);
    if (!$row) {
        tactics_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
    }

    if (!tactics_resolve_is_owner($row, $accessToken, $userId, $userDb)) {
        tactics_json_error($lang === 'en' ? 'Access denied' : 'Нет доступа', 403);
    }

    if (!tactics_delete_room($userDb, $publicId)) {
        tactics_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
    }

    echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    tactics_json_error('Ошибка сервера', 500);
}
