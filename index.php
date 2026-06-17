<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

$metaDescription = $lang === 'en'
    ? 'Chadow project hub: ABS replay analysis, server status, recruiting, tournament brackets, aim training, and more for World of Tanks.'
    : 'Портал Chadow: анализ АБС реплеев, статус серверов, рекрутинг, турнирные сетки, тренировка прицела и другие сервисы для World of Tanks.';
$bodyClass = 'page-landing';

$absServiceHref = $lang === 'en' ? '/en/services/abs' : '/services/abs';
$onlineServiceHref = $lang === 'en' ? '/en/services/online' : '/services/online';
$recruitingServiceHref = $lang === 'en' ? '/en/services/recruiting' : '/services/recruiting';
$bracketServiceHref = $lang === 'en' ? '/en/services/bracket' : '/services/bracket';
$bracketCreateHref = $lang === 'en' ? '/en/services/bracket/create' : '/services/bracket/create';
$bracketPublicHref = $bracketServiceHref;
$bracketCreateLabel = $lang === 'en' ? 'Create bracket' : 'Создать сетку';
$bracketPublicLabel = $lang === 'en' ? 'Public brackets' : 'Публичные сетки';
$tacticsServiceHref = $lang === 'en' ? '/en/services/tactics' : '/services/tactics';
$tacticsCreateHref = $tacticsServiceHref;
$tacticsRoomsHref = $lang === 'en' ? '/en/services/tactics/rooms' : '/services/tactics/rooms';
$tacticsCreateLabel = $lang === 'en' ? 'Create board' : 'Создать планшет';
$tacticsRoomsLabel = $lang === 'en' ? 'Open rooms' : 'Открытые комнаты';
$aimServiceHref = $lang === 'en' ? '/en/services/aim' : '/services/aim';
$onlineGamesServiceHref = $lang === 'en' ? '/en/services/onlinegames' : '/services/onlinegames';
$wotmodsServiceHref = $lang === 'en' ? '/en/services/mods' : '/services/mods';
$inDevLabel = $lang === 'en' ? 'In development' : 'в разработке';
$openLabel = $lang === 'en' ? 'Open' : 'Открыть';
require_once __DIR__ . '/includes/game_api.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/minecraft_helpers.php';
require_once __DIR__ . '/config/ensure_map_dictionary.php';
require_once __DIR__ . '/config/ensure_tactics.php';
require_once __DIR__ . '/config/tactics_map_catalog.php';
$tacticsBadgesHtml = '';
try {
    $tacticsDb = Database::getInstance();
    ensure_map_dictionary_table($tacticsDb);
    ensure_tactics_map_assignments_table($tacticsDb);
    $tacticsMapRows = $tacticsDb->fetchAll(
        'SELECT map_code, display_name_ru, display_name_en, side_length
         FROM map_dictionary
         ORDER BY display_name_ru'
    );
    $tacticsCatalog = tactics_build_map_catalog($tacticsMapRows, $lang, $tacticsDb);
    $tacticsBadgesHtml = tactics_project_card_badges_html(
        tactics_games_with_catalog_maps($tacticsCatalog['games'] ?? [])
    );
} catch (Throwable $e) {
    $tacticsBadgesHtml = '';
}
$launcherLanding = minecraft_landing_defaults();
$launcherLanding['active'] = false;
$launcherLanding['launcher_file'] = null;
try {
    $launcherDb = Database::getInstance();
    ensure_site_settings_table($launcherDb);
    $launcherLanding = minecraft_get_landing_settings($launcherDb);
} catch (Throwable $e) {

}
$launcherCardFile = $launcherLanding['launcher_file'] ?? null;
$launcherCardActive = !empty($launcherLanding['active']) && is_array($launcherCardFile);
$launcherCardDownloadUrl = $launcherCardActive
    ? minecraft_launcher_public_path((string) $launcherCardFile['filename'])
    : '';
$launcherCardTileClass = minecraft_landing_tile_class((int) ($launcherLanding['tile_span'] ?? 2));
$launcherCardDescRu = (string) ($launcherLanding['desc_ru'] ?? '');
$launcherCardDescEn = (string) ($launcherLanding['desc_en'] ?? '');
$launcherCardDesc = $lang === 'en'
    ? ($launcherCardDescEn !== '' ? $launcherCardDescEn : $launcherCardDescRu)
    : ($launcherCardDescRu !== '' ? $launcherCardDescRu : $launcherCardDescEn);
