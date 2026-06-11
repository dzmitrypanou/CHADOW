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
$bodyClass = 'page-tactics page-tactics-room' . ($needsPassword ? ' page-tactics-room-locked' : '');
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
    $preloadAllUrls = array_values(array_unique(array_filter($mapUrls)));
    if ($preloadAllUrls !== []) {
        $extraHeadHtml .= '<script>(function(u){u.forEach(function(s){var i=new Image();i.crossOrigin="anonymous";i.src=s})})('
            . json_encode($preloadAllUrls, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
            . ')</script>';
    }
}

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="tactics-service tactics-room-layout<?php echo $needsPassword ? ' tactics-room-layout--locked' : ''; ?>">
            <section class="tactics-panel tactics-room-header" id="tacticsRoomHeader"<?php echo $needsPassword ? ' hidden' : ''; ?>>
                <div class="tactics-section-head">
                    <div class="tactics-room-header-main">
                        <a class="tactics-back-link" href="<?php echo htmlspecialchars($lobbyHref, ENT_QUOTES, 'UTF-8'); ?>">
                            <i class="fas fa-arrow-left" aria-hidden="true"></i>
                            <?php echo $lang === 'en' ? 'All rooms' : 'Все комнаты'; ?>
                        </a>
                        <h2 class="tactics-section-title" id="tacticsRoomTitle"><?php echo htmlspecialchars((string) $row['title'], ENT_QUOTES, 'UTF-8'); ?></h2>
                    </div>
                    <div class="tactics-section-actions">
                        <button type="button" class="tactics-back-link tactics-room-code-btn" id="tacticsCopyLinkBtn" title="<?php echo $lang === 'en' ? 'Copy link' : 'Копировать ссылку'; ?>">
                            <i class="fas fa-link tactics-room-code-btn__icon" aria-hidden="true"></i>
                            <span class="tactics-room-code-btn__text">
                                <span class="tactics-room-code-btn__label"><?php echo $lang === 'en' ? 'Code' : 'Код'; ?>:</span>
                                <span class="tactics-room-code-btn__value" id="tacticsRoomCode"><?php echo htmlspecialchars($publicId, ENT_QUOTES, 'UTF-8'); ?></span>
                            </span>
                        </button>
                    </div>
                </div>
            </section>

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

            <div id="tacticsRoomWorkspace" class="tactics-room-workspace"<?php echo $needsPassword ? ' hidden' : ''; ?>>
                <aside class="tactics-tools-column">
                    <section class="tactics-panel tactics-tools-panel">
                        <div class="tactics-palette" id="tacticsPalette">
                            <div class="tactics-palette-presets" role="group" aria-label="<?php echo $lang === 'en' ? 'Colors' : 'Цвета'; ?>">
                                <button type="button" class="tactics-palette-swatch" data-color="#22c55e" style="--swatch-color:#22c55e" title="<?php echo $lang === 'en' ? 'Green' : 'Зелёный'; ?>"></button>
                                <button type="button" class="tactics-palette-swatch is-active" data-color="#ff4444" style="--swatch-color:#ff4444" title="<?php echo $lang === 'en' ? 'Red' : 'Красный'; ?>"></button>
                                <button type="button" class="tactics-palette-swatch" data-color="#3b82f6" style="--swatch-color:#3b82f6" title="<?php echo $lang === 'en' ? 'Blue' : 'Синий'; ?>"></button>
                                <button type="button" class="tactics-palette-swatch" data-color="#f97316" style="--swatch-color:#f97316" title="<?php echo $lang === 'en' ? 'Orange' : 'Оранжевый'; ?>"></button>
                                <button type="button" class="tactics-palette-swatch" data-color="#111111" style="--swatch-color:#111111" title="<?php echo $lang === 'en' ? 'Black' : 'Чёрный'; ?>"></button>
                            </div>
                            <input type="range" id="tacticsHueSlider" class="tactics-hue-slider" min="0" max="360" value="0" title="<?php echo $lang === 'en' ? 'Hue' : 'Оттенок'; ?>">
                            <div class="tactics-palette-actions">
                                <input type="color" id="tacticsStrokeColor" class="tactics-color-input" value="#ff4444" title="<?php echo $lang === 'en' ? 'Color' : 'Цвет'; ?>">
                                <input type="color" id="tacticsStrokeColorSecondary" class="tactics-color-input tactics-color-input--secondary" value="#3b82f6" title="<?php echo $lang === 'en' ? 'Secondary color' : 'Второй цвет'; ?>">
                                <button type="button" class="tactics-tool-btn tactics-palette-action-btn" id="tacticsSwapColorsBtn" title="<?php echo $lang === 'en' ? 'Swap colors' : 'Поменять цвета'; ?>"><i class="fas fa-exchange-alt" aria-hidden="true"></i></button>
                                <button type="button" class="tactics-tool-btn tactics-palette-action-btn" id="tacticsEyedropperBtn" title="<?php echo $lang === 'en' ? 'Eyedropper' : 'Пипетка'; ?>"><i class="fas fa-eye-dropper" aria-hidden="true"></i></button>
                            </div>
                        </div>
                        <div class="tactics-toolbar tactics-toolbar--grid" id="tacticsToolbar">
                            <button type="button" class="tactics-tool-btn is-active" data-tool="select" title="<?php echo $lang === 'en' ? 'Select' : 'Выбор'; ?>"><i class="fas fa-mouse-pointer"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="pen" title="<?php echo $lang === 'en' ? 'Pen' : 'Карандаш'; ?>"><i class="fas fa-pen"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="line" title="<?php echo $lang === 'en' ? 'Line' : 'Линия'; ?>"><i class="fas fa-minus"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="arrow" title="<?php echo $lang === 'en' ? 'Arrow' : 'Стрелка'; ?>"><i class="fas fa-long-arrow-alt-right"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="rect" title="<?php echo $lang === 'en' ? 'Rectangle' : 'Прямоугольник'; ?>"><i class="far fa-square"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="circle" title="<?php echo $lang === 'en' ? 'Circle' : 'Круг'; ?>"><i class="far fa-circle"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="polygon" title="<?php echo $lang === 'en' ? 'Polygon' : 'Многоугольник'; ?>"><i class="fas fa-draw-polygon"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="eraser" title="<?php echo $lang === 'en' ? 'Eraser' : 'Ластик'; ?>"><i class="fas fa-eraser"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="text" title="<?php echo $lang === 'en' ? 'Text' : 'Текст'; ?>"><i class="fas fa-font"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="image" title="<?php echo $lang === 'en' ? 'Image' : 'Изображение'; ?>"><i class="fas fa-image"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="ping" title="<?php echo $lang === 'en' ? 'Ping map' : 'Пинг по карте'; ?>"><i class="fas fa-crosshairs"></i></button>
                            <button type="button" class="tactics-tool-btn" data-tool="ruler" title="<?php echo $lang === 'en' ? 'Ruler' : 'Линейка'; ?>"><i class="fas fa-ruler-horizontal"></i></button>
                        </div>
                        <div class="tactics-toolbar-room" id="tacticsToolbarRoom">
                            <input type="range" id="tacticsStrokeWidth" class="tactics-width-input tactics-width-input--horizontal" min="2" max="16" value="6" title="<?php echo $lang === 'en' ? 'Width' : 'Толщина'; ?>">
                            <div class="tactics-toolbar-room__row">
                                <button type="button" class="tactics-tool-btn is-active" id="tacticsDrawLockBtn" title="<?php echo $lang === 'en' ? 'Drawing lock' : 'Блокировка рисования'; ?>"><i class="fas fa-lock" aria-hidden="true"></i></button>
                                <button type="button" class="tactics-tool-btn" id="tacticsCursorsLockBtn" title="<?php echo $lang === 'en' ? 'Cursors lock' : 'Блокировка курсоров'; ?>"><i class="fas fa-eye-slash" aria-hidden="true"></i></button>
                                <button type="button" class="tactics-tool-btn is-active" id="tacticsGridToggleBtn" title="<?php echo $lang === 'en' ? 'Toggle grid' : 'Сетка'; ?>"><i class="fas fa-border-all"></i></button>
                                <button type="button" class="tactics-tool-btn is-active" id="tacticsRemoteCursorsBtn" title="<?php echo $lang === 'en' ? 'Peer cursors' : 'Курсоры'; ?>"><i class="fas fa-users"></i></button>
                                <button type="button" class="tactics-tool-btn is-active" id="tacticsShareCursorBtn" title="<?php echo $lang === 'en' ? 'Share cursor' : 'Мой курсор'; ?>"><i class="fas fa-location-arrow"></i></button>
                            </div>
                            <div class="tactics-toolbar-room__row">
                                <button type="button" class="tactics-tool-btn" id="tacticsUndoBtn" title="<?php echo $lang === 'en' ? 'Undo' : 'Отменить'; ?>"><i class="fas fa-undo"></i></button>
                                <button type="button" class="tactics-tool-btn" id="tacticsRedoBtn" title="<?php echo $lang === 'en' ? 'Redo' : 'Повтор'; ?>"><i class="fas fa-redo"></i></button>
                                <button type="button" class="tactics-tool-btn" id="tacticsClearBtn" title="<?php echo $lang === 'en' ? 'Clear slide' : 'Очистить'; ?>"><i class="fas fa-trash-alt"></i></button>
                            </div>
                        </div>
                        <input type="file" id="tacticsImageUpload" accept="image/webp,image/png,image/jpeg" hidden>
                    </section>
                    <section class="tactics-panel tactics-chat-panel" id="tacticsChatPanel">
                        <button type="button" class="tactics-chat-toggle" id="tacticsChatToggle" aria-expanded="true">
                            <span data-tactics-i18n="chatTitle"><?php echo $lang === 'en' ? 'Chat' : 'Чат'; ?></span>
                            <i class="fas fa-chevron-up tactics-chat-toggle__icon" aria-hidden="true"></i>
                        </button>
                        <div class="tactics-chat-body" id="tacticsChatBody">
                            <ul class="tactics-chat-messages" id="tacticsChatMessages" aria-live="polite"></ul>
                            <form class="tactics-chat-form" id="tacticsChatForm">
                                <input type="text" id="tacticsChatInput" class="tactics-chat-input" maxlength="500" autocomplete="off" placeholder="<?php echo $lang === 'en' ? 'Message…' : 'Сообщение…'; ?>">
                                <button type="submit" class="tactics-chat-send" title="<?php echo $lang === 'en' ? 'Send' : 'Отправить'; ?>"><i class="fas fa-paper-plane" aria-hidden="true"></i></button>
                            </form>
                        </div>
                    </section>
                </aside>

                <section class="tactics-canvas-panel">
                    <div class="tactics-map-column">
                        <div class="tactics-map-grid" id="tacticsMapGrid">
                            <div class="tactics-grid-corner" aria-hidden="true"></div>
                            <div class="tactics-grid-top" aria-hidden="true">
                                <?php foreach (['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as $col) : ?>
                                    <span><?php echo $col; ?></span>
                                <?php endforeach; ?>
                            </div>
                            <div class="tactics-grid-left" aria-hidden="true">
                                <?php foreach (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as $rowLabel) : ?>
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

                <aside class="tactics-right-sidebar">
                    <section class="tactics-panel tactics-sidebar-panel">
                        <h4 class="tactics-sidebar-title" data-tactics-i18n="sidebarOnline"><?php echo $lang === 'en' ? 'Users' : 'Участники'; ?></h4>
                        <ul id="tacticsParticipants" class="tactics-participants-list"></ul>
                    </section>
                    <section class="tactics-panel tactics-sidebar-panel" id="tacticsRoomSettings" hidden>
                        <h4 class="tactics-sidebar-title"><?php echo $lang === 'en' ? 'Room settings' : 'Настройки комнаты'; ?></h4>
                        <span class="tactics-field-label" id="tacticsRoomVisibility-label">
                            <?php echo $lang === 'en' ? 'Visibility' : 'Видимость'; ?>
                        </span>
                        <div id="tacticsRoomVisibilitySwitch" class="bracket-visibility-switch" role="radiogroup" aria-labelledby="tacticsRoomVisibility-label">
                            <label class="bracket-visibility-switch__option<?php echo ($row['visibility'] ?? '') === 'open' ? ' is-active' : ''; ?>">
                                <input type="radio" name="room_visibility" value="open"<?php echo ($row['visibility'] ?? '') === 'open' ? ' checked' : ''; ?>>
                                <span class="bracket-visibility-switch__text">
                                    <?php echo $lang === 'en' ? 'Open' : 'Открытая'; ?>
                                </span>
                            </label>
                            <label class="bracket-visibility-switch__option<?php echo ($row['visibility'] ?? '') === 'closed' ? ' is-active' : ''; ?>">
                                <input type="radio" name="room_visibility" value="closed"<?php echo ($row['visibility'] ?? '') === 'closed' ? ' checked' : ''; ?>>
                                <span class="bracket-visibility-switch__text">
                                    <?php echo $lang === 'en' ? 'Closed' : 'Закрытая'; ?>
                                </span>
                            </label>
                        </div>
                        <label class="tactics-field tactics-room-password-field" id="tacticsRoomPasswordSetting"<?php echo ($row['visibility'] ?? '') === 'closed' ? '' : ' hidden'; ?>>
                            <span class="tactics-field-label"><?php echo $lang === 'en' ? 'New password (optional)' : 'Новый пароль (необязательно)'; ?></span>
                            <input type="password" id="tacticsRoomSettingPassword" maxlength="64" autocomplete="new-password" placeholder="<?php echo $lang === 'en' ? 'Leave empty to keep current' : 'Пусто — оставить текущий'; ?>">
                        </label>
                        <div class="tactics-room-delete-wrap">
                            <button type="button" class="tactics-room-delete-btn" id="tacticsDeleteRoomBtn">
                                <i class="fas fa-trash-alt" aria-hidden="true"></i>
                                <?php echo $lang === 'en' ? 'Delete room' : 'Удалить комнату'; ?>
                            </button>
                        </div>
                    </section>
                    <section class="tactics-panel tactics-sidebar-panel tactics-sidebar-panel--slides" id="tacticsMapsPanel">
                        <div class="tactics-slides-head">
                            <h4 class="tactics-sidebar-title" data-tactics-i18n="slidesSection"><?php echo $lang === 'en' ? 'Slides' : 'Слайды'; ?></h4>
                            <div class="tactics-slides-head__actions">
                                <button type="button" class="tactics-icon-btn" id="tacticsSlidesScrollLeft" title="<?php echo $lang === 'en' ? 'Scroll left' : 'Влево'; ?>"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                                <button type="button" class="tactics-icon-btn" id="tacticsSlidesScrollRight" title="<?php echo $lang === 'en' ? 'Scroll right' : 'Вправо'; ?>"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
                                <button type="button" class="tactics-add-slide-btn" id="tacticsAddSlideBtn" data-tactics-i18n="addSlide"><?php echo $lang === 'en' ? '+ Add' : '+ Добавить'; ?></button>
                            </div>
                        </div>
                        <div class="tactics-slides-strip-wrap">
                            <ul id="tacticsSlidesList" class="tactics-slides-list tactics-slides-list--strip"></ul>
                        </div>
                        <div id="tacticsCustomMapUpload" class="tactics-custom-map-upload" hidden>
                            <button type="button" class="tactics-custom-map-upload__btn" id="tacticsCustomMapUploadBtn">
                                <i class="fas fa-cloud-upload-alt" aria-hidden="true"></i>
                                <span data-tactics-i18n="uploadCustomMap"><?php echo $lang === 'en' ? 'Upload map' : 'Загрузить карту'; ?></span>
                            </button>
                            <input type="file" id="tacticsCustomMapFile" accept="image/webp,image/png,image/jpeg" hidden>
                            <p class="tactics-custom-map-upload__hint" data-tactics-i18n="uploadCustomMapHint"><?php echo $lang === 'en' ? 'PNG, JPEG or WebP, max 8 MB' : 'PNG, JPEG или WebP, макс. 8 МБ'; ?></p>
                        </div>
                        <div id="tacticsAddSlideField" class="tactics-add-slide-field" hidden>
                            <?php
                            $mapPickerId = 'tacticsAddMapPicker';
                            $mapSelectId = 'tacticsAddSlideMap';
                            require __DIR__ . '/_map_picker.php';
                            ?>
                        </div>
                    </section>
                </aside>
            </div>

            <?php
            $asOverlay = true;
            require __DIR__ . '/_room_gone.php';
            unset($asOverlay);
            ?>
        </main>

<?php
require __DIR__ . '/../../includes/site_footer.php';
?>
    <script src="https://cdn.jsdelivr.net/npm/fabric@5.3.0/dist/fabric.min.js" defer></script>
    <script>
        window.ABS_TACTICS_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_TACTICS_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_TACTICS_PUBLIC_ID = <?php echo json_encode($publicId); ?>;
        window.ABS_TACTICS_NEEDS_PASSWORD = <?php echo json_encode($needsPassword); ?>;
        window.ABS_TACTICS_INITIAL_ROOM = <?php echo json_encode($needsPassword ? null : $roomItem); ?>;
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
        window.ABS_TACTICS_GAME_NICKS = <?php echo json_encode($gameNicknames); ?>;
        window.ABS_TACTICS_LOBBY_HREF = <?php echo json_encode($lobbyHref); ?>;
        window.ABS_TACTICS_ROOMS_HREF = <?php echo json_encode($roomsHref); ?>;
        window.ABS_TACTICS_UPLOAD_CUSTOM_MAP_API = <?php echo json_encode(user_api_path('/api/tactics/upload_custom_map.php')); ?>;
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
    <script src="/js/services/tactics/canvas.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/chat.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/room.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
