<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/../../includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

require_once __DIR__ . '/../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../config/ensure_tactics.php';
require_once __DIR__ . '/../../includes/user_auth.php';
require_once __DIR__ . '/../../includes/tactics_helpers.php';

ensure_tactics_table($userDb);

$userProfile = null;
$userLoggedIn = user_is_logged_in();
$defaultNickname = $lang === 'en' ? 'Guest' : 'Гость';
$gameNicknames = [];
if ($userLoggedIn) {
    $uid = user_current_id();
    $userProfile = $uid !== null ? user_login_row($userDb, $uid) : null;
    $gameNicknames = tactics_game_nicknames_for_user($userProfile, $lang);
    $defaultNickname = $gameNicknames['wot'] ?? tactics_default_nickname_for_user($userProfile, $lang, 'wot');
}

$pageTitle = $lang === 'en' ? 'Tactical Board' : 'Тактический планшет';
abs_set_page_titles('Тактический планшет', 'Tactical Board');
$metaDescription = $lang === 'en'
    ? 'Plan tactics together on map overlays — create open or password-protected rooms.'
    : 'Совместное планирование тактик на картах — открытые и закрытые комнаты.';
$bodyClass = 'page-tactics page-tactics-lobby';
$seoSlug = 'services/tactics';

$roomsHref = abs_build_lang_href($lang, 'services/tactics/rooms');

