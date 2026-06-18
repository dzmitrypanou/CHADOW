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
$input = reserves_read_json_input();
$activeLink = reserves_parse_active_link($profile, $input);

$reserveType = clan_reserve_normalize_reserve_type(trim((string) ($input['reserve_type'] ?? '')));
$reserveLevel = (int) ($input['reserve_level'] ?? 0);
if ($reserveType === '' || $reserveLevel <= 0) {
    reserves_json_error($isEn ? 'Invalid reserve type or level.' : 'Некорректный тип или уровень резерва.');
}

$linkId = clan_reserve_resolve_link_id(
    $userDb,
    (int) $profile['id'],
    (int) ($activeLink['link_id'] ?? 0),
    (string) ($activeLink['provider'] ?? 'wg'),
    (string) ($activeLink['realm'] ?? 'eu')
);
if ($linkId <= 0) {
    reserves_json_error($isEn ? 'Could not load access token.' : 'Не удалось получить access token.', 403, 'token_missing');
}

$service = new ClanReserveService($userDb);
$result = $service->activateForUser(
    (int) $profile['id'],
    $linkId,
    $reserveType,
    $reserveLevel,
    'manual',
    null,
    $lang
);

if (!$result['ok']) {
    $errorCode = (string) ($result['error'] ?? 'activation_failed');
    $code = (int) ($result['code'] ?? 0);
    if ($code === 409) {
        reserves_json_error($isEn
            ? 'Cannot activate: not in clan, no permission, or wrong reserve.'
            : 'Не удалось активировать: нет клана, прав или выбран неверный резерв.', 409, $errorCode);
    }
    reserves_json_error($errorCode, 502, $errorCode);
}

echo json_encode([
    'success' => true,
    'data' => [
        'activated_at' => $result['activated_at'] ?? null,
    ],
    'message' => $isEn ? 'Reserve activated.' : 'Резерв активирован.',
], JSON_UNESCAPED_UNICODE);
