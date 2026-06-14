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

$publicId = strtoupper(trim((string) ($_GET['public_id'] ?? '')));
if (!checkers_public_id_valid($publicId)) {
    http_response_code(404);
    require __DIR__ . '/../../../includes/site_header.php';
    echo '<main class="checkers-service"><section class="checkers-panel"><p>'
        . ($lang === 'en' ? 'Room not found.' : 'Комната не найдена.')
        . '</p></section></main>';
    require __DIR__ . '/../../../includes/site_footer.php';
    echo '</body></html>';
    exit();
}

$defaultNickname = '';
$userLoggedIn = user_is_logged_in();
if ($userLoggedIn) {
    $uid = user_current_id();
    $profile = $uid !== null ? user_login_row($userDb, $uid) : null;
    if (is_array($profile) && !empty($profile['username'])) {
        $defaultNickname = (string) $profile['username'];
    }
}

$meta = checkers_meta($lang);
$pageTitle = $meta['title'] . ' - ' . $publicId;
abs_set_page_titles('Шашки онлайн - ' . $publicId, 'Online Checkers - ' . $publicId);
$metaDescription = $meta['desc'];
$bodyClass = 'page-checkers page-checkers-room';
$seoSlug = 'services/onlinegames/checkers/' . $publicId;
$hubHref = onlinegames_build_href($lang);
$lobbyHref = checkers_build_lobby_href($lang);

