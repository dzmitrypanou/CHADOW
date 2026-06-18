<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    reserves_json_error($isEn ? 'Method not allowed' : 'Метод не поддерживается', 405);
}

$profile = reserves_require_user();
$userId = (int) ($profile['id'] ?? 0);
$rawIds = trim((string) ($_GET['link_ids'] ?? ''));
if ($rawIds === '') {
    reserves_json_error($isEn ? 'Link ids are required.' : 'Укажите id привязок.', 400);
}

$linkIds = [];
foreach (explode(',', $rawIds) as $part) {
    $id = (int) trim($part);
    if ($id > 0) {
        $linkIds[] = $id;
    }
}
$linkIds = array_values(array_unique($linkIds));
if ($linkIds === []) {
    reserves_json_error($isEn ? 'Link ids are required.' : 'Укажите id привязок.', 400);
}

$ctx = reserves_user_context($profile);
$allowedIds = [];
foreach ($linkIds as $linkId) {
    $link = clan_reserve_find_link_by_id($ctx['links'], $linkId);
    if ($link !== null && !empty($link['has_token']) && !empty($link['token_ok'])) {
        $allowedIds[] = $linkId;
    }
}

$forceRefresh = !empty($_GET['refresh']);
$service = new ClanReserveService($userDb);
$results = $service->fetchClanProfilesForLinks($userId, $allowedIds, $forceRefresh);

$accounts = [];
foreach ($allowedIds as $linkId) {
    $result = $results[$linkId] ?? ['ok' => false, 'error' => 'clan_fetch_failed'];
    if (empty($result['ok'])) {
        $error = (string) ($result['error'] ?? 'clan_fetch_failed');
        $accounts[(string) $linkId] = [
            'link_id' => $linkId,
            'clan' => null,
            'no_clan' => $error === 'no_clan',
            'error_code' => $error,
            'nickname' => trim((string) ($result['nickname'] ?? '')),
        ];
        continue;
    }

    $accounts[(string) $linkId] = [
        'link_id' => $linkId,
        'clan' => is_array($result['clan'] ?? null) ? $result['clan'] : null,
        'no_clan' => !empty($result['no_clan']),
        'nickname' => trim((string) ($result['nickname'] ?? '')),
        'cached' => !empty($result['cached']),
    ];
}

echo json_encode([
    'success' => true,
    'data' => [
        'accounts' => $accounts,
    ],
], JSON_UNESCAPED_UNICODE);
