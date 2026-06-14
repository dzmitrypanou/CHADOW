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

    $slideGame = is_array($slide) ? (string) ($slide['game'] ?? '') : '';
    $slideBattleMode = is_array($slide) ? (string) ($slide['battle_mode'] ?? 'random') : 'random';
    $slideMapCode = is_array($slide) ? (string) ($slide['map_code'] ?? '') : '';

    $game = tactics_sanitize_game((string) ($_POST['game'] ?? $slideGame));
    $battleMode = tactics_sanitize_battle_mode((string) ($_POST['battle_mode'] ?? $slideBattleMode), $game);
    $mapCode = tactics_sanitize_map_code((string) ($_POST['map_code'] ?? $slideMapCode));

    if ($slide !== null) {
        if (!tactics_is_custom_room_slide($slide)) {
            tactics_json_error($lang === 'en' ? 'Custom upload not allowed for this map' : 'Загрузка недоступна для этой карты');
        }
        $game = tactics_sanitize_game((string) ($slide['game'] ?? $game));
    } else {
        if ($game === 'wot') {
            $game = tactics_room_primary_game($roomData);
        }
        $expected = tactics_custom_map_code_for_game($game);
        if ($expected === null || $battleMode !== 'custom' || $mapCode !== $expected) {
            tactics_json_error($lang === 'en' ? 'Custom upload not allowed for this map' : 'Загрузка недоступна для этой карты');
        }
    }

    $isOwner = tactics_resolve_is_owner($row, $accessToken, $userId, $userDb);
    $clientId = tactics_token_client_id($accessToken, $userDb, $publicId, $row);
    if (!$isOwner && !tactics_user_can_draw($roomData, $clientId, false)) {
        tactics_json_error($lang === 'en' ? 'No draw permission' : 'Нет прав на редактирование', 403);
    }

    $rel = tactics_custom_room_map_rel_path($publicId, $slideId, $game);
    if ($rel === '') {
        tactics_json_error('Ошибка сервера', 500);
    }

    $destDir = dirname(__DIR__, 2) . '/' . dirname($rel);
    if (!tactics_admin_ensure_writable_dir($destDir)) {
        tactics_json_error($lang === 'en' ? 'Could not save file' : 'Не удалось сохранить файл', 500);
    }

    $destBasePath = dirname(__DIR__, 2) . '/' . $rel;
    $saved = tactics_save_uploaded_map_image($_FILES['image'], $destBasePath, tactics_map_upload_max_bytes());
    if (!$saved['ok']) {
        $errors = [
            'upload_failed' => $lang === 'en' ? 'Upload failed' : 'Ошибка загрузки файла',
            'file_too_large' => tactics_map_upload_size_error($lang),
            'invalid_image' => $lang === 'en' ? 'Invalid image' : 'Некорректное изображение',
            'invalid_type' => $lang === 'en' ? 'Allowed: WebP, PNG, JPEG' : 'Допустимы WebP, PNG, JPEG',
            'save_failed' => $lang === 'en' ? 'Could not save file' : 'Не удалось сохранить файл',
        ];
        tactics_json_error($errors[$saved['error'] ?? ''] ?? ($lang === 'en' ? 'Could not save file' : 'Не удалось сохранить файл'), 500);
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'url' => '/' . $rel . '.webp?t=' . time(),
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    tactics_json_error('Ошибка сервера', 500);
}
