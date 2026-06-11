<?php
require_once __DIR__ . '/../includes/user_bootstrap.php';
require_once __DIR__ . '/../includes/lang.php';
require_once __DIR__ . '/../includes/wg_openid_client.php';

$lang = abs_detect_lang();
$isEn = $lang === 'en';

if (user_is_logged_in()) {
    header('Location: ' . user_auth_path('/auth/profile'));
    exit();
}

$defaultReturn = user_auth_path('/auth/profile');
$returnUrl = isset($_GET['return']) ? (string) $_GET['return'] : $defaultReturn;
$returnUrl = user_validate_return_url($returnUrl, $defaultReturn);

$loginError = null;
$loginFailureCounted = false;
$prefillLogin = isset($_GET['login']) ? user_normalize_login((string) $_GET['login']) : '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login'])) {
    if (isset($_POST['return'])) {
        $returnUrl = user_validate_return_url((string) $_POST['return'], $defaultReturn);
    }

    $blockedFor = user_login_throttle_retry_after_seconds($userDb);
    if ($blockedFor !== null && $blockedFor > 0) {
        $mins = max(1, (int) ceil($blockedFor / 60));
        $loginError = $isEn
            ? 'Too many failed attempts. Try again in ' . $mins . ' min.'
            : 'Слишком много неудачных попыток. Повторите через ' . $mins . ' мин.';
    } elseif (!user_csrf_verify()) {
        $loginError = $isEn
            ? 'Session expired. Refresh the page and try again.'
            : 'Сессия устарела. Обновите страницу и попробуйте снова.';
    } else {
        $login = $_POST['login_name'] ?? '';
        $password = $_POST['password'] ?? '';
        $rememberMe = isset($_POST['remember_me']) && $_POST['remember_me'] === '1';
        try {
            $loggedIn = user_attempt_login($userDb, $login, $password, $rememberMe);
        } catch (Throwable $e) {
            $loggedIn = false;
            $loginError = $isEn
                ? 'Server error. Please try again later.'
                : 'Ошибка сервера. Попробуйте позже.';
        }
        if (!empty($loggedIn)) {
            header('Location: ' . $returnUrl);
            exit();
        }
        $prefillLogin = user_normalize_login((string) $login);
        if ($loginError === null) {
            $loginError = $isEn ? 'Invalid username or password' : 'Неверный логин или пароль';
        }
        if ($loginError === ($isEn ? 'Invalid username or password' : 'Неверный логин или пароль')
            && trim((string) $login) !== '' && $password !== '') {
            $loginFailureCounted = true;
            user_login_throttle_register_failure($userDb);
            $blockedAfter = user_login_throttle_retry_after_seconds($userDb);
            if ($blockedAfter !== null && $blockedAfter > 0) {
                $mins = max(1, (int) ceil($blockedAfter / 60));
                $loginError = $isEn
                    ? 'Too many failed attempts. Try again in ' . $mins . ' min.'
                    : 'Слишком много неудачных попыток. Повторите через ' . $mins . ' мин.';
            }
        }
    }
}

$loginThrottleRetry = user_login_throttle_retry_after_seconds($userDb);
$loginFormLocked = $loginThrottleRetry !== null && $loginThrottleRetry > 0;
$attemptsRemaining = user_login_throttle_attempts_remaining($userDb);

if ($loginFailureCounted && $loginError === ($isEn ? 'Invalid username or password' : 'Неверный логин или пароль')) {
    $loginError = $isEn
        ? 'Invalid username or password. Attempts remaining before lockout: ' . $attemptsRemaining . '.'
        : 'Неверный логин или пароль. Осталось попыток до блокировки: ' . $attemptsRemaining . '.';
}

$wgClient = new WgOpenIdClient($userDb);
$wgAppConfigured = $wgClient->applicationId() !== '';
$wgProviderConfigured = [
    'wg' => $wgClient->applicationIdForRealm('eu') !== '',
    'lesta' => $wgClient->applicationIdForRealm('ru') !== '',
];
$wgLoginError = isset($_GET['wg_error']) ? trim((string) $_GET['wg_error']) : '';

