<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

$metaDescription = $lang === 'en'
    ? 'Chadow project hub: ABS replay analysis, server status, recruiting tools, tournament brackets, and more for World of Tanks.'
    : 'Портал Chadow: анализ АБС реплеев, статус серверов, рекрутинг, турнирные сетки и другие сервисы для World of Tanks.';
$bodyClass = 'page-landing';

$absServiceHref = $lang === 'en' ? '/en/services/abs' : '/services/abs';
$onlineServiceHref = $lang === 'en' ? '/en/services/online/' : '/services/online/';
$recruitingServiceHref = $lang === 'en' ? '/en/services/recruiting' : '/services/recruiting';
$bracketServiceHref = $lang === 'en' ? '/en/services/bracket' : '/services/bracket';
$bracketCreateHref = $lang === 'en' ? '/en/services/bracket/create' : '/services/bracket/create';
$bracketPublicHref = $bracketServiceHref;
$bracketCreateLabel = $lang === 'en' ? 'Create bracket' : 'Создать сетку';
$bracketPublicLabel = $lang === 'en' ? 'Public brackets' : 'Публичные сетки';
$tacticsServiceHref = $lang === 'en' ? '/en/services/tactics' : '/services/tactics';
$tacticsCreateHref = $tacticsServiceHref . '#tactics-create';
$tacticsRoomsHref = $lang === 'en' ? '/en/services/tactics/rooms' : '/services/tactics/rooms';
$tacticsCreateLabel = $lang === 'en' ? 'Create board' : 'Создать планшет';
$tacticsRoomsLabel = $lang === 'en' ? 'Open rooms' : 'Открытые комнаты';
$aimServiceHref = $lang === 'en' ? '/en/services/aim' : '/services/aim';
$inDevLabel = $lang === 'en' ? 'In development' : 'в разработке';
$openLabel = $lang === 'en' ? 'Open' : 'Открыть';
require_once __DIR__ . '/includes/game_api.php';
$lestaApiConfigured = game_api_is_configured_for_realm('ru');
$realmBadgesHtml = '<div class="project-card-badge-row">'
    . '<span class="project-card-badge project-card-badge--wg">WG</span>'
    . '<span class="project-card-badge project-card-badge--lesta">LESTA</span>'
    . '</div>';
$onlineBadgesHtml = '<div class="project-card-badge-row">'
    . '<span class="project-card-badge project-card-badge--wg">WG</span>'
    . ($lestaApiConfigured ? '<span class="project-card-badge project-card-badge--lesta">LESTA</span>' : '')
    . '</div>';
$inDevBadgeHtml = '<div class="project-card-badge-row">'
    . '<span class="project-card-badge">' . htmlspecialchars($inDevLabel, ENT_QUOTES, 'UTF-8') . '</span>'
    . '</div>';
$bracketBadgesHtml = '<div class="project-card-badge-row">'
    . '<span class="project-card-badge project-card-badge--wg">WG</span>'
    . '<span class="project-card-badge project-card-badge--lesta">LESTA</span>'
    . '<span class="project-card-badge project-card-badge--cs2">CS2</span>'
    . '<span class="project-card-badge project-card-badge--dota2">Dota 2</span>'
    . '</div>';
$tacticsBadgesHtml = '<div class="project-card-badge-row">'
    . '<span class="project-card-badge project-card-badge--wg">WG</span>'
    . '<span class="project-card-badge project-card-badge--lesta">LESTA</span>'
    . '<span class="project-card-badge project-card-badge--cs2">CS2</span>'
    . '<span class="project-card-badge project-card-badge--dota2">Dota 2</span>'
    . '</div>';
$aimBadgesHtml = '<div class="project-card-badge-row">'
    . '<span class="project-card-badge project-card-badge--wg">WG</span>'
    . '<span class="project-card-badge project-card-badge--lesta">LESTA</span>'
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

                <div class="project-card project-card--disabled" aria-disabled="true" data-landing-id="mod-install">
                    <i class="fas fa-puzzle-piece project-card-bg-icon" aria-hidden="true"></i>
                    <div class="project-card-body">
                        <div class="project-card-head">
                            <?php echo $inDevBadgeHtml; ?>
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
                                : 'Пошаговая установка и настройка модов для World of Tanks и Мира танков.'; ?>
                        </p>
                    </div>
                    <div class="project-card-footer">
                        <span class="project-card-action project-card-action--placeholder" aria-hidden="true">
                            <?php echo htmlspecialchars($openLabel, ENT_QUOTES, 'UTF-8'); ?>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </span>
                    </div>
                </div>

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
            </div>
        </main>

<?php require __DIR__ . '/includes/site_footer.php'; ?>
</body>
</html>
