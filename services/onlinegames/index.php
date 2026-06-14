<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/../../includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

require_once __DIR__ . '/../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../includes/checkers_helpers.php';
require_once __DIR__ . '/../../includes/onlinegames_helpers.php';

$meta = onlinegames_meta($lang);
$checkersMeta = checkers_meta($lang);
$checkersHref = checkers_build_lobby_href($lang);
$homeHref = onlinegames_build_home_href($lang);
$playLabel = $lang === 'en' ? 'Play' : 'Играть';

$pageTitle = $meta['title'];
abs_set_page_titles('Онлайн игры', 'Online Games');
$metaDescription = $meta['desc'];
$bodyClass = 'page-onlinegames';
$seoSlug = 'services/onlinegames';

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="onlinegames-service">
            <section class="checkers-panel onlinegames-service-header">
                <div class="checkers-section-head">
                    <div>
                        <h2 class="checkers-section-title" data-checkers-i18n="hubTitle"><?php echo htmlspecialchars($meta['title'], ENT_QUOTES, 'UTF-8'); ?></h2>
                        <p class="checkers-section-hint" data-checkers-i18n="hubDesc"><?php echo htmlspecialchars($meta['desc'], ENT_QUOTES, 'UTF-8'); ?></p>
                    </div>
                    <div class="checkers-section-actions">
                        <a class="checkers-back-link" href="<?php echo htmlspecialchars($homeHref, ENT_QUOTES, 'UTF-8'); ?>">
                            <i class="fas fa-arrow-left" aria-hidden="true"></i>
                            <span data-checkers-i18n="backToHome"><?php echo $lang === 'en' ? 'Back to home' : 'На главную'; ?></span>
                        </a>
                    </div>
                </div>
            </section>

            <section class="checkers-panel onlinegames-list-section">
                <div class="online-games-grid">
                    <a href="<?php echo htmlspecialchars($checkersHref, ENT_QUOTES, 'UTF-8'); ?>" class="online-game-card online-game-card--checkers">
                        <i class="fas <?php echo htmlspecialchars($checkersMeta['icon'], ENT_QUOTES, 'UTF-8'); ?> online-game-card__watermark" aria-hidden="true"></i>
                        <div class="online-game-card__visual">
                            <div class="online-game-card__board" aria-hidden="true">
                                <?php for ($row = 0; $row < 8; $row++): ?>
                                    <?php for ($col = 0; $col < 8; $col++): ?>
                                        <span class="online-game-card__cell<?php echo ($row + $col) % 2 ? ' online-game-card__cell--dark' : ''; ?>"></span>
                                    <?php endfor; ?>
                                <?php endfor; ?>
                            </div>
                        </div>
                        <div class="online-game-card__body">
                            <h3 class="online-game-card__title" data-checkers-i18n="cardTitle"><?php echo htmlspecialchars($checkersMeta['title'], ENT_QUOTES, 'UTF-8'); ?></h3>
                            <p class="online-game-card__desc" data-checkers-i18n="cardDesc"><?php echo htmlspecialchars($checkersMeta['desc'], ENT_QUOTES, 'UTF-8'); ?></p>
                        </div>
                        <div class="online-game-card__footer">
                            <span class="online-game-card__action">
                                <span data-checkers-i18n="playOnline"><?php echo htmlspecialchars($playLabel, ENT_QUOTES, 'UTF-8'); ?></span>
                                <i class="fas fa-arrow-right" aria-hidden="true"></i>
                            </span>
                            <span class="online-game-card__badge" data-checkers-i18n="multiplayerBadge"><?php echo htmlspecialchars($checkersMeta['badge'], ENT_QUOTES, 'UTF-8'); ?></span>
                        </div>
                    </a>
                </div>
            </section>
        </main>

<?php require __DIR__ . '/../../includes/site_footer.php'; ?>

    <script>
        window.ABS_CHECKERS_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_LANG = <?php echo json_encode($lang); ?>;
    </script>
    <script src="/js/services/onlinegames/checkers/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/onlinegames/hub.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