$pageTitle = $isEn ? 'Log in' : 'Авторизация';
$bodyClass = 'page-auth page-auth-login';
$seoSlug = 'auth/login';
require __DIR__ . '/../includes/site_header.php';
?>
        <main class="auth-page">
            <section class="auth-card">
                <h2 class="auth-card__title">
                    <i class="fas fa-sign-in-alt" aria-hidden="true"></i>
                    <?php echo $isEn ? 'Log in' : 'Авторизация'; ?>
                </h2>

                <?php if ($loginError !== null): ?>
                <p class="auth-alert auth-alert--error" role="alert"><?php echo htmlspecialchars($loginError, ENT_QUOTES, 'UTF-8'); ?></p>
                <?php elseif ($wgLoginError !== ''): ?>
                <p class="auth-alert auth-alert--error" role="alert"><?php echo htmlspecialchars($wgLoginError, ENT_QUOTES, 'UTF-8'); ?></p>
                <?php elseif ($loginFormLocked): ?>
                <?php $lockM = max(1, (int) ceil($loginThrottleRetry / 60)); ?>
                <p class="auth-alert auth-alert--warning" role="alert">
                    <?php echo $isEn
                        ? 'Login temporarily locked. Try again in ' . (int) $lockM . ' min.'
                        : 'Вход временно заблокирован. Повторите через ' . (int) $lockM . ' мин.'; ?>
                </p>
                <?php endif; ?>

                <form class="auth-form" method="post" action="<?php echo htmlspecialchars(user_auth_path('/auth/login'), ENT_QUOTES, 'UTF-8'); ?>">
                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars(user_csrf_token(), ENT_QUOTES, 'UTF-8'); ?>">
                    <input type="hidden" name="return" value="<?php echo htmlspecialchars($returnUrl, ENT_QUOTES, 'UTF-8'); ?>">
                    <div class="auth-form__group">
                        <label for="login_name"><?php echo $isEn ? 'Username or email' : 'Логин или email'; ?></label>
                        <input type="text" id="login_name" name="login_name" required autocomplete="username" value="<?php echo htmlspecialchars($prefillLogin, ENT_QUOTES, 'UTF-8'); ?>"<?php echo $loginFormLocked ? ' disabled' : ''; ?>>
                    </div>
                    <div class="auth-form__group">
                        <label for="password"><?php echo $isEn ? 'Password' : 'Пароль'; ?></label>
                        <?php
                        $passwordInputId = 'password';
                        $passwordInputName = 'password';
                        $passwordInputExtra = 'required autocomplete="current-password"' . ($loginFormLocked ? ' disabled' : '');
                        require __DIR__ . '/_password_input.php';
                        ?>
                    </div>
                    <label class="auth-remember">
                        <input type="checkbox" name="remember_me" value="1"<?php echo $loginFormLocked ? ' disabled' : ''; ?>>
                        <span><?php echo $isEn ? 'Remember me' : 'Запомнить меня'; ?></span>
                    </label>
                    <button type="submit" name="login" value="1" class="auth-btn auth-btn--primary"<?php echo $loginFormLocked ? ' disabled' : ''; ?>>
                        <i class="fas fa-sign-in-alt" aria-hidden="true"></i>
                        <?php echo $isEn ? 'Log in' : 'Войти'; ?>
                    </button>
                </form>

                <div class="auth-divider"><span><?php echo $isEn ? 'or' : 'или'; ?></span></div>

                <?php
                $wgOAuthAction = 'login';
                $providersWrapperClass = 'auth-providers auth-providers--row';
                $wgOAuthReturn = $returnUrl;
                require __DIR__ . '/_game_provider_buttons.php';
                ?>

                <p class="auth-card__footer">
                    <?php if ($isEn): ?>
                    No account? <a href="<?php echo htmlspecialchars(user_auth_path('/auth/register'), ENT_QUOTES, 'UTF-8'); ?>">Register</a>
                    <?php else: ?>
                    Нет аккаунта? <a href="<?php echo htmlspecialchars(user_auth_path('/auth/register'), ENT_QUOTES, 'UTF-8'); ?>">Регистрация</a>
                    <?php endif; ?>
                </p>
            </section>
        </main>
<?php
require __DIR__ . '/../includes/site_footer.php';
?>
    <script src="/js/auth/password-toggle.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
