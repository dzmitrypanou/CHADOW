<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/../../includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

require_once __DIR__ . '/../../includes/wotmods_helpers.php';

$meta = wotmods_hub_meta($lang);
$mods = wotmods_catalog($lang);
$homeHref = wotmods_build_home_href($lang);
$openLabel = $lang === 'en' ? 'View' : 'Подробнее';
$downloadLabel = $lang === 'en' ? 'Download' : 'Скачать';

$pageTitle = $meta['title'];
abs_set_page_titles('Установка модов', 'Mod Installation');
$metaDescription = $meta['desc'];
$bodyClass = 'page-wotmods';
$seoSlug = 'services/wotmods';

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="wotmods-service">
            <section class="checkers-panel wotmods-service-header">
                <div class="checkers-section-head">
                    <div>
                        <h2 class="checkers-section-title"><?php echo htmlspecialchars($meta['title'], ENT_QUOTES, 'UTF-8'); ?></h2>
                        <p class="checkers-section-hint"><?php echo htmlspecialchars($meta['desc'], ENT_QUOTES, 'UTF-8'); ?></p>
                    </div>
                    <div class="checkers-section-actions">
                        <a class="checkers-back-link" href="<?php echo htmlspecialchars($homeHref, ENT_QUOTES, 'UTF-8'); ?>">
                            <i class="fas fa-arrow-left" aria-hidden="true"></i>
                            <span><?php echo $lang === 'en' ? 'Back to home' : 'На главную'; ?></span>
                        </a>
                    </div>
                </div>
            </section>

            <section class="checkers-panel wotmods-list-section">
                <div class="wotmods-grid">
                    <?php foreach ($mods as $mod): ?>
                        <a href="<?php echo htmlspecialchars((string) $mod['href'], ENT_QUOTES, 'UTF-8'); ?>" class="wotmods-card">
                            <i class="fas <?php echo htmlspecialchars((string) $mod['icon'], ENT_QUOTES, 'UTF-8'); ?> wotmods-card__watermark" aria-hidden="true"></i>
                            <div class="wotmods-card__head">
                                <?php echo wotmods_client_badges_html(); ?>
                                <span class="wotmods-card__version">v<?php echo htmlspecialchars((string) $mod['version'], ENT_QUOTES, 'UTF-8'); ?></span>
                            </div>
                            <div class="wotmods-card__body">
                                <h3 class="wotmods-card__title"><?php echo htmlspecialchars((string) $mod['title'], ENT_QUOTES, 'UTF-8'); ?></h3>
                                <p class="wotmods-card__desc"><?php echo htmlspecialchars((string) $mod['short'], ENT_QUOTES, 'UTF-8'); ?></p>
                            </div>
                            <div class="wotmods-card__footer">
                                <span class="wotmods-card__action">
                                    <span><?php echo htmlspecialchars($openLabel, ENT_QUOTES, 'UTF-8'); ?></span>
                                    <i class="fas fa-arrow-right" aria-hidden="true"></i>
                                </span>
                            </div>
                        </a>
                    <?php endforeach; ?>
                </div>
            </section>
        </main>

<?php require __DIR__ . '/../../includes/site_footer.php'; ?>
</body>
</html>
