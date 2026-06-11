<?php
require_once __DIR__ . '/../includes/user_bootstrap.php';
require_once __DIR__ . '/../includes/lang.php';

$lang = abs_detect_lang();
$isEn = $lang === 'en';

if (user_is_logged_in()) {
    header('Location: ' . user_auth_path('/auth/profile'));
    exit();
}

$defaultReturn = user_auth_path('/auth/profile');
$returnUrl = isset($_GET['return']) ? (string) $_GET['return'] : $defaultReturn;
$returnUrl = user_validate_return_url($returnUrl, $defaultReturn);

$registerError = null;
$registerErrorHint = null;
$registerSuccess = false;
$postedUsername = '';
$postedEmail = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['register'])) {
    if (isset($_POST['return'])) {
        $returnUrl = user_validate_return_url((string) $_POST['return'], $defaultReturn);
    }

    $blockedFor = user_login_throttle_retry_after_seconds($userDb);
    if ($blockedFor !== null && $blockedFor > 0) {
        $mins = max(1, (int) ceil($blockedFor / 60));
        $registerError = $isEn
            ? 'Too many failed attempts. Try again in ' . $mins . ' min.'
            : 'Слишком много неудачных попыток. Повторите через ' . $mins . ' мин.';
    } elseif (!user_csrf_verify()) {
        $registerError = $isEn
            ? 'Session expired. Refresh the page and try again.'
            : 'Сессия устарела. Обновите страницу и попробуйте снова.';
    } else {
        $username = $_POST['username'] ?? '';
        $email = $_POST['email'] ?? '';
        $password = $_POST['password'] ?? '';
        $passwordConfirm = $_POST['password_confirm'] ?? '';
        $postedUsername = trim((string) $username);
        $postedEmail = trim((string) $email);

        if ($password !== $passwordConfirm) {
            $registerError = $isEn ? 'Passwords do not match' : 'Пароли не совпадают';
        } else {
            try {
                $result = user_register_local($userDb, (string) $username, (string) $email, (string) $password);
            } catch (Throwable $e) {
                $result = ['ok' => false, 'error' => 'Ошибка сервера'];
            }
            if (!$result['ok']) {
                $rawError = $result['error'] ?? ($isEn ? 'Registration failed' : 'Ошибка регистрации');
                $registerErrorHint = isset($result['hint']) ? (string) $result['hint'] : null;
                if ($isEn) {
                    $errorTranslations = [
                        'Логин: 3–64 символа, латиница, цифры, _ - .' => 'Username: 3–64 characters, Latin letters, digits, _ - .',
                        'Некорректный email' => 'Invalid email',
                        'Пароль не короче 8 символов' => 'Password must be at least 8 characters',
                        'Такой логин уже занят' => 'This username is already taken',
                        'Такой логин уже занят. Войдите или выберите другой логин.' => 'This username is already taken. Log in or choose another username.',
                        'Такой логин уже занят. Если это ваш аккаунт — войдите.' => 'This username is already taken. If this is your account, log in.',
                        'Этот логин привязан к Wargaming. Войдите через Wargaming API или выберите другой логин.' => 'This username is linked to Wargaming. Log in via Wargaming API or choose another username.',
                        'Такой email уже зарегистрирован' => 'This email is already registered',
                        'Такой email уже зарегистрирован. Войдите или укажите другой email.' => 'This email is already registered. Log in or use another email.',
                        'Аккаунт заблокирован' => 'Account is disabled',
                        'Ошибка сервера' => 'Server error. Please try again later.',
                        'Ошибка сохранения пользователя' => 'Could not save account. Try again or log in if you already registered.',
                    ];
                    $registerError = $errorTranslations[$rawError] ?? $rawError;
                } else {
                    $registerError = $rawError;
                }
                if (($result['error'] ?? '') === 'Ошибка сервера' || ($result['error'] ?? '') === 'Ошибка сохранения пользователя') {
                    user_login_throttle_register_failure($userDb);
                    if (($result['error'] ?? '') === 'Ошибка сохранения пользователя' && $registerErrorHint === null) {
                        $registerErrorHint = 'login';
                    }
                }
            } else {
                $rememberMe = isset($_POST['remember_me']) && $_POST['remember_me'] === '1';
                try {
                    $row = $userDb->fetchOne('SELECT id, username FROM site_users WHERE id = ?', [(int) $result['user_id']]);
                    if ($row) {
                        user_establish_session($row, $rememberMe);
                        user_login_throttle_register_success($userDb);
                        header('Location: ' . $returnUrl);
                        exit();
                    }
                } catch (Throwable $e) {
                    error_log('register session: ' . $e->getMessage());
                    $registerError = $isEn
                        ? 'Account created but sign-in failed. Try logging in.'
                        : 'Аккаунт создан, но вход не удался. Попробуйте авторизоваться.';
                    $registerErrorHint = 'login';
                }
                if ($registerError === null) {
                    $registerSuccess = true;
                }
            }
        }
    }
}

$registerThrottleRetry = user_login_throttle_retry_after_seconds($userDb);
$registerFormLocked = $registerThrottleRetry !== null && $registerThrottleRetry > 0;

