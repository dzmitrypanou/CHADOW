<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    recruiting_json_error('Метод не поддерживается', 405);
}

user_require_ajax();
user_require_active($userDb);
user_require_csrf_ajax();

$lang = abs_detect_lang();
$input = recruiting_read_json_input();
$postId = (int) ($input['id'] ?? $_POST['id'] ?? 0);
if ($postId <= 0) {
    recruiting_json_error('Не указан идентификатор объявления');
}

$userId = user_current_id();

try {
    $existing = $userDb->fetchOne(
        'SELECT id, status FROM recruiting_posts WHERE id = ? AND user_id = ?',
        [$postId, $userId]
    );
    if (!$existing) {
        recruiting_json_error('Объявление не найдено', 404);
    }

    $validation = recruiting_validate_post_input($input, true, $lang);
    if (!$validation['ok']) {
        recruiting_json_error($validation['error'] ?? 'Некорректные данные');
    }
    $data = $validation['data'];
    if (empty($data['title'])) {
        $data['title'] = recruiting_auto_title($data);
    }

    $nicknameCheck = recruiting_assert_game_nickname_allowed(
        $userDb,
        (string) ($data['game_nickname'] ?? ''),
        (string) ($data['realm'] ?? ''),
        $userId,
        $lang
    );
    if (!$nicknameCheck['ok']) {
        recruiting_json_error($nicknameCheck['error'] ?? 'Ник недоступен для публикации');
    }

    $previousStatus = (string) ($existing['status'] ?? 'pending');
    $needsRemoderation = in_array($previousStatus, ['approved', 'rejected'], true);
    $newStatus = $needsRemoderation ? 'pending' : $previousStatus;
    $gameNickname = recruiting_normalize_form_game_nickname((string) ($data['game_nickname'] ?? ''));
    $gameNicknameStored = $gameNickname !== '' ? $gameNickname : null;

    if ($needsRemoderation) {
        $userDb->update(
            'UPDATE recruiting_posts
             SET post_type = ?, realm = ?, title = ?, body = ?, contact = ?, clan_tag = ?, clan_tag_type = ?,
                 game_nickname = ?, status = ?, published_at = NULL, moderated_by = NULL, moderated_at = NULL,
                 moderation_note = NULL
             WHERE id = ? AND user_id = ?',
            [
                $data['post_type'],
                $data['realm'],
                $data['title'],
                $data['body'],
                $data['contact'] ?? null,
                $data['clan_tag'] ?? null,
                $data['clan_tag_type'] ?? null,
                $gameNicknameStored,
                $newStatus,
                $postId,
                $userId,
            ]
        );
    } else {
        $userDb->update(
            'UPDATE recruiting_posts
             SET post_type = ?, realm = ?, title = ?, body = ?, contact = ?, clan_tag = ?, clan_tag_type = ?,
                 game_nickname = ?
             WHERE id = ? AND user_id = ?',
            [
                $data['post_type'],
                $data['realm'],
                $data['title'],
                $data['body'],
                $data['contact'] ?? null,
                $data['clan_tag'] ?? null,
                $data['clan_tag_type'] ?? null,
                $gameNicknameStored,
                $postId,
                $userId,
            ]
        );
    }

    $row = $userDb->fetchOne(
        'SELECT
            p.id,
            p.post_type,
            p.realm,
            p.title,
            p.body,
            p.contact,
            p.clan_tag,
            p.clan_tag_type,
            p.game_nickname,
            p.status,
            p.moderation_note,
            p.moderated_at,
            p.published_at,
            p.created_at,
            p.updated_at,
            ' . recruiting_sql_user_author_columns('u') . '
         FROM recruiting_posts p
         LEFT JOIN site_users u ON u.id = p.user_id
         WHERE p.id = ? AND p.user_id = ?',
        [$postId, $userId]
    );

    user_recruiting_sync_prefs_from_post($userDb, $userId, $data);

    echo json_encode([
        'success' => true,
        'data' => recruiting_format_post($row, true),
        'remoderation' => $needsRemoderation,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    recruiting_json_error('Ошибка сервера', 500);
}
