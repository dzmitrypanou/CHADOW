<?php
require_once __DIR__ . '/../includes/user_bootstrap.php';
require_once __DIR__ . '/../includes/lang.php';
require_once __DIR__ . '/../includes/wg_openid_client.php';
require_once __DIR__ . '/../includes/minecraft_oauth_helpers.php';

$lang = abs_detect_lang();
$isEn = $lang === 'en';

$mcLauncherSession = isset($_GET['mc_launcher_session']) ? trim((string) $_GET['mc_launcher_session']) : '';
if ($mcLauncherSession !== '') {
    if (!minecraft_oauth_is_valid_session_id($mcLauncherSession)) {
        minecraft_oauth_render_result_page(false, $isEn ? 'Invalid launcher session.' : 'Некорректная сессия лаунчера.');
        exit();
    }

    $mcSession = minecraft_oauth_read_session($mcLauncherSession);
    if ($mcSession === null || ($mcSession['status'] ?? '') !== 'pending') {
        minecraft_oauth_render_result_page(false, $isEn ? 'Launcher session expired. Try again from the app.' : 'Сессия лаунчера истекла. Начните вход заново.');
        exit();
    }

    $realm = minecraft_oauth_realm_for_provider((string) ($mcSession['provider'] ?? 'wg'));
    $_SESSION['wg_oauth_mode'] = 'launcher';
    $_SESSION['mc_launcher_session'] = $mcLauncherSession;
    $_SESSION['wg_oauth_realm'] = $realm;
    $_SESSION['wg_oauth_state'] = bin2hex(random_bytes(16));
    unset($_SESSION['wg_oauth_user_id'], $_SESSION['wg_oauth_return']);

    $client = new WgOpenIdClient($userDb);
    $result = $client->fetchLoginLocation($realm);
    if (!$result['ok']) {
        minecraft_oauth_mark_session_error($mcLauncherSession, (string) ($result['error'] ?? 'WG API error'));
        minecraft_oauth_render_result_page(false, (string) ($result['error'] ?? ($isEn ? 'Failed to start sign-in.' : 'Не удалось начать вход.')));
        exit();
    }

    header('Location: ' . $result['location']);
    exit();
}

$loginUrl = user_auth_path('/auth/login');
$profileUrl = user_auth_path('/auth/profile');
$defaultReturn = user_auth_path('/auth/profile');

$action = isset($_GET['action']) ? strtolower(trim((string) $_GET['action'])) : 'link';
if ($action !== 'login' && $action !== 'link') {
    $action = 'link';
}

$returnUrl = isset($_GET['return']) ? user_validate_return_url((string) $_GET['return'], $defaultReturn) : $defaultReturn;
$realm = isset($_GET['realm']) ? WgOpenIdClient::normalizeRealm((string) $_GET['realm']) : 'eu';
$provider = isset($_GET['provider']) ? strtolower(trim((string) $_GET['provider'])) : '';

if ($provider === 'lesta') {
    $realm = 'ru';
} elseif ($provider === 'wg' && $realm === 'ru') {
    $realm = 'eu';
}

if ($action === 'login') {
    if (user_is_logged_in()) {
        header('Location: ' . $returnUrl);
        exit();
    }

    $errorUrl = static function (string $message) use ($loginUrl): string {
        return $loginUrl . '?' . http_build_query(['wg_error' => $message]);
    };

    $_SESSION['wg_oauth_mode'] = 'login';
    $_SESSION['wg_oauth_return'] = $returnUrl;
    $_SESSION['wg_oauth_realm'] = $realm;
    $_SESSION['wg_oauth_state'] = bin2hex(random_bytes(16));
    unset($_SESSION['wg_oauth_user_id']);
} else {
    user_require_web();
    user_require_active_web($userDb);

    $userId = user_current_id();
    $profile = $userId !== null ? user_login_row($userDb, (int) $userId) : null;
    if (!$profile) {
        user_logout();
        header('Location: ' . user_auth_path('/auth/login'));
        exit();
    }

    $errorUrl = static function (string $message) use ($profileUrl): string {
        return $profileUrl . '?' . http_build_query(['wg_error' => $message]);
    };

    if (($profile['auth_provider'] ?? '') !== 'local') {
        header('Location: ' . $errorUrl($isEn ? 'Linking is only available for email accounts.' : 'Привязка доступна только для аккаунтов с email.'));
        exit();
    }

    $isLestaLink = $provider === 'lesta' || $realm === 'ru';
    if ($isLestaLink) {
        if (user_lesta_is_linked($profile)) {
            require_once __DIR__ . '/../includes/game_api.php';
            $publisher = game_api_ru_publisher_name($lang);
            header('Location: ' . $errorUrl($isEn
                ? ('An ' . $publisher . ' account is already linked.')
                : ('Аккаунт ' . $publisher . ' уже привязан.')));
            exit();
        }
    } elseif (user_wg_api_is_linked($profile)) {
        header('Location: ' . $errorUrl($isEn ? 'A Wargaming account is already linked.' : 'Аккаунт Wargaming уже привязан.'));
        exit();
    }

    $returnUrl = $profileUrl;
    $_SESSION['wg_oauth_mode'] = 'link';
    $_SESSION['wg_oauth_user_id'] = (int) $userId;
    $_SESSION['wg_oauth_realm'] = $realm;
    $_SESSION['wg_oauth_provider'] = $isLestaLink ? 'lesta' : 'wg';
    $_SESSION['wg_oauth_return'] = $returnUrl;
    $_SESSION['wg_oauth_state'] = bin2hex(random_bytes(16));
}

$client = new WgOpenIdClient($userDb);
$result = $client->fetchLoginLocation($realm);

if (!$result['ok']) {
    unset(
        $_SESSION['wg_oauth_mode'],
        $_SESSION['wg_oauth_user_id'],
        $_SESSION['wg_oauth_realm'],
        $_SESSION['wg_oauth_return'],
        $_SESSION['wg_oauth_state']
    );
    $redirectError = $action === 'login'
        ? ($loginUrl . '?' . http_build_query(['wg_error' => $result['error'] ?? ($isEn ? 'Failed to start sign-in' : 'Не удалось начать вход')]))
        : ($profileUrl . '?' . http_build_query(['wg_error' => $result['error'] ?? ($isEn ? 'Failed to start linking' : 'Не удалось начать привязку')]));
    header('Location: ' . $redirectError);
    exit();
}

header('Location: ' . $result['location']);
exit();
