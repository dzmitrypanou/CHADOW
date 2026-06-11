<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    tactics_json_error('Метод не поддерживается', 405);
}

$lang = abs_detect_lang();
$publicId = trim((string) ($_GET['public_id'] ?? ''));
if (!tactics_public_id_valid($publicId)) {
    tactics_json_error($lang === 'en' ? 'Invalid room code' : 'Некорректный код комнаты');
}

$password = isset($_GET['password']) ? (string) $_GET['password'] : null;
$userId = user_current_id();

try {
    tactics_purge_stale_guest_rooms($userDb);
    $row = tactics_fetch_row($userDb, $publicId, true);
    if (!$row) {
        tactics_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
    }

    $access = tactics_assert_can_access_room($row, $password, $userId);
    if (!$access['ok']) {
        if (!empty($access['needs_password'])) {
            echo json_encode([
                'success' => true,
                'data' => [
                    'public_id' => $publicId,
                    'title' => (string) ($row['title'] ?? ''),
                    'visibility' => (string) ($row['visibility'] ?? 'open'),
                    'has_password' => tactics_room_has_password($row),
                    'needs_password' => true,
                ],
            ], JSON_UNESCAPED_UNICODE);
            exit();
        }
        tactics_json_error($lang === 'en' ? 'Access denied' : 'Нет доступа', 403);
    }

    $item = tactics_format_item($row, true, true);
    $roomData = is_array($item['room_data'] ?? null) ? $item['room_data'] : [];
    $item['map_urls'] = tactics_build_slide_map_urls($roomData, $publicId);

    header('Cache-Control: private, no-cache');
    echo json_encode([
        'success' => true,
        'data' => $item,
        'ws_url' => tactics_ws_public_url(),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    tactics_json_error('Ошибка сервера', 500);
}