$pageTitle = $isEn ? 'Register' : 'Регистрация';
$bodyClass = 'page-auth page-auth-register';
$seoSlug = 'auth/register';
require __DIR__ . '/../includes/site_header.php';
?>
        <main class="auth-page">
            <section class="auth-card">
                <h2 class="auth-card__title">
                    <i class="fas fa-user-plus" aria-hidden="true"></i>
                    <?php echo $isEn ? 'Create account' : 'Создать аккаунт'; ?>
                </h2>

                <?php if ($registerError !== null): ?>
                <p class="auth-alert auth-alert--error" role="alert">
                    <?php echo htmlspecialchars($registerError, ENT_QUOTES, 'UTF-8'); ?>
                    <?php if ($registerErrorHint === 'login'): ?>
                    <?php
                        $loginUrl = user_auth_path('/auth/login');
                        $loginQuery = ['return' => $returnUrl];
                        if ($postedUsername !== '') {
                            $loginQuery['login'] = $postedUsername;
                        }
                        $loginUrl .= '?' . http_build_query($loginQuery);
                    ?>
                    <a class="auth-alert__link" href="<?php echo htmlspecialchars($loginUrl, ENT_QUOTES, 'UTF-8'); ?>">
                        <?php echo $isEn ? 'Log in' : 'Войти'; ?>
                    </a>
                    <?php endif; ?>
                </p>
                <?php elseif ($registerFormLocked): ?>
                <?php $lockM = max(1, (int) ceil($registerThrottleRetry / 60)); ?>
                <p class="auth-alert auth-alert--warning" role="alert">
                    <?php echo $isEn
                        ? 'Registration temporarily locked. Try again in ' . (int) $lockM . ' min.'
                        : 'Регистрация временно заблокирована. Повторите через ' . (int) $lockM . ' мин.'; ?>
                </p>
                <?php elseif ($registerSuccess): ?>
                <p class="auth-alert auth-alert--success" role="status">
                    <?php echo $isEn ? 'Account created. You can log in now.' : 'Аккаунт создан. Теперь можно войти.'; ?>
                </p>
                <?php endif; ?>

                <form class="auth-form" id="registerForm" method="post" action="<?php echo htmlspecialchars(user_auth_path('/auth/register'), ENT_QUOTES, 'UTF-8'); ?>">
                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars(user_csrf_token(), ENT_QUOTES, 'UTF-8'); ?>">
                    <input type="hidden" name="return" value="<?php echo htmlspecialchars($returnUrl, ENT_QUOTES, 'UTF-8'); ?>">
                    <div class="auth-form__group">
                        <label for="username"><?php echo $isEn ? 'Username' : 'Логин'; ?></label>
                        <input type="text" id="username" name="username" required autocomplete="username" pattern="[A-Za-z0-9_\-\.]{3,64}" value="<?php echo htmlspecialchars($postedUsername, ENT_QUOTES, 'UTF-8'); ?>"<?php echo $registerFormLocked ? ' disabled' : ''; ?>>
                    </div>
                    <div class="auth-form__group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" required autocomplete="email" value="<?php echo htmlspecialchars($postedEmail, ENT_QUOTES, 'UTF-8'); ?>"<?php echo $registerFormLocked ? ' disabled' : ''; ?>>
                    </div>
                    <div class="auth-form__group">
                        <label for="password"><?php echo $isEn ? 'Password' : 'Пароль'; ?></label>
                        <?php
                        $passwordInputId = 'password';
                        $passwordInputName = 'password';
                        $passwordInputExtra = 'required autocomplete="new-password" minlength="8"' . ($registerFormLocked ? ' disabled' : '');
                        require __DIR__ . '/_password_input.php';
                        ?>
                    </div>
                    <div class="auth-form__group">
                        <label for="password_confirm"><?php echo $isEn ? 'Confirm password' : 'Подтверждение пароля'; ?></label>
                        <input
                            type="password"
                            id="password_confirm"
                            name="password_confirm"
                            required
                            autocomplete="new-password"
                            minlength="8"
                            <?php echo $registerFormLocked ? 'disabled' : ''; ?>
                        >
                        <p class="auth-password-match" id="passwordMatchHint" hidden role="status"></p>
                    </div>
                    <label class="auth-remember">
                        <input type="checkbox" name="remember_me" value="1"<?php echo $registerFormLocked ? ' disabled' : ''; ?>>
                        <span><?php echo $isEn ? 'Remember me' : 'Запомнить меня'; ?></span>
                    </label>
                    <button type="submit" name="register" value="1" class="auth-btn auth-btn--primary"<?php echo $registerFormLocked ? ' disabled' : ''; ?>>
                        <i class="fas fa-user-plus" aria-hidden="true"></i>
                        <?php echo $isEn ? 'Register' : 'Зарегистрироваться'; ?>
                    </button>
                </form>

                <p class="auth-card__footer">
                    <?php if ($isEn): ?>
                    Already have an account? <a href="<?php echo htmlspecialchars(user_auth_path('/auth/login'), ENT_QUOTES, 'UTF-8'); ?>">Log in</a>
                    <?php else: ?>
                    Уже есть аккаунт? <a href="<?php echo htmlspecialchars(user_auth_path('/auth/login'), ENT_QUOTES, 'UTF-8'); ?>">Авторизация</a>
                    <?php endif; ?>
                </p>
            </section>
        </main>
<?php
require __DIR__ . '/../includes/site_footer.php';
?>
    <script src="/js/auth/password-toggle.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/auth/register-form.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
