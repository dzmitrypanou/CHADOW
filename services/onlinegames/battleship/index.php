<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/../../../includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

require_once __DIR__ . '/../../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../../includes/user_auth.php';
require_once __DIR__ . '/../../../includes/battleship_helpers.php';
require_once __DIR__ . '/../../../includes/onlinegames_helpers.php';

$defaultNickname = '';
if (user_is_logged_in()) {
    $uid = user_current_id();
    $profile = $uid !== null ? user_login_row($userDb, $uid) : null;
    if (is_array($profile) && !empty($profile['username'])) {
        $defaultNickname = (string) $profile['username'];
    }
}

$meta = battleship_meta($lang);
$pageTitle = $meta['title'];
abs_set_page_titles('Морской бой', 'Battleship Online');
$metaDescription = $meta['desc'];
$bodyClass = 'page-checkers page-battleship page-battleship-lobby';
$seoSlug = 'services/onlinegames/battleship';
$hubHref = onlinegames_build_href($lang);

require __DIR__ . '/../../../includes/site_header.php';
?>

        <main class="checkers-service battleship-service">
            <section class="checkers-panel checkers-service-header">
                <div class="checkers-section-head">
                    <div>
                        <h2 class="checkers-section-title" data-battleship-i18n="title"><?php echo htmlspecialchars($meta['title'], ENT_QUOTES, 'UTF-8'); ?></h2>
                        <p class="checkers-section-hint" data-battleship-i18n="hint"><?php echo htmlspecialchars($meta['desc'], ENT_QUOTES, 'UTF-8'); ?></p>
                    </div>
                    <div class="checkers-section-actions">
                        <a class="checkers-back-link" href="<?php echo htmlspecialchars($hubHref, ENT_QUOTES, 'UTF-8'); ?>">
                            <i class="fas fa-arrow-left" aria-hidden="true"></i>
                            <span data-battleship-i18n="backToHub"><?php echo $lang === 'en' ? 'Online games' : 'К онлайн-играм'; ?></span>
                        </a>
                    </div>
                </div>
            </section>

            <div class="checkers-lobby-grid">
                <section class="checkers-panel checkers-lobby-card">
                    <h3 class="checkers-panel-title" data-battleship-i18n="createTitle"><?php echo $lang === 'en' ? 'Create a game' : 'Создать игру'; ?></h3>
                    <p class="checkers-panel-desc" data-battleship-i18n="createDesc"><?php echo $lang === 'en'
                        ? 'You are the host. Choose board size and share the room link.'
                        : 'Вы — хост. Выберите размер поля и отправьте ссылку сопернику.'; ?></p>
                    <label class="checkers-field" for="battleshipNicknameInput">
                        <span class="checkers-field-label" data-battleship-i18n="nicknameLabel"><?php echo $lang === 'en' ? 'Nickname' : 'Ник'; ?></span>
                        <input
                            type="text"
                            id="battleshipNicknameInput"
                            maxlength="32"
                            autocomplete="nickname"
                            value="<?php echo htmlspecialchars($defaultNickname, ENT_QUOTES, 'UTF-8'); ?>"
                        >
                    </label>
                    <fieldset class="battleship-board-size-field">
                        <legend class="checkers-field-label" data-battleship-i18n="boardSizeLabel"><?php echo $lang === 'en' ? 'Board size' : 'Размер поля'; ?></legend>
                        <div class="battleship-board-size-options" role="radiogroup" aria-label="<?php echo $lang === 'en' ? 'Board size' : 'Размер поля'; ?>">
                            <label class="battleship-size-card">
                                <input type="radio" name="battleshipBoardSize" value="10" checked>
                                <span class="battleship-size-card__inner">
                                    <span class="battleship-size-card__preview battleship-size-card__preview--10" aria-hidden="true"></span>
                                    <span class="battleship-size-card__text">
                                        <span class="battleship-size-card__size">10×10</span>
                                        <span class="battleship-size-card__hint" data-battleship-i18n="boardSize10Hint"><?php echo $lang === 'en' ? 'Classic fleet' : 'Классический флот'; ?></span>
                                    </span>
                                </span>
                            </label>
                            <label class="battleship-size-card">
                                <input type="radio" name="battleshipBoardSize" value="20">
                                <span class="battleship-size-card__inner">
                                    <span class="battleship-size-card__preview battleship-size-card__preview--20" aria-hidden="true"></span>
                                    <span class="battleship-size-card__text">
                                        <span class="battleship-size-card__size">20×20</span>
                                        <span class="battleship-size-card__hint" data-battleship-i18n="boardSize20Hint"><?php echo $lang === 'en' ? 'Extended battle' : 'Расширенный бой'; ?></span>
                                    </span>
                                </span>
                            </label>
                            <label class="battleship-size-card">
                                <input type="radio" name="battleshipBoardSize" value="50">
                                <span class="battleship-size-card__inner">
                                    <span class="battleship-size-card__preview battleship-size-card__preview--50" aria-hidden="true"></span>
                                    <span class="battleship-size-card__text">
                                        <span class="battleship-size-card__size">50×50</span>
                                        <span class="battleship-size-card__hint" data-battleship-i18n="boardSize50Hint"><?php echo $lang === 'en' ? 'Massive armada' : 'Масштабная армада'; ?></span>
                                    </span>
                                </span>
                            </label>
                        </div>
                    </fieldset>
                    <button type="button" class="checkers-submit-btn checkers-create" id="battleshipCreateBtn">
                        <i class="fas fa-plus" aria-hidden="true"></i>
                        <span data-battleship-i18n="createBtn"><?php echo $lang === 'en' ? 'Create room' : 'Создать комнату'; ?></span>
                    </button>
                </section>

                <section class="checkers-panel checkers-lobby-card">
                    <h3 class="checkers-panel-title" data-battleship-i18n="joinTitle"><?php echo $lang === 'en' ? 'Join by code' : 'Войти по коду'; ?></h3>
                    <p class="checkers-panel-desc" data-battleship-i18n="joinDesc"><?php echo $lang === 'en'
                        ? 'Enter the 6-character room code from your friend.'
                        : 'Введите 6-значный код комнаты от друга.'; ?></p>
                    <label class="checkers-field" for="battleshipRoomCodeInput">
                        <span class="checkers-field-label" data-battleship-i18n="roomCodeLabel"><?php echo $lang === 'en' ? 'Room code' : 'Код комнаты'; ?></span>
                        <input
                            type="text"
                            id="battleshipRoomCodeInput"
                            class="checkers-code-input"
                            maxlength="6"
                            autocapitalize="characters"
                            autocomplete="off"
                            spellcheck="false"
                        >
                    </label>
                    <button type="button" class="checkers-back-link checkers-join" id="battleshipJoinBtn">
                        <i class="fas fa-door-open" aria-hidden="true"></i>
                        <span data-battleship-i18n="joinBtn"><?php echo $lang === 'en' ? 'Join' : 'Войти'; ?></span>
                    </button>
                </section>
            </div>

            <p class="checkers-form-error" id="battleshipLobbyStatus" hidden></p>

            <section class="checkers-panel checkers-open-lobbies" id="battleshipOpenLobbies">
                <div class="checkers-open-lobbies__head">
                    <h3 class="checkers-panel-title" data-battleship-i18n="openLobbiesTitle"><?php echo $lang === 'en' ? 'Open lobbies' : 'Открытые лобби'; ?></h3>
                    <p class="checkers-panel-desc" data-battleship-i18n="openLobbiesDesc"><?php echo $lang === 'en'
                        ? 'Join a room that is waiting for a second player.'
                        : 'Подключайтесь к комнатам, где ждут второго игрока.'; ?></p>
                </div>
                <div class="checkers-open-lobbies__status" id="battleshipOpenLobbiesStatus" data-state="loading">
                    <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
                    <span data-battleship-i18n="openLobbiesLoading"><?php echo $lang === 'en' ? 'Loading…' : 'Загрузка…'; ?></span>
                </div>
                <div class="checkers-open-lobbies__list" id="battleshipOpenLobbiesList" hidden></div>
            </section>
        </main>

<?php require __DIR__ . '/../../../includes/site_footer.php'; ?>

    <script>
        window.ABS_BATTLESHIP_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_BATTLESHIP_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_BATTLESHIP_DEFAULT_NICKNAME = <?php echo json_encode($defaultNickname); ?>;
        window.ABS_BATTLESHIP_API_CREATE = <?php echo json_encode(user_api_path('/api/battleship/create.php')); ?>;
        window.ABS_BATTLESHIP_API_JOIN = <?php echo json_encode(user_api_path('/api/battleship/join.php')); ?>;
        window.ABS_BATTLESHIP_API_LIST = <?php echo json_encode(user_api_path('/api/battleship/list.php')); ?>;
        window.ABS_BATTLESHIP_LOBBY_HREF = <?php echo json_encode(battleship_build_lobby_href($lang)); ?>;
        window.ABS_BATTLESHIP_HUB_HREF = <?php echo json_encode($hubHref); ?>;
    </script>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/nickname.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/battleship/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/battleship/storage.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/battleship/lobby.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
