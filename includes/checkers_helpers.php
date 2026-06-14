<?php

const CHECKERS_PUBLIC_ID_LEN = 6;
const CHECKERS_WS_TOKEN_TTL_SEC = 6 * 3600;
const CHECKERS_PLAYER_NAME_MIN = 2;
const CHECKERS_PLAYER_NAME_MAX = 32;

function checkers_public_id_valid(string $publicId): bool {
    return (bool) preg_match('/^[A-Z0-9]{' . CHECKERS_PUBLIC_ID_LEN . '}$/', $publicId);
}

function checkers_read_env_file_secret(): string {
    $path = __DIR__ . '/../deploy/checkers-ws/.env';
    if (!is_readable($path)) {
        return '';
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return '';
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (!str_starts_with($line, 'CHECKERS_WS_SECRET=')) {
            continue;
        }
        $value = trim(substr($line, strlen('CHECKERS_WS_SECRET=')));
        return trim($value, " \t\"'");
    }

    return '';
}

function checkers_ws_secret($db): string {
    $secret = getenv('CHECKERS_WS_SECRET');
    if (is_string($secret) && trim($secret) !== '') {
        return trim($secret);
    }

    $fromEnvFile = checkers_read_env_file_secret();
    if ($fromEnvFile !== '') {
        return $fromEnvFile;
    }

    if (!function_exists('get_site_setting')) {
        require_once __DIR__ . '/../config/ensure_site_settings.php';
    }

    $stored = get_site_setting($db, 'checkers_ws_secret', '');
    if (is_string($stored) && trim($stored) !== '') {
        return trim($stored);
    }

    $generated = bin2hex(random_bytes(32));
    set_site_setting($db, 'checkers_ws_secret', $generated);

    return $generated;
}

function checkers_b64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function checkers_b64url_decode(string $data): string {
    $pad = strlen($data) % 4;
    if ($pad > 0) {
        $data .= str_repeat('=', 4 - $pad);
    }

    return (string) base64_decode(strtr($data, '-_', '+/'), true);
}

/**
 * @return array<string, mixed>|null
 */
function checkers_verify_signed_token($db, string $token, ?string $expectedPublicId = null): ?array {
    $parts = explode('.', $token, 2);
    if (count($parts) !== 2) {
        return null;
    }

    [$payloadB64, $sig] = $parts;
    $expectedSig = hash_hmac('sha256', $payloadB64, checkers_ws_secret($db));
    if (!hash_equals($expectedSig, $sig)) {
        return null;
    }

    $json = checkers_b64url_decode($payloadB64);
    $payload = json_decode($json, true);
    if (!is_array($payload)) {
        return null;
    }

    $exp = (int) ($payload['exp'] ?? 0);
    if ($exp > 0 && $exp < time()) {
        return null;
    }

    $publicId = trim((string) ($payload['pid'] ?? ''));
    if (!checkers_public_id_valid($publicId)) {
        return null;
    }

    if ($expectedPublicId !== null && $publicId !== $expectedPublicId) {
        return null;
    }

    $color = trim((string) ($payload['color'] ?? ''));
    if ($color !== 'white' && $color !== 'black') {
        return null;
    }

    return $payload;
}

function checkers_issue_token(
    $db,
    string $publicId,
    string $clientId,
    string $nickname,
    string $color,
    int $ttlSec = CHECKERS_WS_TOKEN_TTL_SEC
): string {
    $payload = [
        'pid' => $publicId,
        'cid' => $clientId,
        'nick' => checkers_normalize_player_name($nickname),
        'color' => $color,
        'exp' => time() + max(60, $ttlSec),
    ];
    $payloadB64 = checkers_b64url_encode(json_encode($payload, JSON_UNESCAPED_UNICODE));
    $sig = hash_hmac('sha256', $payloadB64, checkers_ws_secret($db));

    return $payloadB64 . '.' . $sig;
}

function checkers_generate_public_id(): string {
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $max = strlen($alphabet) - 1;
    $id = '';
    for ($i = 0; $i < CHECKERS_PUBLIC_ID_LEN; $i++) {
        $id .= $alphabet[random_int(0, $max)];
    }

    return $id;
}

function checkers_normalize_player_name(string $name): string {
    $name = trim($name);
    $name = preg_replace('/\s+/u', ' ', $name) ?? $name;
    if (function_exists('mb_substr')) {
        return mb_substr($name, 0, CHECKERS_PLAYER_NAME_MAX, 'UTF-8');
    }

    return substr($name, 0, CHECKERS_PLAYER_NAME_MAX);
}

function checkers_player_name_valid(string $name): bool {
    $name = checkers_normalize_player_name($name);
    $len = function_exists('mb_strlen') ? mb_strlen($name, 'UTF-8') : strlen($name);
    if ($len < CHECKERS_PLAYER_NAME_MIN || $len > CHECKERS_PLAYER_NAME_MAX) {
        return false;
    }

    return (bool) preg_match('/^[\p{L}\p{N}_\-\.\s]+$/u', $name);
}

function checkers_sanitize_client_id(string $clientId): string {
    $clientId = trim($clientId);
    if ($clientId !== '' && preg_match('/^[a-zA-Z0-9_-]{8,64}$/', $clientId)) {
        return $clientId;
    }

    return 'c' . bin2hex(random_bytes(8));
}

function checkers_ws_public_url(): string {
    $host = $_SERVER['HTTP_HOST'] ?? 'chadow.ru';
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    $scheme = $secure ? 'wss' : 'ws';

    return $scheme . '://' . $host . '/checkers-ws';
}

function checkers_ws_internal_base_url(): string {
    $port = getenv('CHECKERS_WS_PORT');
    if (!is_string($port) || trim($port) === '') {
        $port = '8792';
    }

    return 'http://127.0.0.1:' . trim($port);
}

