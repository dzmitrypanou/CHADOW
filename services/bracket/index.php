<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/../../includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

require_once __DIR__ . '/../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../includes/bracket_helpers.php';
require_once __DIR__ . '/../../includes/user_auth.php';

$listQuery = [
    'q' => isset($_GET['q']) ? trim((string) $_GET['q']) : '',
    'page' => max(1, (int) ($_GET['page'] ?? 1)),
    'limit' => 20,
    'lang' => $lang,
];

$initialList = null;
try {
    require_once __DIR__ . '/../../config/ensure_brackets.php';
    ensure_brackets_table($userDb);
    $initialList = bracket_fetch_list($userDb, $listQuery);
    if (!$initialList['success']) {
        $initialList = null;
    }
} catch (Throwable $e) {
    $initialList = null;
}

$pageTitle = $lang === 'en' ? 'Tournament Brackets' : 'Турнирные сетки';
abs_set_page_titles('Турнирные сетки', 'Tournament Brackets');
$metaDescription = $lang === 'en'
    ? 'Create and browse tournament brackets for clan and team events.'
    : 'Создание и просмотр турнирных сеток для клановых и командных ивентов.';
$bodyClass = 'page-bracket';
$seoSlug = 'services/bracket';

$seoSoftwareApp = [
    'name' => $pageTitle,
    'description' => $metaDescription,
];

$createHref = abs_build_lang_href($lang, 'services/bracket/create');
$isLoggedIn = user_is_logged_in();
$loginHref = user_auth_path('/auth/login') . '?return=' . rawurlencode($createHref);

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="bracket-service">
            <section class="bracket-panel bracket-service-header">
                <div class="bracket-section-head">
                    <div>
                        <h2 class="bracket-section-title">
                            <?php echo $lang === 'en' ? 'Tournament Bracket Generator' : 'Генератор турнирных сеток'; ?>
                        </h2>
                        <p class="bracket-section-hint">
                            <?php echo $lang === 'en'
                                ? 'Create and edit tournament brackets for clan and team events.'
                                : 'Создание и редактирование турнирных сеток для клановых и командных ивентов.'; ?>
                        </p>
                        <?php if (!$isLoggedIn): ?>
                        <p class="bracket-guest-hint">
                            <?php echo $lang === 'en'
                                ? 'Sign in to create a bracket.'
                                : 'Для создания сетки необходимо войти в аккаунт.'; ?>
                        </p>
                        <?php endif; ?>
                    </div>
                    <?php if ($isLoggedIn): ?>
                    <a class="bracket-cta-btn" href="<?php echo htmlspecialchars($createHref, ENT_QUOTES, 'UTF-8'); ?>">
                        <i class="fas fa-plus" aria-hidden="true"></i>
                        <?php echo $lang === 'en' ? 'Create bracket' : 'Создать сетку'; ?>
                    </a>
                    <?php else: ?>
                    <a class="bracket-cta-btn" href="<?php echo htmlspecialchars($loginHref, ENT_QUOTES, 'UTF-8'); ?>">
                        <i class="fas fa-sign-in-alt" aria-hidden="true"></i>
                        <?php echo $lang === 'en' ? 'Sign in to create' : 'Войти для создания'; ?>
                    </a>
                    <?php endif; ?>
                </div>
            </section>

            <section class="bracket-panel bracket-catalog">
                <h3 class="bracket-catalog-title">
                    <?php echo $lang === 'en' ? 'Public brackets' : 'Публичные сетки'; ?>
                </h3>
                <div id="bracketCatalogList" class="bracket-catalog-list">
                    <p class="bracket-catalog-loading"><?php echo $lang === 'en' ? 'Loading…' : 'Загрузка…'; ?></p>
                </div>
            </section>
        </main>

<?php
require __DIR__ . '/../../includes/site_footer.php';
?>
    <script>
        window.ABS_BRACKET_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_BRACKET_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_BRACKET_IS_LOGGED_IN = <?php echo json_encode($isLoggedIn); ?>;
        window.ABS_BRACKET_LOGIN_HREF = <?php echo json_encode($loginHref); ?>;
        window.ABS_BRACKET_LIST_API = <?php echo json_encode(user_api_path('/api/bracket/list.php')); ?>;
        window.ABS_BRACKET_INITIAL_LIST = <?php echo json_encode($initialList); ?>;
    </script>
    <script src="/js/services/bracket/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/games.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/match-format.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/catalog.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
