<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/../../includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

require_once __DIR__ . '/../../includes/recruiting_helpers.php';

$recruitingListQuery = [
    'post_type' => isset($_GET['post_type']) ? trim((string) $_GET['post_type']) : '',
    'realm' => isset($_GET['realm']) ? strtolower(trim((string) $_GET['realm'])) : '',
    'q' => isset($_GET['q']) ? trim((string) $_GET['q']) : '',
    'page' => max(1, (int) ($_GET['page'] ?? 1)),
    'limit' => 20,
];

if ($recruitingListQuery['post_type'] !== '' && !recruiting_post_type_valid($recruitingListQuery['post_type'])) {
    $recruitingListQuery['post_type'] = '';
}
if ($recruitingListQuery['realm'] !== '' && !recruiting_realm_valid($recruitingListQuery['realm'])) {
    $recruitingListQuery['realm'] = '';
}

$recruitingInitialList = null;
try {
    require_once __DIR__ . '/../../includes/user_bootstrap.php';
    require_once __DIR__ . '/../../config/ensure_recruiting.php';
    ensure_recruiting_posts_table($userDb);
    $recruitingInitialList = recruiting_fetch_post_list($userDb, $recruitingListQuery);
    if (!$recruitingInitialList['success']) {
        $recruitingInitialList = null;
    }
} catch (Throwable $e) {
    $recruitingInitialList = null;
}

$recruitingPagination = is_array($recruitingInitialList) ? ($recruitingInitialList['pagination'] ?? null) : null;
$recruitingHasPagination = is_array($recruitingPagination) && (int) ($recruitingPagination['pages'] ?? 0) > 1;

$pageTitle = $lang === 'en' ? 'Recruiting' : 'Рекрутинг';
abs_set_page_titles('Рекрутинг', 'Recruiting');
$metaDescription = $lang === 'en'
    ? 'Find clans, teams, and players for World of Tanks: browse recruiting posts by region and type.'
    : 'Поиск кланов, команд и игроков в World of Tanks: объявления по регионам и типам.';
$bodyClass = 'page-recruiting';
$seoSlug = 'services/recruiting';

$seoSoftwareApp = [
    'name' => $pageTitle,
    'description' => $metaDescription,
];
$postHref = abs_build_lang_href($lang, 'services/recruiting/post');
$boardBase = abs_build_lang_href($lang, 'services/recruiting');

