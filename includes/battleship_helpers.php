<?php

const BATTLESHIP_PUBLIC_ID_LEN = 6;
const BATTLESHIP_WS_TOKEN_TTL_SEC = 6 * 3600;
const BATTLESHIP_PLAYER_NAME_MIN = 2;
const BATTLESHIP_PLAYER_NAME_MAX = 32;
const BATTLESHIP_BOARD_SIZES = [10, 20, 50];

function battleship_public_id_valid(string $publicId): bool {
    return (bool) preg_match('/^[A-Z0-9]{' . BATTLESHIP_PUBLIC_ID_LEN . '}$/', $publicId);
}

function battleship_normalize_board_size($value): int {
    $size = (int) $value;
    return in_array($size, BATTLESHIP_BOARD_SIZES, true) ? $size : 10;
}

function battleship_read_env_file_secret(): string {
    $path = __DIR__ . '/../deploy/battleship-ws/.env';
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
        if (!str_starts_with($line, 'BATTLESHIP_WS_SECRET=')) {
            continue;
        }
        $value = trim(substr($line, strlen('BATTLESHIP_WS_SECRET=')));

        return trim($value, " \t\"'");
    }

    return '';
}

function battleship_ws_secret($db): string {
    $secret = getenv('BATTLESHIP_WS_SECRET');
    if (is_string($secret) && trim($secret) !== '') {
        return trim($secret);
    }

    $fromEnvFile = battleship_read_env_file_secret();
    if ($fromEnvFile !== '') {
        return $fromEnvFile;
    }

    if (!function_exists('get_site_setting')) {
        require_once __DIR__ . '/../config/ensure_site_settings.php';
    }

    $stored = get_site_setting($db, 'battleship_ws_secret', '');
    if (is_string($stored) && trim($stored) !== '') {
        return trim($stored);
    }

    $generated = bin2hex(random_bytes(32));
    set_site_setting($db, 'battleship_ws_secret', $generated);

    return $generated;
}

function battleship_b64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function battleship_b64url_decode(string $data): string {
    $pad = strlen($data) % 4;
    if ($pad > 0) {
        $data .= str_repeat('=', 4 - $pad);
    }

    return (string) base64_decode(strtr($data, '-_', '+/'), true);
}

function battleship_verify_signed_token($db, string $token, ?string $expectedPublicId = null): ?array {
    $parts = explode('.', $token, 2);
    if (count($parts) !== 2) {
        return null;
    }

    [$payloadB64, $sig] = $parts;
    $expectedSig = hash_hmac('sha256', $payloadB64, battleship_ws_secret($db));
    if (!hash_equals($expectedSig, $sig)) {
        return null;
    }

    $json = battleship_b64url_decode($payloadB64);
    $payload = json_decode($json, true);
    if (!is_array($payload)) {
        return null;
    }

    $exp = (int) ($payload['exp'] ?? 0);
    if ($exp > 0 && $exp < time()) {
        return null;
    }

    $publicId = trim((string) ($payload['pid'] ?? ''));
    if (!battleship_public_id_valid($publicId)) {
        return null;
    }

    if ($expectedPublicId !== null && $publicId !== $expectedPublicId) {
        return null;
    }

    $color = trim((string) ($payload['color'] ?? ''));
    if ($color !== 'host' && $color !== 'guest') {
        return null;
    }

    return $payload;
}

function battleship_issue_token(
    $db,
    string $publicId,
    string $clientId,
    string $nickname,
    string $color,
    int $ttlSec = BATTLESHIP_WS_TOKEN_TTL_SEC
): string {
    $payload = [
        'pid' => $publicId,
        'cid' => $clientId,
        'nick' => battleship_normalize_player_name($nickname),
        'color' => $color,
        'exp' => time() + max(60, $ttlSec),
    ];
    $payloadB64 = battleship_b64url_encode(json_encode($payload, JSON_UNESCAPED_UNICODE));
    $sig = hash_hmac('sha256', $payloadB64, battleship_ws_secret($db));

    return $payloadB64 . '.' . $sig;
}

function battleship_generate_public_id(): string {
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $max = strlen($alphabet) - 1;
    $id = '';
    for ($i = 0; $i < BATTLESHIP_PUBLIC_ID_LEN; $i++) {
        $id .= $alphabet[random_int(0, $max)];
    }

    return $id;
}

function battleship_normalize_player_name(string $name): string {
    $name = trim($name);
    $name = preg_replace('/\s+/u', ' ', $name) ?? $name;
    if (function_exists('mb_substr')) {
        return mb_substr($name, 0, BATTLESHIP_PLAYER_NAME_MAX, 'UTF-8');
    }

    return substr($name, 0, BATTLESHIP_PLAYER_NAME_MAX);
}

function battleship_player_name_valid(string $name): bool {
    $name = battleship_normalize_player_name($name);
    $len = function_exists('mb_strlen') ? mb_strlen($name, 'UTF-8') : strlen($name);
    if ($len < BATTLESHIP_PLAYER_NAME_MIN || $len > BATTLESHIP_PLAYER_NAME_MAX) {
        return false;
    }

    return (bool) preg_match('/^[\p{L}\p{N}_\-\.\s]+$/u', $name);
}

function battleship_sanitize_client_id(string $clientId): string {
    $clientId = trim($clientId);
    if ($clientId !== '' && preg_match('/^[a-zA-Z0-9_-]{8,64}$/', $clientId)) {
        return $clientId;
    }

    return 'c' . bin2hex(random_bytes(8));
}

function battleship_ws_public_url(): string {
    $host = $_SERVER['HTTP_HOST'] ?? 'chadow.ru';
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    $scheme = $secure ? 'wss' : 'ws';

    return $scheme . '://' . $host . '/battleship-ws';
}

