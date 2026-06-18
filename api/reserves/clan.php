<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    reserves_json_error($isEn ? 'Method not allowed' : 'Метод не поддерживается', 405);
}

$profile = reserves_require_user();
$userId = (int) ($profile['id'] ?? 0);
$linkId = (int) ($_GET['link_id'] ?? 0);
if ($linkId <= 0) {
    reserves_json_error($isEn ? 'Invalid link.' : 'Некорректная привязка.', 400);
}

$ctx = reserves_user_context($profile);
$link = clan_reserve_find_link_by_id($ctx['links'], $linkId);
if ($link === null || empty($link['has_token'])) {
    reserves_json_error($isEn ? 'Account not linked.' : 'Аккаунт не привязан.', 404);
}

if (empty($link['token_ok'])) {
    reserves_json_error($isEn
        ? 'Access expired. Refresh the link.'
        : 'Доступ истёк. Обновите привязку.', 403);
}

$forceRefresh = !empty($_GET['refresh']);
$service = new ClanReserveService($userDb);
$results = $service->fetchClanProfilesForLinks($userId, [$linkId], $forceRefresh);
$result = $results[$linkId] ?? ['ok' => false, 'error' => 'clan_fetch_failed'];

if (empty($result['ok'])) {
    $error = (string) ($result['error'] ?? 'clan_fetch_failed');
    $message = $error === 'no_clan'
        ? ($isEn ? 'Player not in a clan.' : 'Игрок не в клане.')
        : ($isEn ? 'Could not load clan data.' : 'Не удалось загрузить данные клана.');

    echo json_encode([
        'success' => true,
        'data' => [
            'link_id' => $linkId,
            'clan' => null,
            'no_clan' => $error === 'no_clan',
            'error_code' => $error,
            'nickname' => trim((string) ($result['nickname'] ?? '')),
            'error' => $message,
        ],
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode([
    'success' => true,
    'data' => [
        'link_id' => $linkId,
        'clan' => is_array($result['clan'] ?? null) ? $result['clan'] : null,
        'no_clan' => !empty($result['no_clan']),
        'nickname' => trim((string) ($result['nickname'] ?? '')),
        'cached' => !empty($result['cached']),
    ],
], JSON_UNESCAPED_UNICODE);
