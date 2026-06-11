<?php
require_once __DIR__ . '/../includes/user_bootstrap.php';
require_once __DIR__ . '/../includes/lang.php';
require_once __DIR__ . '/../includes/recruiting_helpers.php';
require_once __DIR__ . '/../includes/bracket_helpers.php';
require_once __DIR__ . '/../includes/wg_openid_client.php';

$lang = abs_detect_lang();
$isEn = $lang === 'en';

user_require_web();
user_require_active_web($userDb);

$userId = user_current_id();
$profile = $userId !== null ? user_login_row($userDb, $userId) : null;
if (!$profile) {
    user_logout();
    header('Location: ' . user_auth_path('/auth/login'));
    exit();
}

$recruitingPrefs = user_recruiting_prefs($userDb, (int) $userId);

$wgClient = new WgOpenIdClient($userDb);
$wgAppConfigured = $wgClient->applicationId() !== '';
$wgProviderConfigured = [
    'wg' => $wgClient->applicationIdForRealm('eu') !== '',
    'lesta' => $wgClient->applicationIdForRealm('ru') !== '',
];
$wgApiLinked = user_wg_api_is_linked($profile);
$lestaLinked = user_lesta_is_linked($profile);
$gameNicknames = user_game_nicknames_state($profile);
$isLocalAccount = ($profile['auth_provider'] ?? '') === 'local';

