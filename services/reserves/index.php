<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/../../includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

require_once __DIR__ . '/../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../config/ensure_clan_reserves.php';
require_once __DIR__ . '/../../includes/user_auth.php';
require_once __DIR__ . '/../../includes/game_api.php';
require_once __DIR__ . '/../../includes/clan_reserve_helpers.php';

ensure_clan_reserves_tables($userDb);
user_require_web();
user_require_active_web($userDb);

$isEn = $lang === 'en';
$userId = user_current_id();
$profile = $userId !== null ? user_login_row($userDb, (int) $userId) : null;
$reserveRegions = is_array($profile)
    ? clan_reserve_user_regions_state($userDb, (int) $profile['id'], $profile)
    : [];
$reserveLinks = [];
foreach ($reserveRegions as $region) {
    foreach ($region['accounts'] ?? [] as $account) {
        if (!is_array($account)) {
            continue;
        }
        $reserveLinks[] = array_merge($account, [
            'configured' => !empty($region['configured']),
        ]);
    }
}
$serviceConfigured = game_api_reserves_service_active($userDb);
$usableLinks = array_values(array_filter($reserveLinks, static fn(array $link): bool => !empty($link['usable'])));

$activeLinkId = isset($_GET['link_id']) ? (int) $_GET['link_id'] : 0;
$activeLink = null;
if ($activeLinkId > 0) {
    $activeLink = clan_reserve_find_link_by_id($usableLinks, $activeLinkId);
}
if ($activeLink === null) {
    $activeLink = clan_reserve_find_usable_link($usableLinks);
}
$canUseReserves = $serviceConfigured && $activeLink !== null;

$reservesReturn = abs_build_lang_href($lang, 'services/reserves');

$pageTitle = $isEn ? 'Clan Reserves' : 'Клановые резервы';
abs_set_page_titles('Клановые резервы', 'Clan Reserves');
$metaDescription = $isEn
    ? 'View clan reserves, activate manually, and schedule automatic activation for World of Tanks.'
    : 'Список клановых резервов, ручная активация и автозапуск по расписанию для World of Tanks.';
