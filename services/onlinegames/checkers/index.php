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
require_once __DIR__ . '/../../../includes/checkers_helpers.php';
require_once __DIR__ . '/../../../includes/onlinegames_helpers.php';

$defaultNickname = '';
if (user_is_logged_in()) {
    $uid = user_current_id();
    $profile = $uid !== null ? user_login_row($userDb, $uid) : null;
    if (is_array($profile) && !empty($profile['username'])) {
        $defaultNickname = (string) $profile['username'];
    }
}

$meta = checkers_meta($lang);
$pageTitle = $meta['title'];
abs_set_page_titles('Шашки онлайн', 'Online Checkers');
$metaDescription = $meta['desc'];
$bodyClass = 'page-checkers page-checkers-lobby';
$seoSlug = 'services/onlinegames/checkers';
$hubHref = onlinegames_build_href($lang);

require __DIR__ . '/../../../includes/site_header.php';
?>

        <main class="checkers-service">
            <section class="checkers-panel checkers-service-header">
                <div class="checkers-section-head">
                    <div>
                        <h2 class="checkers-section-title" data-checkers-i18n="title"><?php echo htmlspecialchars($meta['title'], ENT_QUOTES, 'UTF-8'); ?></h2>
                        <p class="checkers-section-hint" data-checkers-i18n="hint"><?php echo htmlspecialchars($meta['desc'], ENT_QUOTES, 'UTF-8'); ?></p>
                    </div>
                    <div class="checkers-section-actions">
                        <a class="checkers-back-link" href="<?php echo htmlspecialchars($hubHref, ENT_QUOTES, 'UTF-8'); ?>">
                            <i class="fas fa-arrow-left" aria-hidden="true"></i>
                            <span data-checkers-i18n="backToHub"><?php echo $lang === 'en' ? 'Online games' : 'К онлайн-играм'; ?></span>
                        </a>
                    </div>
                </div>
            </section>

            <div class="checkers-lobby-grid">
                <section class="checkers-panel checkers-lobby-card">
                    <h3 class="checkers-panel-title" data-checkers-i18n="createTitle"><?php echo $lang === 'en' ? 'Create a game' : 'Создать игру'; ?></h3>
                    <p class="checkers-panel-desc" data-checkers-i18n="createDesc"><?php echo $lang === 'en'
                        ? 'You play as white. Send the room link to your opponent.'
                        : 'Вы играете белыми. Отправьте ссылку на комнату сопернику.'; ?></p>
                    <label class="checkers-field" for="checkersNicknameInput">
                        <span class="checkers-field-label" data-checkers-i18n="nicknameLabel"><?php echo $lang === 'en' ? 'Nickname' : 'Ник'; ?></span>
                        <input
                            type="text"
                            id="checkersNicknameInput"
                            maxlength="32"
                            autocomplete="nickname"
                            value="<?php echo htmlspecialchars($defaultNickname, ENT_QUOTES, 'UTF-8'); ?>"
                        >
                    </label>
                    <button type="button" class="checkers-submit-btn checkers-create" id="checkersCreateBtn">
                        <i class="fas fa-plus" aria-hidden="true"></i>
                        <span data-checkers-i18n="createBtn"><?php echo $lang === 'en' ? 'Create room' : 'Создать комнату'; ?></span>
                    </button>
                </section>

                <section class="checkers-panel checkers-lobby-card">
                    <h3 class="checkers-panel-title" data-checkers-i18n="joinTitle"><?php echo $lang === 'en' ? 'Join by code' : 'Войти по коду'; ?></h3>
                    <p class="checkers-panel-desc" data-checkers-i18n="joinDesc"><?php echo $lang === 'en'
                        ? 'Enter the 6-character room code from your friend.'
                        : 'Введите 6-значный код комнаты от друга.'; ?></p>
                    <label class="checkers-field" for="checkersRoomCodeInput">
                        <span class="checkers-field-label" data-checkers-i18n="roomCodeLabel"><?php echo $lang === 'en' ? 'Room code' : 'Код комнаты'; ?></span>
                        <input
                            type="text"
                            id="checkersRoomCodeInput"
                            class="checkers-code-input"
                            maxlength="6"
                            autocapitalize="characters"
                            autocomplete="off"
                            spellcheck="false"
                        >
                    </label>
                    <button type="button" class="checkers-back-link checkers-join" id="checkersJoinBtn">
                        <i class="fas fa-door-open" aria-hidden="true"></i>
                        <span data-checkers-i18n="joinBtn"><?php echo $lang === 'en' ? 'Join' : 'Войти'; ?></span>
                    </button>
                </section>
            </div>

            <p class="checkers-form-error" id="checkersLobbyStatus" hidden></p>

            <section class="checkers-panel checkers-open-lobbies" id="checkersOpenLobbies">
                <div class="checkers-open-lobbies__head">
                    <h3 class="checkers-panel-title" data-checkers-i18n="openLobbiesTitle"><?php echo $lang === 'en' ? 'Open lobbies' : 'Открытые лобби'; ?></h3>
                    <p class="checkers-panel-desc" data-checkers-i18n="openLobbiesDesc"><?php echo $lang === 'en'
                        ? 'Join a room that is waiting for a second player.'
                        : 'Подключайтесь к комнатам, где ждут второго игрока.'; ?></p>
                </div>
                <div class="checkers-open-lobbies__status" id="checkersOpenLobbiesStatus" data-state="loading">
                    <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
                    <span data-checkers-i18n="openLobbiesLoading"><?php echo $lang === 'en' ? 'Loading…' : 'Загрузка…'; ?></span>
                </div>
                <div class="checkers-open-lobbies__list" id="checkersOpenLobbiesList" hidden></div>
            </section>
        </main>

<?php require __DIR__ . '/../../../includes/site_footer.php'; ?>

    <script>
        window.ABS_CHECKERS_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_CHECKERS_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_CHECKERS_DEFAULT_NICKNAME = <?php echo json_encode($defaultNickname); ?>;
        window.ABS_CHECKERS_API_CREATE = <?php echo json_encode(user_api_path('/api/checkers/create.php')); ?>;
        window.ABS_CHECKERS_API_JOIN = <?php echo json_encode(user_api_path('/api/checkers/join.php')); ?>;
        window.ABS_CHECKERS_API_LIST = <?php echo json_encode(user_api_path('/api/checkers/list.php')); ?>;
        window.ABS_CHECKERS_LOBBY_HREF = <?php echo json_encode(checkers_build_lobby_href($lang)); ?>;
        window.ABS_CHECKERS_HUB_HREF = <?php echo json_encode($hubHref); ?>;
    </script>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/nickname.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/checkers/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/checkers/storage.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/checkers/lobby.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
