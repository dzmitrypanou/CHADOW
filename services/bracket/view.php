<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/../../includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

require_once __DIR__ . '/../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../config/ensure_brackets.php';
require_once __DIR__ . '/../../includes/user_auth.php';
require_once __DIR__ . '/../../includes/bracket_helpers.php';

ensure_brackets_table($userDb);

$publicId = trim((string) ($_GET['public_id'] ?? ''));
if (!bracket_public_id_valid($publicId)) {
    http_response_code(404);
    require __DIR__ . '/../../includes/site_header.php';
    echo '<main class="bracket-service"><section class="bracket-panel"><p>404</p></section></main>';
    require __DIR__ . '/../../includes/site_footer.php';
    exit();
}

$row = $userDb->fetchOne(
    'SELECT ' . bracket_sql_select_columns('b') . ', b.edit_token FROM tournament_brackets b WHERE b.public_id = ?',
    [$publicId]
);

if (!$row || !bracket_is_publicly_visible($row)) {
    http_response_code(404);
    require __DIR__ . '/../../includes/site_header.php';
    echo '<main class="bracket-service"><section class="bracket-panel"><p>404</p></section></main>';
    require __DIR__ . '/../../includes/site_footer.php';
    exit();
}

$userId = user_current_id();
$ownerId = bracket_row_owner_id($row);
$isOwner = $userId !== null && $ownerId !== null && $ownerId === $userId;
$bracketItem = bracket_format_item($row, false, true);
$bracketCreatorName = bracket_creator_display_name($userDb, $row, $lang);

$pageTitle = htmlspecialchars((string) $row['title'], ENT_QUOTES, 'UTF-8');
abs_set_page_titles((string) $row['title'], (string) $row['title']);
$metaDescription = $lang === 'en'
    ? 'Tournament bracket: ' . (string) $row['title']
    : 'Турнирная сетка: ' . (string) $row['title'];
$bodyClass = 'page-bracket page-bracket-view';
$seoSlug = 'services/bracket/' . $publicId;

if ((string) ($row['visibility'] ?? '') === 'hidden') {
    $metaRobots = 'noindex,nofollow';
}

$listHref = abs_build_lang_href($lang, 'services/bracket');
$editHref = abs_build_lang_href($lang, 'services/bracket/' . $publicId . '/edit');

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="bracket-service">
            <section class="bracket-panel bracket-service-header">
                <div class="bracket-section-head">
                    <div>
                        <h2 class="bracket-section-title"><?php echo htmlspecialchars((string) $row['title'], ENT_QUOTES, 'UTF-8'); ?></h2>
                        <div class="bracket-view-header-meta bracket-meta-top" id="bracketHeaderMeta"></div>
                        <?php if ($bracketCreatorName !== null): ?>
                        <p class="bracket-view-creator">
                            <i class="fas fa-user" aria-hidden="true"></i>
                            <span class="bracket-view-creator-label"><?php echo $lang === 'en' ? 'Organizer' : 'Организатор'; ?>:</span>
                            <span><?php echo htmlspecialchars($bracketCreatorName, ENT_QUOTES, 'UTF-8'); ?></span>
                        </p>
                        <?php endif; ?>
                    </div>
                    <div class="bracket-section-actions">
                        <button type="button" id="bracketCopyLinkBtn" class="bracket-back-link">
                            <i class="fas fa-link" aria-hidden="true"></i>
                            <?php echo $lang === 'en' ? 'Copy link' : 'Копировать ссылку'; ?>
                        </button>
                        <?php if ($isOwner): ?>
                        <a class="bracket-cta-btn" href="<?php echo htmlspecialchars($editHref, ENT_QUOTES, 'UTF-8'); ?>">
                            <i class="fas fa-edit" aria-hidden="true"></i>
                            <?php echo $lang === 'en' ? 'Edit' : 'Редактировать'; ?>
                        </a>
                        <?php endif; ?>
                        <a class="bracket-back-link bracket-section-actions__back" href="<?php echo htmlspecialchars($listHref, ENT_QUOTES, 'UTF-8'); ?>">
                            <i class="fas fa-arrow-left" aria-hidden="true"></i>
                            <?php echo $lang === 'en' ? 'Back' : 'Назад'; ?>
                        </a>
                    </div>
                </div>
            </section>

            <section class="bracket-panel bracket-view-panel">
                <div id="bracketMetaDisplay" class="bracket-meta-display"></div>
                <div id="bracketRenderTarget" class="bracket-render-target"></div>
            </section>
        </main>

<?php
require __DIR__ . '/../../includes/site_footer.php';
?>
    <script>
        window.ABS_BRACKET_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_BRACKET_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_BRACKET_PUBLIC_ID = <?php echo json_encode($publicId); ?>;
        window.ABS_BRACKET_INITIAL = <?php echo json_encode($bracketItem); ?>;
        window.ABS_BRACKET_IS_OWNER = <?php echo json_encode($isOwner); ?>;
    </script>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/games.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/match-format.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/bracket-combobox.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/prizes.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/placements.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/meta-panel.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/engine/single.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/engine/double.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/engine/group.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/engine/index.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/renderer.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/bracket/editor.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
