<?php
require_once __DIR__ . '/../includes/user_bootstrap.php';
require_once __DIR__ . '/../includes/lang.php';
require_once __DIR__ . '/../includes/wg_openid_client.php';
require_once __DIR__ . '/../includes/minecraft_oauth_helpers.php';
require_once __DIR__ . '/../includes/clan_reserve_helpers.php';

$lang = abs_detect_lang();
$isEn = $lang === 'en';

$loginUrl = user_auth_path('/auth/login');
$profileUrl = user_auth_path('/auth/profile');
$returnUrl = isset($_SESSION['wg_oauth_return']) ? (string) $_SESSION['wg_oauth_return'] : $profileUrl;
$returnUrl = user_validate_return_url($returnUrl, $profileUrl);
$realm = isset($_SESSION['wg_oauth_realm']) ? user_normalize_wg_realm((string) $_SESSION['wg_oauth_realm']) : 'eu';
$mode = isset($_SESSION['wg_oauth_mode']) ? (string) $_SESSION['wg_oauth_mode'] : '';
$linkUserId = isset($_SESSION['wg_oauth_user_id']) ? (int) $_SESSION['wg_oauth_user_id'] : 0;
$linkProvider = isset($_SESSION['wg_oauth_provider']) ? (string) $_SESSION['wg_oauth_provider'] : '';
$linkId = isset($_SESSION['wg_oauth_link_id']) ? (int) $_SESSION['wg_oauth_link_id'] : 0;
$mcLauncherSession = isset($_SESSION['mc_launcher_session']) ? trim((string) $_SESSION['mc_launcher_session']) : '';

$finishLauncher = static function (bool $success, string $message) use ($mcLauncherSession): void {
    if ($mcLauncherSession !== '' && minecraft_oauth_is_valid_session_id($mcLauncherSession) && !$success) {
        minecraft_oauth_mark_session_error($mcLauncherSession, $message);
    }
    minecraft_oauth_render_result_page($success, $message);
    exit();
};

unset(
    $_SESSION['wg_oauth_return'],
    $_SESSION['wg_oauth_realm'],
    $_SESSION['wg_oauth_state'],
    $_SESSION['wg_oauth_mode'],
    $_SESSION['wg_oauth_user_id'],
    $_SESSION['wg_oauth_provider'],
    $_SESSION['wg_oauth_link_id'],
    $_SESSION['mc_launcher_session']
);

$errorRedirect = static function (string $message) use ($mode, $loginUrl, $profileUrl, $returnUrl, $finishLauncher): void {
    if ($mode === 'launcher') {
        $finishLauncher(false, $message);
    }
    if ($mode === 'login') {
        header('Location: ' . $loginUrl . '?' . http_build_query(['wg_error' => $message]));
    } elseif ($mode === 'reserve_link' || $mode === 'reserve_refresh') {
        header('Location: ' . $returnUrl . (str_contains($returnUrl, '?') ? '&' : '?') . http_build_query(['wg_error' => $message]));
    } else {
        header('Location: ' . $profileUrl . '?' . http_build_query(['wg_error' => $message]));
    }
    exit();
};

$status = isset($_GET['status']) ? (string) $_GET['status'] : '';
$accessToken = isset($_GET['access_token']) ? (string) $_GET['access_token'] : '';
$nickname = isset($_GET['nickname']) ? (string) $_GET['nickname'] : '';
$accountId = isset($_GET['account_id']) ? (int) $_GET['account_id'] : 0;
$expiresAt = isset($_GET['expires_at']) ? (int) $_GET['expires_at'] : 0;

if ($mode !== 'login' && $mode !== 'link' && $mode !== 'launcher' && $mode !== 'refresh'
    && $mode !== 'reserve_link' && $mode !== 'reserve_refresh') {
    $errorRedirect($isEn ? 'Session expired. Try again.' : 'Сессия истекла. Попробуйте снова.');
}

if (($mode === 'link' || $mode === 'refresh' || $mode === 'reserve_link' || $mode === 'reserve_refresh') && $linkUserId <= 0) {
    $errorRedirect($isEn ? 'Session expired. Try again.' : 'Сессия истекла. Попробуйте снова.');
}

if ($status !== 'ok') {
    $code = isset($_GET['code']) ? (string) $_GET['code'] : '500';
    $errorRedirect($isEn
        ? 'Authorization failed. Error code: ' . $code
        : 'Ошибка авторизации. Код ошибки: ' . $code);
}

if ($accessToken === '' || $accountId <= 0) {
    $errorRedirect($isEn ? 'Incomplete data from the game API.' : 'Неполные данные от игрового API.');
}

if ($expiresAt > 0 && $expiresAt < time()) {
    $errorRedirect($isEn ? 'Access token has expired.' : 'Срок действия access_token истёк.');
}

$client = new WgOpenIdClient($userDb);
$verified = $client->prolongateToken($accessToken, $realm);
if (!$verified['ok']) {
    $errorRedirect($isEn ? 'Could not verify game API token.' : 'Не удалось подтвердить токен игрового API.');
}

$verifiedAccountId = (int) ($verified['account_id'] ?? 0);
if ($verifiedAccountId > 0) {
    $accountId = $verifiedAccountId;
}

