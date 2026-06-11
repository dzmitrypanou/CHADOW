<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/../../includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

require_once __DIR__ . '/../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../config/ensure_recruiting.php';
require_once __DIR__ . '/../../includes/user_auth.php';
require_once __DIR__ . '/../../includes/recruiting_helpers.php';

ensure_recruiting_posts_table($userDb);
user_require_web();

$postId = (int) ($_GET['id'] ?? 0);
$userId = user_current_id();
$formPost = null;

if ($postId > 0 && $userId !== null) {
    $formPost = $userDb->fetchOne(
        'SELECT
            id, post_type, realm, title, body, contact, clan_tag, clan_tag_type,
            status, moderation_note
         FROM recruiting_posts
         WHERE id = ? AND user_id = ?',
        [$postId, $userId]
    );
}

if (!$formPost) {
    $boardHref = abs_build_lang_href($lang, 'services/recruiting');
    header('Location: ' . $boardHref, true, 302);
    exit();
}

$profile = user_login_row($userDb, (int) $userId);
$postRealm = recruiting_realm_valid((string) ($formPost['realm'] ?? ''))
    ? (string) $formPost['realm']
    : 'ru';
$gameNickname = '';
if (is_array($profile)) {
    $nickState = user_game_nicknames_state($profile);
    $gameNickname = trim((string) ($nickState[$postRealm]['value'] ?? ''));
    if (preg_match('/^#\d+$/', $gameNickname)) {
        $gameNickname = '';
    }
}
$formPost['game_nickname'] = $gameNickname;

$pageTitle = $lang === 'en' ? 'Edit ad' : 'Редактировать объявление';
abs_set_page_titles('Редактировать объявление', 'Edit ad');
$metaDescription = $lang === 'en'
    ? 'Edit your recruiting ad for World of Tanks.'
    : 'Редактирование объявления в разделе рекрутинга World of Tanks.';
$bodyClass = 'page-recruiting';
$seoSlug = 'services/recruiting/edit';
$metaRobots = 'noindex,nofollow';

$boardHref = abs_build_lang_href($lang, 'services/recruiting');
$isEdit = true;

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="recruiting-service">
            <section class="recruiting-panel recruiting-form-panel">
                <div class="recruiting-section-head">
                    <div>
                        <h2 class="recruiting-section-title">
                            <?php echo $lang === 'en' ? 'Edit recruiting ad' : 'Редактирование объявления'; ?>
                        </h2>
                        <p class="recruiting-section-hint">
                            <?php echo $lang === 'en'
                                ? 'Update your ad. Published ads go back to moderation after saving.'
                                : 'Измените объявление. Опубликованные объявления после сохранения снова попадают на модерацию.'; ?>
                        </p>
                    </div>
                    <a class="recruiting-back-link" href="<?php echo htmlspecialchars($boardHref, ENT_QUOTES, 'UTF-8'); ?>">
                        <i class="fas fa-arrow-left" aria-hidden="true"></i>
                        <?php echo $lang === 'en' ? 'Back to recruiting' : 'К рекрутингу'; ?>
                    </a>
                </div>

                <form class="recruiting-form" id="recruitingForm" novalidate>
                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars(user_csrf_token(), ENT_QUOTES, 'UTF-8'); ?>">
                    <input type="hidden" name="id" value="<?php echo (int) $formPost['id']; ?>">
                    <?php require __DIR__ . '/_form_fields.php'; ?>

                    <div class="recruiting-form-actions">
                        <button type="submit" class="recruiting-submit-btn" id="recruitingSubmitBtn">
                            <i class="fas fa-save" aria-hidden="true"></i>
                            <?php echo $lang === 'en' ? 'Save changes' : 'Сохранить'; ?>
                        </button>
                    </div>
                    <div class="recruiting-form-status hidden" id="recruitingFormStatus" role="alert"></div>
                </form>
            </section>
        </main>

<?php require __DIR__ . '/../../includes/site_footer.php'; ?>

    <script>
        window.ABS_RECRUITING_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_RECRUITING_FORM_MODE = 'edit';
        window.ABS_RECRUITING_POST_ID = <?php echo (int) $formPost['id']; ?>;
        window.ABS_RECRUITING_BOARD_HREF = <?php echo json_encode($boardHref); ?>;
        window.ABS_RECRUITING_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_RECRUITING_IS_LOGGED_IN = true;
        window.ABS_RECRUITING_PROFILE_NICKS = <?php echo json_encode(
            is_array($profile)
                ? array_map(static function (string $realm) use ($profile): string {
                    $state = user_game_nicknames_state($profile);
                    $value = trim((string) ($state[$realm]['value'] ?? ''));
                    return preg_match('/^#\d+$/', $value) ? '' : $value;
                }, user_game_nickname_realms())
                : ['ru' => '', 'eu' => '', 'na' => ''],
            JSON_UNESCAPED_UNICODE
        ); ?>;
    </script>
    <script src="/js/services/recruiting/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/custom-select.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/max-icon.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/contacts-editor.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/clan-tag-field.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/form.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
