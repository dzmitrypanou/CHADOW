<?php

const USER_SESSION_REMEMBER_LIFETIME_SEC = 60 * 60 * 24 * 30;

function user_request_is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
}

function user_absolute_url(string $path): string {
    $path = '/' . ltrim($path, '/');
    $scheme = user_request_is_https() ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return $scheme . '://' . $host . $path;
}

function user_lang_prefix(): string {
    if (!function_exists('abs_detect_lang')) {
        require_once __DIR__ . '/lang.php';
    }
    return abs_detect_lang() === 'en' ? '/en' : '';
}

function user_auth_path(string $suffix): string {
    $suffix = '/' . ltrim($suffix, '/');
    return user_lang_prefix() . $suffix;
}

function user_api_path(string $suffix): string {
    return '/' . ltrim($suffix, '/');
}

function user_validate_return_url(string $url, string $default = '/'): string {
    if ($url === '' || strpos($url, '/') !== 0 || strpos($url, '//') !== false) {
        return $default;
    }
    return $url;
}

function user_session_send_cookie(int $expiresUnix): void {
    $secure = user_request_is_https();
    $name = session_name();
    $sid = session_id();
    if (PHP_VERSION_ID >= 70300) {
        setcookie($name, $sid, [
            'expires' => $expiresUnix,
            'path' => '/',
            'domain' => '',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    } else {
        setcookie($name, $sid, $expiresUnix, '/', '', $secure, true);
    }
}

function site_user() {
    if (empty($_SESSION['site_user_id'])) {
        return null;
    }
    return [
        'id' => (int) $_SESSION['site_user_id'],
        'username' => (string) ($_SESSION['site_username'] ?? ''),
    ];
}

function user_is_logged_in(): bool {
    return site_user() !== null;
}

function user_current_id(): ?int {
    $user = site_user();
    return $user ? $user['id'] : null;
}

function user_require_web(): void {
    if (!user_is_logged_in()) {
        $path = $_SERVER['REQUEST_URI'] ?? '/auth/profile';
        if (preg_match('#^/en/auth/login#', $path) || preg_match('#^/auth/login#', $path)) {
            $return = user_auth_path('/auth/profile');
        } else {
            $return = $path;
        }
        header('Location: ' . user_auth_path('/auth/login') . '?return=' . rawurlencode($return));
        exit();
    }
}

function user_require_ajax(): void {
    if (!user_is_logged_in()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Не авторизован'], JSON_UNESCAPED_UNICODE);
        exit();
    }
}

function user_is_active($db): bool {
    $userId = user_current_id();
    if ($userId === null) {
        return false;
    }
    $row = $db->fetchOne(
        'SELECT is_active FROM site_users WHERE id = ?',
        [$userId]
    );
    return $row && (int) $row['is_active'] === 1;
}

function user_require_active($db): void {
    if (!user_is_active($db)) {
        user_logout();
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Аккаунт отключён'], JSON_UNESCAPED_UNICODE);
        exit();
    }
}

function user_require_active_web($db): void {
    if (!user_is_active($db)) {
        user_logout();
        header('Location: ' . user_auth_path('/auth/login'));
        exit();
    }
}

function user_validate_username(string $username): bool {
    return $username !== '' && preg_match('/^[a-zA-Z0-9_\-\.]{3,64}$/u', $username) === 1;
}

function user_normalize_login(string $login): string {
    $login = trim($login);
    if ($login !== '' && strpos($login, '@') === false) {
        $login = strtolower($login);
    }
    return $login;
}

function user_validate_email(string $email): bool {
    return $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false && strlen($email) <= 255;
}

function user_validate_password(string $password): bool {
    return strlen($password) >= 8;
}

function user_login_row($db, int $userId): ?array {
    $sql = 'SELECT id, username, email, auth_provider, wg_account_id, wg_nickname, wg_realm,
                    lesta_account_id, lesta_nickname,
                    game_nickname_ru, game_nickname_eu, game_nickname_na, game_nickname_asia,
                    email_verified, is_active, created_at, updated_at
             FROM site_users WHERE id = ?';

    try {
        $row = $db->fetchOne($sql, [$userId]);
    } catch (Throwable $e) {
        if (function_exists('ensure_site_users_table')) {
            ensure_site_users_table($db);
            try {
                $row = $db->fetchOne($sql, [$userId]);
            } catch (Throwable $retryError) {
                error_log('user_login_row: ' . $retryError->getMessage());
                return null;
            }
        } else {
            error_log('user_login_row: ' . $e->getMessage());
            return null;
        }
    }
    return is_array($row) ? $row : null;
}

function user_establish_session(array $row, bool $rememberMe = false): void {
    session_regenerate_id(true);
    $_SESSION['site_user_id'] = (int) $row['id'];
    $_SESSION['site_username'] = (string) $row['username'];
    $_SESSION['site_remember_me'] = $rememberMe ? 1 : 0;
    $cookieExpires = $rememberMe ? time() + USER_SESSION_REMEMBER_LIFETIME_SEC : 0;
    user_session_send_cookie($cookieExpires);
    session_write_close();
}

function user_attempt_login($db, $login, $password, $rememberMe = false) {
    $login = user_normalize_login((string) $login);
    if ($login === '' || $password === '') {
        return false;
    }

    try {
        $row = $db->fetchOne(
            'SELECT id, username, password_hash, is_active, auth_provider
             FROM site_users
             WHERE (username = ? OR email = ?) AND auth_provider = ?',
            [$login, $login, 'local']
        );
    } catch (Throwable $e) {
        return false;
    }

    if (!$row || !(int) $row['is_active']) {
        return false;
    }
    $hash = $row['password_hash'] ?? '';
    if (!is_string($hash) || $hash === '' || !password_verify($password, $hash)) {
        return false;
    }

    user_establish_session($row, (bool) $rememberMe);
    user_login_throttle_register_success($db);
    return true;
}

function user_register_local($db, string $username, string $email, string $password): array {
    $username = strtolower(trim($username));
    $email = trim(strtolower($email));

    if (!user_validate_username($username)) {
        return ['ok' => false, 'error' => 'Логин: 3–64 символа, латиница, цифры, _ - .'];
    }
    if (!user_validate_email($email)) {
        return ['ok' => false, 'error' => 'Некорректный email'];
    }
    if (!user_validate_password($password)) {
        return ['ok' => false, 'error' => 'Пароль не короче 8 символов'];
    }

    ensure_site_users_table($db);

    if (!site_users_schema_ready($db->getConnection())) {
        ensure_site_users_table($db);
        if (!site_users_schema_ready($db->getConnection())) {
            return ['ok' => false, 'error' => 'Ошибка сохранения пользователя'];
        }
    }

    try {
        return user_register_local_execute($db, $username, $email, $password);
    } catch (Throwable $e) {
        error_log('user_register_local: ' . $e->getMessage());
        ensure_site_users_table($db);
        try {
            return user_register_local_execute($db, $username, $email, $password);
        } catch (Throwable $e2) {
            error_log('user_register_local retry: ' . $e2->getMessage());
            return ['ok' => false, 'error' => 'Ошибка сохранения пользователя'];
        }
    }
}

function user_fetch_by_username($db, string $username): ?array {
    try {
        $row = $db->fetchOne(
            'SELECT id, email, password_hash, auth_provider, is_active FROM site_users WHERE username = ?',
            [$username]
        );
        return is_array($row) ? $row : null;
    } catch (Throwable $e) {
        try {
            $row = $db->fetchOne(
                'SELECT id, email, password_hash FROM site_users WHERE username = ?',
                [$username]
            );
            if (!is_array($row)) {
                return null;
            }
            $row['auth_provider'] = 'local';
            $row['is_active'] = 1;
            return $row;
        } catch (Throwable $e2) {
            throw $e;
        }
    }
}

function user_fetch_by_email($db, string $email): ?array {
    try {
        $row = $db->fetchOne(
            'SELECT id, password_hash, auth_provider, is_active FROM site_users WHERE email = ?',
            [$email]
        );
        return is_array($row) ? $row : null;
    } catch (Throwable $e) {
        try {
            $row = $db->fetchOne(
                'SELECT id, password_hash FROM site_users WHERE email = ?',
                [$email]
            );
            if (!is_array($row)) {
                return null;
            }
            $row['auth_provider'] = 'local';
            $row['is_active'] = 1;
            return $row;
        } catch (Throwable $e2) {
            throw $e;
        }
    }
}

function user_register_local_execute($db, string $username, string $email, string $password): array {
    $dup = user_fetch_by_username($db, $username);
    if ($dup) {
        $provider = (string) ($dup['auth_provider'] ?? 'local');
        if ($provider === 'local' && strtolower((string) ($dup['email'] ?? '')) === $email) {
            $hash = $dup['password_hash'] ?? '';
            if (is_string($hash) && $hash !== '' && password_verify($password, $hash)) {
                if (!(int) ($dup['is_active'] ?? 1)) {
                    return ['ok' => false, 'error' => 'Аккаунт заблокирован'];
                }
                return ['ok' => true, 'user_id' => (int) $dup['id']];
            }
            return ['ok' => false, 'error' => 'Такой логин уже занят. Войдите или выберите другой логин.', 'hint' => 'login'];
        }
        if ($provider === 'wg') {
            return ['ok' => false, 'error' => 'Этот логин привязан к Wargaming. Войдите через Wargaming API или выберите другой логин.', 'hint' => 'wg'];
        }
        return ['ok' => false, 'error' => 'Такой логин уже занят. Если это ваш аккаунт — войдите.', 'hint' => 'login'];
    }
    $dup = user_fetch_by_email($db, $email);
    if ($dup) {
        $provider = (string) ($dup['auth_provider'] ?? 'local');
        if ($provider === 'local') {
            $hash = $dup['password_hash'] ?? '';
            if (is_string($hash) && $hash !== '' && password_verify($password, $hash)) {
                if (!(int) ($dup['is_active'] ?? 1)) {
                    return ['ok' => false, 'error' => 'Аккаунт заблокирован'];
                }
                return ['ok' => true, 'user_id' => (int) $dup['id']];
            }
        }
        return ['ok' => false, 'error' => 'Такой email уже зарегистрирован. Войдите или укажите другой email.', 'hint' => 'login'];
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    try {
        $userId = (int) $db->insert(
            'INSERT INTO site_users (username, email, password_hash, auth_provider, is_active) VALUES (?, ?, ?, ?, 1)',
            [$username, $email, $hash, 'local']
        );
    } catch (Throwable $e) {
        $msg = $e->getMessage();
        if (stripos($msg, 'Duplicate') !== false || stripos($msg, '1062') !== false) {
            if (stripos($msg, 'username') !== false) {
                return ['ok' => false, 'error' => 'Такой логин уже занят. Если это ваш аккаунт — войдите.', 'hint' => 'login'];
            }
            if (stripos($msg, 'email') !== false) {
                return ['ok' => false, 'error' => 'Такой email уже зарегистрирован. Войдите или укажите другой email.', 'hint' => 'login'];
            }
        }
        error_log('user_register_local insert: ' . $msg);
        throw $e;
    }

    if ($userId <= 0) {
        return ['ok' => false, 'error' => 'Ошибка сохранения пользователя'];
    }

    return ['ok' => true, 'user_id' => $userId];
}

function user_make_wg_username(int $accountId, string $realm, ?string $nickname): string {
    if (is_string($nickname) && $nickname !== '') {
        $slug = strtolower(trim($nickname));
        $slug = preg_replace('/[^a-z0-9_\-\.]+/u', '_', $slug) ?? '';
        $slug = trim($slug, '._-');
        if ($slug !== '' && user_validate_username($slug)) {
            return $slug;
        }
    }
    return 'wg_' . $realm . '_' . $accountId;
}

function user_make_unique_username($db, string $base): string {
    $base = trim($base);
    if ($base === '' || !user_validate_username($base)) {
        $base = 'user_' . bin2hex(random_bytes(4));
    }
    $candidate = $base;
    $suffix = 1;
    while ($db->fetchOne('SELECT id FROM site_users WHERE username = ?', [$candidate])) {
        $suffix++;
        $candidate = $base . '_' . $suffix;
        if (strlen($candidate) > 64) {
            $candidate = substr($base, 0, 50) . '_' . $suffix;
        }
    }
    return $candidate;
}

function user_make_wg_email(int $accountId, string $realm): string {
    return 'wg.' . $realm . '.' . $accountId . '@wg.chadow.local';
}

function user_normalize_wg_realm(?string $realm): string {
    $realm = strtolower(trim((string) $realm));
    return in_array($realm, ['ru', 'eu', 'na', 'asia'], true) ? $realm : 'eu';
}

function user_lesta_is_linked(array $profile): bool {
    if ((int) ($profile['lesta_account_id'] ?? 0) > 0) {
        return true;
    }

    return ($profile['auth_provider'] ?? '') === 'local'
        && (int) ($profile['wg_account_id'] ?? 0) > 0
        && user_normalize_wg_realm((string) ($profile['wg_realm'] ?? '')) === 'ru';
}

function user_wg_api_is_linked(array $profile): bool {
    if ((int) ($profile['wg_account_id'] ?? 0) <= 0) {
        return false;
    }

    return user_normalize_wg_realm((string) ($profile['wg_realm'] ?? '')) !== 'ru';
}

function user_wg_is_linked(array $profile): bool {
    return user_wg_api_is_linked($profile) || user_lesta_is_linked($profile);
}

function user_wg_provider_label(string $realm, string $lang = 'ru'): string {
    $realm = user_normalize_wg_realm($realm);
    if ($realm === 'ru') {
        if (!function_exists('game_api_ru_publisher_name')) {
            require_once __DIR__ . '/game_api.php';
        }

        return game_api_ru_publisher_name($lang);
    }

    return 'Wargaming';
}

function user_game_nickname_realms(): array {
    return ['ru', 'eu', 'na', 'asia'];
}

function user_game_nickname_column(string $realm): ?string {
    switch (user_normalize_wg_realm($realm)) {
        case 'ru':
            return 'game_nickname_ru';
        case 'eu':
            return 'game_nickname_eu';
        case 'na':
            return 'game_nickname_na';
        case 'asia':
            return 'game_nickname_asia';
        default:
            return null;
    }
}

function user_validate_game_nickname(string $nickname): bool {
    $nickname = trim($nickname);
    if ($nickname === '') {
        return true;
    }
    if (mb_strlen($nickname) > 24) {
        return false;
    }
    return preg_match('/^[a-zA-Z0-9_\-]+$/u', $nickname) === 1;
}

function user_normalize_game_nickname(?string $nickname): ?string {
    if (!is_string($nickname)) {
        return null;
    }
    $nickname = trim($nickname);
    if ($nickname === '') {
        return null;
    }
    return mb_substr($nickname, 0, 64);
}

function user_wg_api_locked_realm(array $profile): ?string {
    if (user_wg_api_is_linked($profile)) {
        return user_normalize_wg_realm((string) ($profile['wg_realm'] ?? ''));
    }

    return null;
}

function user_lesta_api_locked_realm(array $profile): ?string {
    return user_lesta_is_linked($profile) ? 'ru' : null;
}

function user_game_nicknames_state(array $profile): array {
    $wgLockedRealm = user_wg_api_locked_realm($profile);
    $lestaLocked = user_lesta_is_linked($profile);
    $wgNick = trim((string) ($profile['wg_nickname'] ?? ''));
    $lestaNick = trim((string) ($profile['lesta_nickname'] ?? ''));
    if ($lestaNick === '' && $lestaLocked && user_normalize_wg_realm((string) ($profile['wg_realm'] ?? '')) === 'ru') {
        $lestaNick = $wgNick;
    }
    $wgAccountId = (int) ($profile['wg_account_id'] ?? 0);
    $lestaAccountId = (int) ($profile['lesta_account_id'] ?? 0);
    if ($lestaAccountId <= 0 && $lestaLocked && $wgAccountId > 0 && user_normalize_wg_realm((string) ($profile['wg_realm'] ?? '')) === 'ru') {
        $lestaAccountId = $wgAccountId;
    }
    $state = [];

    foreach (user_game_nickname_realms() as $realm) {
        $manual = trim((string) ($profile['game_nickname_' . $realm] ?? ''));
        $locked = ($realm === 'ru' && $lestaLocked) || ($wgLockedRealm !== null && $wgLockedRealm === $realm);
        if ($locked) {
            if ($realm === 'ru') {
                if ($lestaNick !== '') {
                    $value = $lestaNick;
                } elseif ($lestaAccountId > 0) {
                    $value = '#' . $lestaAccountId;
                } else {
                    $value = $manual;
                }
            } elseif ($wgNick !== '') {
                $value = $wgNick;
            } elseif ($wgAccountId > 0) {
                $value = '#' . $wgAccountId;
            } else {
                $value = $manual;
            }
        } else {
            $value = $manual;
        }
        $state[$realm] = [
            'value' => $value,
            'locked' => $locked,
        ];
    }

    return $state;
}

function user_set_game_nickname_for_realm($db, int $userId, string $realm, ?string $nickname): void {
    if (function_exists('ensure_site_users_table')) {
        ensure_site_users_table($db);
    }
    $column = user_game_nickname_column($realm);
    if ($column === null) {
        return;
    }
    $nickname = user_normalize_game_nickname($nickname);
    $db->update(
        'UPDATE site_users SET ' . $column . ' = ? WHERE id = ?',
        [$nickname, $userId]
    );
}

function user_update_game_nicknames($db, int $userId, array $input, string $lang = 'ru'): array {
    $isEn = $lang === 'en';
    $profile = user_login_row($db, $userId);
    if (!$profile) {
        return ['ok' => false, 'error' => $isEn ? 'Account not found.' : 'Аккаунт не найден.'];
    }

    $wgLockedRealm = user_wg_api_locked_realm($profile);
    $lestaLocked = user_lesta_is_linked($profile);
    $updates = [];

    foreach (user_game_nickname_realms() as $realm) {
        if (($realm === 'ru' && $lestaLocked) || $wgLockedRealm === $realm) {
            continue;
        }
        if (!array_key_exists('game_nickname_' . $realm, $input)) {
            continue;
        }
        $raw = trim((string) $input['game_nickname_' . $realm]);
        if ($raw !== '' && !user_validate_game_nickname($raw)) {
            return [
                'ok' => false,
                'error' => $isEn
                    ? 'Game nickname: up to 24 characters, Latin letters, digits, _ -'
                    : 'Игровой ник: до 24 символов, латиница, цифры, _ -',
            ];
        }
        $updates[$realm] = user_normalize_game_nickname($raw);
    }

    if ($updates === []) {
        return [
            'ok' => true,
            'message' => $isEn ? 'Settings saved.' : 'Настройки сохранены.',
            'profile' => $profile,
        ];
    }

    try {
        foreach ($updates as $realm => $nickname) {
            user_set_game_nickname_for_realm($db, $userId, $realm, $nickname);
        }
        $updated = user_login_row($db, $userId);
        return [
            'ok' => true,
            'message' => $isEn ? 'Settings saved.' : 'Настройки сохранены.',
            'profile' => is_array($updated) ? $updated : $profile,
        ];
    } catch (Throwable $e) {
        error_log('user_update_game_nicknames: ' . $e->getMessage());
        return ['ok' => false, 'error' => $isEn ? 'Could not save nicknames.' : 'Не удалось сохранить ники.'];
    }
}

function user_link_wg_account($db, int $userId, int $accountId, string $realm, ?string $nickname, string $lang = 'ru'): array {
    $isEn = $lang === 'en';
    $realm = user_normalize_wg_realm($realm);
    if ($accountId <= 0) {
        return ['ok' => false, 'error' => $isEn ? 'Invalid game account.' : 'Некорректный игровой аккаунт.'];
    }

    $profile = user_login_row($db, $userId);
    if (!$profile) {
        return ['ok' => false, 'error' => $isEn ? 'Account not found.' : 'Аккаунт не найден.'];
    }
    if (($profile['auth_provider'] ?? '') !== 'local') {
        return [
            'ok' => false,
            'error' => $isEn ? 'Linking is only available for email accounts.' : 'Привязка доступна только для аккаунтов с email.',
        ];
    }
    if (user_wg_api_is_linked($profile)) {
        return [
            'ok' => false,
            'error' => $isEn ? 'A Wargaming account is already linked. Unlink it first.' : 'Аккаунт Wargaming уже привязан. Сначала отвяжите его.',
        ];
    }
    if ($realm === 'ru') {
        if (!function_exists('game_api_ru_api_label')) {
            require_once __DIR__ . '/game_api.php';
        }

        return [
            'ok' => false,
            'error' => $isEn
                ? ('Use ' . game_api_ru_api_label('en') . ' for the RU region.')
                : ('Для региона RU используйте ' . game_api_ru_api_label('ru') . '.'),
        ];
    }

    $existing = $db->fetchOne(
        'SELECT id FROM site_users WHERE wg_account_id = ? AND wg_realm = ?',
        [$accountId, $realm]
    );
    if ($existing && (int) $existing['id'] !== $userId) {
        return [
            'ok' => false,
            'error' => $isEn
                ? 'This game account is already linked to another site account.'
                : 'Этот игровой аккаунт уже привязан к другому аккаунту на сайте.',
        ];
    }

    $wgNick = is_string($nickname) && trim($nickname) !== ''
        ? mb_substr(trim($nickname), 0, 64)
        : null;

    try {
        $db->update(
            'UPDATE site_users SET wg_account_id = ?, wg_nickname = ?, wg_realm = ? WHERE id = ? AND auth_provider = ?',
            [$accountId, $wgNick, $realm, $userId, 'local']
        );
        if ($wgNick !== null) {
            user_set_game_nickname_for_realm($db, $userId, $realm, $wgNick);
        }
        $provider = user_wg_provider_label($realm, $lang);
        return [
            'ok' => true,
            'message' => $isEn
                ? $provider . ' account linked.'
                : 'Аккаунт ' . $provider . ' привязан.',
        ];
    } catch (Throwable $e) {
        error_log('user_link_wg_account: ' . $e->getMessage());
        return ['ok' => false, 'error' => $isEn ? 'Could not link account.' : 'Не удалось привязать аккаунт.'];
    }
}

function user_link_lesta_account($db, int $userId, int $accountId, ?string $nickname, string $lang = 'ru'): array {
    $isEn = $lang === 'en';
    if ($accountId <= 0) {
        return ['ok' => false, 'error' => $isEn ? 'Invalid game account.' : 'Некорректный игровой аккаунт.'];
    }

    $profile = user_login_row($db, $userId);
    if (!$profile) {
        return ['ok' => false, 'error' => $isEn ? 'Account not found.' : 'Аккаунт не найден.'];
    }
    if (($profile['auth_provider'] ?? '') !== 'local') {
        return [
            'ok' => false,
            'error' => $isEn ? 'Linking is only available for email accounts.' : 'Привязка доступна только для аккаунтов с email.',
        ];
    }
    if (user_lesta_is_linked($profile)) {
        if (!function_exists('game_api_ru_publisher_name')) {
            require_once __DIR__ . '/game_api.php';
        }
        $publisher = game_api_ru_publisher_name($lang);

        return [
            'ok' => false,
            'error' => $isEn
                ? ('An ' . $publisher . ' account is already linked. Unlink it first.')
                : ('Аккаунт ' . $publisher . ' уже привязан. Сначала отвяжите его.'),
        ];
    }

    $existing = $db->fetchOne(
        'SELECT id FROM site_users WHERE lesta_account_id = ?',
        [$accountId]
    );
    if ($existing && (int) $existing['id'] !== $userId) {
        return [
            'ok' => false,
            'error' => $isEn
                ? 'This game account is already linked to another site account.'
                : 'Этот игровой аккаунт уже привязан к другому аккаунту на сайте.',
        ];
    }

    $lestaNick = is_string($nickname) && trim($nickname) !== ''
        ? mb_substr(trim($nickname), 0, 64)
        : null;

    try {
        $db->update(
            'UPDATE site_users SET lesta_account_id = ?, lesta_nickname = ? WHERE id = ? AND auth_provider = ?',
            [$accountId, $lestaNick, $userId, 'local']
        );
        if ($lestaNick !== null) {
            user_set_game_nickname_for_realm($db, $userId, 'ru', $lestaNick);
        }
        if (!function_exists('game_api_ru_publisher_name')) {
            require_once __DIR__ . '/game_api.php';
        }
        $publisher = game_api_ru_publisher_name($lang);

        return [
            'ok' => true,
            'message' => $isEn
                ? ($publisher . ' nickname linked.')
                : ('Ник ' . $publisher . ' привязан.'),
        ];
    } catch (Throwable $e) {
        error_log('user_link_lesta_account: ' . $e->getMessage());
        return ['ok' => false, 'error' => $isEn ? 'Could not link account.' : 'Не удалось привязать аккаунт.'];
    }
}

function user_unlink_wg_account($db, int $userId, string $lang = 'ru'): array {
    $isEn = $lang === 'en';
    $profile = user_login_row($db, $userId);
    if (!$profile) {
        return ['ok' => false, 'error' => $isEn ? 'Account not found.' : 'Аккаунт не найден.'];
    }
    if (($profile['auth_provider'] ?? '') !== 'local') {
        return [
            'ok' => false,
            'error' => $isEn ? 'Unlinking is only available for email accounts.' : 'Отвязка доступна только для аккаунтов с email.',
        ];
    }
    if (!user_wg_api_is_linked($profile)) {
        return [
            'ok' => false,
            'error' => $isEn ? 'No Wargaming account is linked.' : 'Аккаунт Wargaming не привязан.',
        ];
    }

    try {
        $realm = user_normalize_wg_realm((string) ($profile['wg_realm'] ?? ''));
        $wgNick = trim((string) ($profile['wg_nickname'] ?? ''));
        if ($wgNick !== '') {
            $manual = trim((string) ($profile['game_nickname_' . $realm] ?? ''));
            if ($manual === '') {
                user_set_game_nickname_for_realm($db, $userId, $realm, $wgNick);
            }
        }

        $db->update(
            'UPDATE site_users SET wg_account_id = NULL, wg_nickname = NULL, wg_realm = NULL WHERE id = ? AND auth_provider = ?',
            [$userId, 'local']
        );
        return [
            'ok' => true,
            'message' => $isEn ? 'Wargaming nickname unlinked.' : 'Ник Wargaming отвязан.',
        ];
    } catch (Throwable $e) {
        error_log('user_unlink_wg_account: ' . $e->getMessage());
        return ['ok' => false, 'error' => $isEn ? 'Could not unlink account.' : 'Не удалось отвязать аккаунт.'];
    }
}

function user_unlink_lesta_account($db, int $userId, string $lang = 'ru'): array {
    $isEn = $lang === 'en';
    $profile = user_login_row($db, $userId);
    if (!$profile) {
        return ['ok' => false, 'error' => $isEn ? 'Account not found.' : 'Аккаунт не найден.'];
    }
    if (($profile['auth_provider'] ?? '') !== 'local') {
        return [
            'ok' => false,
            'error' => $isEn ? 'Unlinking is only available for email accounts.' : 'Отвязка доступна только для аккаунтов с email.',
        ];
    }
    if (!user_lesta_is_linked($profile)) {
        if (!function_exists('game_api_ru_publisher_name')) {
            require_once __DIR__ . '/game_api.php';
        }
        $publisher = game_api_ru_publisher_name($lang);

        return [
            'ok' => false,
            'error' => $isEn
                ? ('No ' . $publisher . ' account is linked.')
                : ('Аккаунт ' . $publisher . ' не привязан.'),
        ];
    }

    try {
        $lestaNick = trim((string) ($profile['lesta_nickname'] ?? ''));
        if ($lestaNick === '' && user_normalize_wg_realm((string) ($profile['wg_realm'] ?? '')) === 'ru') {
            $lestaNick = trim((string) ($profile['wg_nickname'] ?? ''));
        }
        if ($lestaNick !== '') {
            $manual = trim((string) ($profile['game_nickname_ru'] ?? ''));
            if ($manual === '') {
                user_set_game_nickname_for_realm($db, $userId, 'ru', $lestaNick);
            }
        }

        $db->update(
            'UPDATE site_users SET lesta_account_id = NULL, lesta_nickname = NULL WHERE id = ? AND auth_provider = ?',
            [$userId, 'local']
        );

        if ((int) ($profile['wg_account_id'] ?? 0) > 0 && user_normalize_wg_realm((string) ($profile['wg_realm'] ?? '')) === 'ru') {
            $db->update(
                'UPDATE site_users SET wg_account_id = NULL, wg_nickname = NULL, wg_realm = NULL WHERE id = ? AND auth_provider = ?',
                [$userId, 'local']
            );
        }

        if (!function_exists('game_api_ru_publisher_name')) {
            require_once __DIR__ . '/game_api.php';
        }
        $publisher = game_api_ru_publisher_name($lang);

        return [
            'ok' => true,
            'message' => $isEn
                ? ($publisher . ' nickname unlinked.')
                : ('Ник ' . $publisher . ' отвязан.'),
        ];
    } catch (Throwable $e) {
        error_log('user_unlink_lesta_account: ' . $e->getMessage());
        return ['ok' => false, 'error' => $isEn ? 'Could not unlink account.' : 'Не удалось отвязать аккаунт.'];
    }
}

function user_unlink_game_api_account($db, int $userId, string $provider, string $lang = 'ru'): array {
    $provider = strtolower(trim($provider));
    if ($provider === 'lesta') {
        return user_unlink_lesta_account($db, $userId, $lang);
    }

    return user_unlink_wg_account($db, $userId, $lang);
}

function user_find_by_linked_game_account($db, int $accountId, string $realm): ?array {
    $realm = user_normalize_wg_realm($realm);
    if ($accountId <= 0) {
        return null;
    }

    if ($realm === 'ru') {
        $byLesta = $db->fetchOne(
            'SELECT id, username, is_active FROM site_users WHERE lesta_account_id = ? LIMIT 1',
            [$accountId]
        );
        if (is_array($byLesta)) {
            return $byLesta;
        }
    }

    $row = $db->fetchOne(
        'SELECT id, username, is_active FROM site_users WHERE wg_account_id = ? AND wg_realm = ? LIMIT 1',
        [$accountId, $realm]
    );

    return is_array($row) ? $row : null;
}

function user_login_or_register_wg($db, int $accountId, string $realm, ?string $nickname, bool $rememberMe = false, string $lang = 'ru'): array {
    $isEn = $lang === 'en';
    $realm = user_normalize_wg_realm($realm);
    if ($accountId <= 0) {
        return ['ok' => false, 'error' => $isEn ? 'Invalid game account.' : 'Некорректный account_id'];
    }

    $existing = user_find_by_linked_game_account($db, $accountId, $realm);
    if (!$existing) {
        $provider = user_wg_provider_label($realm, $lang);
        return [
            'ok' => false,
            'error' => $isEn
                ? 'Access denied! Register first, then link ' . $provider . ' API in your profile.'
                : 'В доступе отказано! Сначала зарегистрируйтесь и привяжите ' . $provider . ' API в профиле.',
        ];
    }

    if (!(int) $existing['is_active']) {
        return ['ok' => false, 'error' => $isEn ? 'Account is disabled.' : 'Аккаунт отключён'];
    }

    user_establish_session($existing, $rememberMe);
    if (is_string($nickname) && trim($nickname) !== '') {
        $gameNick = mb_substr(trim($nickname), 0, 64);
        if ($realm === 'ru') {
            $db->query(
                'UPDATE site_users SET lesta_nickname = ? WHERE id = ?',
                [$gameNick, (int) $existing['id']]
            );
        } else {
            $db->query(
                'UPDATE site_users SET wg_nickname = ? WHERE id = ?',
                [$gameNick, (int) $existing['id']]
            );
        }
        user_set_game_nickname_for_realm($db, (int) $existing['id'], $realm, $gameNick);
    }
    user_login_throttle_register_success($db);
    return ['ok' => true, 'user_id' => (int) $existing['id']];
}

function user_update_local_profile($db, int $userId, string $username, string $email, string $lang = 'ru'): array {
    $isEn = $lang === 'en';
    $profile = user_login_row($db, $userId);
    if (!$profile) {
        return ['ok' => false, 'error' => $isEn ? 'Account not found.' : 'Аккаунт не найден.'];
    }
    if (($profile['auth_provider'] ?? '') !== 'local') {
        return [
            'ok' => false,
            'error' => $isEn
                ? 'Profile details for this sign-in method cannot be edited here.'
                : 'Для этого способа входа редактирование недоступно.',
        ];
    }

    $username = strtolower(trim($username));
    $email = trim(strtolower($email));

    if (!user_validate_username($username)) {
        return [
            'ok' => false,
            'error' => $isEn
                ? 'Username: 3–64 characters, Latin letters, digits, _ - .'
                : 'Логин: 3–64 символа, латиница, цифры, _ - .',
        ];
    }
    if (!user_validate_email($email)) {
        return ['ok' => false, 'error' => $isEn ? 'Invalid email.' : 'Некорректный email.'];
    }

    $currentUsername = strtolower(trim((string) $profile['username']));
    $currentEmail = strtolower(trim((string) $profile['email']));

    if ($username !== $currentUsername) {
        $dup = user_fetch_by_username($db, $username);
        if ($dup && (int) $dup['id'] !== $userId) {
            return ['ok' => false, 'error' => $isEn ? 'This username is already taken.' : 'Такой логин уже занят.'];
        }
    }
    if ($email !== $currentEmail) {
        $dup = user_fetch_by_email($db, $email);
        if ($dup && (int) $dup['id'] !== $userId) {
            return ['ok' => false, 'error' => $isEn ? 'This email is already registered.' : 'Такой email уже зарегистрирован.'];
        }
    }

    if ($username === $currentUsername && $email === $currentEmail) {
        return [
            'ok' => true,
            'message' => $isEn ? 'Settings saved.' : 'Настройки сохранены.',
            'profile' => $profile,
        ];
    }

    try {
        $db->update(
            'UPDATE site_users SET username = ?, email = ? WHERE id = ? AND auth_provider = ?',
            [$username, $email, $userId, 'local']
        );
        $_SESSION['site_username'] = $username;
        $updated = user_login_row($db, $userId);
        return [
            'ok' => true,
            'message' => $isEn ? 'Settings saved.' : 'Настройки сохранены.',
            'profile' => is_array($updated) ? $updated : $profile,
        ];
    } catch (Throwable $e) {
        error_log('user_update_local_profile: ' . $e->getMessage());
        return ['ok' => false, 'error' => $isEn ? 'Could not save settings.' : 'Не удалось сохранить настройки.'];
    }
}

function user_change_local_password($db, int $userId, string $currentPassword, string $newPassword, string $lang = 'ru'): array {
    $isEn = $lang === 'en';

    if ($currentPassword === '') {
        return ['ok' => false, 'error' => $isEn ? 'Enter your current password.' : 'Введите текущий пароль.'];
    }
    if ($newPassword === '') {
        return ['ok' => false, 'error' => $isEn ? 'Enter a new password.' : 'Введите новый пароль.'];
    }
    if (!user_validate_password($newPassword)) {
        return ['ok' => false, 'error' => $isEn ? 'New password must be at least 8 characters.' : 'Новый пароль — не менее 8 символов.'];
    }
    if ($newPassword === $currentPassword) {
        return [
            'ok' => false,
            'error' => $isEn ? 'New password must differ from the current one.' : 'Новый пароль должен отличаться от текущего.',
        ];
    }

    try {
        $row = $db->fetchOne(
            'SELECT id, password_hash, auth_provider FROM site_users WHERE id = ?',
            [$userId]
        );
    } catch (Throwable $e) {
        error_log('user_change_local_password: ' . $e->getMessage());
        return ['ok' => false, 'error' => $isEn ? 'Could not change password.' : 'Не удалось сменить пароль.'];
    }

    if (!is_array($row) || ($row['auth_provider'] ?? '') !== 'local') {
        return [
            'ok' => false,
            'error' => $isEn ? 'Password change is not available for this account.' : 'Смена пароля для этого аккаунта недоступна.',
        ];
    }

    $hash = $row['password_hash'] ?? '';
    if (!is_string($hash) || $hash === '' || !password_verify($currentPassword, $hash)) {
        return ['ok' => false, 'error' => $isEn ? 'Current password is incorrect.' : 'Неверный текущий пароль.'];
    }

    try {
        $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $db->update(
            'UPDATE site_users SET password_hash = ? WHERE id = ? AND auth_provider = ?',
            [$newHash, $userId, 'local']
        );
        return ['ok' => true, 'message' => $isEn ? 'Password changed.' : 'Пароль изменён.'];
    } catch (Throwable $e) {
        error_log('user_change_local_password: ' . $e->getMessage());
        return ['ok' => false, 'error' => $isEn ? 'Could not change password.' : 'Не удалось сменить пароль.'];
    }
}

function user_logout(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        $name = session_name();
        if (PHP_VERSION_ID >= 70300) {
            setcookie($name, '', [
                'expires' => time() - 42000,
                'path' => $p['path'] ?: '/',
                'domain' => $p['domain'] ?? '',
                'secure' => $p['secure'],
                'httponly' => $p['httponly'],
                'samesite' => $p['samesite'] ?? 'Lax',
            ]);
        } else {
            setcookie($name, '', time() - 42000, $p['path'] ?: '/', $p['domain'] ?? '', $p['secure'], $p['httponly']);
        }
    }
    session_destroy();
}