$pageTitle = $isEn ? 'Account' : 'Аккаунт';
abs_set_page_titles('Аккаунт', 'Account');
$bodyClass = 'page-auth page-auth-profile';
$seoSlug = 'auth/profile';
require __DIR__ . '/../includes/site_header.php';
?>
        <main class="auth-page auth-page--account">
            <div class="profile-layout">
                <div class="profile-layout__col">
                <section class="profile-panel profile-panel--account">
                    <div class="profile-panel__head">
                        <h2 class="profile-panel__title">
                            <i class="fas fa-user" aria-hidden="true"></i>
                            <span data-profile-i18n="accountTitle"><?php echo $isEn ? 'My account' : 'Мой аккаунт'; ?></span>
                        </h2>
                        <?php
                        $registeredAt = trim((string) ($profile['created_at'] ?? ''));
                        $registeredTip = $registeredAt !== ''
                            ? ($isEn ? 'Registered: ' : 'Регистрация: ') . $registeredAt
                            : ($isEn ? 'Registration date unknown' : 'Дата регистрации неизвестна');
                        ?>
                        <span class="site-law-help-wrap profile-registered-help">
                            <button
                                type="button"
                                class="site-law-help"
                                aria-describedby="profileRegisteredTip"
                                aria-label="<?php echo $isEn ? 'Registration date' : 'Дата регистрации'; ?>"
                                data-profile-i18n-title="regDateLabel"
                            >
                                <i class="fas fa-question-circle" aria-hidden="true"></i>
                            </button>
                            <span class="site-law-help-tip" id="profileRegisteredTip" role="tooltip">
                                <span class="site-law-help-tip-line"><?php echo htmlspecialchars($registeredTip, ENT_QUOTES, 'UTF-8'); ?></span>
                            </span>
                        </span>
                    </div>

                    <?php if ($isLocalAccount): ?>
                    <form class="auth-form auth-form--profile-account" id="profileAccountForm" method="post" action="<?php echo htmlspecialchars(user_auth_path('/auth/profile'), ENT_QUOTES, 'UTF-8'); ?>" novalidate>
                        <div class="auth-form__group">
                            <label class="recruiting-form-label" for="profile_username"><span data-profile-i18n="username"><?php echo $isEn ? 'Username' : 'Логин'; ?></span></label>
                            <input
                                type="text"
                                id="profile_username"
                                name="username"
                                class="recruiting-text-input"
                                required
                                autocomplete="username"
                                value="<?php echo htmlspecialchars((string) $profile['username'], ENT_QUOTES, 'UTF-8'); ?>"
                                title="<?php echo $isEn ? '3–64 characters: Latin letters, digits, _ - .' : '3–64 символа: латиница, цифры, _ - .'; ?>"
                                data-profile-i18n-title="usernameTitle"
                            >
                        </div>
                        <div class="auth-form__group">
                            <label class="recruiting-form-label" for="profile_email">Email</label>
                            <input
                                type="email"
                                id="profile_email"
                                name="email"
                                class="recruiting-text-input"
                                required
                                autocomplete="email"
                                value="<?php echo htmlspecialchars((string) $profile['email'], ENT_QUOTES, 'UTF-8'); ?>"
                            >
                        </div>
                    </form>

                    <div class="profile-password auth-profile--meta">
                        <h3 class="profile-linking__title"><span data-profile-i18n="changePassword"><?php echo $isEn ? 'Change password' : 'Смена пароля'; ?></span></h3>
                        <div class="profile-password__row" id="profilePasswordFields">
                            <div class="auth-form__group">
                                <label class="recruiting-form-label" for="profile_current_password">
                                    <span data-profile-i18n="currentPassword"><?php echo $isEn ? 'Current password' : 'Текущий пароль'; ?></span>
                                </label>
                                <?php
                                $passwordInputId = 'profile_current_password';
                                $passwordInputName = 'current_password';
                                $passwordInputExtra = 'autocomplete="current-password" placeholder="********"';
                                require __DIR__ . '/_password_input.php';
                                ?>
                            </div>
                            <div class="auth-form__group">
                                <label class="recruiting-form-label" for="profile_new_password">
                                    <span data-profile-i18n="newPassword"><?php echo $isEn ? 'New password' : 'Новый пароль'; ?></span>
                                </label>
                                <?php
                                $passwordInputId = 'profile_new_password';
                                $passwordInputName = 'new_password';
                                $passwordInputExtra = 'minlength="8" autocomplete="new-password" placeholder="' . ($isEn ? 'At least 8 characters' : 'Не менее 8 символов') . '" data-profile-i18n-placeholder="passwordNewPh"';
                                require __DIR__ . '/_password_input.php';
                                ?>
                            </div>
                            <div class="auth-form__group">
                                <label class="recruiting-form-label" for="profile_new_password_confirm">
                                    <span data-profile-i18n="confirmation"><?php echo $isEn ? 'Confirmation' : 'Подтверждение'; ?></span>
                                </label>
                                <?php
                                $passwordInputId = 'profile_new_password_confirm';
                                $passwordInputName = 'new_password_confirm';
                                $passwordInputExtra = 'minlength="8" autocomplete="new-password" placeholder="' . ($isEn ? 'Enter again' : 'Введите ещё раз') . '" data-profile-i18n-placeholder="passwordConfirmPh"';
                                $passwordShowToggle = false;
                                require __DIR__ . '/_password_input.php';
                                ?>
                            </div>
                        </div>
                        <p class="auth-password-match" id="profilePasswordMatchHint" hidden role="status"></p>
                    </div>
                    <?php else: ?>
                    <dl class="auth-profile auth-profile--readonly-top">
                        <div class="auth-profile__row">
                            <dt><span data-profile-i18n="username"><?php echo $isEn ? 'Username' : 'Логин'; ?></span></dt>
                            <dd><?php echo htmlspecialchars((string) $profile['username'], ENT_QUOTES, 'UTF-8'); ?></dd>
                        </div>
                        <div class="auth-profile__row">
                            <dt>Email</dt>
                            <dd><?php echo htmlspecialchars((string) $profile['email'], ENT_QUOTES, 'UTF-8'); ?></dd>
                        </div>
                    </dl>
                    <?php endif; ?>

                    <div class="profile-game-nicks auth-profile--meta">
                        <h3 class="profile-linking__title"><span data-profile-i18n="gameNicknames"><?php echo $isEn ? 'Game nicknames' : 'Игровые ники'; ?></span></h3>
                        <?php
                        require __DIR__ . '/_game_nickname_fields.php';
                        ?>
                    </div>

                    <?php if ($isLocalAccount): ?>
                    <div class="profile-linking auth-profile--meta">
                        <h3 class="profile-linking__title"><span data-profile-i18n="gameAccounts"><?php echo $isEn ? 'Game accounts' : 'Игровые аккаунты'; ?></span></h3>
                        <?php
                        $wgOAuthAction = 'link';
                        $providersWrapperClass = 'auth-providers profile-linking__providers';
                        $wgOAuthReturn = '';
                        $wgProviderButtonsContext = 'profile-nickname';
                        $wgProviderProfile = $profile;
                        $wgProviderLinkState = [
                            'wg' => $wgApiLinked,
                            'lesta' => $lestaLinked,
                        ];
                        require __DIR__ . '/_game_provider_buttons.php';
                        ?>
                    </div>
                    <?php endif; ?>

                </section>

                <section class="profile-panel profile-panel--tactics profile-panel--list">
                    <h2 class="profile-panel__title">
                        <i class="fas fa-chess-board" aria-hidden="true"></i>
                        <span data-profile-i18n="myTacticsRooms"><?php echo $isEn ? 'My tactics rooms' : 'Мои тактические комнаты'; ?></span>
                    </h2>
                    <div class="bracket-profile-wrap">
                        <table class="bracket-profile-table bracket-profile-table--tactics" id="profileTacticsRoomsTable">
                            <thead>
                                <tr>
                                    <th data-profile-i18n="colTitle"><?php echo $isEn ? 'Title' : 'Название'; ?></th>
                                    <th data-profile-i18n="colCode"><?php echo $isEn ? 'Code' : 'Код'; ?></th>
                                    <th data-profile-i18n="colUpdated"><?php echo $isEn ? 'Updated' : 'Обновлено'; ?></th>
                                    <th data-profile-i18n="colActions"><?php echo $isEn ? 'Actions' : 'Действия'; ?></th>
                                </tr>
                            </thead>
                            <tbody id="profileTacticsRoomsBody">
                                <tr><td colspan="4"><?php echo $isEn ? 'Loading…' : 'Загрузка…'; ?></td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>
                </div>

                <div class="profile-layout__col profile-layout__col--secondary">
                <section class="profile-panel profile-panel--recruiting">
                    <h2 class="profile-panel__title">
                        <i class="fas fa-users" aria-hidden="true"></i>
                        <span data-profile-i18n="recruiting"><?php echo $isEn ? 'Recruiting' : 'Рекрутинг'; ?></span>
                    </h2>

                    <form class="auth-form auth-form--profile-recruiting" id="profileRecruitingForm" method="post" action="<?php echo htmlspecialchars(user_auth_path('/auth/profile'), ENT_QUOTES, 'UTF-8'); ?>" novalidate>
                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars(user_csrf_token(), ENT_QUOTES, 'UTF-8'); ?>">
                    <div class="auth-form__grid auth-form__grid--recruiting">
                        <div class="auth-form__group">
                            <label class="recruiting-form-label" for="recruiting_post_type"><span data-profile-i18n="adType"><?php echo $isEn ? 'Ad type' : 'Тип объявления'; ?></span></label>
                            <select id="recruiting_post_type" name="recruiting_post_type" class="recruiting-select">
                                <option value=""<?php echo $recruitingPrefs['post_type'] === '' ? ' selected' : ''; ?>>
                                    <?php echo $isEn ? 'Not set' : 'Не выбран'; ?>
                                </option>
                                <?php foreach (RECRUITING_POST_TYPES as $type): ?>
                                <option value="<?php echo htmlspecialchars($type, ENT_QUOTES, 'UTF-8'); ?>"<?php echo $recruitingPrefs['post_type'] === $type ? ' selected' : ''; ?>>
                                    <?php echo htmlspecialchars(recruiting_post_type_label($type, $lang), ENT_QUOTES, 'UTF-8'); ?>
                                </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="auth-form__group">
                            <label class="recruiting-form-label" for="recruiting_realm"><span data-profile-i18n="region"><?php echo $isEn ? 'Region' : 'Регион'; ?></span></label>
                            <select id="recruiting_realm" name="recruiting_realm" class="recruiting-select">
                                <option value=""<?php echo $recruitingPrefs['realm'] === '' ? ' selected' : ''; ?>>
                                    <?php echo $isEn ? 'Not set' : 'Не выбран'; ?>
                                </option>
                                <?php foreach (RECRUITING_REALMS as $realmOption): ?>
                                <option value="<?php echo htmlspecialchars($realmOption, ENT_QUOTES, 'UTF-8'); ?>"<?php echo $recruitingPrefs['realm'] === $realmOption ? ' selected' : ''; ?>>
                                    <?php echo htmlspecialchars(recruiting_realm_label($realmOption, $lang), ENT_QUOTES, 'UTF-8'); ?>
                                </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                    <?php
                    $contacts = $recruitingPrefs['contacts'];
                    $contactsInputName = 'recruiting_contacts_json';
                    $contactsEditorId = 'profileContactsEditor';
                    $showContactsHint = false;
                    require __DIR__ . '/../services/recruiting/_contacts_editor.php';
                    ?>
                    <?php
                    $clanTagValue = $recruitingPrefs['clan_tag'];
                    $teamNameValue = $recruitingPrefs['team_name'];
                    $clanTagFieldClass = 'auth-form__group';
                    require __DIR__ . '/../services/recruiting/_profile_clan_team_fields.php';
                    ?>
                    </form>
                </section>

                <section class="profile-panel profile-panel--brackets profile-panel--list">
                    <h2 class="profile-panel__title">
                        <i class="fas fa-sitemap" aria-hidden="true"></i>
                        <span data-profile-i18n="myBrackets"><?php echo $isEn ? 'My brackets' : 'Мои сетки'; ?></span>
                    </h2>
                    <div class="bracket-profile-wrap">
                        <table class="bracket-profile-table" id="profileBracketsTable">
                            <thead>
                                <tr>
                                    <th data-profile-i18n="colTitle"><?php echo $isEn ? 'Title' : 'Название'; ?></th>
                                    <th data-profile-i18n="colFormat"><?php echo $isEn ? 'Format' : 'Формат'; ?></th>
                                    <th data-profile-i18n="colUpdated"><?php echo $isEn ? 'Updated' : 'Обновлено'; ?></th>
                                    <th data-profile-i18n="colActions"><?php echo $isEn ? 'Actions' : 'Действия'; ?></th>
                                </tr>
                            </thead>
                            <tbody id="profileBracketsBody">
                                <tr><td colspan="4"><?php echo $isEn ? 'Loading…' : 'Загрузка…'; ?></td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>
                </div>
            </div>

            <div class="profile-save-bar">
                <button type="button" id="profileSaveBtn" class="auth-btn auth-btn--primary">
                    <i class="fas fa-save" aria-hidden="true"></i>
                    <span data-profile-i18n="saveSettings"><?php echo $isEn ? 'Save settings' : 'Сохранить настройки'; ?></span>
                </button>
            </div>
        </main>