$bodyClass = 'page-reserves';
$seoSlug = 'services/reserves';

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="reserves-service">
            <section class="tactics-panel reserves-header-panel">
                <div class="bracket-section-head reserves-header-panel__head">
                    <div class="reserves-header-panel__intro">
                        <h1 class="bracket-section-title reserves-page-title" data-reserves-i18n="pageTitle"><?php echo htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8'); ?></h1>
                        <p class="bracket-section-hint" data-reserves-i18n="pageHint">
                            <?php echo $isEn
                                ? 'Manage clan reserves per linked region — manual activation and schedules for each clan.'
                                : 'Управление клановыми резервами по регионам — ручной запуск и расписание для каждого клана.'; ?>
                        </p>
                    </div>
                </div>

                <?php if ($serviceConfigured): ?>
                <div class="reserves-account-bar" id="reservesAccountPanel">
                    <div class="reserves-account-bar__body" id="reservesAccountState">
                        <?php
                        $reservesPanelRegions = $reserveRegions;
                        $reservesPanelReturn = $reservesReturn;
                        $reservesPanelActiveLinkId = $activeLink !== null ? (int) ($activeLink['link_id'] ?? 0) : 0;
                        $reservesPanelUserId = (int) $userId;
                        require __DIR__ . '/../../auth/_reserves_accounts_panel.php';
                        ?>
                    </div>
                </div>
                <?php endif; ?>
            </section>

            <?php if (!$serviceConfigured): ?>
            <section class="tactics-panel">
                <p class="bracket-section-hint" data-reserves-i18n="apiNotConfigured">
                    <?php echo $isEn
                        ? 'WG or LESTA API keys are not configured. Ask the site administrator to add them.'
                        : 'API-ключи WG или LESTA не настроены. Обратитесь к администратору сайта.'; ?>
                </p>
            </section>
            <?php else: ?>

            <div class="reserves-workspace" id="reservesWorkspace">
                <section class="tactics-panel reserves-catalog-panel" id="reservesCatalogPanel">
                    <div class="tactics-section-head">
                        <h2 class="bracket-section-title" data-reserves-i18n="catalogTitle"><?php echo $isEn ? 'Clan reserves' : 'Клановые резервы'; ?></h2>
                        <div class="tactics-section-actions">
                            <button type="button" class="tactics-icon-btn reserves-action-btn" id="reservesRefreshBtn" data-reserves-i18n="refresh">
                                <?php echo $isEn ? 'Refresh' : 'Обновить'; ?>
                            </button>
                        </div>
                    </div>
                    <div class="reserves-catalog-body">
                        <div class="reserves-catalog-body__content" id="reservesCatalog"></div>
                        <p class="bracket-section-hint reserves-loading reserves-catalog-body__overlay" id="reservesCatalogLoading"<?php echo $canUseReserves ? '' : ' hidden'; ?> data-reserves-i18n="loading"><?php echo $isEn ? 'Loading…' : 'Загрузка…'; ?></p>
                        <p class="tactics-form-error reserves-catalog-body__overlay" id="reservesCatalogError" hidden></p>
                    </div>
                </section>

                <aside class="reserves-sidebar">
                    <section class="tactics-panel" id="reservesSchedulePanel">
                        <h2 class="bracket-section-title" data-reserves-i18n="scheduleTitle"><?php echo $isEn ? 'Automatic activation' : 'Автоматическая активация'; ?></h2>
                        <p class="bracket-section-hint" data-reserves-i18n="scheduleHint">
                            <?php echo $isEn
                                ? 'Schedule applies to the selected clan above.'
                                : 'Расписание применяется к выбранному клану выше.'; ?>
                        </p>
                        <form id="reservesRuleForm" class="tactics-form reserves-schedule-form">
                            <div class="reserves-schedule-form__row">
                                <label class="tactics-field reserves-schedule-field">
                                    <span class="tactics-field-label" data-reserves-i18n="ruleType"><?php echo $isEn ? 'Reserve type' : 'Тип резерва'; ?></span>
                                    <select id="reservesRuleType" class="recruiting-select" required>
                                        <option value="" data-reserves-i18n="selectType"><?php echo $isEn ? 'Select type' : 'Выберите тип'; ?></option>
                                    </select>
                                </label>
                                <label class="tactics-field reserves-schedule-field">
                                    <span class="tactics-field-label" data-reserves-i18n="ruleLevel"><?php echo $isEn ? 'Level' : 'Уровень'; ?></span>
                                    <select id="reservesRuleLevel" class="recruiting-select" required>
                                        <option value="" data-reserves-i18n="selectLevel"><?php echo $isEn ? 'Select level' : 'Выберите уровень'; ?></option>
                                    </select>
                                </label>
                                <label class="tactics-field reserves-schedule-field reserves-schedule-field--time">
                                    <span class="tactics-field-label" data-reserves-i18n="ruleTime"><?php echo $isEn ? 'Time' : 'Время'; ?></span>
                                    <input type="time" id="reservesRuleTime" class="reserves-control reserves-control--time" required value="20:00">
                                </label>
                            </div>
                            <fieldset class="reserves-days">
                                <legend data-reserves-i18n="ruleDays"><?php echo $isEn ? 'Days' : 'Дни'; ?></legend>
                                <label class="reserves-day"><input type="checkbox" name="day" value="mon"><span class="reserves-day__chip" data-reserves-i18n="dayMon">Mon</span></label>
                                <label class="reserves-day"><input type="checkbox" name="day" value="tue"><span class="reserves-day__chip" data-reserves-i18n="dayTue">Tue</span></label>
                                <label class="reserves-day"><input type="checkbox" name="day" value="wed"><span class="reserves-day__chip" data-reserves-i18n="dayWed">Wed</span></label>
                                <label class="reserves-day"><input type="checkbox" name="day" value="thu"><span class="reserves-day__chip" data-reserves-i18n="dayThu">Thu</span></label>
                                <label class="reserves-day"><input type="checkbox" name="day" value="fri"><span class="reserves-day__chip" data-reserves-i18n="dayFri">Fri</span></label>
                                <label class="reserves-day"><input type="checkbox" name="day" value="sat"><span class="reserves-day__chip" data-reserves-i18n="daySat">Sat</span></label>
                                <label class="reserves-day"><input type="checkbox" name="day" value="sun"><span class="reserves-day__chip" data-reserves-i18n="daySun">Sun</span></label>
                            </fieldset>
                            <button type="submit" class="tactics-submit-btn reserves-action-btn" id="reservesRuleSaveBtn" data-reserves-i18n="saveRule">
                                <?php echo $isEn ? 'Save schedule' : 'Сохранить расписание'; ?>
                            </button>
                        </form>
                    </section>

                    <section class="tactics-panel" id="reservesRulesPanel">
                        <h2 class="bracket-section-title" data-reserves-i18n="rulesTitle"><?php echo $isEn ? 'Saved schedules' : 'Сохранённые расписания'; ?></h2>
                        <p class="bracket-section-hint reserves-loading" id="reservesRulesLoading"<?php echo $canUseReserves ? '' : ' hidden'; ?> data-reserves-i18n="loading"><?php echo $isEn ? 'Loading…' : 'Загрузка…'; ?></p>
                        <div id="reservesRulesList"></div>
                    </section>

                    <section class="tactics-panel" id="reservesLogPanel">
                        <h2 class="bracket-section-title" data-reserves-i18n="logTitle"><?php echo $isEn ? 'Activation log' : 'Журнал активаций'; ?></h2>
                        <div id="reservesLog"></div>
                    </section>
                </aside>
            </div>

            <?php endif; ?>
        </main>