function battleship_ws_internal_base_url(): string {
    $port = getenv('BATTLESHIP_WS_PORT');
    if (!is_string($port) || trim($port) === '') {
        $port = '8793';
    }

    return 'http://127.0.0.1:' . trim($port);
}

function battleship_build_href(string $lang, string $publicId): string {
    if (!function_exists('abs_build_lang_href')) {
        require_once __DIR__ . '/lang.php';
    }

    return abs_build_lang_href($lang, 'services/onlinegames/battleship/' . $publicId);
}

function battleship_build_lobby_href(string $lang): string {
    if (!function_exists('abs_build_lang_href')) {
        require_once __DIR__ . '/lang.php';
    }

    return abs_build_lang_href($lang, 'services/onlinegames/battleship');
}

function battleship_build_home_href(string $lang): string {
    if (!function_exists('onlinegames_build_href')) {
        require_once __DIR__ . '/onlinegames_helpers.php';
    }

    return onlinegames_build_href($lang);
}

function battleship_ws_register_room(
    $db,
    string $publicId,
    string $hostClientId,
    string $hostNickname,
    int $boardSize = 10
): array {
    $url = battleship_ws_internal_base_url() . '/rooms';
    $payload = json_encode([
        'roomId' => $publicId,
        'hostCid' => $hostClientId,
        'hostNick' => battleship_normalize_player_name($hostNickname),
        'boardSize' => battleship_normalize_board_size($boardSize),
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

    return [
        'ok' => true,
        'board_size' => battleship_normalize_board_size($data['boardSize'] ?? $boardSize),
    ];
}

function battleship_ws_join_room($db, string $publicId, string $clientId, string $nickname): array {
    $url = battleship_ws_internal_base_url()
        . '/rooms/'
        . rawurlencode($publicId)
        . '/join';

    $payload = json_encode([
        'clientId' => $clientId,
        'nickname' => battleship_normalize_player_name($nickname),
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
        'color' => (string) ($data['color'] ?? 'guest'),
        'board_size' => battleship_normalize_board_size($data['boardSize'] ?? 10),
    ];
}

function battleship_ws_list_lobbies(int $limit = 50): array {
    $url = battleship_ws_internal_base_url()
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

function battleship_format_lobby_item(array $row, string $lang): ?array {
    $publicId = strtoupper(trim((string) ($row['roomId'] ?? '')));
    if (!battleship_public_id_valid($publicId)) {
        return null;
    }

    $host = battleship_normalize_player_name((string) ($row['host'] ?? 'Guest'));
    if ($host === '') {
        $host = $lang === 'en' ? 'Player' : 'Игрок';
    }

    $createdAt = (int) ($row['createdAt'] ?? 0);
    $boardSize = battleship_normalize_board_size($row['boardSize'] ?? 10);

    return [
        'public_id' => $publicId,
        'host' => $host,
        'board_size' => $boardSize,
        'room_href' => battleship_build_href($lang, $publicId),
        'created_at' => $createdAt > 0 ? $createdAt : null,
        'slots_free' => 1,
        'slots_total' => 2,
    ];
}

function battleship_format_session(
    $db,
    string $publicId,
    string $clientId,
    string $nickname,
    string $color,
    string $lang,
    int $boardSize = 10
): array {
    return [
        'public_id' => $publicId,
        'client_id' => $clientId,
        'nickname' => battleship_normalize_player_name($nickname),
        'color' => $color,
        'board_size' => battleship_normalize_board_size($boardSize),
        'ws_token' => battleship_issue_token($db, $publicId, $clientId, $nickname, $color),
        'ws_url' => battleship_ws_public_url(),
        'room_href' => battleship_build_href($lang, $publicId),
        'lobby_href' => battleship_build_lobby_href($lang),
        'hub_href' => battleship_build_home_href($lang),
    ];
}

function battleship_fleet_meta(int $boardSize): array {
    $size = battleship_normalize_board_size($boardSize);
    $fleets = [
        10 => [
            ['len' => 4, 'count' => 1],
            ['len' => 3, 'count' => 2],
            ['len' => 2, 'count' => 3],
            ['len' => 1, 'count' => 4],
        ],
        20 => [
            ['len' => 6, 'count' => 1],
            ['len' => 5, 'count' => 2],
            ['len' => 4, 'count' => 3],
            ['len' => 3, 'count' => 5],
            ['len' => 2, 'count' => 8],
            ['len' => 1, 'count' => 12],
        ],
        50 => [
            ['len' => 10, 'count' => 2],
            ['len' => 8, 'count' => 3],
            ['len' => 6, 'count' => 5],
            ['len' => 5, 'count' => 6],
            ['len' => 4, 'count' => 10],
            ['len' => 3, 'count' => 15],
            ['len' => 2, 'count' => 25],
            ['len' => 1, 'count' => 40],
        ],
    ];

    return $fleets[$size] ?? $fleets[10];
}

function battleship_meta(string $lang = 'ru'): array {
    if ($lang === 'en') {
        return [
            'id' => 'battleship',
            'icon' => 'fa-ship',
            'title' => 'Battleship Online',
            'desc' => 'Classic sea battle for two. Choose 10×10, 20×20 or 50×50 board and share the room link.',
            'badge' => '2 players',
        ];
    }

    return [
        'id' => 'battleship',
        'icon' => 'fa-ship',
        'title' => 'Морской бой',
        'desc' => 'Классический морской бой на двоих. Поле 10×10, 20×20 или 50×50 — создайте комнату и отправьте ссылку.',
        'badge' => '2 игрока',
    ];
}
