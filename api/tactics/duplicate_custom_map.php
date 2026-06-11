<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    tactics_json_error('Метод не поддерживается', 405);
}

user_require_csrf_ajax();

$lang = abs_detect_lang();
$publicId = trim((string) ($_POST['public_id'] ?? ''));
$sourceSlideId = trim((string) ($_POST['source_slide_id'] ?? ''));
$targetSlideId = trim((string) ($_POST['target_slide_id'] ?? ''));

if (!tactics_public_id_valid($publicId)) {
    tactics_json_error($lang === 'en' ? 'Invalid room code' : 'Некорректный код комнаты');
}

$slideIdPattern = '/^[a-zA-Z0-9_\-]{1,48}$/';
if ($sourceSlideId === '' || $targetSlideId === '' || !preg_match($slideIdPattern, $sourceSlideId) || !preg_match($slideIdPattern, $targetSlideId)) {
    tactics_json_error($lang === 'en' ? 'Invalid slide' : 'Некорректный слайд');
}

if ($sourceSlideId === $targetSlideId) {
    tactics_json_error($lang === 'en' ? 'Invalid slide' : 'Некорректный слайд');
}

$accessToken = tactics_resolve_access_token($_POST);
$userId = user_current_id();

try {
    $row = tactics_fetch_row($userDb, $publicId, true);
    if (!$row) {
        tactics_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
    }

    $roomData = tactics_parse_room_data($row['room_data'] ?? null);
    $sourceSlide = null;
    foreach ($roomData['slides'] ?? [] as $item) {
        if (!is_array($item)) {
            continue;
        }
        if ((string) ($item['id'] ?? '') === $sourceSlideId) {
            $sourceSlide = $item;
            break;
        }
    }

    if ($sourceSlide === null) {
        tactics_json_error($lang === 'en' ? 'Invalid slide' : 'Некорректный слайд');
    }

    $game = tactics_sanitize_game((string) ($sourceSlide['game'] ?? ''));
    if (!in_array($game, ['cs2', 'dota2'], true)) {
        tactics_json_error($lang === 'en' ? 'Custom map copy not allowed' : 'Копирование карты недоступно');
    }

    $isOwner = tactics_resolve_is_owner($row, $accessToken, $userId, $userDb);
    $clientId = tactics_token_client_id($accessToken, $userDb, $publicId, $row);
    if (!$isOwner && !tactics_user_can_draw($roomData, $clientId, false)) {
        tactics_json_error($lang === 'en' ? 'No draw permission' : 'Нет прав на редактирование', 403);
    }

    $game = (string) ($sourceSlide['game'] ?? '');
    $srcRel = tactics_custom_room_map_rel_path($publicId, $sourceSlideId, $game);
    $tgtRel = tactics_custom_room_map_rel_path($publicId, $targetSlideId, $game);
    if ($srcRel === '' || $tgtRel === '') {
        tactics_json_error('Ошибка сервера', 500);
    }

    $root = dirname(__DIR__, 2);
    $copiedExt = null;
    foreach (['webp', 'png', 'jpg', 'jpeg'] as $ext) {
        $srcPath = $root . '/' . $srcRel . '.' . $ext;
        if (!is_file($srcPath)) {
            continue;
        }
        $destDir = dirname($root . '/' . $tgtRel);
        if (!tactics_admin_ensure_writable_dir($destDir)) {
            tactics_json_error($lang === 'en' ? 'Could not save file' : 'Не удалось сохранить файл', 500);
        }
        foreach (['webp', 'png', 'jpg', 'jpeg'] as $oldExt) {
            $oldPath = $root . '/' . $tgtRel . '.' . $oldExt;
            if (is_file($oldPath)) {
                @unlink($oldPath);
            }
        }
        $destPath = $root . '/' . $tgtRel . '.' . $ext;
        if (!@copy($srcPath, $destPath)) {
            tactics_json_error($lang === 'en' ? 'Could not copy file' : 'Не удалось скопировать файл', 500);
        }
        @chmod($destPath, 0644);
        $copiedExt = $ext;
        break;
    }

    if ($copiedExt === null) {
        tactics_json_error($lang === 'en' ? 'Source map not found' : 'Исходная карта не найдена', 404);
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'url' => '/' . $tgtRel . '.' . $copiedExt . '?t=' . time(),
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    tactics_json_error('Ошибка сервера', 500);
}