$postTypeOptions = [];
foreach (RECRUITING_POST_TYPES as $type) {
    $postTypeOptions[] = [
        'value' => $type,
        'label' => recruiting_post_type_label($type, $lang),
    ];
}

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="recruiting-service">
            <section class="recruiting-panel recruiting-board-header">
                <div class="recruiting-section-head">
                    <div>
                        <h2 class="recruiting-section-title">
                            <?php echo $lang === 'en' ? 'Recruiting' : 'Рекрутинг'; ?>
                        </h2>
                        <p class="recruiting-section-hint">
                            <?php echo $lang === 'en'
                                ? 'Clans, teams, and players looking for each other across RU, EU, NA, and ASIA.'
                                : 'Кланы, команды и игроки ищут друг друга на серверах RU, EU, NA и ASIA.'; ?>
                        </p>
                    </div>
                    <a class="recruiting-cta-btn" href="<?php echo htmlspecialchars($postHref, ENT_QUOTES, 'UTF-8'); ?>">
                        <i class="fas fa-plus" aria-hidden="true"></i>
                        <?php echo $lang === 'en' ? 'Post an ad' : 'Подать объявление'; ?>
                    </a>
                </div>
            </section>

            <section class="recruiting-panel recruiting-filters" aria-label="<?php echo $lang === 'en' ? 'Filters' : 'Фильтры'; ?>">
                <div class="recruiting-filters-toolbar">
                    <div class="recruiting-filters-field recruiting-type-filter">
                        <label class="recruiting-filter-label" for="recruitingFilterType">
                            <?php echo $lang === 'en' ? 'Type' : 'Тип'; ?>
                        </label>
                        <select id="recruitingFilterType" class="recruiting-select">
                            <option value=""<?php echo $recruitingListQuery['post_type'] === '' ? ' selected' : ''; ?>>
                                <?php echo $lang === 'en' ? 'All types' : 'Все типы'; ?>
                            </option>
                            <?php foreach ($postTypeOptions as $opt): ?>
                            <option
                                value="<?php echo htmlspecialchars($opt['value'], ENT_QUOTES, 'UTF-8'); ?>"
                                <?php echo $recruitingListQuery['post_type'] === $opt['value'] ? ' selected' : ''; ?>
                            >
                                <?php echo htmlspecialchars($opt['label'], ENT_QUOTES, 'UTF-8'); ?>
                            </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="recruiting-filters-field recruiting-realm-filter">
                        <span class="recruiting-filter-label"><?php echo $lang === 'en' ? 'Region' : 'Регион'; ?></span>
                        <div class="recruiting-realm-tabs" id="recruitingRealmTabs" role="tablist">
                            <?php $activeRealm = $recruitingListQuery['realm']; ?>
                            <button
                                type="button"
                                class="recruiting-realm-tab<?php echo $activeRealm === '' ? ' is-active' : ''; ?>"
                                data-realm=""
                                role="tab"
                                aria-selected="<?php echo $activeRealm === '' ? 'true' : 'false'; ?>"
                            >
                                <?php echo $lang === 'en' ? 'All' : 'Все'; ?>
                            </button>
                            <?php foreach (RECRUITING_REALMS as $realm): ?>
                            <button
                                type="button"
                                class="recruiting-realm-tab<?php echo $activeRealm === $realm ? ' is-active' : ''; ?>"
                                data-realm="<?php echo htmlspecialchars($realm, ENT_QUOTES, 'UTF-8'); ?>"
                                role="tab"
                                aria-selected="<?php echo $activeRealm === $realm ? 'true' : 'false'; ?>"
                            ><?php echo htmlspecialchars(recruiting_realm_label($realm, $lang), ENT_QUOTES, 'UTF-8'); ?></button>
                            <?php endforeach; ?>
                        </div>
                    </div>

                    <div class="recruiting-filters-field recruiting-search-filter">
                        <label class="recruiting-filter-label" for="recruitingFilterSearch">
                            <?php echo $lang === 'en' ? 'Search' : 'Поиск'; ?>
                        </label>
                        <div class="recruiting-search-row">
                            <input
                                type="search"
                                id="recruitingFilterSearch"
                                class="recruiting-search-input"
                                maxlength="120"
                                value="<?php echo htmlspecialchars($recruitingListQuery['q'], ENT_QUOTES, 'UTF-8'); ?>"
                                placeholder="<?php echo $lang === 'en' ? 'Text, clan tag…' : 'Текст, тег клана…'; ?>"
                            >
                            <button type="button" class="recruiting-search-btn" id="recruitingSearchBtn">
                                <i class="fas fa-search" aria-hidden="true"></i>
                                <span class="recruiting-search-btn__label"><?php echo $lang === 'en' ? 'Search' : 'Найти'; ?></span>
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <section class="recruiting-panel recruiting-list-panel">
                <div class="recruiting-list-status hidden" id="recruitingListStatus" role="status"></div>
                <div class="recruiting-post-list" id="recruitingPostList" data-ssr="1">
                    <?php echo recruiting_render_board_list($recruitingInitialList, $lang); ?>
                </div>
                <div class="recruiting-pagination<?php echo $recruitingHasPagination ? '' : ' hidden'; ?>" id="recruitingPagination">
                    <?php echo recruiting_render_board_pagination($recruitingPagination, $lang); ?>
                </div>
            </section>
        </main>

<?php require __DIR__ . '/../../includes/site_footer.php'; ?>

    <script>
        window.ABS_RECRUITING_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_RECRUITING_BOARD_BASE = <?php echo json_encode($boardBase); ?>;
        window.ABS_RECRUITING_INITIAL = <?php echo json_encode($recruitingInitialList, JSON_UNESCAPED_UNICODE); ?>;
        window.ABS_RECRUITING_POST_TYPES = <?php echo json_encode(array_map(static function (string $type) use ($lang): array {
            return [
                'value' => $type,
                'label' => recruiting_post_type_label($type, $lang),
            ];
        }, RECRUITING_POST_TYPES)); ?>;
        window.ABS_RECRUITING_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
    </script>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/board.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/custom-select.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/max-icon.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
