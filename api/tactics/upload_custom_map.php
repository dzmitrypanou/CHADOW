<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    tactics_json_error('Метод не поддерживается', 405);
}

user_require_csrf_ajax();

$lang = abs_detect_lang();
$publicId = trim((string) ($_POST['public_id'] ?? ''));
$slideId = trim((string) ($_POST['slide_id'] ?? ''));

if (!tactics_public_id_valid($publicId)) {
    tactics_json_error($lang === 'en' ? 'Invalid room code' : 'Некорректный код комнаты');
}

if ($slideId === '' || !preg_match('/^[a-zA-Z0-9_\-]{1,48}$/', $slideId)) {
    tactics_json_error($lang === 'en' ? 'Invalid slide' : 'Некорректный слайд');
}

if (!isset($_FILES['image'])) {
    tactics_json_error($lang === 'en' ? 'No file uploaded' : 'Файл не передан');
}

$accessToken = tactics_resolve_access_token($_POST);
$userId = user_current_id();

try {
    $row = tactics_fetch_row($userDb, $publicId, true);
    if (!$row) {
        tactics_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
    }

    $roomData = tactics_parse_room_data($row['room_data'] ?? null);
    $slide = null;
    foreach ($roomData['slides'] ?? [] as $item) {
        if (!is_array($item)) {
            continue;
        }
        if ((string) ($item['id'] ?? '') === $slideId) {
            $slide = $item;
            break;
        }
    }

    if ($slide === null || !tactics_is_custom_room_slide($slide)) {
        tactics_json_error($lang === 'en' ? 'Custom upload not allowed for this map' : 'Загрузка недоступна для этой карты');
    }

    $isOwner = tactics_resolve_is_owner($row, $accessToken, $userId, $userDb);
    $clientId = tactics_token_client_id($accessToken, $userDb, $publicId);
    if (!$isOwner && !tactics_user_can_draw($roomData, $clientId, false)) {
        tactics_json_error($lang === 'en' ? 'No draw permission' : 'Нет прав на редактирование', 403);
    }

    $rel = tactics_custom_room_map_rel_path($publicId, $slideId, (string) ($slide['game'] ?? ''));
    if ($rel === '') {
        tactics_json_error('Ошибка сервера', 500);
    }

    $destDir = dirname(__DIR__, 2) . '/' . dirname($rel);
    if (!tactics_admin_ensure_writable_dir($destDir)) {
        tactics_json_error($lang === 'en' ? 'Could not save file' : 'Не удалось сохранить файл', 500);
    }

    $tmp = (string) ($_FILES['image']['tmp_name'] ?? '');
    if ($tmp === '' || !is_uploaded_file($tmp)) {
        tactics_json_error($lang === 'en' ? 'Upload failed' : 'Ошибка загрузки файла');
    }

    $size = (int) ($_FILES['image']['size'] ?? 0);
    if ($size <= 0 || $size > 8 * 1024 * 1024) {
        tactics_json_error($lang === 'en' ? 'File too large (max 8 MB)' : 'Файл слишком большой (макс. 8 МБ)');
    }

    $imageInfo = @getimagesize($tmp);
    if ($imageInfo === false) {
        tactics_json_error($lang === 'en' ? 'Invalid image' : 'Некорректное изображение');
    }

    $mime = (string) ($imageInfo['mime'] ?? '');
    $extMap = ['image/webp' => 'webp', 'image/png' => 'png', 'image/jpeg' => 'jpg'];
    if (!isset($extMap[$mime])) {
        tactics_json_error($lang === 'en' ? 'Allowed: WebP, PNG, JPEG' : 'Допустимы WebP, PNG, JPEG');
    }
    $ext = $extMap[$mime];

    foreach (['webp', 'png', 'jpg', 'jpeg'] as $oldExt) {
        $oldPath = dirname(__DIR__, 2) . '/' . $rel . '.' . $oldExt;
        if (is_file($oldPath)) {
            @unlink($oldPath);
        }
    }

    $destPath = dirname(__DIR__, 2) . '/' . $rel . '.' . $ext;
    if (!tactics_admin_persist_uploaded_file($tmp, $destPath)) {
        tactics_json_error($lang === 'en' ? 'Could not save file' : 'Не удалось сохранить файл', 500);
    }

    @chmod($destPath, 0644);

    echo json_encode([
        'success' => true,
        'data' => [
            'url' => '/' . $rel . '.' . $ext . '?t=' . time(),
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    tactics_json_error('Ошибка сервера', 500);
}
