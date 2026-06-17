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

$pageTitle = $meta['title'];
abs_set_page_titles('Установка модов', 'Mod Installation');
$metaDescription = $meta['desc'];
$bodyClass = 'page-wotmods';
$seoSlug = 'services/mods';

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="wotmods-service">
            <?php require __DIR__ . '/_installer.php'; ?>
        </main>

<?php require __DIR__ . '/../../includes/site_footer.php'; ?>

    <script>
        window.ABS_LANG = <?php echo json_encode($lang); ?>;
        window.WOTMODS_CATALOG = <?php echo json_encode($mods, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;
        window.WOTMODS_GAMES = <?php echo json_encode([
            'wot' => [
                'label' => wotmods_game_client_label('wot', $lang),
                'icon' => wotmods_game_client_icon('wot'),
            ],
            'lesta' => [
                'label' => wotmods_game_client_label('lesta', $lang),
                'icon' => wotmods_game_client_icon('lesta'),
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;
    </script>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/tactics/confirm.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/wotmods/installer.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