<?php
require __DIR__ . '/../includes/site_footer.php';
?>
    <script>
        window.ABS_PROFILE_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_PROFILE_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_PROFILE_RECRUITING_API = <?php echo json_encode(user_api_path('/api/auth/save_recruiting_prefs.php')); ?>;
        window.ABS_PROFILE_ACCOUNT_API = <?php echo json_encode(user_api_path('/api/auth/update_profile.php')); ?>;
        window.ABS_PROFILE_PASSWORD_API = <?php echo json_encode(user_api_path('/api/auth/change_password.php')); ?>;
        window.ABS_PROFILE_IS_LOCAL = <?php echo json_encode($isLocalAccount); ?>;
        window.ABS_PROFILE_UNLINK_WG_API = <?php echo json_encode(user_api_path('/api/auth/unlink_wg.php')); ?>;
        window.ABS_PROFILE_BRACKETS_API = <?php echo json_encode(user_api_path('/api/bracket/my.php')); ?>;
        window.ABS_PROFILE_BRACKETS_DELETE_API = <?php echo json_encode(user_api_path('/api/bracket/delete.php')); ?>;
        window.ABS_PROFILE_TACTICS_ROOMS_API = <?php echo json_encode(user_api_path('/api/tactics/my.php')); ?>;
        window.ABS_PROFILE_TACTICS_DELETE_API = <?php echo json_encode(user_api_path('/api/tactics/delete.php')); ?>;
    </script>
    <script src="/js/auth/profile-i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/auth/profile-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/auth/profile-wg.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/custom-select.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/max-icon.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/contacts-editor.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/auth/profile-recruiting-fields.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/auth/password-toggle.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/auth/profile-password.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/auth/profile-brackets.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/auth/profile-tactics-rooms.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/auth/profile-save.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