<?php require __DIR__ . '/../../includes/site_footer.php'; ?>
    <script src="/js/site-toast.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script>
        window.ABS_RESERVES_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_RESERVES_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
        window.ABS_RESERVES_CATALOG_API = <?php echo json_encode(user_api_path('/api/reserves/catalog.php')); ?>;
        window.ABS_RESERVES_ACTIVATE_API = <?php echo json_encode(user_api_path('/api/reserves/activate.php')); ?>;
        window.ABS_RESERVES_RULES_API = <?php echo json_encode(user_api_path('/api/reserves/rules.php')); ?>;
        window.ABS_RESERVES_UNLINK_API = <?php echo json_encode(user_api_path('/api/reserves/unlink.php')); ?>;
        window.ABS_RESERVES_CLAN_API = <?php echo json_encode(user_api_path('/api/reserves/clan.php')); ?>;
        window.ABS_RESERVES_CLANS_API = <?php echo json_encode(user_api_path('/api/reserves/clans.php')); ?>;
        window.ABS_RESERVES_CAN_USE = <?php echo json_encode($canUseReserves); ?>;
        window.ABS_RESERVES_ACTIVE = <?php echo json_encode($activeLink !== null ? [
            'link_id' => (int) ($activeLink['link_id'] ?? 0),
            'provider' => $activeLink['provider'] ?? '',
            'realm' => $activeLink['realm'] ?? '',
            'slot_label' => $activeLink['slot_label'] ?? '',
            'nickname' => $activeLink['nickname'] ?? '',
        ] : null); ?>;
        window.ABS_RESERVES_USABLE = <?php echo json_encode(array_map(static fn(array $link): array => [
            'link_id' => (int) ($link['link_id'] ?? 0),
            'provider' => $link['provider'] ?? '',
            'realm' => $link['realm'] ?? '',
            'slot_label' => $link['slot_label'] ?? '',
            'nickname' => $link['nickname'] ?? '',
        ], $usableLinks)); ?>;
        window.showProfileToast = window.showProfileToast || window.showSiteToast;
    </script>
    <script src="/js/services/tactics/confirm.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/reserves/i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/recruiting/custom-select.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/reserves/reserves-accounts.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/reserves/reserves-links.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
    <script src="/js/services/reserves/app.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
