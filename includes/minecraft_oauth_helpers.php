<?php

require_once __DIR__ . '/../config/ensure_site_settings.php';
require_once __DIR__ . '/game_api.php';
require_once __DIR__ . '/user_auth.php';

const MINECRAFT_OAUTH_SESSIONS_DIR = 'uploads/minecraft/oauth/sessions';
const MINECRAFT_OAUTH_SESSION_TTL_SEC = 600;
const MINECRAFT_OAUTH_COOKIE = 'mc_oauth_sid';

function minecraft_oauth_sessions_root(): string
{
    return dirname(__DIR__) . '/' . MINECRAFT_OAUTH_SESSIONS_DIR;
}

function minecraft_oauth_callback_uri(): string
{
    return user_absolute_url('/auth/wg/callback');
}

function minecraft_oauth_launcher_start_url(string $sessionId): string
{
    return user_absolute_url('/auth/wg.php?mc_launcher_session=' . urlencode($sessionId));
}

function minecraft_oauth_is_valid_session_id(string $sessionId): bool
{
    return (bool) preg_match('/^[a-f0-9]{32,64}$/i', $sessionId);
}

function minecraft_oauth_normalize_provider(string $provider): string
{
    $provider = strtolower(trim($provider));

    return $provider === 'lesta' ? 'lesta' : 'wg';
}

function minecraft_oauth_realm_for_provider(string $provider): string
{
    return $provider === 'lesta' ? 'ru' : 'eu';
}

function minecraft_oauth_session_path(string $sessionId): string
{
    return minecraft_oauth_sessions_root() . '/' . $sessionId . '.json';
}

/**
 * @return array<string, mixed>|null
 */
function minecraft_oauth_read_session(string $sessionId): ?array
{
    if (!minecraft_oauth_is_valid_session_id($sessionId)) {
        return null;
    }

    $path = minecraft_oauth_session_path($sessionId);
    if (!is_file($path)) {
        return null;
    }

    $raw = file_get_contents($path);
    $data = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($data)) {
        return null;
    }

    $expiresAt = (int) ($data['expires_at'] ?? 0);
    if ($expiresAt > 0 && $expiresAt < time()) {
        @unlink($path);

        return null;
    }

    return $data;
}

/**
 * @param array<string, mixed> $data
 */
function minecraft_oauth_write_session(string $sessionId, array $data): bool
{
    if (!minecraft_oauth_is_valid_session_id($sessionId)) {
        return false;
    }

    $root = minecraft_oauth_sessions_root();
    if (!is_dir($root) && !mkdir($root, 0755, true) && !is_dir($root)) {
        return false;
    }

    $path = minecraft_oauth_session_path($sessionId);
    $json = json_encode($data, JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        return false;
    }

    return file_put_contents($path, $json, LOCK_EX) !== false;
}

/**
 * @return array{ok:bool,error?:string,session?:string,loginUrl?:string}
 */
function minecraft_oauth_create_session($db, string $provider): array
{
    $provider = minecraft_oauth_normalize_provider($provider);
    $realm = minecraft_oauth_realm_for_provider($provider);
    $appId = $provider === 'lesta'
        ? game_api_lesta_application_id($db)
        : game_api_wg_application_id($db);

    if ($appId === '') {
        return [
            'ok' => false,
            'error' => $provider === 'lesta' ? 'Lesta API не настроен' : 'WG API не настроен',
        ];
    }

    $sessionId = bin2hex(random_bytes(16));
    $now = time();
    $session = [
        'session' => $sessionId,
        'provider' => $provider,
        'realm' => $realm,
        'status' => 'pending',
        'nickname' => '',
        'account_id' => 0,
        'error' => '',
        'created_at' => $now,
        'expires_at' => $now + MINECRAFT_OAUTH_SESSION_TTL_SEC,
    ];

    if (!minecraft_oauth_write_session($sessionId, $session)) {
        return ['ok' => false, 'error' => 'Не удалось создать сессию OAuth'];
    }

    return [
        'ok' => true,
        'session' => $sessionId,
        'loginUrl' => minecraft_oauth_launcher_start_url($sessionId),
    ];
}

function minecraft_oauth_mark_session_error(string $sessionId, string $error): void
{
    $session = minecraft_oauth_read_session($sessionId);
    if (!is_array($session)) {
        return;
    }
    $session['status'] = 'error';
    $session['error'] = $error;
    minecraft_oauth_write_session($sessionId, $session);
}

