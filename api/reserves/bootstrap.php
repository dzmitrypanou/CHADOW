<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';
require_once __DIR__ . '/../../config/ensure_clan_reserves.php';
require_once __DIR__ . '/../../includes/user_auth.php';
require_once __DIR__ . '/../../includes/user_csrf.php';
require_once __DIR__ . '/../../includes/clan_reserve_helpers.php';
require_once __DIR__ . '/../../includes/clan_reserve_service.php';

if (!isset($userDb)) {
    $userDb = Database::getInstance();
}

ensure_clan_reserves_tables($userDb);
user_csrf_ensure();

function reserves_read_json_input(): array {
    $raw = user_request_raw_body();
    if (trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);

    return is_array($data) ? $data : [];
}

$reservesApiInput = array_merge($_GET, reserves_read_json_input());
$lang = abs_resolve_lang($reservesApiInput);
$isEn = $lang === 'en';

function reserves_json_error(string $message, int $code = 400, ?string $errorCode = null): void {
    http_response_code($code);
    $payload = ['success' => false, 'error' => $message];
    if ($errorCode !== null && $errorCode !== '') {
        $payload['error_code'] = $errorCode;
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit();
}

function reserves_require_user(): array {
    global $userDb, $isEn;
    if (!user_is_logged_in()) {
        reserves_json_error($isEn ? 'Not authorized' : 'Не авторизован', 401);
    }
    $userId = user_current_id();
    if ($userId === null) {
        reserves_json_error($isEn ? 'Not authorized' : 'Не авторизован', 401);
    }
    user_require_active($userDb);
    $profile = user_login_row($userDb, (int) $userId);
    if (!$profile) {
        reserves_json_error($isEn ? 'Account not found' : 'Аккаунт не найден', 404);
    }

    return $profile;
}

function reserves_user_context(array $profile): array {
    $userId = (int) ($profile['id'] ?? 0);
    $links = clan_reserve_user_links_state($GLOBALS['userDb'], $userId, $profile);

    return [
        'links' => $links,
        'enabled_realms' => clan_reserve_enabled_realms($GLOBALS['userDb']),
        'usable_links' => array_values(array_filter($links, static fn(array $link): bool => !empty($link['usable']))),
    ];
}

function reserves_parse_active_link(array $profile, array $input = []): ?array {
    global $userDb, $isEn;
    $ctx = reserves_user_context($profile);
    $links = $ctx['links'];
    $linkId = (int) ($input['link_id'] ?? $_GET['link_id'] ?? 0);
    $provider = trim((string) ($input['provider'] ?? $_GET['provider'] ?? ''));
    $realm = trim((string) ($input['realm'] ?? $_GET['realm'] ?? ''));

    if ($linkId > 0) {
        $link = clan_reserve_find_link_by_id($links, $linkId);
        if ($link === null || empty($link['usable'])) {
            reserves_json_error($isEn
                ? 'This account is not linked or access expired.'
                : 'Этот аккаунт не привязан или доступ истёк.', 403);
        }

        return $link;
    }

    if ($provider !== '' && $realm !== '') {
        $link = clan_reserve_find_link($links, $provider, $realm);
        if ($link === null || empty($link['usable'])) {
            reserves_json_error($isEn
                ? 'This region has no linked account with valid access.'
                : 'В этом регионе нет привязанного аккаунта с действующим доступом.', 403);
        }

        return $link;
    }

    $usable = clan_reserve_find_usable_link($links);
    if ($usable === null) {
        reserves_json_error($isEn
            ? 'Link at least one account for clan reserves.'
            : 'Привяжите хотя бы один аккаунт для клановых резервов.', 403);
    }

    return $usable;
}
