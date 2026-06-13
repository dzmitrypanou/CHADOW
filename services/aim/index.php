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

$trainers = aim_all_trainers_meta($lang);
$miniLeaderboards = ['desktop' => [], 'mobile' => []];
try {
    require_once __DIR__ . '/../../config/ensure_aim.php';
    ensure_aim_scores_table($userDb);
    $miniLeaderboards = aim_fetch_mini_leaderboards_by_device(
        $userDb,
        array_map(static function (array $trainer): string {
            return (string) ($trainer['id'] ?? '');
        }, $trainers),
        3
    );
} catch (Throwable $e) {
    // lobby still renders without DB
}

$defaultNickname = '';
if (user_is_logged_in()) {
    $uid = user_current_id();
    $profile = $uid !== null ? user_login_row($userDb, $uid) : null;
    if (is_array($profile) && !empty($profile['username'])) {
        $defaultNickname = (string) $profile['username'];
    }
}

$pageTitle = $lang === 'en' ? 'Aim Trainers' : 'Аим-тренажеры';
abs_set_page_titles('Аим-тренажеры', 'Aim Trainers');
$metaDescription = $lang === 'en'
    ? 'Mini-games for aim and reaction training: flick, tracking, reaction, lead shot, gridshot, and duck hunt with global leaderboards.'
    : 'Мини-игры для тренировки прицеливания и реакции: flick, tracking, reaction, lead shot, gridshot и утиная охота с глобальным топом.';
$bodyClass = 'page-aim';
$seoSlug = 'services/aim';
$extraHeadHtml = aim_device_sniff_script();

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="aim-service">
            <section class="aim-panel aim-service-header">
                <div class="aim-header-bar">
                    <div class="aim-header-intro">
                        <h2 class="aim-section-title" data-aim-i18n="serviceTitle">
                            <?php echo $lang === 'en' ? 'Aim Trainer Games' : 'Аим-тренажеры'; ?>
                        </h2>
                        <p class="aim-section-hint" data-aim-i18n="serviceHint">
                            <?php echo $lang === 'en'
                                ? 'Pick a trainer, enter your nickname, and compete on the global leaderboard.'
                                : 'Выберите тренажёр, введите ник и соревнуйтесь в глобальном топе.'; ?>
                        </p>
                    </div>
                    <div class="aim-header-actions">
                        <label class="aim-nick-inline" for="aimNicknameInput">
                            <span class="aim-nick-inline__label" data-aim-i18n="nicknameLabel">
                                <?php echo $lang === 'en' ? 'Nickname' : 'Ник'; ?>
                            </span>
                            <span class="aim-nick-inline__field">
                                <i class="fas fa-user aim-nick-inline__icon" aria-hidden="true"></i>
                                <input
                                    type="text"
                                    id="aimNicknameInput"
                                    class="aim-nick-inline__input"
                                    maxlength="32"
                                    autocomplete="nickname"
                                    value="<?php echo htmlspecialchars($defaultNickname, ENT_QUOTES, 'UTF-8'); ?>"
                                    placeholder="<?php echo $lang === 'en' ? 'For leaderboard' : 'Для топа'; ?>"
                                    title="<?php echo $lang === 'en'
                                        ? 'Saved in this browser. Required to submit scores.'
                                        : 'Сохраняется в браузере. Нужен для отправки результата в топ.'; ?>"
                                >
                            </span>
                        </label>
                        <a
                            class="aim-btn aim-btn--ghost aim-ratings-btn"
                            data-aim-ratings-link
                            href="<?php echo htmlspecialchars(abs_build_lang_href($lang, 'services/aim/ratings'), ENT_QUOTES, 'UTF-8'); ?>"
                        >
                            <i class="fas fa-trophy" aria-hidden="true"></i>
                            <span data-aim-i18n="ratingsBtn"><?php echo $lang === 'en' ? 'Leaderboards' : 'Таблицы лидеров'; ?></span>
                        </a>
                    </div>
                </div>
            </section>

            <section class="aim-panel aim-trainers-section" aria-label="<?php echo $lang === 'en' ? 'Trainers' : 'Тренажёры'; ?>">
                <div id="aimTrainerGrid" class="aim-trainer-grid"></div>
            </section>
        </main>

<?php require __DIR__ . '/../../includes/site_footer.php'; ?>

    <script>
        window.ABS_AIM_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_AIM_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_AIM_TRAINERS = <?php echo json_encode($trainers, JSON_UNESCAPED_UNICODE); ?>;
        window.ABS_AIM_MINI_LEADERBOARDS = <?php echo json_encode($miniLeaderboards, JSON_UNESCAPED_UNICODE); ?>;
        window.ABS_AIM_HUB_BASE = <?php echo json_encode(abs_build_lang_href($lang, 'services/aim')); ?>;
        window.ABS_AIM_API_LEADERBOARD = <?php echo json_encode(user_api_path('/api/aim/leaderboard.php')); ?>;
        window.ABS_AIM_API_SUBMIT = <?php echo json_encode(user_api_path('/api/aim/submit.php')); ?>;
        window.ABS_AIM_DEFAULT_NICKNAME = <?php echo json_encode($defaultNickname); ?>;
    </script>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/core.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/nickname.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/leaderboard.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/lobby.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
