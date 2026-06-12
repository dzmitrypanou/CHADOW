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
ensure_tactics_realtime_tables($userDb);

$publicId = trim((string) ($_GET['public_id'] ?? ''));
if (!tactics_public_id_valid($publicId)) {
    http_response_code(404);
    $lobbyHref = abs_build_lang_href($lang, 'services/tactics');
    $roomsHref = abs_build_lang_href($lang, 'services/tactics/rooms');
    $bodyClass = 'page-tactics page-tactics-room-gone';
    require __DIR__ . '/../../includes/site_header.php';
    echo '<main class="tactics-service tactics-room-gone-page">';
    $asOverlay = false;
    require __DIR__ . '/_room_gone.php';
    echo '</main>';
    require __DIR__ . '/../../includes/site_footer.php';
    exit();
}

$row = tactics_fetch_row($userDb, $publicId, true);
if (!$row) {
    http_response_code(404);
    $lobbyHref = abs_build_lang_href($lang, 'services/tactics');
    $roomsHref = abs_build_lang_href($lang, 'services/tactics/rooms');
    $bodyClass = 'page-tactics page-tactics-room-gone';
    require __DIR__ . '/../../includes/site_header.php';
    echo '<main class="tactics-service tactics-room-gone-page">';
    $asOverlay = false;
    require __DIR__ . '/_room_gone.php';
    echo '</main>';
    require __DIR__ . '/../../includes/site_footer.php';
    exit();
}

$userProfile = null;
$userLoggedIn = user_is_logged_in();
$defaultNickname = $lang === 'en' ? 'Guest' : 'Гость';
$gameNicknames = null;
$userId = user_current_id();

$needsPassword = ($row['visibility'] ?? '') === 'closed'
    && tactics_room_has_password($row)
    && ($userId === null || (int) ($row['user_id'] ?? 0) !== $userId);

$roomItem = tactics_format_item($row, !$needsPassword, true);
$roomItemBoot = !$needsPassword ? tactics_strip_inactive_slide_canvas($roomItem) : null;
$isRoomOwner = $userId !== null && (int) ($row['user_id'] ?? 0) === $userId;
$roomHasPassword = tactics_room_has_password($row);

$roomGame = tactics_room_primary_game(is_array($roomItem['room_data'] ?? null) ? $roomItem['room_data'] : []);
if ($userLoggedIn && $userId !== null) {
    $userProfile = user_login_row($userDb, $userId);
    $defaultNickname = tactics_default_nickname_for_user($userProfile, $lang, $roomGame);
    $gameNicknames = tactics_game_nicknames_for_user($userProfile, $lang);
}
$mapUrls = [];
if (!$needsPassword) {
    $roomDataForMaps = is_array($roomItem['room_data'] ?? null) ? $roomItem['room_data'] : [];
    $mapUrls = tactics_build_slide_map_urls($roomDataForMaps, $publicId);
}

$pageTitle = htmlspecialchars((string) $row['title'], ENT_QUOTES, 'UTF-8');
abs_set_page_titles((string) $row['title'], (string) $row['title']);
$metaDescription = $lang === 'en'
    ? 'Tactics room: ' . (string) $row['title']
    : 'Тактическая комната: ' . (string) $row['title'];
$bodyClass = 'page-tactics page-tactics-room page-tactics-room-shell'
    . ($needsPassword ? ' page-tactics-room-locked' : '');
$tacticsRoomShell = true;
$seoSlug = 'services/tactics/' . $publicId;

if (($row['visibility'] ?? '') === 'closed') {
    $metaRobots = 'noindex,nofollow';
}

$lobbyHref = abs_build_lang_href($lang, 'services/tactics');
$roomsHref = abs_build_lang_href($lang, 'services/tactics/rooms');

