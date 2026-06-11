<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bracket_json_error('Метод не поддерживается', 405);
}

user_require_csrf_ajax();

$lang = abs_detect_lang();
$input = bracket_read_json_input();
$publicId = trim((string) ($input['public_id'] ?? ''));
if (!bracket_public_id_valid($publicId)) {
    bracket_json_error($lang === 'en' ? 'Invalid bracket ID' : 'Некорректный идентификатор');
}

$editToken = bracket_resolve_edit_token(
    $publicId,
    isset($input['edit_token']) ? trim((string) $input['edit_token']) : null
);
$userId = user_current_id();

try {
    $existing = $userDb->fetchOne(
        'SELECT id, user_id, edit_token FROM tournament_brackets WHERE public_id = ?',
        [$publicId]
    );
    if (!$existing) {
        bracket_json_error($lang === 'en' ? 'Bracket not found' : 'Сетка не найдена', 404);
    }

    $ownerCheck = bracket_assert_owner($userDb, $existing, $userId, $editToken);
    if (!$ownerCheck['ok']) {
        bracket_json_error($ownerCheck['error'] ?? 'Нет прав', 403);
    }

    $userDb->delete('DELETE FROM tournament_brackets WHERE public_id = ?', [$publicId]);
    bracket_clear_guest_edit_cookie($publicId);

    echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    bracket_json_error('Ошибка сервера', 500);
}