$extraHeadHtml = (isset($extraHeadHtml) ? $extraHeadHtml : '')
    . '<script>(function(){if(window.location.hash==="#tactics-create"){try{history.scrollRestoration="manual";}catch(e){}window.scrollTo(0,0);}})();</script>';

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="tactics-service">
            <section class="tactics-panel tactics-service-header">
                <div class="tactics-section-head">
                    <div>
                        <h2 class="tactics-section-title" data-tactics-i18n="lobbyTitle"><?php echo $lang === 'en' ? 'Tactical Board' : 'Тактический планшет'; ?></h2>
                        <p class="tactics-section-hint" data-tactics-i18n="lobbyHint">
                            <?php echo $lang === 'en'
                                ? 'Create a room and share the link with teammates — draw arrows, routes, and positions on map overlays.'
                                : 'Создайте комнату и поделитесь ссылкой с союзниками — рисуйте стрелки, маршруты и позиции на картах.'; ?>
                        </p>
                    </div>
                    <div class="tactics-section-actions">
                        <a class="tactics-back-link tactics-header-btn" href="<?php echo htmlspecialchars($roomsHref, ENT_QUOTES, 'UTF-8'); ?>">
                            <i class="fas fa-th-list" aria-hidden="true"></i>
                            <span data-tactics-i18n="openRoomsLink"><?php echo $lang === 'en' ? 'Open rooms' : 'Открытые комнаты'; ?></span>
                        </a>
                    </div>
                </div>
            </section>

            <div class="tactics-lobby-grid">
                <section class="tactics-panel tactics-create-panel" id="tactics-create">
                    <h3 class="tactics-panel-title" data-tactics-i18n="createRoom"><?php echo $lang === 'en' ? 'Create room' : 'Создать комнату'; ?></h3>
                    <form id="tacticsCreateForm" class="tactics-form" autocomplete="off">
                        <label class="tactics-field">
                            <span class="tactics-field-label" data-tactics-i18n="yourNickname"><?php echo $lang === 'en' ? 'Your nickname' : 'Ваш ник в комнате'; ?></span>
                            <input type="text" id="tacticsNickname" name="nickname" maxlength="32" value="<?php echo htmlspecialchars($defaultNickname, ENT_QUOTES, 'UTF-8'); ?>"<?php echo $userLoggedIn ? ' readonly aria-readonly="true" class="tactics-input--locked"' : ''; ?> required>
                        </label>
                        <label class="tactics-field">
                            <span class="tactics-field-label" data-tactics-i18n="roomTitle"><?php echo $lang === 'en' ? 'Room title' : 'Название комнаты'; ?></span>
                            <input type="text" id="tacticsTitle" name="title" maxlength="120" data-tactics-i18n-placeholder="roomTitlePlaceholder" placeholder="<?php echo $lang === 'en' ? 'Untitled' : 'Без названия'; ?>">
                        </label>
                        <?php
                        $mapPickerId = 'tacticsCreateMapPicker';
                        $mapSelectId = 'tacticsMapSelect';
                        require __DIR__ . '/_map_picker.php';
                        ?>
                        <div class="tactics-field">
                            <span class="tactics-field-label" id="tacticsVisibility-label" data-tactics-i18n="roomVisibility">
                                <?php echo $lang === 'en' ? 'Room visibility' : 'Видимость комнаты'; ?>
                            </span>
                            <div id="tacticsVisibilitySwitch" class="bracket-visibility-switch" role="radiogroup" aria-labelledby="tacticsVisibility-label">
                                <label class="bracket-visibility-switch__option is-active">
                                    <input type="radio" name="visibility" value="open" checked>
                                    <span class="bracket-visibility-switch__text" data-tactics-i18n="visibilityOpen">
                                        <?php echo $lang === 'en' ? 'Open — listed publicly' : 'Открытая — в общем списке'; ?>
                                    </span>
                                </label>
                                <label class="bracket-visibility-switch__option">
                                    <input type="radio" name="visibility" value="closed">
                                    <span class="bracket-visibility-switch__text" data-tactics-i18n="visibilityClosed">
                                        <?php echo $lang === 'en' ? 'Closed — link only' : 'Закрытая — только по ссылке'; ?>
                                    </span>
                                </label>
                            </div>
                        </div>
                        <label class="tactics-field tactics-password-field" id="tacticsPasswordWrap" hidden>
                            <span class="tactics-field-label" data-tactics-i18n="passwordOptional"><?php echo $lang === 'en' ? 'Password (optional)' : 'Пароль (необязательно)'; ?></span>
                            <input type="password" id="tacticsPassword" name="password" maxlength="64" autocomplete="new-password">
                        </label>
                        <p class="tactics-form-error" id="tacticsCreateError" hidden></p>
                        <button type="submit" class="tactics-submit-btn" id="tacticsCreateBtn">
                            <i class="fas fa-plus" aria-hidden="true"></i>
                            <span data-tactics-i18n="createRoom"><?php echo $lang === 'en' ? 'Create room' : 'Создать комнату'; ?></span>
                        </button>
                    </form>
                </section>

                <section class="tactics-panel tactics-join-panel">
                    <h3 class="tactics-panel-title" data-tactics-i18n="joinByCode"><?php echo $lang === 'en' ? 'Join by code' : 'Войти по коду'; ?></h3>
                    <form id="tacticsJoinForm" class="tactics-form" autocomplete="off">
                        <label class="tactics-field">
                            <span class="tactics-field-label" data-tactics-i18n="roomCodeLabel"><?php echo $lang === 'en' ? 'Room code' : 'Код комнаты'; ?></span>
                            <input type="text" id="tacticsJoinCode" name="public_id" maxlength="8" pattern="[A-Za-z0-9]{6,8}" required>
                        </label>
                        <label class="tactics-field">
                            <span class="tactics-field-label" data-tactics-i18n="nicknameLabel"><?php echo $lang === 'en' ? 'Nickname' : 'Ник'; ?></span>
                            <input type="text" id="tacticsJoinNickname" name="nickname" maxlength="32" value="<?php echo htmlspecialchars($defaultNickname, ENT_QUOTES, 'UTF-8'); ?>"<?php echo $userLoggedIn ? ' readonly aria-readonly="true" class="tactics-input--locked"' : ''; ?> required>
                        </label>
                        <label class="tactics-field" id="tacticsJoinPasswordWrap" hidden>
                            <span class="tactics-field-label" data-tactics-i18n="passwordLabel"><?php echo $lang === 'en' ? 'Password' : 'Пароль'; ?></span>
                            <input type="password" id="tacticsJoinPassword" name="password" maxlength="64" autocomplete="current-password">
                        </label>
                        <p class="tactics-form-error" id="tacticsJoinError" hidden></p>
                        <button type="submit" class="tactics-submit-btn">
                            <i class="fas fa-sign-in-alt" aria-hidden="true"></i>
                            <span data-tactics-i18n="enterRoom"><?php echo $lang === 'en' ? 'Enter room' : 'Войти в комнату'; ?></span>
                        </button>
                    </form>
                </section>
            </div>
        </main>

<?php
require __DIR__ . '/../../includes/site_footer.php';
?>
    <script>
        window.ABS_TACTICS_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_TACTICS_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_TACTICS_CREATE_API = <?php echo json_encode(user_api_path('/api/tactics/create.php')); ?>;
        window.ABS_TACTICS_JOIN_API = <?php echo json_encode(user_api_path('/api/tactics/join.php')); ?>;
        window.ABS_TACTICS_CATALOG_API = <?php echo json_encode(user_api_path('/api/tactics/maps.php')); ?>;
        window.ABS_TACTICS_LOBBY_BASE = <?php echo json_encode(abs_build_lang_href($lang, 'services/tactics')); ?>;
        window.ABS_TACTICS_ROOMS_HREF = <?php echo json_encode($roomsHref); ?>;
        window.ABS_TACTICS_IS_LOGGED_IN = <?php echo json_encode($userLoggedIn); ?>;
        window.ABS_TACTICS_GAME_NICKS = <?php echo json_encode($gameNicknames); ?>;
    </script>
    <script src="/js/services/tactics/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/store.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/maps.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/custom-select.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/map-picker.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/lobby.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
