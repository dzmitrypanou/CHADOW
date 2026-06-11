<?php
require_once __DIR__ . '/seo.php';
abs_redirect_www_to_apex();

if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.gc_maxlifetime', '2592000');
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    } else {
        session_set_cookie_params(0, '/', '', $secure, true);
    }
    session_start();
}

$_userRoot = dirname(__DIR__);
require_once $_userRoot . '/config/database.php';
require_once $_userRoot . '/config/ensure_site_users.php';
require_once $_userRoot . '/config/ensure_user_login_throttle.php';
require_once $_userRoot . '/config/runtime_flags.php';

$userDb = Database::getInstance();
if (chadow_runtime_schema_checks_enabled()) {
    ensure_site_users_table($userDb);
    ensure_site_login_throttle_table($userDb);
}

require_once __DIR__ . '/user_login_throttle.php';
require_once __DIR__ . '/user_csrf.php';
user_csrf_ensure();
require_once __DIR__ . '/user_auth.php';

if (user_is_logged_in() && !empty($_SESSION['site_remember_me'])) {
    user_session_send_cookie(time() + USER_SESSION_REMEMBER_LIFETIME_SEC);
}

if (!headers_sent()) {
    header('X-Frame-Options: SAMEORIGIN');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
    $secure = user_request_is_https();
    if ($secure) {
        header('Strict-Transport-Security: max-age=31536000');
    }
}
