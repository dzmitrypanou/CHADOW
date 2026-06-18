<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
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
$activeLink = reserves_parse_active_link($profile, $input);

$filter = clan_reserve_build_log_filter(
    $userDb,
    $userId,
    (int) ($activeLink['link_id'] ?? 0),
    (string) ($activeLink['provider'] ?? ''),
    (string) ($activeLink['realm'] ?? '')
);

$deleted = clan_reserve_clear_activation_log($userDb, $userId, $filter);

echo json_encode([
    'success' => true,
    'data' => ['deleted' => $deleted],
    'message' => $isEn ? 'Activation log cleared.' : 'Журнал активаций очищен.',
], JSON_UNESCAPED_UNICODE);
