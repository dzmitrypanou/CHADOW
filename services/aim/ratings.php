<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/../../includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

require_once __DIR__ . '/../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../includes/user_auth.php';
require_once __DIR__ . '/../../includes/aim_helpers.php';

try {
    require_once __DIR__ . '/../../config/ensure_aim.php';
    ensure_aim_scores_table($userDb);
} catch (Throwable $e) {
    // ratings page still renders without DB
}

$trainers = aim_all_trainers_meta($lang);
$hubHref = abs_build_lang_href($lang, 'services/aim');
$ratingsHref = abs_build_lang_href($lang, 'services/aim/ratings');

$pageTitle = $lang === 'en' ? 'Leaderboards' : 'Таблицы лидеров';
abs_set_page_titles('Таблицы лидеров — Аим-тренажеры', 'Leaderboards — Aim Trainers');
$metaDescription = $lang === 'en'
    ? 'Global aim trainer leaderboards: flick, tracking, reaction, lead shot, gridshot, and duck hunt top scores.'
    : 'Глобальные таблицы лидеров аим-тренажёров: flick, tracking, reaction, lead shot, gridshot и утиная охота.';
$bodyClass = 'page-aim page-aim-ratings';
$seoSlug = 'services/aim/ratings';
$extraHeadHtml = aim_device_sniff_script();

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="aim-service aim-ratings">
            <section class="aim-panel aim-ratings-header">
                <div class="aim-ratings-toolbar">
                    <a class="aim-back-link" href="<?php echo htmlspecialchars($hubHref, ENT_QUOTES, 'UTF-8'); ?>">
                        <i class="fas fa-arrow-left" aria-hidden="true"></i>
                        <span data-aim-i18n="backToHub"><?php echo $lang === 'en' ? 'All trainers' : 'К выбору'; ?></span>
                    </a>
                    <h2 class="aim-section-title" data-aim-i18n="leaderboardTitle">
                        <?php echo $lang === 'en' ? 'Leaderboard' : 'Таблица лидеров'; ?>
                    </h2>
                </div>
            </section>

            <section class="aim-panel aim-leaderboard-section">
                <div class="aim-leaderboard-head">
                    <div class="aim-leaderboard-tabs" id="aimLeaderboardTabs" role="tablist"></div>
                </div>
                <div id="aimLeaderboardPanel" class="aim-leaderboard-panel" role="tabpanel"></div>
            </section>
        </main>

<?php require __DIR__ . '/../../includes/site_footer.php'; ?>

    <script>
        window.ABS_AIM_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_AIM_TRAINERS = <?php echo json_encode($trainers, JSON_UNESCAPED_UNICODE); ?>;
        window.ABS_AIM_HUB_BASE = <?php echo json_encode($hubHref); ?>;
        window.ABS_AIM_RATINGS_BASE = <?php echo json_encode($ratingsHref); ?>;
        window.ABS_AIM_API_LEADERBOARD = <?php echo json_encode(user_api_path('/api/aim/leaderboard.php')); ?>;
    </script>
    <script src="/js/services/aim/core.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/leaderboard.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/ratings.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