$launcherCardBadgesHtml = minecraft_landing_card_badges_html($launcherLanding, $lang, $launcherCardActive);
$launcherDownloadLabel = $lang === 'en' ? 'Download' : 'Скачать';
$lestaApiConfigured = game_api_is_configured_for_realm('ru');
$lestaBadgeHtml = game_api_ru_publisher_badge_span($lang);
$realmBadgesHtml = '<div class="project-card-badge-row">'
    . '<span class="project-card-badge project-card-badge--wg">WG</span>'
    . $lestaBadgeHtml
    . '</div>';
$onlineBadgesHtml = '<div class="project-card-badge-row">'
    . '<span class="project-card-badge project-card-badge--wg">WG</span>'
    . ($lestaApiConfigured ? $lestaBadgeHtml : '')
    . '</div>';
$inDevBadgeHtml = '<div class="project-card-badge-row">'
    . '<span class="project-card-badge">' . htmlspecialchars($inDevLabel, ENT_QUOTES, 'UTF-8') . '</span>'
    . '</div>';
$wotmodsBadgesHtml = '<div class="project-card-badge-row">'
    . '<span class="project-card-badge project-card-badge--wg">WG</span>'
    . $lestaBadgeHtml
    . '</div>';
$bracketBadgesHtml = '<div class="project-card-badge-row">'
    . '<span class="project-card-badge project-card-badge--wg">WG</span>'
    . $lestaBadgeHtml
    . '<span class="project-card-badge project-card-badge--cs2">CS2</span>'
    . '<span class="project-card-badge project-card-badge--dota2">Dota 2</span>'
    . '</div>';
$aimBadgesHtml = '<div class="project-card-badge-row">'
    . '<span class="project-card-badge project-card-badge--wg">WG</span>'
    . $lestaBadgeHtml
    . '<span class="project-card-badge project-card-badge--cs2">CS2</span>'
    . '<span class="project-card-badge project-card-badge--dota2">Dota 2</span>'
    . '</div>';
