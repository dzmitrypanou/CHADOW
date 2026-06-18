<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    reserves_json_error($isEn ? 'Method not allowed' : 'Метод не поддерживается', 405);
}

$profile = reserves_require_user();
$input = array_merge($_GET, reserves_read_json_input());
$activeLink = reserves_parse_active_link($profile, $input);
$provider = (string) ($activeLink['provider'] ?? 'wg');
$realm = (string) ($activeLink['realm'] ?? 'eu');

if (!in_array($realm, reserves_user_context($profile)['enabled_realms'], true)) {
    reserves_json_error($isEn
        ? 'API is not configured for this region.'
        : 'API для этого региона не настроен.', 503);
}

$token = clan_reserve_get_valid_token(
    $userDb,
    (int) $profile['id'],
    (int) ($activeLink['link_id'] ?? 0)
);
if (!$token['ok']) {
    reserves_json_error($isEn ? 'Could not load access token.' : 'Не удалось получить access token.', 403);
}

$service = new ClanReserveService($userDb);
$result = $service->fetchClanReserves((string) $token['access_token'], $realm, $lang);
if (!$result['ok']) {
    $code = (int) ($result['code'] ?? 0);
    if ($code === 409) {
        reserves_json_error(
            $isEn ? 'Account is not in a clan.' : 'Аккаунт не состоит в клане.',
            409,
            'no_clan'
        );
    }
    reserves_json_error((string) ($result['error'] ?? 'api_error'), 502, 'api_error');
}

echo json_encode([
    'success' => true,
    'data' => [
        'link_id' => (int) ($activeLink['link_id'] ?? 0),
        'provider' => $provider,
        'realm' => $realm,
        'slot_label' => clan_reserve_slot_label($provider, $realm),
        'nickname' => $activeLink['nickname'] ?? '',
        'items' => $result['items'],
    ],
], JSON_UNESCAPED_UNICODE);
