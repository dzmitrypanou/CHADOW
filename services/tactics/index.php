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
            <section class="tactics-panel tactics-create-panel" id="tactics-create">
                <div class="tactics-create-layout">
                    <div class="tactics-create-form-col">
                        <h3 class="tactics-panel-title" data-tactics-i18n="createRoom"><?php echo $lang === 'en' ? 'Create room' : 'Создать комнату'; ?></h3>
                        <form id="tacticsCreateForm" class="tactics-form" autocomplete="off">
                            <div class="tactics-create-fields-row">
                                <label class="tactics-field">
                                    <span class="tactics-field-label" data-tactics-i18n="yourNickname"><?php echo $lang === 'en' ? 'Your nickname' : 'Ваш ник в комнате'; ?></span>
                                    <input type="text" id="tacticsNickname" name="nickname" maxlength="32" value="<?php echo htmlspecialchars($defaultNickname, ENT_QUOTES, 'UTF-8'); ?>"<?php echo $userLoggedIn ? ' readonly aria-readonly="true" class="tactics-input--locked"' : ''; ?> required>
                                </label>
                                <label class="tactics-field">
                                    <span class="tactics-field-label" data-tactics-i18n="roomTitle"><?php echo $lang === 'en' ? 'Room title' : 'Название комнаты'; ?></span>
                                    <input type="text" id="tacticsTitle" name="title" maxlength="120" data-tactics-i18n-placeholder="roomTitlePlaceholder" placeholder="<?php echo $lang === 'en' ? 'Untitled' : 'Без названия'; ?>">
                                </label>
                            </div>
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
                                    <label class="bracket-visibility-switch__option">
                                        <input type="radio" name="visibility" value="open">
                                        <span class="bracket-visibility-switch__text" data-tactics-i18n="visibilityOpen">
                                            <?php echo $lang === 'en' ? 'Open — listed publicly' : 'Открытая — в общем списке'; ?>
                                        </span>
                                    </label>
                                    <label class="bracket-visibility-switch__option is-active">
                                        <input type="radio" name="visibility" value="closed" checked>
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
                            <button type="submit" class="tactics-submit-btn tactics-create-submit" id="tacticsCreateBtn">
                                <i class="fas fa-plus" aria-hidden="true"></i>
                                <span data-tactics-i18n="createRoom"><?php echo $lang === 'en' ? 'Create room' : 'Создать комнату'; ?></span>
                            </button>
                        </form>
                    </div>
                    <aside class="tactics-create-preview-col" aria-labelledby="tacticsCreatePreviewLabel">
                        <div class="tactics-create-preview-card">
                            <span id="tacticsCreatePreviewLabel" class="tactics-create-preview__label" data-tactics-i18n="mapPreviewLabel"><?php echo $lang === 'en' ? 'Preview' : 'Превью'; ?></span>
                            <div class="tactics-create-preview__frame">
                                <img id="tacticsCreateMapPreview" class="tactics-create-preview__img" alt="" hidden>
                                <div id="tacticsCreateMapPreviewPlaceholder" class="tactics-create-preview__placeholder">
                                    <i class="fas fa-map" aria-hidden="true"></i>
                                    <span data-tactics-i18n="mapPreviewPlaceholder"><?php echo $lang === 'en' ? 'No preview' : 'Нет превью'; ?></span>
                                </div>
                                <div class="tactics-create-preview__meta" id="tacticsCreatePreviewMeta" hidden>
                                    <span id="tacticsCreatePreviewGame" class="tactics-create-preview__game"></span>
                                    <strong id="tacticsCreatePreviewMap" class="tactics-create-preview__map"></strong>
                                    <span id="tacticsCreatePreviewMode" class="tactics-create-preview__mode"></span>
                                </div>
                            </div>
                            <p class="tactics-create-preview__hint" data-tactics-i18n="createMapPreviewHint">
                                <?php echo $lang === 'en'
                                    ? 'This map will be the first slide in your room'
                                    : 'Эта карта станет первым слайдом комнаты'; ?>
                            </p>
                        </div>
                    </aside>
                </div>
            </section>
        </main>

<?php
require __DIR__ . '/../../includes/site_footer.php';
?>
    <script>
        window.ABS_TACTICS_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_TACTICS_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_TACTICS_CREATE_API = <?php echo json_encode(user_api_path('/api/tactics/create.php')); ?>;
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
