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

$trainer = isset($_GET['trainer']) ? strtolower(trim((string) $_GET['trainer'])) : '';
if ($trainer === 'checkers') {
    header('Location: ' . abs_build_lang_href($lang, 'services/onlinegames/checkers'), true, 301);
    exit;
}
if (!aim_trainer_valid($trainer)) {
    http_response_code(404);
    require __DIR__ . '/../../404.php';
    exit;
}

try {
    require_once __DIR__ . '/../../config/ensure_aim.php';
    ensure_aim_scores_table($userDb);
} catch (Throwable $e) {
    // play page still works offline
}

$meta = aim_trainer_meta($trainer, $lang);
$defaultNickname = '';
if (user_is_logged_in()) {
    $uid = user_current_id();
    $profile = $uid !== null ? user_login_row($userDb, $uid) : null;
    if (is_array($profile) && !empty($profile['username'])) {
        $defaultNickname = (string) $profile['username'];
    }
}

$hubHref = abs_build_lang_href($lang, 'services/aim');
$playHref = abs_build_lang_href($lang, 'services/aim/' . $trainer);

$pageTitle = $meta['title'] ?? ($lang === 'en' ? 'Aim Trainer' : 'Аим-тренажёр');
abs_set_page_titles(
    ($meta['title'] ?? 'Аим-тренажёр') . ' — Аим-тренажеры',
    ($meta['title'] ?? 'Aim Trainer') . ' — Aim Trainers'
);
$metaDescription = $meta['desc'] ?? ($lang === 'en' ? 'Aim training mini-game.' : 'Мини-игра для тренировки прицела.');
$bodyClass = 'page-aim page-aim-play page-aim-play-' . $trainer;
$seoSlug = 'services/aim/' . $trainer;
$extraHeadHtml = aim_device_sniff_script();

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="aim-play" id="aimPlayRoot">
            <div class="aim-play-toolbar">
                <a class="aim-back-link" href="<?php echo htmlspecialchars($hubHref, ENT_QUOTES, 'UTF-8'); ?>">
                    <i class="fas fa-arrow-left" aria-hidden="true"></i>
                    <span data-aim-i18n="backToHub"><?php echo $lang === 'en' ? 'All trainers' : 'К выбору'; ?></span>
                </a>
                <div class="aim-play-title-wrap">
                    <h2 class="aim-play-title" id="aimPlayTitle"><?php echo htmlspecialchars($meta['title'], ENT_QUOTES, 'UTF-8'); ?></h2>
                    <p class="aim-play-desc" id="aimPlayDesc"><?php echo htmlspecialchars($meta['desc'], ENT_QUOTES, 'UTF-8'); ?></p>
                </div>
                <div class="aim-hud" id="aimHud" hidden>
                    <div class="aim-hud-stat">
                        <span class="aim-hud-label" data-aim-i18n="hudTime"><?php echo $lang === 'en' ? 'Time' : 'Время'; ?></span>
                        <span class="aim-hud-value" id="aimHudTime">—</span>
                    </div>
                    <div class="aim-hud-stat">
                        <span class="aim-hud-label" data-aim-i18n="hudScore"><?php echo $lang === 'en' ? 'Score' : 'Очки'; ?></span>
                        <span class="aim-hud-value" id="aimHudScore">0</span>
                    </div>
                    <div class="aim-hud-stat" id="aimHudExtraWrap" hidden>
                        <span class="aim-hud-label" id="aimHudExtraLabel"></span>
                        <span class="aim-hud-value" id="aimHudExtra">—</span>
                    </div>
                </div>
            </div>

            <div class="aim-play-stage" id="aimPlayStage">
                <div class="aim-play-viewport" id="aimPlayViewport">
                    <canvas id="aimCanvas" class="aim-canvas" aria-label="<?php echo htmlspecialchars($meta['title'], ENT_QUOTES, 'UTF-8'); ?>"></canvas>
                    <div class="aim-crosshair" id="aimCrosshair" hidden aria-hidden="true"></div>

                    <div class="aim-overlay" id="aimOverlay">
                    <div class="aim-overlay-card aim-overlay-card--start" id="aimOverlayIdle">
                        <p class="aim-overlay-hint" data-aim-i18n="clickToStart">
                            <?php echo $lang === 'en'
                                ? 'Click anywhere on the field to start'
                                : 'Кликните в любой точку поля, чтобы начать'; ?>
                        </p>
                    </div>
                    <div class="aim-overlay-card aim-overlay-card--countdown" id="aimOverlayCountdown" hidden>
                        <span class="aim-countdown-num" id="aimCountdownNum">3</span>
                    </div>
                    <div class="aim-overlay-card" id="aimOverlayResults" hidden>
                        <p class="aim-results-label" data-aim-i18n="yourResult">
                            <?php echo $lang === 'en' ? 'Your result' : 'Ваш результат'; ?>
                        </p>
                        <div class="aim-results-score" id="aimResultsScore">0</div>
                        <div class="aim-grade aim-grade--d" id="aimResultsGrade">D</div>
                        <dl class="aim-results-metrics" id="aimResultsMetrics"></dl>
                        <label class="aim-field aim-results-nickname" for="aimResultNickname">
                            <span class="aim-field-label" data-aim-i18n="nicknameLabel">
                                <?php echo $lang === 'en' ? 'Nickname for leaderboard' : 'Ник для топа'; ?>
                            </span>
                            <input
                                type="text"
                                id="aimResultNickname"
                                class="aim-input"
                                maxlength="32"
                                autocomplete="nickname"
                                value="<?php echo htmlspecialchars($defaultNickname, ENT_QUOTES, 'UTF-8'); ?>"
                            >
                        </label>
                        <div class="aim-results-actions">
                            <button type="button" class="aim-btn aim-btn--primary" id="aimSubmitBtn">
                                <i class="fas fa-trophy" aria-hidden="true"></i>
                                <span data-aim-i18n="submitScore"><?php echo $lang === 'en' ? 'Save' : 'Сохранить'; ?></span>
                            </button>
                            <button type="button" class="aim-btn" id="aimRetryBtn">
                                <i class="fas fa-redo" aria-hidden="true"></i>
                                <span data-aim-i18n="retry"><?php echo $lang === 'en' ? 'Try again' : 'Ещё раз'; ?></span>
                            </button>
                            <a class="aim-btn aim-btn--ghost" href="<?php echo htmlspecialchars($hubHref, ENT_QUOTES, 'UTF-8'); ?>">
                                <i class="fas fa-th-large" aria-hidden="true"></i>
                                <span data-aim-i18n="backToHub"><?php echo $lang === 'en' ? 'All trainers' : 'К выбору'; ?></span>
                            </a>
                        </div>
                        <p class="aim-results-note" id="aimSubmitNote" hidden></p>
                    </div>
                </div>
                </div>
                <aside class="aim-play-side-hud" id="aimPlaySideHud" hidden aria-hidden="true">
                    <div class="aim-hud-stat">
                        <span class="aim-hud-label" data-aim-i18n="hudTime"><?php echo $lang === 'en' ? 'Time' : 'Время'; ?></span>
                        <span class="aim-hud-value" id="aimHudSideTime">—</span>
                    </div>
                    <div class="aim-hud-stat">
                        <span class="aim-hud-label" data-aim-i18n="hudScore"><?php echo $lang === 'en' ? 'Score' : 'Очки'; ?></span>
                        <span class="aim-hud-value" id="aimHudSideScore">0</span>
                    </div>
                    <div class="aim-hud-stat" id="aimHudSideExtraWrap" hidden>
                        <span class="aim-hud-label" id="aimHudSideExtraLabel"></span>
                        <span class="aim-hud-value" id="aimHudSideExtra">—</span>
                    </div>
                </aside>
                <p class="aim-play-rotate-hint">
                    <i class="fas fa-mobile-screen-button" aria-hidden="true"></i>
                    <span data-aim-i18n="rotateForFullscreen"><?php echo $lang === 'en'
                        ? 'Rotate your device for fullscreen play'
                        : 'Поверните экран, чтобы играть в полноэкранном режиме'; ?></span>
                </p>
            </div>
        </main>

<?php require __DIR__ . '/../../includes/site_footer.php'; ?>

    <script>
        window.ABS_AIM_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_AIM_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_AIM_TRAINER = <?php echo json_encode($trainer); ?>;
        window.ABS_AIM_TRAINER_META = <?php echo json_encode($meta, JSON_UNESCAPED_UNICODE); ?>;
        window.ABS_AIM_HUB_BASE = <?php echo json_encode($hubHref); ?>;
        window.ABS_AIM_API_SUBMIT = <?php echo json_encode(user_api_path('/api/aim/submit.php')); ?>;
        window.ABS_AIM_DEFAULT_NICKNAME = <?php echo json_encode($defaultNickname); ?>;
        window.ABS_AIM_GRADE_THRESHOLDS = <?php echo json_encode(AIM_GRADE_THRESHOLDS[$trainer]); ?>;
    </script>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/nickname.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/core.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/trainers/flick.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/trainers/tracking.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/trainers/reaction.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/trainers/lead.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/trainers/gridshot.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/trainers/duckhunt.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/trainers/vugich.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/aim/play.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