function checkers_build_href(string $lang, string $publicId): string {
    if (!function_exists('abs_build_lang_href')) {
        require_once __DIR__ . '/lang.php';
    }

    return abs_build_lang_href($lang, 'services/onlinegames/checkers/' . $publicId);
}

function checkers_build_lobby_href(string $lang): string {
    if (!function_exists('abs_build_lang_href')) {
        require_once __DIR__ . '/lang.php';
    }

    return abs_build_lang_href($lang, 'services/onlinegames/checkers');
}

function checkers_build_home_href(string $lang): string {
    if (!function_exists('onlinegames_build_href')) {
        require_once __DIR__ . '/onlinegames_helpers.php';
    }

    return onlinegames_build_href($lang);
}

function checkers_ws_register_room($db, string $publicId, string $whiteClientId, string $whiteNickname): array {
    $url = checkers_ws_internal_base_url() . '/rooms';
    $payload = json_encode([
        'roomId' => $publicId,
        'whiteCid' => $whiteClientId,
        'whiteNick' => checkers_normalize_player_name($whiteNickname),
    ], JSON_UNESCAPED_UNICODE);

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $payload,
            'timeout' => 2,
            'ignore_errors' => true,
        ],
    ]);

    $raw = @file_get_contents($url, false, $context);
    if (!is_string($raw) || trim($raw) === '') {
        return ['ok' => false, 'error' => 'ws_unreachable'];
    }

    $data = json_decode($raw, true);
    if (!is_array($data) || !($data['success'] ?? false)) {
        return ['ok' => false, 'error' => (string) ($data['error'] ?? 'ws_error')];
    }

    return ['ok' => true];
}

/**
 * @return array{ok: bool, error?: string, status?: string}
 */
function checkers_ws_join_room($db, string $publicId, string $clientId, string $nickname): array {
    $url = checkers_ws_internal_base_url()
        . '/rooms/'
        . rawurlencode($publicId)
        . '/join';

    $payload = json_encode([
        'clientId' => $clientId,
        'nickname' => checkers_normalize_player_name($nickname),
    ], JSON_UNESCAPED_UNICODE);

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $payload,
            'timeout' => 2,
            'ignore_errors' => true,
        ],
    ]);

    $raw = @file_get_contents($url, false, $context);
    if (!is_string($raw) || trim($raw) === '') {
        return ['ok' => false, 'error' => 'ws_unreachable'];
    }

    $data = json_decode($raw, true);
    if (!is_array($data) || !($data['success'] ?? false)) {
        $error = (string) ($data['error'] ?? 'ws_error');
        return ['ok' => false, 'error' => $error];
    }

    return [
        'ok' => true,
        'status' => (string) ($data['status'] ?? 'waiting'),
        'color' => (string) ($data['color'] ?? 'black'),
    ];
}

/**
 * @return array{ok: bool, error?: string, lobbies?: list<array<string, mixed>>}
 */
function checkers_ws_list_lobbies(int $limit = 50): array {
    $url = checkers_ws_internal_base_url()
        . '/lobbies?limit='
        . max(1, min($limit, 100));

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 2,
            'ignore_errors' => true,
        ],
    ]);

    $raw = @file_get_contents($url, false, $context);
    if (!is_string($raw) || trim($raw) === '') {
        return ['ok' => false, 'error' => 'ws_unreachable'];
    }

    $data = json_decode($raw, true);
    if (!is_array($data) || !($data['success'] ?? false)) {
        return ['ok' => false, 'error' => 'ws_error'];
    }

    $lobbies = $data['lobbies'] ?? [];
    if (!is_array($lobbies)) {
        $lobbies = [];
    }

    return ['ok' => true, 'lobbies' => $lobbies];
}

function checkers_format_lobby_item(array $row, string $lang): ?array {
    $publicId = strtoupper(trim((string) ($row['roomId'] ?? '')));
    if (!checkers_public_id_valid($publicId)) {
        return null;
    }

    $host = checkers_normalize_player_name((string) ($row['host'] ?? 'Guest'));
    if ($host === '') {
        $host = $lang === 'en' ? 'Player' : 'Игрок';
    }

    $createdAt = (int) ($row['createdAt'] ?? 0);

    return [
        'public_id' => $publicId,
        'host' => $host,
        'room_href' => checkers_build_href($lang, $publicId),
        'created_at' => $createdAt > 0 ? $createdAt : null,
        'slots_free' => 1,
        'slots_total' => 2,
    ];
}

function checkers_format_session(
    $db,
    string $publicId,
    string $clientId,
    string $nickname,
    string $color,
    string $lang
): array {
    return [
        'public_id' => $publicId,
        'client_id' => $clientId,
        'nickname' => checkers_normalize_player_name($nickname),
        'color' => $color,
        'ws_token' => checkers_issue_token($db, $publicId, $clientId, $nickname, $color),
        'ws_url' => checkers_ws_public_url(),
        'room_href' => checkers_build_href($lang, $publicId),
        'lobby_href' => checkers_build_lobby_href($lang),
        'hub_href' => checkers_build_home_href($lang),
    ];
}

function checkers_meta(string $lang = 'ru'): array {
    if ($lang === 'en') {
        return [
            'id' => 'checkers',
            'icon' => 'fa-chess-board',
            'title' => 'Online Checkers',
            'desc' => 'Play Russian draughts for two in real time. Create a room and share the link.',
            'badge' => '2 players',
        ];
    }

    return [
        'id' => 'checkers',
        'icon' => 'fa-chess-board',
        'title' => 'Шашки онлайн',
        'desc' => 'Русские шашки на двоих в реальном времени. Создайте комнату и отправьте ссылку другу.',
        'badge' => '2 игрока',
    ];
}