require __DIR__ . '/includes/site_header.php';
?>

        <main class="projects-landing">
            <div class="projects-grid">
                <div class="project-card project-card--active project-card--span-2" data-landing-id="tactics">
                    <i class="fas fa-map project-card-bg-icon" aria-hidden="true"></i>
                    <div class="project-card-body">
                        <div class="project-card-head">
                            <?php echo $tacticsBadgesHtml; ?>
                            <h2 class="project-card-title">
                                <i class="fas fa-map project-card-icon" aria-hidden="true"></i>
                                <span class="project-card-title-text">
                                    <?php echo $lang === 'en' ? 'Tactical Board' : 'Тактический планшет'; ?>
                                </span>
                            </h2>
                        </div>
                        <p class="project-card-desc">
                            <?php echo $lang === 'en'
                                ? 'Plan tactics together on map overlays — open or password-protected rooms.'
                                : 'Совместное планирование тактик на картах — открытые и закрытые комнаты.'; ?>
                        </p>
                    </div>
                    <div class="project-card-footer project-card-footer--actions">
                        <a href="<?php echo htmlspecialchars($tacticsCreateHref, ENT_QUOTES, 'UTF-8'); ?>" class="project-card-action" data-landing-action="create">
                            <?php echo htmlspecialchars($tacticsCreateLabel, ENT_QUOTES, 'UTF-8'); ?>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </a>
                        <a href="<?php echo htmlspecialchars($tacticsRoomsHref, ENT_QUOTES, 'UTF-8'); ?>" class="project-card-action" data-landing-action="rooms">
                            <?php echo htmlspecialchars($tacticsRoomsLabel, ENT_QUOTES, 'UTF-8'); ?>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </a>
                    </div>
                </div>

                <a href="<?php echo htmlspecialchars($absServiceHref, ENT_QUOTES, 'UTF-8'); ?>" class="project-card project-card--active" data-landing-id="abs">
                    <i class="fas fa-chart-bar project-card-bg-icon" aria-hidden="true"></i>
                    <div class="project-card-body">
                        <div class="project-card-head">
                            <?php echo $realmBadgesHtml; ?>
                            <h2 class="project-card-title">
                                <i class="fas fa-chart-bar project-card-icon" aria-hidden="true"></i>
                                <span class="project-card-title-text">
                                    <?php echo $lang === 'en' ? 'ABS Replay Analysis' : 'Анализ АБС реплеев'; ?>
                                </span>
                            </h2>
                        </div>
                        <p class="project-card-desc">
                            <?php echo $lang === 'en'
                                ? 'Upload replays and review team statistics, WGSRT, and battle metrics.'
                                : 'Загрузка реплеев, статистика команды, WGSRT и метрики боёв.'; ?>
                        </p>
                    </div>
                    <div class="project-card-footer">
                        <span class="project-card-action">
                            <?php echo htmlspecialchars($openLabel, ENT_QUOTES, 'UTF-8'); ?>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </span>
                    </div>
                </a>

                <a href="<?php echo htmlspecialchars($recruitingServiceHref, ENT_QUOTES, 'UTF-8'); ?>" class="project-card project-card--active" data-landing-id="recruiting">
                    <i class="fas fa-users project-card-bg-icon" aria-hidden="true"></i>
                    <div class="project-card-body">
                        <div class="project-card-head">
                            <?php echo $realmBadgesHtml; ?>
                            <h2 class="project-card-title">
                                <i class="fas fa-users project-card-icon" aria-hidden="true"></i>
                                <span class="project-card-title-text">
                                    <?php echo $lang === 'en' ? 'Recruiting' : 'Рекрутинг'; ?>
                                </span>
                            </h2>
                        </div>
                        <p class="project-card-desc">
                            <?php echo $lang === 'en'
                                ? 'Search for teams, clans, and players for clan and team.'
                                : 'Поиск команды, клана, игроков в клан и команду.'; ?>
                        </p>
                    </div>
                    <div class="project-card-footer">
                        <span class="project-card-action">
                            <?php echo htmlspecialchars($openLabel, ENT_QUOTES, 'UTF-8'); ?>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </span>
                    </div>
                </a>

                <div class="project-card project-card--disabled project-card--span-2" aria-disabled="true" data-landing-id="clan-reserve">
                    <i class="fas fa-user-plus project-card-bg-icon" aria-hidden="true"></i>
                    <div class="project-card-body">
                        <div class="project-card-head">
                            <?php echo $inDevBadgeHtml; ?>
                            <h2 class="project-card-title">
                                <i class="fas fa-user-plus project-card-icon" aria-hidden="true"></i>
                                <span class="project-card-title-text">
                                    <?php echo $lang === 'en' ? 'Automatic Clan Reserve Activation' : 'Автоматическое включение клановых резервов'; ?>
                                </span>
                            </h2>
                        </div>
                        <p class="project-card-desc">
                            <?php echo $lang === 'en'
                                ? 'Scheduled automatic activation of clan reserves.'
                                : 'Автоматическое включение клановых резервов по расписанию.'; ?>
                        </p>
                    </div>
                    <div class="project-card-footer">
                        <span class="project-card-action project-card-action--placeholder" aria-hidden="true">
                            <?php echo htmlspecialchars($openLabel, ENT_QUOTES, 'UTF-8'); ?>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </span>
                    </div>
                </div>

                <div class="project-card project-card--active project-card--span-2" data-landing-id="bracket">
                    <i class="fas fa-sitemap project-card-bg-icon" aria-hidden="true"></i>
                    <div class="project-card-body">
                        <div class="project-card-head">
                            <?php echo $bracketBadgesHtml; ?>
                            <h2 class="project-card-title">
                                <i class="fas fa-sitemap project-card-icon" aria-hidden="true"></i>
                                <span class="project-card-title-text">
                                    <?php echo $lang === 'en' ? 'Tournament Bracket Generator' : 'Генератор турнирных сеток'; ?>
                                </span>
                            </h2>
                        </div>
                        <p class="project-card-desc">
                            <?php echo $lang === 'en'
                                ? 'Create and edit tournament brackets for clan and team events.'
                                : 'Создание и редактирование турнирных сеток для клановых и командных ивентов.'; ?>
                        </p>
                    </div>
                    <div class="project-card-footer project-card-footer--actions">
                        <a href="<?php echo htmlspecialchars($bracketCreateHref, ENT_QUOTES, 'UTF-8'); ?>" class="project-card-action" data-landing-action="create">
                            <?php echo htmlspecialchars($bracketCreateLabel, ENT_QUOTES, 'UTF-8'); ?>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </a>
                        <a href="<?php echo htmlspecialchars($bracketPublicHref, ENT_QUOTES, 'UTF-8'); ?>" class="project-card-action" data-landing-action="public">
                            <?php echo htmlspecialchars($bracketPublicLabel, ENT_QUOTES, 'UTF-8'); ?>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </a>
                    </div>
                </div>

                <a href="<?php echo htmlspecialchars($wotmodsServiceHref, ENT_QUOTES, 'UTF-8'); ?>" class="project-card project-card--active" id="mod-install" data-landing-id="mod-install">
                    <i class="fas fa-puzzle-piece project-card-bg-icon" aria-hidden="true"></i>
                    <div class="project-card-body">
                        <div class="project-card-head">
                            <?php echo $wotmodsBadgesHtml; ?>
                            <h2 class="project-card-title">
                                <i class="fas fa-puzzle-piece project-card-icon" aria-hidden="true"></i>
                                <span class="project-card-title-text">
                                    <?php echo $lang === 'en' ? 'Mod Installation' : 'Установка модов'; ?>
                                </span>
                            </h2>
                        </div>
                        <p class="project-card-desc">
                            <?php echo $lang === 'en'
                                ? 'Step-by-step mod installation and setup for World of Tanks and Mir Tankov.'
                                : 'Пошаговая установка модов для World of Tanks или Мира танков.'; ?>
                        </p>
                    </div>
                    <div class="project-card-footer">
                        <span class="project-card-action">
                            <?php echo htmlspecialchars($openLabel, ENT_QUOTES, 'UTF-8'); ?>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </span>
                    </div>
                </a>

                <a href="<?php echo htmlspecialchars($aimServiceHref, ENT_QUOTES, 'UTF-8'); ?>" class="project-card project-card--active project-card--span-2" data-landing-id="aim-trainers">
                    <i class="fas fa-crosshairs project-card-bg-icon" aria-hidden="true"></i>
                    <div class="project-card-body">
                        <div class="project-card-head">
                            <?php echo $aimBadgesHtml; ?>
                            <h2 class="project-card-title">
                                <i class="fas fa-crosshairs project-card-icon" aria-hidden="true"></i>
                                <span class="project-card-title-text">
                                    <?php echo $lang === 'en' ? 'Aim Trainer Games' : 'Аим-тренажеры'; ?>
                                </span>
                            </h2>
                        </div>
                        <p class="project-card-desc">
                            <?php echo $lang === 'en'
                                ? 'Mini-games for aim and reaction training.'
                                : 'Мини-игры для тренировки прицеливания и реакции.'; ?>
                        </p>
                    </div>
                    <div class="project-card-footer">
                        <span class="project-card-action">
                            <?php echo htmlspecialchars($openLabel, ENT_QUOTES, 'UTF-8'); ?>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </span>
                    </div>
                </a>

                <a href="<?php echo htmlspecialchars($onlineServiceHref, ENT_QUOTES, 'UTF-8'); ?>" class="project-card project-card--active" data-landing-id="online">
                    <i class="fas fa-signal project-card-bg-icon" aria-hidden="true"></i>
                    <div class="project-card-body">
                        <div class="project-card-head">
                            <?php echo $onlineBadgesHtml; ?>
                            <h2 class="project-card-title">
                                <i class="fas fa-signal project-card-icon" aria-hidden="true"></i>
                                <span class="project-card-title-text">
                                    <?php echo $lang === 'en' ? 'Server Status' : 'Статус серверов'; ?>
                                </span>
                            </h2>
                        </div>
                        <p class="project-card-desc">
                            <?php echo $lang === 'en'
                                ? 'Server availability status, online counts, and charts.'
                                : 'Статус доступности серверов, онлайн и графики.'; ?>
                        </p>
                    </div>
                    <div class="project-card-footer">
                        <span class="project-card-action">
                            <?php echo htmlspecialchars($openLabel, ENT_QUOTES, 'UTF-8'); ?>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </span>
                    </div>
                </a>

                <a href="<?php echo htmlspecialchars($onlineGamesServiceHref, ENT_QUOTES, 'UTF-8'); ?>" class="project-card project-card--active project-card--span-2 project-card--online-games" id="online-games" data-landing-id="online-games">
                    <i class="fas fa-gamepad project-card-bg-icon" aria-hidden="true"></i>
                    <div class="project-card-body">
                        <div class="project-card-head">
                            <h2 class="project-card-title">
                                <i class="fas fa-gamepad project-card-icon" aria-hidden="true"></i>
                                <span class="project-card-title-text">
                                    <?php echo $lang === 'en' ? 'Online Games' : 'Онлайн игры'; ?>
                                </span>
                            </h2>
                        </div>
                        <p class="project-card-desc" data-landing-desc="online-games">
                            <?php echo $lang === 'en'
                                ? 'Play with friends in real time — board games and more.'
                                : 'Играйте с друзьями в реальном времени — настольные игры и не только.'; ?>
                        </p>
                    </div>
                    <div class="project-card-footer">
                        <span class="project-card-action">
                            <?php echo htmlspecialchars($openLabel, ENT_QUOTES, 'UTF-8'); ?>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </span>
                    </div>
                </a>

                <?php if ($launcherCardActive): ?>
                <a
                    class="project-card project-card--active project-card--launcher <?php echo htmlspecialchars($launcherCardTileClass, ENT_QUOTES, 'UTF-8'); ?>"
                    href="<?php echo htmlspecialchars($launcherCardDownloadUrl, ENT_QUOTES, 'UTF-8'); ?>"
                    download
                    data-landing-id="games-launcher"
                    data-desc-ru="<?php echo htmlspecialchars($launcherCardDescRu, ENT_QUOTES, 'UTF-8'); ?>"
                    data-desc-en="<?php echo htmlspecialchars($launcherCardDescEn, ENT_QUOTES, 'UTF-8'); ?>"
                    data-download-href="<?php echo htmlspecialchars($launcherCardDownloadUrl, ENT_QUOTES, 'UTF-8'); ?>"
                >
                <?php else: ?>
                <div
                    class="project-card project-card--disabled project-card--launcher <?php echo htmlspecialchars($launcherCardTileClass, ENT_QUOTES, 'UTF-8'); ?>"
                    aria-disabled="true"
                    data-landing-id="games-launcher"
                    data-desc-ru="<?php echo htmlspecialchars($launcherCardDescRu, ENT_QUOTES, 'UTF-8'); ?>"
                    data-desc-en="<?php echo htmlspecialchars($launcherCardDescEn, ENT_QUOTES, 'UTF-8'); ?>"
                >
                <?php endif; ?>
                    <i class="fas fa-rocket project-card-bg-icon" aria-hidden="true"></i>
                    <div class="project-card-body">
                        <div class="project-card-head">
                            <?php echo $launcherCardBadgesHtml; ?>
                            <h2 class="project-card-title">
                                <i class="fas fa-rocket project-card-icon" aria-hidden="true"></i>
                                <span class="project-card-title-text">
                                    Chadow Games Launcher
                                </span>
                            </h2>
                        </div>
                        <p class="project-card-desc">
                            <?php echo htmlspecialchars($launcherCardDesc, ENT_QUOTES, 'UTF-8'); ?>
                        </p>
                    </div>
                    <div class="project-card-footer">
                        <?php if ($launcherCardActive): ?>
                        <span class="project-card-action">
                            <?php echo htmlspecialchars($launcherDownloadLabel, ENT_QUOTES, 'UTF-8'); ?>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </span>
                        <?php else: ?>
                        <span class="project-card-action project-card-action--placeholder" aria-hidden="true">
                            <?php echo htmlspecialchars($openLabel, ENT_QUOTES, 'UTF-8'); ?>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </span>
                        <?php endif; ?>
                    </div>
                <?php echo $launcherCardActive ? '</a>' : '</div>'; ?>
            </div>
        </main>

<?php require __DIR__ . '/includes/site_footer.php'; ?>
</body>
</html>
