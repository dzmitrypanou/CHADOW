<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    recruiting_json_error('Метод не поддерживается', 405);
}

user_require_csrf_ajax();

$lang = abs_detect_lang();
$input = recruiting_read_json_input();
$validation = recruiting_validate_post_input($input, true, $lang);
if (!$validation['ok']) {
    recruiting_json_error($validation['error'] ?? 'Некорректные данные');
}

$data = $validation['data'];
$userId = user_current_id();
if ($userId !== null) {
    if (!user_is_active($userDb)) {
        recruiting_json_error($lang === 'en' ? 'Account disabled' : 'Аккаунт отключён', 403);
    }
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
if (empty($data['title'])) {
    $data['title'] = recruiting_auto_title($data);
}

$gameNickname = recruiting_normalize_form_game_nickname((string) ($data['game_nickname'] ?? ''));

try {
    $duplicate = recruiting_find_recent_duplicate_post($userDb, $data, $userId);
    if ($duplicate) {
        $postId = (int) $duplicate['id'];
    } else {
        $postId = $userDb->insert(
            'INSERT INTO recruiting_posts
                (user_id, post_type, realm, title, body, contact, clan_tag, clan_tag_type, game_nickname, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $userId,
                $data['post_type'],
                $data['realm'],
                $data['title'],
                $data['body'],
                $data['contact'] ?? null,
                $data['clan_tag'] ?? null,
                $data['clan_tag_type'] ?? null,
                $gameNickname !== '' ? $gameNickname : null,
                'pending',
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
         WHERE p.id = ?',
        [(int) $postId]
    );

    if ($userId !== null) {
        user_recruiting_sync_prefs_from_post($userDb, $userId, $data);
    }

    echo json_encode([
        'success' => true,
        'data' => recruiting_format_post($row, true),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    recruiting_json_error('Ошибка сервера', 500);
}