function minecraft_oauth_set_browser_cookie(string $sessionId): void
{
    $secure = user_request_is_https();
    setcookie(MINECRAFT_OAUTH_COOKIE, $sessionId, [
        'expires' => time() + MINECRAFT_OAUTH_SESSION_TTL_SEC,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/**
 * @return array{ok:bool,error?:string,nickname?:string}
 */
function minecraft_oauth_finalize_session(string $sessionId, int $accountId, string $nickname): array
{
    $session = minecraft_oauth_read_session($sessionId);
    if ($session === null) {
        return ['ok' => false, 'error' => 'Сессия не найдена'];
    }

    $wgNick = minecraft_normalize_wg_nickname($nickname);
    if ($wgNick === '' || !preg_match('/^[a-zA-Z0-9_\-]{3,}$/', $wgNick)) {
        $wgNick = minecraft_sanitize_launcher_nickname($nickname, $accountId);
    }

    $session['status'] = 'done';
    $session['nickname'] = $wgNick;
    $session['account_id'] = $accountId;
    $session['error'] = '';
    minecraft_oauth_write_session($sessionId, $session);

    return ['ok' => true, 'nickname' => $wgNick];
}

/**
 * @return array{ok:bool,error?:string,location?:string}
 */
function minecraft_oauth_fetch_login_location($db, string $sessionId): array
{
    require_once __DIR__ . '/wg_openid_client.php';

    $session = minecraft_oauth_read_session($sessionId);
    if ($session === null) {
        return ['ok' => false, 'error' => 'Сессия не найдена или истекла'];
    }

    if (($session['status'] ?? '') !== 'pending') {
        return ['ok' => false, 'error' => 'Сессия уже использована'];
    }

    $realm = (string) ($session['realm'] ?? 'eu');
    $client = new WgOpenIdClient($db);

    return $client->fetchLoginLocation($realm);
}

function minecraft_resolve_wg_nickname($db, int $accountId, string $realm, string $nickname): string
{
    $nickname = trim($nickname);
    if ($accountId <= 0) {
        return $nickname;
    }

    require_once __DIR__ . '/wg_openid_client.php';
    $client = new WgOpenIdClient($db);
    $fetched = $client->fetchAccountNickname($accountId, $realm);
    if (!empty($fetched['ok']) && trim((string) ($fetched['nickname'] ?? '')) !== '') {
        return trim((string) $fetched['nickname']);
    }

    return $nickname;
}

function minecraft_normalize_wg_nickname(string $nickname): string
{
    $nickname = trim($nickname);
    if ($nickname === '') {
        return '';
    }

    if (preg_match('/[^\x00-\x7F]/u', $nickname)) {
        $translit = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $nickname);
        if (is_string($translit) && trim($translit) !== '') {
            $nickname = trim($translit);
        }
    }

    return mb_substr($nickname, 0, 64);
}

function minecraft_sanitize_launcher_nickname(string $nickname, int $accountId = 0): string
{
    $nickname = trim($nickname);
    if ($nickname !== '' && preg_match('/[^\x00-\x7F]/u', $nickname)) {
        $translit = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $nickname);
        if (is_string($translit) && trim($translit) !== '') {
            $nickname = trim($translit);
        }
    }

    $nick = preg_replace('/[^a-zA-Z0-9_]/', '', $nickname) ?? '';

    if (strlen($nick) > 16) {
        $nick = substr($nick, 0, 16);
    }

    if (strlen($nick) >= 3) {
        return $nick;
    }

    if ($accountId > 0) {
        $fallback = 'WG' . (string) $accountId;
        $fallback = substr($fallback, 0, 16);

        return strlen($fallback) >= 3 ? $fallback : 'Player';
    }

    return strlen($nick) >= 3 ? $nick : 'Player';
}

/**
 * @return array{ok:bool,error?:string,nickname?:string}
 */
function minecraft_oauth_complete_session($db, string $sessionId, string $accessToken, int $accountId, string $nickname, string $realm): array
{
    require_once __DIR__ . '/wg_openid_client.php';

    $session = minecraft_oauth_read_session($sessionId);
    if ($session === null) {
        return ['ok' => false, 'error' => 'Сессия не найдена'];
    }

    $client = new WgOpenIdClient($db);
    $verified = $client->prolongateToken($accessToken, $realm);
    if (!$verified['ok']) {
        minecraft_oauth_mark_session_error($sessionId, 'Не удалось подтвердить токен');

        return ['ok' => false, 'error' => 'Не удалось подтвердить токен'];
    }

    $verifiedAccountId = (int) ($verified['account_id'] ?? 0);
    if ($verifiedAccountId > 0) {
        $accountId = $verifiedAccountId;
    }

    $nickname = minecraft_resolve_wg_nickname($db, $accountId, $realm, $nickname);

    return minecraft_oauth_finalize_session($sessionId, $accountId, $nickname);
}

/**
 * @return array{ok:bool,status?:string,nickname?:string,error?:string}
 */
function minecraft_oauth_poll_session(string $sessionId): array
{
    $session = minecraft_oauth_read_session($sessionId);
    if ($session === null) {
        return ['ok' => false, 'status' => 'expired', 'error' => 'Сессия истекла'];
    }

    $status = (string) ($session['status'] ?? 'pending');
    if ($status === 'done') {
        return [
            'ok' => true,
            'status' => 'done',
            'nickname' => (string) ($session['nickname'] ?? ''),
        ];
    }

    if ($status === 'error') {
        return [
            'ok' => false,
            'status' => 'error',
            'error' => (string) ($session['error'] ?? 'Ошибка авторизации'),
        ];
    }

    return ['ok' => true, 'status' => 'pending'];
}

function minecraft_oauth_send_cors_headers(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

function minecraft_oauth_render_result_page(bool $success, string $message): void
{
    header('Content-Type: text/html; charset=utf-8');
    $title = $success ? 'Вход выполнен' : 'Ошибка входа';
    $color = $success ? '#74f6c8' : '#ff9b9b';
    echo '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</title>'
        . '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a1022;color:#eceff4;font-family:Inter,Segoe UI,sans-serif;padding:24px}'
        . '.card{max-width:420px;background:#12182a;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:28px;text-align:center}'
        . 'h1{font-size:1.25rem;margin:0 0 12px;color:' . $color . '}p{margin:0;color:#9aa8be;line-height:1.5}</style></head><body>'
        . '<div class="card"><h1>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h1>'
        . '<p>' . htmlspecialchars($message, ENT_QUOTES, 'UTF-8') . '</p></div></body></html>';
}
