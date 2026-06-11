<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    recruiting_json_error('Метод не поддерживается', 405);
}

$lang = abs_detect_lang();
$input = recruiting_read_json_input();
$nickname = recruiting_normalize_form_game_nickname((string) ($input['game_nickname'] ?? ''));
$realm = strtolower(trim((string) ($input['realm'] ?? '')));
$currentUserId = user_current_id();

$check = recruiting_assert_game_nickname_allowed($userDb, $nickname, $realm, $currentUserId, $lang);
if (!$check['ok']) {
    echo json_encode([
        'success' => true,
        'allowed' => false,
        'error' => $check['error'] ?? ($lang === 'en' ? 'Nickname is not available.' : 'Ник недоступен для публикации.'),
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode([
    'success' => true,
    'allowed' => true,
], JSON_UNESCAPED_UNICODE);
