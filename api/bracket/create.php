<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bracket_json_error('Метод не поддерживается', 405);
}

user_require_csrf_ajax();
user_require_ajax();

$lang = abs_detect_lang();
$input = bracket_read_json_input();
$validation = bracket_validate_create_input($input, $lang);
if (!$validation['ok']) {
    bracket_json_error($validation['error'] ?? 'Некорректные данные');
}

$data = $validation['data'];
$userId = user_current_id();
if (!user_is_active($userDb)) {
    bracket_json_error($lang === 'en' ? 'Account disabled' : 'Аккаунт отключён', 403);
}

$publicId = bracket_generate_public_id($userDb);

$bracketJson = json_encode($data['bracket_data'], JSON_UNESCAPED_UNICODE);
$description = $data['description'] ?? null;
$startsAt = $data['starts_at'] ?? null;
$prizePool = isset($data['prize_pool']) ? json_encode($data['prize_pool'], JSON_UNESCAPED_UNICODE) : null;

try {
    $userDb->insert(
        'INSERT INTO tournament_brackets
            (public_id, user_id, edit_token, title, description, format, match_format, game, game_realm, visibility, status, bracket_data, starts_at, prize_pool)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $publicId,
            $userId,
            null,
            $data['title'],
            $description,
            $data['format'],
            $data['match_format'],
            $data['game'],
            $data['game_realm'],
            $data['visibility'],
            'active',
            $bracketJson,
            $startsAt,
            $prizePool,
        ]
    );

    $row = $userDb->fetchOne(
        'SELECT ' . bracket_sql_select_columns('b') . ' FROM tournament_brackets b WHERE b.public_id = ?',
        [$publicId]
    );

    echo json_encode([
        'success' => true,
        'data' => bracket_format_item($row, false, true),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    bracket_json_error('Ошибка сервера', 500);
}