$extraHeadHtml = '';
if (!$needsPassword && $mapUrls !== []) {
    $activeSlideId = (string) ($roomItem['room_data']['active_slide_id'] ?? '');
    $preloadMapUrl = null;
    foreach (($roomItem['room_data']['slides'] ?? []) as $slide) {
        if (!is_array($slide)) {
            continue;
        }
        $slideId = (string) ($slide['id'] ?? '');
        if ($slideId === '') {
            continue;
        }
        if ($activeSlideId !== '' && $slideId !== $activeSlideId) {
            continue;
        }
        $preloadMapUrl = $mapUrls[$slideId] ?? tactics_slide_map_url($slide, $publicId);
        break;
    }
    if ($preloadMapUrl) {
        $extraHeadHtml .= '<link rel="preload" as="image" href="'
            . htmlspecialchars($preloadMapUrl, ENT_QUOTES, 'UTF-8')
            . '" crossorigin="anonymous" fetchpriority="high">';
    }
    $extraHeadHtml .= '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/css/flag-icons.min.css">';
    $extraHeadHtml .= '<link rel="preload" as="script" href="/js/vendor/fabric.min.js?v='
        . htmlspecialchars($siteVersion, ENT_QUOTES, 'UTF-8')
        . '">'
        . '<script src="/js/vendor/fabric.min.js?v='
        . htmlspecialchars($siteVersion, ENT_QUOTES, 'UTF-8')
        . '"></script>';
    $extraHeadHtml .= '<style>'
        . '.page-tactics-room-shell{background:#0a1022;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}'
        . '.page-tactics-room .tactics-editor.is-booting{opacity:0;pointer-events:none}'
        . '.page-tactics-room .tactics-editor.is-ready{opacity:1;transition:opacity .12s ease}'
        . '</style>';
}

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="tactics-service tactics-room-layout<?php echo $needsPassword ? ' tactics-room-layout--locked' : ''; ?>">
            <div id="tacticsPasswordGate" class="tactics-password-gate"<?php echo $needsPassword ? '' : ' hidden'; ?>>
                <section class="tactics-panel tactics-password-panel">
                    <h3 class="tactics-panel-title" data-tactics-i18n="closedRoom"><?php echo $lang === 'en' ? 'Closed room' : 'Закрытая комната'; ?></h3>
                    <form id="tacticsRoomJoinForm" class="tactics-form">
                        <label class="tactics-field">
                            <span class="tactics-field-label" data-tactics-i18n="passwordLabel"><?php echo $lang === 'en' ? 'Password' : 'Пароль'; ?></span>
                            <input type="password" id="tacticsRoomPassword" maxlength="64" required autofocus autocomplete="current-password">
                        </label>
                        <p class="tactics-form-error" id="tacticsRoomJoinError" hidden></p>
                        <div class="tactics-password-panel__actions">
                            <button type="submit" class="tactics-submit-btn tactics-password-panel__enter" data-tactics-i18n="enterRoom"><?php echo $lang === 'en' ? 'Enter room' : 'Войти в комнату'; ?></button>
                            <a class="tactics-back-link tactics-password-panel__lobby" href="<?php echo htmlspecialchars($lobbyHref, ENT_QUOTES, 'UTF-8'); ?>">
                                <i class="fas fa-arrow-left" aria-hidden="true"></i>
                                <span data-tactics-i18n="allRooms"><?php echo $lang === 'en' ? 'All rooms' : 'Все комнаты'; ?></span>
                            </a>
                        </div>
                    </form>
                </section>
            </div>

            <div id="tacticsRoomWorkspace" class="tactics-editor<?php echo $needsPassword ? '' : ' is-booting'; ?>"<?php echo $needsPassword ? ' hidden' : ''; ?>>
                <header class="tactics-editor-topbar">
                    <div class="tactics-editor-topbar__group tactics-editor-topbar__group--left">
                        <button type="button" class="tactics-editor-topbar__btn tactics-editor-topbar__btn--text" id="tacticsBackBtn" title="<?php echo $lang === 'en' ? 'Back' : 'Назад'; ?>">
                            <i class="fas fa-chevron-left" aria-hidden="true"></i>
                            <span data-tactics-i18n="back"><?php echo $lang === 'en' ? 'Back' : 'Назад'; ?></span>
                        </button>
                        <button type="button" class="tactics-editor-topbar__btn tactics-editor-topbar__btn--text" id="tacticsPresentBtn" title="<?php echo $lang === 'en' ? 'Presentation mode' : 'Режим презентации'; ?>" hidden>
                            <i class="fas fa-play" aria-hidden="true"></i>
                            <span id="tacticsPresentBtnLabel" data-tactics-i18n="presentBtn"><?php echo $lang === 'en' ? 'Present' : 'Презентация'; ?></span>
                        </button>
                        <button type="button" class="tactics-editor-topbar__btn" id="tacticsUndoBtn" title="<?php echo $lang === 'en' ? 'Undo' : 'Отменить'; ?>"><i class="fas fa-undo" aria-hidden="true"></i></button>
                        <button type="button" class="tactics-editor-topbar__btn" id="tacticsRedoBtn" title="<?php echo $lang === 'en' ? 'Redo' : 'Повтор'; ?>"><i class="fas fa-redo" aria-hidden="true"></i></button>
                    </div>
                    <div class="tactics-editor-topbar__group tactics-editor-topbar__group--center">
                        <div class="tactics-editor-topbar__title-cluster">
                        <div class="tactics-editor-topbar__title-row">
                        <div class="tactics-room-visibility-wrap" id="tacticsRoomVisibilityWrap" hidden>
                            <div class="tactics-room-visibility-anchor">
                                <div class="tactics-room-password-slot<?php echo ($row['visibility'] ?? '') === 'closed' ? ' is-open' : ''; ?>" id="tacticsRoomPasswordSlot" aria-hidden="<?php echo ($row['visibility'] ?? '') === 'closed' ? 'false' : 'true'; ?>">
                                    <button type="button" class="tactics-room-password-save-btn<?php echo $roomHasPassword ? ' is-saved' : ''; ?>" id="tacticsRoomPasswordSaveBtn" data-tactics-i18n-title="roomPasswordSave" title="<?php echo $lang === 'en' ? 'Save password' : 'Сохранить пароль'; ?>" tabindex="<?php echo ($row['visibility'] ?? '') === 'closed' ? '0' : '-1'; ?>" aria-label="<?php echo $lang === 'en' ? 'Save password' : 'Сохранить пароль'; ?>">
                                        <i class="fas fa-check" aria-hidden="true"></i>
                                    </button>
                                    <input type="password" id="tacticsRoomSettingPassword" class="tactics-room-password-input" maxlength="64" autocomplete="new-password" data-tactics-i18n-placeholder="roomPasswordPlaceholder" placeholder="<?php echo $lang === 'en' ? 'Password' : 'Пароль'; ?>" tabindex="<?php echo ($row['visibility'] ?? '') === 'closed' ? '0' : '-1'; ?>"<?php echo $roomHasPassword ? ' readonly data-password-masked="1" value="••••••••"' : ''; ?>>
                                </div>
                                <input type="checkbox" class="tactics-room-visibility-toggle__input" id="tacticsRoomVisibilityToggle"<?php echo ($row['visibility'] ?? '') === 'closed' ? ' checked' : ''; ?> tabindex="-1" aria-hidden="true">
                                <button type="button" class="tactics-room-visibility-lock-btn<?php echo ($row['visibility'] ?? '') === 'closed' ? ' is-closed' : ''; ?>" id="tacticsRoomVisibilityBtn" aria-pressed="<?php echo ($row['visibility'] ?? '') === 'closed' ? 'true' : 'false'; ?>" data-tactics-i18n-title="<?php echo ($row['visibility'] ?? '') === 'closed' ? 'visibilityClosedShort' : 'visibilityOpenShort'; ?>" title="<?php echo $lang === 'en' ? (($row['visibility'] ?? '') === 'closed' ? 'Closed' : 'Open') : (($row['visibility'] ?? '') === 'closed' ? 'Закрытая' : 'Открытая'); ?>">
                                    <i class="fas <?php echo ($row['visibility'] ?? '') === 'closed' ? 'fa-lock' : 'fa-lock-open'; ?>" id="tacticsRoomVisibilityIcon" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                        <h1 class="tactics-editor-topbar__title" id="tacticsRoomTitle"><?php echo htmlspecialchars((string) $row['title'], ENT_QUOTES, 'UTF-8'); ?></h1>
                        </div>
                        </div>
                    </div>
                    <div class="tactics-editor-topbar__group tactics-editor-topbar__group--right">
                        <button type="button" class="tactics-editor-topbar__btn tactics-editor-topbar__btn--text tactics-room-delete-btn" id="tacticsDeleteRoomBtn" data-tactics-i18n-title="deleteRoom" title="<?php echo $lang === 'en' ? 'Delete room' : 'Удалить комнату'; ?>" aria-label="<?php echo $lang === 'en' ? 'Delete room' : 'Удалить комнату'; ?>" hidden>
                            <i class="fas fa-trash-alt" aria-hidden="true"></i>
                            <span data-tactics-i18n="deleteRoomLabel"><?php echo $lang === 'en' ? 'Delete room' : 'Удаление комнаты'; ?></span>
                        </button>
                        <button type="button" class="tactics-editor-topbar__btn tactics-room-code-btn" id="tacticsCopyLinkBtn" title="<?php echo $lang === 'en' ? 'Copy link' : 'Копировать ссылку'; ?>">
                            <span class="tactics-room-code-btn__text">
                                <span class="tactics-room-code-btn__label"><span data-tactics-i18n="roomCode"><?php echo $lang === 'en' ? 'Code' : 'Код'; ?></span>:</span>
                                <span class="tactics-room-code-btn__value"><?php echo htmlspecialchars($publicId, ENT_QUOTES, 'UTF-8'); ?></span>
                            </span>
                            <i class="fas fa-link tactics-room-code-btn__icon" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="tactics-editor-topbar__btn" id="tacticsDownloadScreenshotBtn" title="<?php echo $lang === 'en' ? 'Download screenshot' : 'Скачать скрин'; ?>"><i class="fas fa-download" aria-hidden="true"></i></button>
                        <div class="site-lang-switch tactics-editor-lang-switch" id="tacticsEditorLangSwitch" aria-label="<?php echo $lang === 'en' ? 'Language' : 'Язык'; ?>">
                            <a class="site-lang-link<?php echo $lang === 'ru' ? ' is-active' : ''; ?>" data-lang="ru" href="<?php echo htmlspecialchars($langRuHref, ENT_QUOTES, 'UTF-8'); ?>" aria-label="Russian">
                                <span class="site-lang-flag fi fi-ru" aria-hidden="true"></span><span class="site-lang-code">RU</span>
                            </a>
                            <a class="site-lang-link<?php echo $lang === 'en' ? ' is-active' : ''; ?>" data-lang="en" href="<?php echo htmlspecialchars($langEnHref, ENT_QUOTES, 'UTF-8'); ?>" aria-label="English">
                                <span class="site-lang-flag fi fi-us" aria-hidden="true"></span><span class="site-lang-code">US</span>
                            </a>
                        </div>
                    </div>
                </header>

                <div class="tactics-editor-body">
                <aside class="tactics-tools-column" id="tacticsToolsColumn">
                    <button type="button" class="tactics-editor-edge-toggle tactics-editor-edge-toggle--left" id="tacticsCollapseLeft" title="<?php echo $lang === 'en' ? 'Toggle tools' : 'Скрыть инструменты'; ?>" aria-expanded="true"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                    <div class="tactics-tools-column__inner">
                    <section class="tactics-room-controls" aria-label="<?php echo $lang === 'en' ? 'View options' : 'Параметры'; ?>">
                        <button type="button" class="tactics-room-controls__btn is-active" id="tacticsGridToggleBtn" title="<?php echo $lang === 'en' ? 'Toggle grid' : 'Сетка'; ?>"><i class="fas fa-border-all" aria-hidden="true"></i></button>
                        <button type="button" class="tactics-room-controls__btn" id="tacticsCursorsLockBtn" title="<?php echo $lang === 'en' ? 'Cursors lock' : 'Курсоры'; ?>" hidden><i class="fas fa-eye" aria-hidden="true"></i></button>
                        <button type="button" class="tactics-room-controls__btn is-active" id="tacticsRemoteCursorsBtn" title="<?php echo $lang === 'en' ? 'Peer cursors' : 'Курсоры участников'; ?>"><i class="fas fa-users" aria-hidden="true"></i></button>
                        <button type="button" class="tactics-room-controls__btn is-active" id="tacticsShareCursorBtn" title="<?php echo $lang === 'en' ? 'Share cursor' : 'Мой курсор'; ?>"><i class="fas fa-location-arrow" aria-hidden="true"></i></button>
                        <button type="button" class="tactics-room-controls__btn" id="tacticsClearBtn" title="<?php echo $lang === 'en' ? 'Clear slide' : 'Очистить слайд'; ?>"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
                    </section>
                    <div class="tactics-tools-scroll">
                    <section class="tactics-tools-panel">
                        <div class="tactics-palette" id="tacticsPalette">
                            <div class="tactics-palette-presets" role="group" aria-label="<?php echo $lang === 'en' ? 'Colors' : 'Цвета'; ?>">
                                <button type="button" class="tactics-palette-swatch tactics-palette-swatch--custom" id="tacticsCustomColorSwatch" data-custom="1" data-color="#ff4444" style="--swatch-color:#ff4444" title="<?php echo $lang === 'en' ? 'Custom' : 'Свой'; ?>"></button>
                                <button type="button" class="tactics-palette-swatch is-active" data-color="#ff4444" style="--swatch-color:#ff4444" title="<?php echo $lang === 'en' ? 'Red' : 'Красный'; ?>"></button>
                                <button type="button" class="tactics-palette-swatch" data-color="#22c55e" style="--swatch-color:#22c55e" title="<?php echo $lang === 'en' ? 'Green' : 'Зелёный'; ?>"></button>
                                <button type="button" class="tactics-palette-swatch" data-color="#3b82f6" style="--swatch-color:#3b82f6" title="<?php echo $lang === 'en' ? 'Blue' : 'Синий'; ?>"></button>
                                <button type="button" class="tactics-palette-swatch" data-color="#f97316" style="--swatch-color:#f97316" title="<?php echo $lang === 'en' ? 'Orange' : 'Оранжевый'; ?>"></button>
                                <button type="button" class="tactics-palette-swatch" data-color="#eab308" style="--swatch-color:#eab308" title="<?php echo $lang === 'en' ? 'Yellow' : 'Жёлтый'; ?>"></button>
                                <button type="button" class="tactics-palette-swatch" data-color="#111111" style="--swatch-color:#111111" title="<?php echo $lang === 'en' ? 'Black' : 'Чёрный'; ?>"></button>
                            </div>
                            <div class="tactics-palette-hue-row">
                                <input type="range" id="tacticsHueSlider" class="tactics-hue-slider" min="0" max="360" value="0" title="<?php echo $lang === 'en' ? 'Hue' : 'Оттенок'; ?>">
                                <div class="tactics-palette-actions">
                                    <input type="color" id="tacticsStrokeColor" class="tactics-color-input tactics-color-input--hidden" value="#ff4444" tabindex="-1" aria-hidden="true">
                                    <button type="button" class="tactics-palette-action-btn" id="tacticsResetColorBtn" title="<?php echo $lang === 'en' ? 'Reset color' : 'Сброс цвета'; ?>"><i class="fas fa-rotate-left" aria-hidden="true"></i></button>
                                    <button type="button" class="tactics-palette-action-btn" id="tacticsEyedropperBtn" title="<?php echo $lang === 'en' ? 'Eyedropper' : 'Пипетка'; ?>"><i class="fas fa-eye-dropper" aria-hidden="true"></i></button>
                                </div>
                            </div>
                        </div>
                        <div class="tactics-tool-list tactics-toolbar" id="tacticsToolbar" role="toolbar" aria-orientation="horizontal">
                            <button type="button" class="tactics-tool-btn is-active" data-tool="select" title="<?php echo $lang === 'en' ? 'Select' : 'Выбор'; ?>" aria-label="<?php echo $lang === 'en' ? 'Select' : 'Выбор'; ?>"><i class="fas fa-arrow-pointer tactics-tool-btn__icon" aria-hidden="true"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="ping" title="<?php echo $lang === 'en' ? 'Ping' : 'Пинг'; ?>" aria-label="<?php echo $lang === 'en' ? 'Ping' : 'Пинг'; ?>"><svg class="tactics-tool-btn__icon tactics-tool-btn__icon--ping" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.5"/></svg></button>
                            <button type="button" class="tactics-tool-btn" data-tool="cell" title="<?php echo $lang === 'en' ? 'Grid cell' : 'Клетка'; ?>" aria-label="<?php echo $lang === 'en' ? 'Grid cell' : 'Клетка'; ?>"><i class="fas fa-hand-pointer tactics-tool-btn__icon" aria-hidden="true"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="pen" title="<?php echo $lang === 'en' ? 'Draw' : 'Рисование'; ?>" aria-label="<?php echo $lang === 'en' ? 'Draw' : 'Рисование'; ?>"><i class="fas fa-pen tactics-tool-btn__icon" aria-hidden="true"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="circle" title="<?php echo $lang === 'en' ? 'Circle' : 'Круг'; ?>" aria-label="<?php echo $lang === 'en' ? 'Circle' : 'Круг'; ?>"><i class="far fa-circle tactics-tool-btn__icon" aria-hidden="true"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="rect" title="<?php echo $lang === 'en' ? 'Rectangle' : 'Прямоугольник'; ?>" aria-label="<?php echo $lang === 'en' ? 'Rectangle' : 'Прямоугольник'; ?>"><i class="far fa-square tactics-tool-btn__icon" aria-hidden="true"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="polygon" title="<?php echo $lang === 'en' ? 'Shape' : 'Фигура'; ?>" aria-label="<?php echo $lang === 'en' ? 'Shape' : 'Фигура'; ?>"><i class="fas fa-draw-polygon tactics-tool-btn__icon" aria-hidden="true"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="eraser" title="<?php echo $lang === 'en' ? 'Eraser' : 'Ластик'; ?>" aria-label="<?php echo $lang === 'en' ? 'Eraser' : 'Ластик'; ?>"><i class="fas fa-eraser tactics-tool-btn__icon" aria-hidden="true"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="text" title="<?php echo $lang === 'en' ? 'Text' : 'Текст'; ?>" aria-label="<?php echo $lang === 'en' ? 'Text' : 'Текст'; ?>"><i class="fas fa-font tactics-tool-btn__icon" aria-hidden="true"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="image" title="<?php echo $lang === 'en' ? 'Icons' : 'Значки'; ?>" aria-label="<?php echo $lang === 'en' ? 'Icons' : 'Значки'; ?>"><i class="fas fa-icons tactics-tool-btn__icon" aria-hidden="true"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="ruler" title="<?php echo $lang === 'en' ? 'Measure' : 'Линейка'; ?>" aria-label="<?php echo $lang === 'en' ? 'Measure' : 'Линейка'; ?>"><i class="fas fa-ruler-combined tactics-tool-btn__icon" aria-hidden="true"></i></button>
                        </div>
                        <section class="tactics-tool-context" id="tacticsToolContext">
                            <div class="tactics-tool-context__head">
                                <span class="tactics-tool-context__title" id="tacticsToolContextTitle" data-tactics-i18n="toolSelect"><?php echo $lang === 'en' ? 'Select' : 'Выбор'; ?></span>
                            </div>
                            <div class="tactics-tool-context__content" id="tacticsToolContextContent">
                                <div class="tactics-tool-panel" data-tactics-tool-panel="none" id="tacticsToolPanelNone"></div>
                                <div class="tactics-tool-panel" data-tactics-tool-panel="draw" id="tacticsToolPanelDraw" hidden>
                                    <div class="tactics-tool-field">
                                        <div class="tactics-tool-field__head">
                                            <span class="tactics-tool-field__label" data-tactics-i18n="toolSize"><?php echo $lang === 'en' ? 'Size:' : 'Размер:'; ?></span>
                                            <span class="tactics-tool-field__value" id="tacticsStrokeWidthValue">6</span>
                                        </div>
                                        <input type="range" id="tacticsStrokeWidth" class="tactics-tool-slider" min="2" max="16" value="6" title="<?php echo $lang === 'en' ? 'Width' : 'Толщина'; ?>">
                                    </div>
                                    <div class="tactics-tool-field">
                                        <div class="tactics-tool-field__head">
                                            <span class="tactics-tool-field__label" data-tactics-i18n="toolLineType"><?php echo $lang === 'en' ? 'Line Type:' : 'Тип линии:'; ?></span>
                                            <span class="tactics-tool-field__value" id="tacticsLineTypeValue" data-tactics-i18n="toolLineSolid"><?php echo $lang === 'en' ? 'Solid' : 'Сплошная'; ?></span>
                                        </div>
                                        <div class="tactics-option-row" id="tacticsLineTypeOptions" role="radiogroup">
                                            <button type="button" class="tactics-option-btn is-active" data-value="solid" aria-label="<?php echo $lang === 'en' ? 'Solid' : 'Сплошная'; ?>"><span class="tactics-line-preview tactics-line-preview--solid"></span></button>
                                            <button type="button" class="tactics-option-btn" data-value="dashed" aria-label="<?php echo $lang === 'en' ? 'Dashed' : 'Штрих'; ?>"><span class="tactics-line-preview tactics-line-preview--dashed"></span></button>
                                            <button type="button" class="tactics-option-btn" data-value="dotted" aria-label="<?php echo $lang === 'en' ? 'Dotted' : 'Пунктир'; ?>"><span class="tactics-line-preview tactics-line-preview--dotted"></span></button>
                                        </div>
                                    </div>
                                    <div class="tactics-tool-field" id="tacticsEndTypeRow">
                                        <div class="tactics-tool-field__head">
                                            <span class="tactics-tool-field__label" data-tactics-i18n="toolEndType"><?php echo $lang === 'en' ? 'End Type:' : 'Конец:'; ?></span>
                                            <span class="tactics-tool-field__value" id="tacticsEndTypeValue" data-tactics-i18n="toolEndNone"><?php echo $lang === 'en' ? 'None' : 'Нет'; ?></span>
                                        </div>
                                        <div class="tactics-option-row" id="tacticsEndTypeOptions" role="radiogroup">
                                            <button type="button" class="tactics-option-btn is-active" data-value="none" aria-label="<?php echo $lang === 'en' ? 'None' : 'Нет'; ?>"><span class="tactics-end-preview tactics-end-preview--none"></span></button>
                                            <button type="button" class="tactics-option-btn" data-value="arrow" aria-label="<?php echo $lang === 'en' ? 'Arrow' : 'Стрелка'; ?>"><span class="tactics-end-preview tactics-end-preview--arrow"></span></button>
                                            <button type="button" class="tactics-option-btn" data-value="bar" aria-label="<?php echo $lang === 'en' ? 'Bar' : 'Черта'; ?>"><span class="tactics-end-preview tactics-end-preview--bar"></span></button>
                                        </div>
                                    </div>
                                </div>
                                <div class="tactics-tool-panel" data-tactics-tool-panel="shape" id="tacticsToolPanelShape" hidden>
                                    <div class="tactics-tool-field">
                                        <div class="tactics-tool-field__head">
                                            <span class="tactics-tool-field__label" data-tactics-i18n="toolSize"><?php echo $lang === 'en' ? 'Size:' : 'Размер:'; ?></span>
                                            <span class="tactics-tool-field__value" id="tacticsShapeWidthValue">6</span>
                                        </div>
                                        <input type="range" id="tacticsStrokeWidthShape" class="tactics-tool-slider" min="2" max="16" value="6">
                                    </div>
                                    <div class="tactics-tool-field">
                                        <div class="tactics-tool-field__head">
                                            <span class="tactics-tool-field__label" data-tactics-i18n="toolLineType"><?php echo $lang === 'en' ? 'Line Type:' : 'Тип линии:'; ?></span>
                                            <span class="tactics-tool-field__value" id="tacticsShapeLineTypeValue" data-tactics-i18n="toolLineSolid"><?php echo $lang === 'en' ? 'Solid' : 'Сплошная'; ?></span>
                                        </div>
                                        <div class="tactics-option-row" id="tacticsShapeLineTypeOptions" role="radiogroup">
                                            <button type="button" class="tactics-option-btn is-active" data-value="solid" aria-label="<?php echo $lang === 'en' ? 'Solid' : 'Сплошная'; ?>"><span class="tactics-line-preview tactics-line-preview--solid"></span></button>
                                            <button type="button" class="tactics-option-btn" data-value="dashed" aria-label="<?php echo $lang === 'en' ? 'Dashed' : 'Штрих'; ?>"><span class="tactics-line-preview tactics-line-preview--dashed"></span></button>
                                            <button type="button" class="tactics-option-btn" data-value="dotted" aria-label="<?php echo $lang === 'en' ? 'Dotted' : 'Пунктир'; ?>"><span class="tactics-line-preview tactics-line-preview--dotted"></span></button>
                                        </div>
                                    </div>
                                    <label class="tactics-tool-checkbox">
                                        <input type="checkbox" id="tacticsShapeFilled">
                                        <span class="tactics-tool-checkbox__box" aria-hidden="true"></span>
                                        <span data-tactics-i18n="toolFilled"><?php echo $lang === 'en' ? 'Filled' : 'Заливка'; ?></span>
                                    </label>
                                    <div class="tactics-tool-field" id="tacticsShapeFillOpacityField" hidden>
                                        <div class="tactics-tool-field__head">
                                            <span class="tactics-tool-field__label" data-tactics-i18n="toolFillOpacity"><?php echo $lang === 'en' ? 'Fill opacity:' : 'Прозрачность:'; ?></span>
                                            <span class="tactics-tool-field__value" id="tacticsShapeFillOpacityValue">50%</span>
                                        </div>
                                        <input type="range" id="tacticsShapeFillOpacity" class="tactics-tool-slider" min="0" max="100" value="50">
                                    </div>
                                </div>
                                <div class="tactics-tool-panel" data-tactics-tool-panel="text" id="tacticsToolPanelText" hidden>
                                    <div class="tactics-tool-field">
                                        <div class="tactics-tool-field__head">
                                            <span class="tactics-tool-field__label" data-tactics-i18n="toolFontSize"><?php echo $lang === 'en' ? 'Font Size:' : 'Размер шрифта:'; ?></span>
                                            <span class="tactics-tool-field__value" id="tacticsFontSizeValue">16</span>
                                        </div>
                                        <input type="range" id="tacticsFontSize" class="tactics-tool-slider" min="10" max="32" value="16">
                                    </div>
                                    <div class="tactics-tool-field">
                                        <div class="tactics-tool-field__head">
                                            <span class="tactics-tool-field__label" data-tactics-i18n="toolTextType"><?php echo $lang === 'en' ? 'Text Type:' : 'Тип текста:'; ?></span>
                                            <span class="tactics-tool-field__value" id="tacticsTextTypeValue" data-tactics-i18n="toolTextPlain"><?php echo $lang === 'en' ? 'Text' : 'Текст'; ?></span>
                                        </div>
                                        <div class="tactics-option-row" id="tacticsTextTypeOptions" role="radiogroup">
                                            <button type="button" class="tactics-option-btn is-active" data-value="text" aria-label="Text"><span class="tactics-text-type-preview">ABC</span></button>
                                            <button type="button" class="tactics-option-btn" data-value="label" aria-label="Label"><span class="tactics-text-type-preview tactics-text-type-preview--label">ABC</span></button>
                                            <button type="button" class="tactics-option-btn" data-value="callout" aria-label="Callout"><span class="tactics-text-type-preview tactics-text-type-preview--callout">ABC</span></button>
                                        </div>
                                    </div>
                                    <div class="tactics-tool-field">
                                        <div class="tactics-tool-field__head">
                                            <span class="tactics-tool-field__label" data-tactics-i18n="toolAlignment"><?php echo $lang === 'en' ? 'Alignment:' : 'Выравнивание:'; ?></span>
                                            <span class="tactics-tool-field__value" id="tacticsTextAlignValue" data-tactics-i18n="toolAlignCenter"><?php echo $lang === 'en' ? 'Center' : 'По центру'; ?></span>
                                        </div>
                                        <div class="tactics-option-row" id="tacticsTextAlignOptions" role="radiogroup">
                                            <button type="button" class="tactics-option-btn" data-value="left" aria-label="<?php echo $lang === 'en' ? 'Left' : 'Слева'; ?>"><i class="fas fa-align-left" aria-hidden="true"></i></button>
                                            <button type="button" class="tactics-option-btn is-active" data-value="center" aria-label="<?php echo $lang === 'en' ? 'Center' : 'По центру'; ?>"><i class="fas fa-align-center" aria-hidden="true"></i></button>
                                            <button type="button" class="tactics-option-btn" data-value="right" aria-label="<?php echo $lang === 'en' ? 'Right' : 'Справа'; ?>"><i class="fas fa-align-right" aria-hidden="true"></i></button>
                                        </div>
                                    </div>
                                </div>
                                <div class="tactics-tool-panel" data-tactics-tool-panel="ping" id="tacticsToolPanelPing" hidden>
                                    <div class="tactics-tool-field">
                                        <div class="tactics-tool-field__head">
                                            <span class="tactics-tool-field__label" data-tactics-i18n="toolPingSize"><?php echo $lang === 'en' ? 'Ping size:' : 'Размер пинга:'; ?></span>
                                            <span class="tactics-tool-field__value" id="tacticsPingSizeValue">70</span>
                                        </div>
                                        <input type="range" id="tacticsPingSize" class="tactics-tool-slider" min="24" max="140" value="70">
                                    </div>
                                    <div class="tactics-tool-field">
                                        <div class="tactics-tool-field__head">
                                            <span class="tactics-tool-field__label" data-tactics-i18n="toolPingStrokeWidth"><?php echo $lang === 'en' ? 'Ring thickness:' : 'Толщина кольца:'; ?></span>
                                            <span class="tactics-tool-field__value" id="tacticsPingStrokeWidthValue">6</span>
                                        </div>
                                        <input type="range" id="tacticsPingStrokeWidth" class="tactics-tool-slider" min="1" max="12" value="6">
                                    </div>
                                </div>
                                <div class="tactics-tool-panel" data-tactics-tool-panel="cell" id="tacticsToolPanelCell" hidden>
                                    <div class="tactics-tool-field">
                                        <div class="tactics-tool-field__head">
                                            <span class="tactics-tool-field__label" data-tactics-i18n="toolCellFlashDuration"><?php echo $lang === 'en' ? 'Highlight duration:' : 'Время подсветки:'; ?></span>
                                            <span class="tactics-tool-field__value" id="tacticsCellFlashDurationValue">2.0 <?php echo $lang === 'en' ? 's' : 'с'; ?></span>
                                        </div>
                                        <input type="range" id="tacticsCellFlashDuration" class="tactics-tool-slider" min="400" max="4000" step="100" value="2000">
                                    </div>
                                </div>
                                <div class="tactics-tool-panel" data-tactics-tool-panel="icons" id="tacticsToolPanelIcons" hidden>
                                    <input type="text" id="tacticsIconLabel" class="tactics-icon-label-input" autocomplete="off" placeholder="<?php echo $lang === 'en' ? 'Label (optional)' : 'Подпись (необяз.)'; ?>" data-tactics-i18n-placeholder="toolIconLabel">
                                    <div class="tactics-tool-field">
                                        <div class="tactics-tool-field__head">
                                            <span class="tactics-tool-field__label" data-tactics-i18n="toolIconSize"><?php echo $lang === 'en' ? 'Icon size:' : 'Размер значка:'; ?></span>
                                            <span class="tactics-tool-field__value" id="tacticsIconSizeValue">16</span>
                                        </div>
                                        <input type="range" id="tacticsIconSize" class="tactics-tool-slider" min="10" max="28" value="16">
                                    </div>
                                    <div class="tactics-tool-field">
                                        <div class="tactics-tool-field__head">
                                            <span class="tactics-tool-field__label" data-tactics-i18n="toolIconLabelSize"><?php echo $lang === 'en' ? 'Label size:' : 'Размер подписи:'; ?></span>
                                            <span class="tactics-tool-field__value" id="tacticsIconLabelSizeValue">14</span>
                                        </div>
                                        <input type="range" id="tacticsIconLabelSize" class="tactics-tool-slider" min="8" max="24" value="14">
                                    </div>
                                    <div class="tactics-option-row tactics-option-row--markers" id="tacticsIconMarkerOptions" role="radiogroup"></div>
                                    <hr class="tactics-tool-divider">
                                    <div class="tactics-icon-grid-scroll">
                                        <div class="tactics-icon-grid" id="tacticsIconGrid" role="radiogroup"></div>
                                    </div>
                                </div>
                            </div>
                        </section>
                        <input type="file" id="tacticsImageUpload" accept="image/webp,image/png,image/jpeg" hidden>
                    </section>
                    </div>
                    <div class="tactics-chat-dock" id="tacticsChatDock">
                        <section class="tactics-chat-panel" id="tacticsChatPanel">
                            <button type="button" class="tactics-menu-section-head tactics-chat-toggle" id="tacticsChatToggle" aria-expanded="true" aria-controls="tacticsChatBody">
                                <span class="tactics-menu-section-head__title" data-tactics-i18n="chatTitle"><?php echo $lang === 'en' ? 'Chat' : 'Чат'; ?></span>
                                <i class="fas fa-chevron-up tactics-chat-toggle__icon" aria-hidden="true"></i>
                            </button>
                            <div class="tactics-chat-body" id="tacticsChatBody">
                                <ul class="tactics-chat-messages" id="tacticsChatMessages" aria-live="polite"></ul>
                                <p class="tactics-chat-empty" id="tacticsChatEmpty" data-tactics-i18n="chatEmpty"><?php echo $lang === 'en' ? 'No messages yet' : 'Сообщений пока нет'; ?></p>
                                <p class="tactics-chat-error" id="tacticsChatError" hidden></p>
                            </div>
                            <form class="tactics-chat-form" id="tacticsChatForm">
                                <input type="text" id="tacticsChatInput" class="tactics-chat-input" maxlength="500" autocomplete="off" placeholder="<?php echo $lang === 'en' ? 'Message…' : 'Сообщение…'; ?>" data-tactics-i18n-placeholder="chatPlaceholder">
                                <button type="submit" class="tactics-chat-send" title="<?php echo $lang === 'en' ? 'Send' : 'Отправить'; ?>"><i class="fas fa-paper-plane" aria-hidden="true"></i></button>
                            </form>
                        </section>
                    </div>
                    </div>
                </aside>

                <section class="tactics-canvas-panel">
                    <div class="tactics-map-column">
                        <div class="tactics-map-grid is-map-loading" id="tacticsMapGrid">
                            <div class="tactics-grid-corner" aria-hidden="true"></div>
                            <div class="tactics-grid-top" aria-hidden="true">
                                <?php foreach (['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as $col) : ?>
                                    <span><?php echo $col; ?></span>
                                <?php endforeach; ?>
                            </div>
                            <div class="tactics-grid-left" aria-hidden="true">
                                <?php foreach (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'] as $rowLabel) : ?>
                                    <span><?php echo $rowLabel; ?></span>
                                <?php endforeach; ?>
                            </div>
                            <div class="tactics-map-canvas-stack">
                                <div class="tactics-canvas-wrap">
                                    <canvas id="tacticsCanvas"></canvas>
                                </div>
                                <div class="tactics-canvas-overlays" id="tacticsCanvasOverlays" aria-hidden="true"></div>
                                <div id="tacticsDotaPickAction" class="tactics-dota-pick-action" hidden>
                                    <button type="button" class="tactics-dota-pick-btn" id="tacticsDotaPickBtn">
                                        <i class="fas fa-hand-pointer" aria-hidden="true"></i>
                                        <span data-tactics-i18n="dotaMakePick"><?php echo $lang === 'en' ? 'Make pick' : 'Сделать выбор'; ?></span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <p class="tactics-map-scale" id="tacticsMapScale" aria-live="polite" hidden></p>
                    </div>
                </section>

                <aside class="tactics-right-sidebar" id="tacticsRightColumn">
                    <button type="button" class="tactics-editor-edge-toggle tactics-editor-edge-toggle--right" id="tacticsCollapseRight" title="<?php echo $lang === 'en' ? 'Toggle sidebar' : 'Скрыть панель'; ?>" aria-expanded="true"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
                    <div class="tactics-right-sidebar__inner">
                    <section class="tactics-sidebar-panel tactics-sidebar-panel--users">
                        <div class="tactics-menu-section-head tactics-users-head">
                            <span class="tactics-menu-section-head__title">
                                <span data-tactics-i18n="sidebarOnline"><?php echo $lang === 'en' ? 'Users' : 'Участники'; ?></span>
                                <span class="tactics-users-count" id="tacticsUsersCount">(0)</span>
                            </span>
                            <button type="button" class="tactics-editor-inline-btn tactics-users-perms-btn" id="tacticsDrawLockBtnSide" title="<?php echo $lang === 'en' ? 'Drawing permissions' : 'Права на рисование'; ?>" hidden>
                                <span data-tactics-i18n="drawPermissionsLabel"><?php echo $lang === 'en' ? 'Permissions' : 'Права'; ?></span>
                                <i class="fas fa-lock" aria-hidden="true"></i>
                            </button>
                        </div>
                        <ul id="tacticsParticipants" class="tactics-participants-list"></ul>
                    </section>
                    <section class="tactics-sidebar-panel tactics-sidebar-panel--slides" id="tacticsMapsPanel">
                        <div class="tactics-menu-section-head tactics-slides-head">
                            <span class="tactics-menu-section-head__title" data-tactics-i18n="slidesSection"><?php echo $lang === 'en' ? 'Slides' : 'Слайды'; ?></span>
                            <div class="tactics-slides-head__actions">
                                <button type="button" class="tactics-slides-nav-btn" id="tacticsSlidesScrollLeft" data-tactics-i18n-title="slidesPrev" title="<?php echo $lang === 'en' ? 'Previous slide' : 'Предыдущий слайд'; ?>" aria-label="<?php echo $lang === 'en' ? 'Previous slide' : 'Предыдущий слайд'; ?>"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                                <button type="button" class="tactics-slides-nav-btn" id="tacticsSlidesScrollRight" data-tactics-i18n-title="slidesNext" title="<?php echo $lang === 'en' ? 'Next slide' : 'Следующий слайд'; ?>" aria-label="<?php echo $lang === 'en' ? 'Next slide' : 'Следующий слайд'; ?>"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
                                <button type="button" class="tactics-slides-nav-btn" id="tacticsSlidesViewToggle" data-tactics-i18n-title="slidesViewList" title="<?php echo $lang === 'en' ? 'List view' : 'Список'; ?>" aria-label="<?php echo $lang === 'en' ? 'List view' : 'Список'; ?>"><i class="fas fa-list" id="tacticsSlidesViewToggleIcon" aria-hidden="true"></i></button>
                                <button type="button" class="tactics-add-slide-btn" id="tacticsAddSlideBtn">
                                    <span data-tactics-i18n="addSlide"><?php echo $lang === 'en' ? 'Add' : 'Добавить'; ?></span>
                                    <i class="fas fa-plus" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                        <div class="tactics-slides-strip-wrap tactics-slides-strip-wrap--grid" id="tacticsSlidesStripWrap">
                            <button type="button" class="tactics-slides-carousel-btn tactics-slides-carousel-btn--prev" id="tacticsSlidesCarouselPrev" data-tactics-i18n-title="slidesPrev" title="<?php echo $lang === 'en' ? 'Previous slide' : 'Предыдущий слайд'; ?>" aria-label="<?php echo $lang === 'en' ? 'Previous slide' : 'Предыдущий слайд'; ?>" hidden><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                            <div class="tactics-slides-carousel-viewport" id="tacticsSlidesCarouselViewport">
                                <ul id="tacticsSlidesList" class="tactics-slides-list tactics-slides-list--grid"></ul>
                            </div>
                            <button type="button" class="tactics-slides-carousel-btn tactics-slides-carousel-btn--next" id="tacticsSlidesCarouselNext" data-tactics-i18n-title="slidesNext" title="<?php echo $lang === 'en' ? 'Next slide' : 'Следующий слайд'; ?>" aria-label="<?php echo $lang === 'en' ? 'Next slide' : 'Следующий слайд'; ?>" hidden><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
                        </div>
                    </section>
                    </div>
                </aside>
                </div>
                <nav class="tactics-mobile-bar" id="tacticsMobileBar" aria-label="<?php echo $lang === 'en' ? 'Slides' : 'Слайды'; ?>">
                    <button type="button" class="tactics-mobile-bar__btn" id="tacticsMobileSlidePrev" data-tactics-i18n-title="slidesPrev" title="<?php echo $lang === 'en' ? 'Previous slide' : 'Предыдущий слайд'; ?>" aria-label="<?php echo $lang === 'en' ? 'Previous slide' : 'Предыдущий слайд'; ?>"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                    <span class="tactics-mobile-bar__label" id="tacticsMobileSlideLabel" aria-live="polite">—</span>
                    <button type="button" class="tactics-mobile-bar__btn" id="tacticsMobileSlideNext" data-tactics-i18n-title="slidesNext" title="<?php echo $lang === 'en' ? 'Next slide' : 'Следующий слайд'; ?>" aria-label="<?php echo $lang === 'en' ? 'Next slide' : 'Следующий слайд'; ?>"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
                </nav>
                <span class="tactics-editor-build" aria-hidden="true"><?php echo htmlspecialchars($siteVersion, ENT_QUOTES, 'UTF-8'); ?></span>
            </div>

            <?php
            $mapSelectId = 'tacticsAddSlideMap';
            $mapPickerModalId = 'tacticsMapPickerModal';
            require __DIR__ . '/_map_picker_modal.php';
            ?>

            <?php
            $asOverlay = true;
            require __DIR__ . '/_room_gone.php';
            unset($asOverlay);
            ?>
        </main>

<?php
require __DIR__ . '/../../includes/site_footer.php';
?>
    <script>
        window.ABS_TACTICS_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_TACTICS_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_TACTICS_PUBLIC_ID = <?php echo json_encode($publicId); ?>;
        window.ABS_TACTICS_NEEDS_PASSWORD = <?php echo json_encode($needsPassword); ?>;
        window.ABS_TACTICS_INITIAL_ROOM = <?php echo json_encode($roomItemBoot); ?>;
        window.ABS_TACTICS_MAP_URLS = <?php echo json_encode($mapUrls); ?>;
        window.ABS_TACTICS_GET_API = <?php echo json_encode(user_api_path('/api/tactics/get.php')); ?>;
        window.ABS_TACTICS_JOIN_API = <?php echo json_encode(user_api_path('/api/tactics/join.php')); ?>;
        window.ABS_TACTICS_UPDATE_API = <?php echo json_encode(user_api_path('/api/tactics/update.php')); ?>;
        window.ABS_TACTICS_SYNC_API = <?php echo json_encode(user_api_path('/api/tactics/sync.php')); ?>;
        window.ABS_TACTICS_DELETE_API = <?php echo json_encode(user_api_path('/api/tactics/delete.php')); ?>;
        window.ABS_TACTICS_MAPS_API = <?php echo json_encode(user_api_path('/api/get_maps.php')); ?>;
        window.ABS_TACTICS_CATALOG_API = <?php echo json_encode(user_api_path('/api/tactics/maps.php')); ?>;
        window.ABS_TACTICS_DEFAULT_NICK = <?php echo json_encode($defaultNickname); ?>;
        window.ABS_TACTICS_IS_LOGGED_IN = <?php echo json_encode($userLoggedIn); ?>;
        window.ABS_TACTICS_IS_OWNER = <?php echo json_encode($isRoomOwner); ?>;
        window.ABS_TACTICS_GAME_NICKS = <?php echo json_encode($gameNicknames); ?>;
        window.ABS_TACTICS_LOBBY_HREF = <?php echo json_encode($lobbyHref); ?>;
        window.ABS_TACTICS_ROOMS_HREF = <?php echo json_encode($roomsHref); ?>;
        window.ABS_TACTICS_UPLOAD_CUSTOM_MAP_API = <?php echo json_encode(user_api_path('/api/tactics/upload_custom_map.php')); ?>;
        window.ABS_TACTICS_DUPLICATE_CUSTOM_MAP_API = <?php echo json_encode(user_api_path('/api/tactics/duplicate_custom_map.php')); ?>;
        window.ABS_TACTICS_WS_URL = <?php echo json_encode(tactics_ws_public_url()); ?>;
        window.ABS_TACTICS_PRESENCE_API = <?php echo json_encode(user_api_path('/api/tactics/presence.php')); ?>;
        window.ABS_TACTICS_EVENT_API = <?php echo json_encode(user_api_path('/api/tactics/event.php')); ?>;
        window.ABS_TACTICS_CHAT_API = <?php echo json_encode(user_api_path('/api/tactics/chat.php')); ?>;
    </script>
    <script src="/js/services/tactics/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/store.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/maps.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/custom-select.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/map-picker.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/ws-client.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/slides.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/icons.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/tool-settings.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/canvas.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/chat.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/room.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
