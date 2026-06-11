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

$listQuery = [
    'q' => isset($_GET['q']) ? trim((string) $_GET['q']) : '',
    'page' => max(1, (int) ($_GET['page'] ?? 1)),
    'limit' => 50,
    'lang' => $lang,
];

$initialList = null;
try {
    ensure_tactics_table($userDb);
    $initialList = tactics_fetch_list($userDb, $listQuery);
    if (!$initialList['success']) {
        $initialList = null;
    }
} catch (Throwable $e) {
    $initialList = null;
}

$pageTitle = $lang === 'en' ? 'Open rooms' : 'Открытые комнаты';
abs_set_page_titles('Открытые комнаты', 'Open rooms');
$metaDescription = $lang === 'en'
    ? 'Browse open tactical board rooms and join a session.'
    : 'Список открытых тактических комнат — выберите и присоединяйтесь.';
$bodyClass = 'page-tactics page-tactics-rooms';
$seoSlug = 'services/tactics/rooms';

$lobbyHref = abs_build_lang_href($lang, 'services/tactics');
$roomBase = abs_build_lang_href($lang, 'services/tactics');

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="tactics-service">
            <section class="tactics-panel tactics-service-header">
                <div class="tactics-section-head">
                    <div>
                        <h2 class="tactics-section-title" data-tactics-i18n="openRoomsTitle"><?php echo $lang === 'en' ? 'Open rooms' : 'Открытые комнаты'; ?></h2>
                        <p class="tactics-section-hint" data-tactics-i18n="openRoomsHint">
                            <?php echo $lang === 'en'
                                ? 'Only rooms created with «Open» visibility appear here. Closed rooms are accessible by link only.'
                                : 'Здесь только комнаты с видимостью «Открытая». Закрытые доступны только по ссылке.'; ?>
                        </p>
                    </div>
                    <div class="tactics-section-actions">
                        <a class="tactics-submit-btn tactics-header-btn" href="<?php echo htmlspecialchars($lobbyHref, ENT_QUOTES, 'UTF-8'); ?>#tactics-create">
                            <i class="fas fa-plus" aria-hidden="true"></i>
                            <span data-tactics-i18n="createRoom"><?php echo $lang === 'en' ? 'Create room' : 'Создать комнату'; ?></span>
                        </a>
                    </div>
                </div>
            </section>

            <section class="tactics-panel tactics-catalog">
                <div id="tacticsCatalogList" class="tactics-catalog-list">
                    <p class="tactics-catalog-loading" data-tactics-i18n="catalogLoading"><?php echo $lang === 'en' ? 'Loading…' : 'Загрузка…'; ?></p>
                </div>
            </section>
        </main>

<?php
require __DIR__ . '/../../includes/site_footer.php';
?>
    <script>
        window.ABS_TACTICS_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_TACTICS_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_TACTICS_LIST_API = <?php echo json_encode(user_api_path('/api/tactics/list.php')); ?>;
        window.ABS_TACTICS_INITIAL_LIST = <?php echo json_encode($initialList); ?>;
        window.ABS_TACTICS_LOBBY_BASE = <?php echo json_encode($lobbyHref); ?>;
        window.ABS_TACTICS_ROOM_BASE = <?php echo json_encode($roomBase); ?>;
    </script>
    <script src="/js/services/tactics/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/store.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/catalog-cards.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/rooms-page.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
