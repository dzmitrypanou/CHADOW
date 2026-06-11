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

$isLoggedIn = user_is_logged_in();
$pageTitle = $lang === 'en' ? 'Post an ad' : 'Подать объявление';
abs_set_page_titles('Подать объявление', 'Post an ad');
$metaDescription = $lang === 'en'
    ? 'Submit a recruiting ad for World of Tanks clans, teams, or players.'
    : 'Разместить объявление о поиске клана, команды или игроков в World of Tanks.';
$bodyClass = 'page-recruiting';
$seoSlug = 'services/recruiting/post';
$metaRobots = 'noindex,nofollow';

$boardHref = abs_build_lang_href($lang, 'services/recruiting');
$userId = user_current_id();
$recruitingPrefs = $userId !== null
    ? user_recruiting_prefs($userDb, $userId)
    : ['contacts' => [], 'clan_tag' => '', 'team_name' => '', 'clan_tag_type' => 'clan_tag', 'post_type' => '', 'realm' => ''];
$profile = null;
$gameNickname = '';
if ($userId !== null) {
    $profile = user_login_row($userDb, (int) $userId);
    if (is_array($profile)) {
        $prefRealm = recruiting_realm_valid((string) $recruitingPrefs['realm'])
            ? (string) $recruitingPrefs['realm']
            : 'ru';
        $nickState = user_game_nicknames_state($profile);
        $gameNickname = trim((string) ($nickState[$prefRealm]['value'] ?? ''));
        if (preg_match('/^#\d+$/', $gameNickname)) {
            $gameNickname = '';
        }
    }
}

$recruitingClanFields = user_recruiting_post_form_clan($recruitingPrefs);
$formPost = [
    'post_type' => $recruitingPrefs['post_type'],
    'realm' => $recruitingPrefs['realm'],
    'game_nickname' => $gameNickname,
    'contacts' => $recruitingPrefs['contacts'],
    'clan_tag' => $recruitingClanFields['clan_tag'],
    'clan_tag_type' => $recruitingClanFields['clan_tag_type'],
];
$isEdit = false;

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="recruiting-service">
            <section class="recruiting-panel recruiting-form-panel">
                <div class="recruiting-section-head">
                    <div>
                        <h2 class="recruiting-section-title">
                            <?php echo $lang === 'en' ? 'New recruiting ad' : 'Новое объявление'; ?>
                        </h2>
                        <p class="recruiting-section-hint">
                            <?php echo $lang === 'en'
                                ? 'Your ad will be reviewed by a moderator before publication.'
                                : 'Объявление будет проверено модератором перед публикацией.'; ?>
                        </p>
                    </div>
                    <a class="recruiting-back-link" href="<?php echo htmlspecialchars($boardHref, ENT_QUOTES, 'UTF-8'); ?>">
                        <i class="fas fa-arrow-left" aria-hidden="true"></i>
                        <?php echo $lang === 'en' ? 'Back to recruiting' : 'К рекрутингу'; ?>
                    </a>
                </div>

                <form class="recruiting-form" id="recruitingForm" novalidate>
                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars(user_csrf_token(), ENT_QUOTES, 'UTF-8'); ?>">
                    <?php require __DIR__ . '/_form_fields.php'; ?>

                    <div class="recruiting-form-actions">
                        <button type="submit" class="recruiting-submit-btn" id="recruitingSubmitBtn">
                            <i class="fas fa-paper-plane" aria-hidden="true"></i>
                            <?php echo $lang === 'en' ? 'Submit' : 'Отправить'; ?>
                        </button>
                    </div>
                    <div class="recruiting-form-status hidden" id="recruitingFormStatus" role="alert"></div>
                </form>
            </section>
        </main>

<?php require __DIR__ . '/../../includes/site_footer.php'; ?>

    <script>
        window.ABS_RECRUITING_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_RECRUITING_FORM_MODE = 'create';
        window.ABS_RECRUITING_BOARD_HREF = <?php echo json_encode($boardHref); ?>;
        window.ABS_RECRUITING_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_RECRUITING_IS_LOGGED_IN = <?php echo $isLoggedIn ? 'true' : 'false'; ?>;
        window.ABS_RECRUITING_PREFS_API = '/api/auth/save_recruiting_prefs.php';
        window.ABS_RECRUITING_CLAN_PREFS = <?php echo json_encode([
            'clan_tag' => $recruitingPrefs['clan_tag'],
            'team_name' => $recruitingPrefs['team_name'],
        ], JSON_UNESCAPED_UNICODE); ?>;
        window.ABS_RECRUITING_INITIAL_FORM = <?php echo json_encode([
            'post_type' => $formPost['post_type'],
            'realm' => $formPost['realm'],
            'game_nickname' => $formPost['game_nickname'],
            'clan_tag' => $recruitingPrefs['clan_tag'],
            'team_name' => $recruitingPrefs['team_name'],
            'clan_tag_type' => $formPost['clan_tag_type'],
            'contacts' => $formPost['contacts'],
        ], JSON_UNESCAPED_UNICODE); ?>;
        window.ABS_RECRUITING_PROFILE_NICKS = <?php echo json_encode(
            $userId !== null && isset($profile) && is_array($profile)
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
    <script src="/js/services/recruiting/form-draft-cache.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/custom-select.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/max-icon.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/contacts-editor.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/clan-tag-field.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/form.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