require __DIR__ . '/../../../includes/site_header.php';
?>

        <main class="checkers-service checkers-room">
            <section class="checkers-panel checkers-room-bar">
                <div class="checkers-section-head">
                    <div class="checkers-room-bar__meta">
                        <a class="checkers-back-link" href="<?php echo htmlspecialchars($lobbyHref, ENT_QUOTES, 'UTF-8'); ?>">
                            <i class="fas fa-arrow-left" aria-hidden="true"></i>
                            <span data-checkers-i18n="backToLobby"><?php echo $lang === 'en' ? 'Lobby' : 'Лобби'; ?></span>
                        </a>
                        <div class="checkers-room-code-wrap">
                            <span class="checkers-room-code" id="checkersRoomCode"><?php echo htmlspecialchars($publicId, ENT_QUOTES, 'UTF-8'); ?></span>
                            <button type="button" class="checkers-icon-btn checkers-copy-link" id="checkersCopyLinkBtn" data-checkers-i18n-title="copyLinkTitle" title="<?php echo $lang === 'en' ? 'Copy link' : 'Скопировать ссылку'; ?>">
                                <i class="fas fa-link" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>
                    <div class="checkers-room-bar__status">
                        <span class="checkers-connection" id="checkersConnectionStatus" data-state="connecting">
                            <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
                            <span data-checkers-i18n="connecting"><?php echo $lang === 'en' ? 'Connecting…' : 'Подключение…'; ?></span>
                        </span>
                        <button type="button" class="checkers-back-link checkers-resign" id="checkersResignBtn" hidden>
                            <i class="fas fa-flag" aria-hidden="true"></i>
                            <span data-checkers-i18n="resign"><?php echo $lang === 'en' ? 'Resign' : 'Сдаться'; ?></span>
                        </button>
                    </div>
                </div>
            </section>

            <div class="checkers-nickname-gate" id="checkersNicknameGate" hidden>
                <div class="checkers-nickname-gate__card checkers-panel">
                    <h3 class="checkers-panel-title" data-checkers-i18n="roomJoinTitle"><?php echo $lang === 'en' ? 'Join the room' : 'Вход в комнату'; ?></h3>
                    <p class="checkers-panel-desc" data-checkers-i18n="roomJoinDesc"><?php echo $lang === 'en'
                        ? 'Enter your nickname before joining the game.'
                        : 'Укажите ник, под которым вас увидят в комнате.'; ?></p>
                    <label class="checkers-field" for="checkersRoomNicknameInput">
                        <span class="checkers-field-label" data-checkers-i18n="nicknameLabel"><?php echo $lang === 'en' ? 'Nickname' : 'Ник'; ?></span>
                        <input
                            type="text"
                            id="checkersRoomNicknameInput"
                            maxlength="32"
                            autocomplete="nickname"
                            value="<?php echo htmlspecialchars($defaultNickname, ENT_QUOTES, 'UTF-8'); ?>"
                            <?php echo $userLoggedIn ? 'readonly aria-readonly="true"' : ''; ?>
                        >
                    </label>
                    <p class="checkers-form-error" id="checkersNicknameGateError" hidden></p>
                    <button type="button" class="checkers-submit-btn" id="checkersNicknameGateBtn">
                        <i class="fas fa-door-open" aria-hidden="true"></i>
                        <span data-checkers-i18n="roomJoinBtn"><?php echo $lang === 'en' ? 'Enter room' : 'Войти в комнату'; ?></span>
                    </button>
                </div>
            </div>

            <section class="checkers-panel checkers-board-panel">
                <div class="checkers-play-layout">
                    <div class="checkers-play-board">
                        <div class="checkers-board-shell" aria-hidden="false">
                            <div class="checkers-board-shell__corner checkers-board-shell__corner--tl" aria-hidden="true"></div>
                            <div class="checkers-board-shell__files checkers-board-shell__files--top" aria-hidden="true">
                                <?php foreach (range(0, 7) as $col): ?>
                                    <span><?php echo chr(97 + $col); ?></span>
                                <?php endforeach; ?>
                            </div>
                            <div class="checkers-board-shell__corner checkers-board-shell__corner--tr" aria-hidden="true"></div>
                            <div class="checkers-board-shell__ranks checkers-board-shell__ranks--left" aria-hidden="true">
                                <?php foreach (range(8, 1) as $rank): ?>
                                    <span><?php echo $rank; ?></span>
                                <?php endforeach; ?>
                            </div>
                            <div class="checkers-board-stage">
                                <div class="checkers-board" id="checkersBoard" aria-label="<?php echo $lang === 'en' ? 'Checkers board' : 'Доска шашек'; ?>"></div>
                                <div class="checkers-waiting" id="checkersWaiting">
                                    <p data-checkers-i18n="waitingOpponent"><?php echo $lang === 'en'
                                        ? 'Waiting for the second player… Share the room link.'
                                        : 'Ждём второго игрока… Отправьте ссылку на комнату.'; ?></p>
                                </div>
                                <div class="checkers-overlay" id="checkersGameOver" hidden>
                                    <div class="checkers-overlay__card">
                                        <h3 id="checkersGameOverTitle"></h3>
                                        <p id="checkersGameOverHint"></p>
                                        <div class="checkers-overlay__actions">
                                            <a class="checkers-submit-btn" id="checkersPlayAgainBtn" href="<?php echo htmlspecialchars($lobbyHref, ENT_QUOTES, 'UTF-8'); ?>">
                                                <?php echo $lang === 'en' ? 'New game' : 'Новая игра'; ?>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="checkers-board-shell__ranks checkers-board-shell__ranks--right" aria-hidden="true">
                                <?php foreach (range(8, 1) as $rank): ?>
                                    <span><?php echo $rank; ?></span>
                                <?php endforeach; ?>
                            </div>
                            <div class="checkers-board-shell__corner checkers-board-shell__corner--bl" aria-hidden="true"></div>
                            <div class="checkers-board-shell__files checkers-board-shell__files--bottom" aria-hidden="true">
                                <?php foreach (range(0, 7) as $col): ?>
                                    <span><?php echo chr(97 + $col); ?></span>
                                <?php endforeach; ?>
                            </div>
                            <div class="checkers-board-shell__corner checkers-board-shell__corner--br" aria-hidden="true"></div>
                        </div>
                    </div>

                    <aside class="checkers-sidebar">
                        <div class="checkers-play-meta">
                            <div class="checkers-status-line" id="checkersStatusLine" hidden></div>
                            <div class="checkers-players" id="checkersPlayers"></div>
                        </div>
                        <div class="checkers-chat" id="checkersChat">
                        <div class="checkers-chat__head">
                            <h3 class="checkers-panel-title" data-checkers-i18n="chatTitle"><?php echo $lang === 'en' ? 'Chat' : 'Чат'; ?></h3>
                        </div>
                        <ul class="checkers-chat__messages" id="checkersChatMessages" aria-live="polite"></ul>
                        <p class="checkers-chat__empty" id="checkersChatEmpty" data-checkers-i18n="chatEmpty"><?php echo $lang === 'en' ? 'No messages yet' : 'Сообщений пока нет'; ?></p>
                        <form class="checkers-chat__form" id="checkersChatForm">
                            <label class="checkers-field checkers-chat__field" for="checkersChatInput">
                                <input
                                    type="text"
                                    id="checkersChatInput"
                                    class="checkers-chat__input"
                                    maxlength="500"
                                    autocomplete="off"
                                    aria-label="<?php echo $lang === 'en' ? 'Message' : 'Сообщение'; ?>"
                                    placeholder="<?php echo $lang === 'en' ? 'Message…' : 'Сообщение…'; ?>"
                                    data-checkers-i18n-placeholder="chatPlaceholder"
                                >
                            </label>
                            <button type="submit" class="checkers-submit-btn checkers-chat__send">
                                <i class="fas fa-paper-plane" aria-hidden="true"></i>
                                <span data-checkers-i18n="chatSend"><?php echo $lang === 'en' ? 'Send' : 'Отправить'; ?></span>
                            </button>
                        </form>
                        </div>
                    </aside>
                </div>
            </section>
        </main>

<?php require __DIR__ . '/../../../includes/site_footer.php'; ?>

    <script>
        window.ABS_CHECKERS_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_CHECKERS_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_CHECKERS_PUBLIC_ID = <?php echo json_encode($publicId); ?>;
        window.ABS_CHECKERS_DEFAULT_NICKNAME = <?php echo json_encode($defaultNickname); ?>;
        window.ABS_CHECKERS_IS_LOGGED_IN = <?php echo json_encode($userLoggedIn); ?>;
        window.ABS_CHECKERS_API_JOIN = <?php echo json_encode(user_api_path('/api/checkers/join.php')); ?>;
        window.ABS_CHECKERS_LOBBY_HREF = <?php echo json_encode($lobbyHref); ?>;
        window.ABS_CHECKERS_HUB_HREF = <?php echo json_encode($hubHref); ?>;
        window.ABS_CHECKERS_ROOM_HREF = <?php echo json_encode(checkers_build_href($lang, $publicId)); ?>;
    </script>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/confirm.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/nickname.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/checkers/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/checkers/storage.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/checkers/ws-client.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/checkers/sounds.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/checkers/board.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/checkers/room.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