if ($mode === 'launcher') {
    if ($mcLauncherSession === '' || !minecraft_oauth_is_valid_session_id($mcLauncherSession)) {
        $finishLauncher(false, $isEn ? 'Launcher session not found.' : 'Сессия лаунчера не найдена.');
    }

    $nickname = minecraft_resolve_wg_nickname($userDb, $accountId, $realm, $nickname, $accessToken);
    $result = minecraft_oauth_finalize_session($userDb, $mcLauncherSession, $accountId, $nickname, $realm);
    if (!$result['ok']) {
        $finishLauncher(false, (string) ($result['error'] ?? ($isEn ? 'Could not complete sign-in.' : 'Не удалось завершить вход.')));
    }

    $finishLauncher(
        true,
        ($isEn ? 'Nickname ' : 'Ник ') . ($result['nickname'] ?? '') . ($isEn
            ? ' received. Return to Chadow Games Launcher.'
            : ' получен. Вернитесь в Chadow Games Launcher.')
    );
}

if ($mode === 'login') {
    try {
        $loginResult = user_login_or_register_wg($userDb, $accountId, $realm, $nickname, true, $lang);
    } catch (Throwable $e) {
        error_log('wg_callback login: ' . $e->getMessage());
        $errorRedirect($isEn ? 'Could not sign in.' : 'Не удалось выполнить вход.');
    }
    if (!$loginResult['ok']) {
        $errorRedirect($loginResult['error'] ?? ($isEn ? 'Could not sign in.' : 'Не удалось выполнить вход.'));
    }
    header('Location: ' . $returnUrl);
    exit();
}

if ($mode === 'refresh') {
    $profile = user_login_row($userDb, $linkUserId);
    if (!$profile) {
        $errorRedirect($isEn ? 'Account not found.' : 'Аккаунт не найден.');
    }
    $linkCtx = clan_reserve_user_link_context($profile);
    if ($linkCtx === null || empty($linkCtx['linked'])) {
        $errorRedirect($isEn ? 'Game account is not linked.' : 'Игровой аккаунт не привязан.');
    }
    if ((int) ($linkCtx['account_id'] ?? 0) !== $accountId) {
        $errorRedirect($isEn
            ? 'Authorized account does not match the linked profile.'
            : 'Авторизованный аккаунт не совпадает с привязанным.');
    }

    $successUrl = $returnUrl;
    $separator = str_contains($successUrl, '?') ? '&' : '?';
    header('Location: ' . $successUrl . $separator . 'wg_linked=1');
    exit();
}

if ($mode === 'reserve_refresh' || $mode === 'reserve_link') {
    $reserveProvider = $linkProvider !== '' ? clan_reserve_normalize_provider($linkProvider) : ($realm === 'ru' ? 'lesta' : 'wg');
    $reserveRealm = clan_reserve_realm_for_provider($reserveProvider, $realm);

    if ($mode === 'reserve_refresh') {
        $tokenRow = $linkId > 0
            ? clan_reserve_fetch_token_by_id($userDb, $linkUserId, $linkId)
            : clan_reserve_fetch_token_row($userDb, $linkUserId, $reserveProvider, $reserveRealm);
        if ($tokenRow === null) {
            $errorRedirect($isEn ? 'Reserve link not found.' : 'Привязка резервов не найдена.');
        }
        if ((int) ($tokenRow['account_id'] ?? 0) !== $accountId) {
            $errorRedirect($isEn
                ? 'Authorized account does not match the linked reserve account.'
                : 'Авторизованный аккаунт не совпадает с привязанным для резервов.');
        }
    }

    $alreadyLinked = false;
    if ($mode === 'reserve_link') {
        $existingRow = clan_reserve_fetch_token_row($userDb, $linkUserId, $reserveProvider, $reserveRealm, $accountId);
        $alreadyLinked = $existingRow !== null;
    }

    $tokenExpires = (int) ($verified['expires_at'] ?? $expiresAt);
    if ($tokenExpires <= 0) {
        $tokenExpires = time() + 1209600;
    }
    $savedLinkId = clan_reserve_save_user_token(
        $userDb,
        $linkUserId,
        $reserveProvider,
        $reserveRealm,
        $accountId,
        (string) ($verified['access_token'] ?? $accessToken),
        $tokenExpires,
        $nickname
    );
    if ($savedLinkId <= 0) {
        $errorRedirect($isEn ? 'Could not save API token.' : 'Не удалось сохранить токен API.');
    }

    $successUrl = $returnUrl;
    $separator = str_contains($successUrl, '?') ? '&' : '?';
    if ($alreadyLinked) {
        header('Location: ' . $successUrl . $separator . http_build_query([
            'wg_linked' => 'exists',
            'link_id' => $savedLinkId,
        ]));
    } else {
        header('Location: ' . $successUrl . $separator . 'wg_linked=1&link_id=' . $savedLinkId);
    }
    exit();
}

$linkResult = $realm === 'ru'
    ? user_link_lesta_account($userDb, $linkUserId, $accountId, $nickname, $lang)
    : user_link_wg_account($userDb, $linkUserId, $accountId, $realm, $nickname, $lang);
if (!$linkResult['ok']) {
    $errorRedirect($linkResult['error'] ?? ($isEn ? 'Could not link account.' : 'Не удалось привязать аккаунт.'));
}

$successUrl = $returnUrl;
$separator = str_contains($successUrl, '?') ? '&' : '?';
header('Location: ' . $successUrl . $separator . 'wg_linked=1');
exit();
