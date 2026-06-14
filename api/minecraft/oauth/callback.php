<?php
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../config/ensure_site_settings.php';
require_once __DIR__ . '/../../../includes/minecraft_oauth_helpers.php';

$sessionId = isset($_COOKIE[MINECRAFT_OAUTH_COOKIE]) ? trim((string) $_COOKIE[MINECRAFT_OAUTH_COOKIE]) : '';
$status = isset($_GET['status']) ? (string) $_GET['status'] : '';
$accessToken = isset($_GET['access_token']) ? (string) $_GET['access_token'] : '';
$nickname = isset($_GET['nickname']) ? (string) $_GET['nickname'] : '';
$accountId = isset($_GET['account_id']) ? (int) $_GET['account_id'] : 0;
$expiresAt = isset($_GET['expires_at']) ? (int) $_GET['expires_at'] : 0;

setcookie(MINECRAFT_OAUTH_COOKIE, '', [
    'expires' => time() - 3600,
    'path' => '/api/minecraft/oauth/',
    'secure' => user_request_is_https(),
    'httponly' => true,
    'samesite' => 'Lax',
]);

if (!minecraft_oauth_is_valid_session_id($sessionId)) {
    minecraft_oauth_render_result_page(false, 'Сессия входа не найдена. Закройте вкладку и попробуйте снова из лаунчера.');
    exit();
}

$session = minecraft_oauth_read_session($sessionId);
$realm = is_array($session) ? (string) ($session['realm'] ?? 'eu') : 'eu';

if ($status !== 'ok') {
    $code = isset($_GET['code']) ? (string) $_GET['code'] : '500';
    if (is_array($session)) {
        $session['status'] = 'error';
        $session['error'] = 'Ошибка авторизации (код ' . $code . ')';
        minecraft_oauth_write_session($sessionId, $session);
    }
    minecraft_oauth_render_result_page(false, 'Авторизация отменена или не удалась.');
    exit();
}

if ($accessToken === '' || $accountId <= 0) {
    if (is_array($session)) {
        $session['status'] = 'error';
        $session['error'] = 'Неполные данные от API';
        minecraft_oauth_write_session($sessionId, $session);
    }
    minecraft_oauth_render_result_page(false, 'Неполные данные от игрового API.');
    exit();
}

if ($expiresAt > 0 && $expiresAt < time()) {
    if (is_array($session)) {
        $session['status'] = 'error';
        $session['error'] = 'Срок действия токена истёк';
        minecraft_oauth_write_session($sessionId, $session);
    }
    minecraft_oauth_render_result_page(false, 'Срок действия access_token истёк.');
    exit();
}

try {
    $db = Database::getInstance();
    ensure_site_settings_table($db);
    $result = minecraft_oauth_complete_session($db, $sessionId, $accessToken, $accountId, $nickname, $realm);
} catch (Throwable $e) {
    minecraft_oauth_render_result_page(false, 'Не удалось завершить вход.');
    exit();
}

if (!$result['ok']) {
    minecraft_oauth_render_result_page(false, $result['error'] ?? 'Не удалось подтвердить вход.');
    exit();
}

minecraft_oauth_render_result_page(
    true,
    'Ник ' . ($result['nickname'] ?? '') . ' получен. Вернитесь в Chadow Games Launcher — лаунчер подхватит вход автоматически.'
);
