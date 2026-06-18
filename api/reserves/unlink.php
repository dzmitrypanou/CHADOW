<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reserves_json_error($isEn ? 'Method not allowed' : 'Метод не поддерживается', 405);
}

if (!user_csrf_verify()) {
    reserves_json_error($isEn
        ? 'Session expired. Refresh the page and try again.'
        : 'Сессия устарела. Обновите страницу и попробуйте снова.', 403);
}

$profile = reserves_require_user();
$userId = (int) ($profile['id'] ?? 0);
$input = reserves_read_json_input();
$linkId = (int) ($input['link_id'] ?? 0);

if ($linkId <= 0) {
    reserves_json_error($isEn ? 'Link id is required.' : 'Укажите id привязки.');
}

$tokenRow = clan_reserve_fetch_token_by_id($userDb, $userId, $linkId);
if ($tokenRow === null) {
    reserves_json_error($isEn ? 'Reserve link not found.' : 'Привязка резервов не найдена.', 404);
}

clan_reserve_delete_user_token_by_id($userDb, $userId, $linkId);

echo json_encode([
    'success' => true,
    'message' => $isEn ? 'Reserve link removed.' : 'Привязка для резервов отвязана.',
], JSON_UNESCAPED_UNICODE);
