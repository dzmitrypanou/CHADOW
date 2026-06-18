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

$publicId = strtoupper(trim((string) ($_GET['public_id'] ?? '')));
if (!battleship_public_id_valid($publicId)) {
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

$meta = battleship_meta($lang);
$pageTitle = $meta['title'] . ' - ' . $publicId;
abs_set_page_titles('Морской бой - ' . $publicId, 'Battleship Online - ' . $publicId);
$metaDescription = $meta['desc'];
$bodyClass = 'page-checkers page-battleship page-battleship-room';
$seoSlug = 'services/onlinegames/battleship/' . $publicId;
$hubHref = onlinegames_build_href($lang);
$lobbyHref = battleship_build_lobby_href($lang);

require __DIR__ . '/../../../includes/site_header.php';
?>

        <main class="checkers-service battleship-service battleship-room">
            <section class="checkers-panel checkers-room-bar">
                <div class="checkers-section-head">
                    <div class="checkers-room-bar__meta">
                        <a class="checkers-back-link" href="<?php echo htmlspecialchars($lobbyHref, ENT_QUOTES, 'UTF-8'); ?>">
                            <i class="fas fa-arrow-left" aria-hidden="true"></i>
                            <span data-battleship-i18n="backToLobby"><?php echo $lang === 'en' ? 'Lobby' : 'Лобби'; ?></span>
                        </a>
                        <div class="checkers-room-code-wrap">
                            <span class="checkers-room-code" id="battleshipRoomCode"><?php echo htmlspecialchars($publicId, ENT_QUOTES, 'UTF-8'); ?></span>
                            <span class="battleship-board-badge" id="battleshipBoardBadge" hidden></span>
                            <button type="button" class="checkers-icon-btn checkers-copy-link" id="battleshipCopyLinkBtn" data-battleship-i18n-title="copyLinkTitle" title="<?php echo $lang === 'en' ? 'Copy link' : 'Скопировать ссылку'; ?>">
                                <i class="fas fa-link" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>
                    <div class="checkers-room-bar__status">
                        <span class="checkers-connection" id="battleshipConnectionStatus" data-state="connecting">
                            <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
                            <span data-battleship-i18n="connecting"><?php echo $lang === 'en' ? 'Connecting…' : 'Подключение…'; ?></span>
                        </span>
                        <button type="button" class="checkers-back-link checkers-resign" id="battleshipResignBtn" hidden>
                            <i class="fas fa-flag" aria-hidden="true"></i>
                            <span data-battleship-i18n="resign"><?php echo $lang === 'en' ? 'Resign' : 'Сдаться'; ?></span>
                        </button>
                    </div>
                </div>
            </section>

            <div class="checkers-nickname-gate" id="battleshipNicknameGate" hidden>
                <div class="checkers-nickname-gate__card checkers-panel">
                    <h3 class="checkers-panel-title" data-battleship-i18n="roomJoinTitle"><?php echo $lang === 'en' ? 'Join the room' : 'Вход в комнату'; ?></h3>
                    <p class="checkers-panel-desc" data-battleship-i18n="roomJoinDesc"><?php echo $lang === 'en'
                        ? 'Enter your nickname before joining the game.'
                        : 'Укажите ник, под которым вас увидят в комнате.'; ?></p>
                    <label class="checkers-field" for="battleshipRoomNicknameInput">
                        <span class="checkers-field-label" data-battleship-i18n="nicknameLabel"><?php echo $lang === 'en' ? 'Nickname' : 'Ник'; ?></span>
                        <input
                            type="text"
                            id="battleshipRoomNicknameInput"
                            maxlength="32"
                            autocomplete="nickname"
                            value="<?php echo htmlspecialchars($defaultNickname, ENT_QUOTES, 'UTF-8'); ?>"
                            <?php echo $userLoggedIn ? 'readonly aria-readonly="true"' : ''; ?>
                        >
                    </label>
                    <p class="checkers-form-error" id="battleshipNicknameGateError" hidden></p>
                    <button type="button" class="checkers-submit-btn" id="battleshipNicknameGateBtn">
                        <i class="fas fa-door-open" aria-hidden="true"></i>
                        <span data-battleship-i18n="roomJoinBtn"><?php echo $lang === 'en' ? 'Enter room' : 'Войти в комнату'; ?></span>
                    </button>
                </div>
            </div>

            <section class="checkers-panel battleship-board-panel">
                <div class="battleship-placement-bar" id="battleshipPlacementBar" hidden>
                    <p class="battleship-placement-hint" id="battleshipPlacementHint"></p>
                    <p class="battleship-placement-subhint" id="battleshipPlacementSubhint" data-battleship-i18n="placementDragHint"><?php echo $lang === 'en' ? 'Mouse wheel — rotate ship' : 'Колесо мыши — поворот корабля'; ?></p>
                    <div class="battleship-ship-dock" id="battleshipShipDock" hidden></div>
                    <div class="battleship-placement-actions">
                        <button type="button" class="checkers-submit-btn" id="battleshipConfirmPlacementBtn" hidden>
                            <i class="fas fa-check" aria-hidden="true"></i>
                            <span data-battleship-i18n="confirmPlacement"><?php echo $lang === 'en' ? 'Ready — start battle' : 'Готово — начать бой'; ?></span>
                        </button>
                        <button type="button" class="checkers-back-link battleship-auto-place" id="battleshipAutoPlaceBtn">
                            <i class="fas fa-random" aria-hidden="true"></i>
                            <span data-battleship-i18n="autoPlace"><?php echo $lang === 'en' ? 'Random placement' : 'Случайная расстановка'; ?></span>
                        </button>
                    </div>
                </div>

                <div class="battleship-room-layout">
                    <div class="battleship-room-main">
                        <div class="battleship-play-layout">
                            <div class="battleship-board-block">
                                <h3 class="battleship-board-title" data-battleship-i18n="ownBoard"><?php echo $lang === 'en' ? 'Your fleet' : 'Ваш флот'; ?></h3>
                                <div class="battleship-board-wrap">
                                    <div class="battleship-board" id="battleshipOwnBoard" data-board="own"></div>
                                </div>
                            </div>
                            <div class="battleship-board-block">
                                <h3 class="battleship-board-title" data-battleship-i18n="enemyBoard"><?php echo $lang === 'en' ? 'Enemy waters' : 'Поле соперника'; ?></h3>
                                <div class="battleship-board-wrap">
                                    <div class="battleship-board" id="battleshipEnemyBoard" data-board="enemy"></div>
                                </div>
                            </div>
                        </div>

                        <div class="battleship-waiting" id="battleshipWaiting">
                            <p data-battleship-i18n="waitingOpponent"><?php echo $lang === 'en'
                                ? 'Waiting for the second player… Share the room link.'
                                : 'Ждём второго игрока… Отправьте ссылку на комнату.'; ?></p>
                        </div>

                        <div class="checkers-overlay" id="battleshipGameOver" hidden>
                            <div class="checkers-overlay__card">
                                <h3 id="battleshipGameOverTitle"></h3>
                                <p id="battleshipGameOverHint"></p>
                                <div class="checkers-overlay__actions">
                                    <a class="checkers-submit-btn" id="battleshipPlayAgainBtn" href="<?php echo htmlspecialchars($lobbyHref, ENT_QUOTES, 'UTF-8'); ?>">
                                        <?php echo $lang === 'en' ? 'New game' : 'Новая игра'; ?>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <aside class="checkers-sidebar battleship-sidebar">
                        <div class="checkers-play-meta">
                            <div class="checkers-status-line" id="battleshipStatusLine" hidden></div>
                            <div class="checkers-players" id="battleshipPlayers"></div>
                        </div>
                        <div class="checkers-chat" id="battleshipChat">
                            <div class="checkers-chat__head">
                                <h3 class="checkers-panel-title" data-battleship-i18n="chatTitle"><?php echo $lang === 'en' ? 'Chat' : 'Чат'; ?></h3>
                            </div>
                            <div class="checkers-chat__body">
                                <ul class="checkers-chat__messages" id="battleshipChatMessages" aria-live="polite"></ul>
                                <p class="checkers-chat__empty" id="battleshipChatEmpty" data-battleship-i18n="chatEmpty"><?php echo $lang === 'en' ? 'No messages yet' : 'Сообщений пока нет'; ?></p>
                            </div>
                            <form class="checkers-chat__form" id="battleshipChatForm">
                                <label class="checkers-field checkers-chat__field" for="battleshipChatInput">
                                    <input
                                        type="text"
                                        id="battleshipChatInput"
                                        class="checkers-chat__input"
                                        maxlength="500"
                                        autocomplete="off"
                                        aria-label="<?php echo $lang === 'en' ? 'Message' : 'Сообщение'; ?>"
                                        placeholder="<?php echo $lang === 'en' ? 'Message…' : 'Сообщение…'; ?>"
                                        data-battleship-i18n-placeholder="chatPlaceholder"
                                    >
                                </label>
                                <button type="submit" class="checkers-submit-btn checkers-chat__send">
                                    <i class="fas fa-paper-plane" aria-hidden="true"></i>
                                    <span data-battleship-i18n="chatSend"><?php echo $lang === 'en' ? 'Send' : 'Отправить'; ?></span>
                                </button>
                            </form>
                        </div>
                    </aside>
                </div>
            </section>
        </main>

<?php require __DIR__ . '/../../../includes/site_footer.php'; ?>

    <script>
        window.ABS_BATTLESHIP_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_BATTLESHIP_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_BATTLESHIP_PUBLIC_ID = <?php echo json_encode($publicId); ?>;
        window.ABS_BATTLESHIP_DEFAULT_NICKNAME = <?php echo json_encode($defaultNickname); ?>;
        window.ABS_BATTLESHIP_IS_LOGGED_IN = <?php echo json_encode($userLoggedIn); ?>;
        window.ABS_BATTLESHIP_API_JOIN = <?php echo json_encode(user_api_path('/api/battleship/join.php')); ?>;
        window.ABS_BATTLESHIP_LOBBY_HREF = <?php echo json_encode($lobbyHref); ?>;
        window.ABS_BATTLESHIP_HUB_HREF = <?php echo json_encode($hubHref); ?>;
        window.ABS_BATTLESHIP_ROOM_HREF = <?php echo json_encode(battleship_build_href($lang, $publicId)); ?>;
    </script>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/confirm.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/nickname.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/battleship/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/battleship/storage.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/battleship/ws-client.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/battleship/board.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/battleship/placement.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/battleship/room.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
