<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/../../includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/datetime.php';
require_once __DIR__ . '/../../includes/tanki_client.php';
require_once __DIR__ . '/../../includes/online_server_names.php';
require_once __DIR__ . '/../../includes/online_service.php';
require_once __DIR__ . '/../../includes/online_health.php';

$pageTitle = $lang === 'en' ? 'Server Status' : 'Статус серверов';
abs_set_page_titles('Статус серверов', 'Server Status');
$metaDescription = $lang === 'en'
    ? 'Live World of Tanks server status for Lesta and Wargaming: cluster availability, online players by region, and activity charts.'
    : 'Актуальный статус серверов World of Tanks Lesta и Wargaming: доступность кластеров, онлайн по регионам и графики активности.';
$bodyClass = 'page-online';
$seoSlug = 'services/online';
$extraHeadHtml = '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" defer></script>';

$service = new OnlineService(Database::getInstance());
$cachedRow = $service->getCachedRow();
$cachedResult = $service->getStatusFromCache();
if ($cachedResult['success'] && !$service->isCacheStale($cachedRow)) {
    $result = $cachedResult;
} else {
    $result = $service->getStatus(false);
}
$data = is_array($result['data'] ?? null) ? $result['data'] : ['summary' => [], 'clusters' => []];
$data = $service->filterDataForEnabledRealms($data) ?? ['summary' => [], 'clusters' => []];
$charts = is_array($result['charts'] ?? null) ? $result['charts'] : [];
$charts = $service->filterChartsForEnabledRealms($charts);
$uptime = is_array($result['uptime'] ?? null) ? $result['uptime'] : [];
$fetchedAt = $result['fetched_at'] ?? null;
$fetchedAtDisplay = abs_format_utc_local($fetchedAt);
$hasData = !empty($data['summary']) || !empty($data['clusters']);
$emptyMessage = OnlineService::apiUnavailableMessage($lang);

function online_fmt_num($value): string
{
    if ($value === null || $value === '') {
        return '—';
    }
    return number_format((int) $value, 0, '.', ' ');
}

function online_status_class(string $majority, string $status): string
{
    if ($status === 'offline') {
        return 'is-offline';
    }
    if ($majority === 'major') {
        return 'is-major';
    }
    if ($majority === 'minor') {
        return 'is-minor';
    }
    return 'is-good';
}

function online_status_label(string $majority, string $status, string $lang): string
{
    if ($status === 'offline') {
        return $lang === 'en' ? 'Offline' : 'Офлайн';
    }
    if ($majority === 'major') {
        return $lang === 'en' ? 'Issues' : 'Проблемы';
    }
    if ($majority === 'minor') {
        return $lang === 'en' ? 'Unstable' : 'Нестабильно';
    }
    return $lang === 'en' ? 'Online' : 'Онлайн';
}

function online_recommendation_label(string $value, string $lang): string
{
    $map = [
        'recommended' => $lang === 'en' ? 'Recommended' : 'Рекомендуется',
        'available' => $lang === 'en' ? 'Available' : 'Доступен',
        'not_available' => $lang === 'en' ? 'Unavailable' : 'Недоступен',
        'not_recommended' => $lang === 'en' ? 'Not recommended' : 'Не рекомендуется',
    ];
    return $map[$value] ?? ($value !== '' ? $value : '—');
}

function online_health_class(string $health): string
{
    switch ($health) {
        case 'down':
            return 'is-offline';
        case 'issue':
            return 'is-major';
        case 'dip':
            return 'is-minor';
        default:
            return 'is-good';
    }
}

function online_render_uptime_bar(array $buckets, string $health = 'good'): string
{
    $buckets = OnlineHealth::fillTimelineBuckets($buckets, $health);

    $lastIndex = count($buckets) - 1;
    $segments = '';
    foreach ($buckets as $index => $bucket) {
        if (!is_array($bucket) || count($bucket) < 2) {
            continue;
        }
        $state = htmlspecialchars((string) $bucket[1], ENT_QUOTES, 'UTF-8');
        $latestClass = $index === $lastIndex ? ' is-latest' : '';
        $segments .= '<span class="online-uptime-seg is-' . $state . $latestClass . '"></span>';
    }

    return '<div class="online-uptime-wrap"><div class="online-uptime-bar">' . $segments . '</div><span class="online-uptime-label">24h</span></div>';
}

$realmLabels = $service->enabledRealmLabels($lang);
$summaryTotal = 0;
foreach ($data['summary'] ?? [] as $summaryItem) {
    if (is_array($summaryItem)) {
        $summaryTotal += (int) ($summaryItem['online'] ?? 0);
    }
}
$summaryAllLabel = 'WoT All';

require __DIR__ . '/../../includes/site_header.php';
?>

        <main class="online-service">
            <header class="online-header">
                <div class="online-header-actions">
                    <p class="online-cache-note" id="onlineCacheNote">
                        <?php if ($fetchedAt): ?>
                            <?php echo $lang === 'en' ? 'Data updated:' : 'Данные обновлены:'; ?>
                            <time datetime="<?php echo htmlspecialchars((string) $fetchedAt, ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars((string) $fetchedAtDisplay, ENT_QUOTES, 'UTF-8'); ?></time>
                        <?php endif; ?>
                    </p>
                </div>
            </header>

            <?php if (!$hasData): ?>
                <section class="online-empty" id="onlineEmpty">
                    <p><?php echo htmlspecialchars($emptyMessage, ENT_QUOTES, 'UTF-8'); ?></p>
                </section>
            <?php else: ?>

            <div class="online-dashboard">
                <div class="online-stats-column">
                    <section class="online-panel online-clusters-section">
                        <h3 class="online-section-title" data-label-ru="Кластеры серверов WoT" data-label-en="Server clusters WoT"><?php echo $lang === 'en' ? 'Server clusters WoT' : 'Кластеры серверов WoT'; ?></h3>
                        <div class="online-clusters" id="onlineClusters">
                    <?php foreach (($data['clusters'] ?? []) as $cluster): ?>
                        <?php
                        $clusterRealm = (string) ($cluster['flag'] ?? '');
                        $clusterKey = $clusterRealm !== ''
                            ? TankiClient::onlineClusterTitle($clusterRealm, $lang)
                            : (string) ($cluster['title'] ?? '');
                        ?>
                        <article class="online-cluster-card is-collapsed" data-cluster-key="<?php echo htmlspecialchars($clusterKey, ENT_QUOTES, 'UTF-8'); ?>" data-cluster-realm="<?php echo htmlspecialchars($clusterRealm, ENT_QUOTES, 'UTF-8'); ?>">
                            <header class="online-cluster-head">
                                <button
                                    type="button"
                                    class="online-cluster-toggle"
                                    aria-expanded="false"
                                    aria-controls="online-cluster-body-<?php echo htmlspecialchars(md5($clusterKey), ENT_QUOTES, 'UTF-8'); ?>"
                                >
                                    <i class="fas fa-chevron-down online-cluster-chevron" aria-hidden="true"></i>
                                    <span class="online-cluster-title"><?php echo htmlspecialchars($clusterKey, ENT_QUOTES, 'UTF-8'); ?></span>
                                </button>
                                <div class="online-cluster-meta">
                                    <?php if (!empty($cluster['online'])): ?>
                                        <span class="online-cluster-online">
                                            <span class="online-cluster-online-value"><?php echo online_fmt_num($cluster['online']); ?></span>
                                            <span class="online-cluster-online-label"><?php echo $lang === 'en' ? 'online' : 'онлайн'; ?></span>
                                        </span>
                                    <?php endif; ?>
                                </div>
                            </header>
                            <?php if (!empty($cluster['servers']) && is_array($cluster['servers'])): ?>
                                <div class="online-cluster-body" id="online-cluster-body-<?php echo htmlspecialchars(md5($clusterKey), ENT_QUOTES, 'UTF-8'); ?>">
                                    <div class="online-cluster-api">
                                        <span class="online-cluster-api-label"><?php echo $lang === 'en' ? 'API' : 'API'; ?></span>
                                        <?php
                                        $apiBuckets = is_array($uptime[$clusterRealm]['_api'] ?? null) ? $uptime[$clusterRealm]['_api'] : [];
                                        $apiHealth = 'good';
                                        if ($apiBuckets !== []) {
                                            $apiLast = $apiBuckets[count($apiBuckets) - 1];
                                            $apiHealth = is_array($apiLast) ? (string) ($apiLast[1] ?? 'good') : 'good';
                                        }
                                        echo online_render_uptime_bar($apiBuckets, $apiHealth);
                                        ?>
                                    </div>
                                    <div class="online-server-list">
                                        <?php foreach ($cluster['servers'] as $server): ?>
                                            <?php
                                            $serverCode = (string) ($server['code'] ?? $server['name'] ?? '');
                                            $canonicalCode = OnlineServerNames::canonicalId($clusterRealm, $serverCode);
                                            $health = (string) ($server['health'] ?? 'good');
                                            $healthClass = online_health_class($health);
                                            $serverLabel = OnlineServerNames::label($clusterRealm, $serverCode, $lang);
                                            $serverBuckets = is_array($uptime[$clusterRealm][$canonicalCode] ?? null)
                                                ? $uptime[$clusterRealm][$canonicalCode]
                                                : [];
                                            ?>
                                            <article class="online-server-card">
                                                <div class="online-server-head">
                                                    <span class="online-server-dot <?php echo htmlspecialchars($healthClass, ENT_QUOTES, 'UTF-8'); ?>" aria-hidden="true"></span>
                                                    <div class="online-server-title">
                                                        <span class="online-server-name"><?php echo htmlspecialchars($serverLabel, ENT_QUOTES, 'UTF-8'); ?></span>
                                                        <span class="online-server-online">(<?php echo $lang === 'en' ? 'Online' : 'Онлайн'; ?>: <?php echo online_fmt_num($server['online'] ?? null); ?>)</span>
                                                    </div>
                                                    <span class="online-server-rec <?php echo htmlspecialchars($healthClass, ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars(online_recommendation_label((string) ($server['recommendation'] ?? ''), $lang), ENT_QUOTES, 'UTF-8'); ?></span>
                                                </div>
                                                <?php echo online_render_uptime_bar($serverBuckets, (string) ($server['health'] ?? 'good')); ?>
                                            </article>
                                        <?php endforeach; ?>
                                    </div>
                                </div>
                            <?php endif; ?>
                        </article>
                    <?php endforeach; ?>
                        <script>
                        (function () {
                            var storageKey = 'abs_online_cluster_state';
                            var defaultOpen = { 'МТ RUBY': 1 };
                            var state = {};
                            try {
                                state = JSON.parse(sessionStorage.getItem(storageKey) || '{}') || {};
                            } catch (e) {
                                state = {};
                            }
                            function isOpen(key) {
                                if (Object.prototype.hasOwnProperty.call(state, key)) {
                                    return state[key] === 'open';
                                }
                                return !!defaultOpen[key];
                            }
                            var root = document.getElementById('onlineClusters');
                            if (!root) return;
                            root.querySelectorAll('.online-cluster-card').forEach(function (card) {
                                var key = card.getAttribute('data-cluster-key') || '';
                                var open = isOpen(key);
                                card.classList.toggle('is-collapsed', !open);
                                var toggle = card.querySelector('.online-cluster-toggle');
                                if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
                            });
                        })();
                        </script>
                        </div>
                    </section>
                </div>

                <aside class="online-charts-column">
                    <section class="online-panel online-summary-panel">
                        <h3 class="online-section-title" data-label-ru="Сейчас в сети" data-label-en="Online now"><?php echo $lang === 'en' ? 'Online now' : 'Сейчас в сети'; ?></h3>
                        <div class="online-summary-grid" id="onlineSummaryGrid">
                            <article class="online-summary-card">
                                <span class="online-summary-label"><?php echo htmlspecialchars($summaryAllLabel, ENT_QUOTES, 'UTF-8'); ?></span>
                                <span class="online-summary-value"><?php echo online_fmt_num($summaryTotal); ?></span>
                            </article>
                            <?php foreach (($data['summary'] ?? []) as $item): ?>
                                <?php
                                $summaryRealm = (string) ($item['flag'] ?? '');
                                $summaryLabel = ($summaryRealm !== '' && isset($realmLabels[$summaryRealm]))
                                    ? $realmLabels[$summaryRealm]
                                    : (string) ($item['title'] ?? '');
                                ?>
                                <article class="online-summary-card">
                                    <span class="online-summary-label"><?php echo htmlspecialchars($summaryLabel, ENT_QUOTES, 'UTF-8'); ?></span>
                                    <span class="online-summary-value"><?php echo online_fmt_num($item['online'] ?? null); ?></span>
                                </article>
                            <?php endforeach; ?>
                        </div>
                    </section>

                    <section class="online-panel online-charts-section">
                        <div class="online-charts-head">
                            <h3 class="online-section-title" data-label-ru="Графики онлайна" data-label-en="Online charts"><?php echo $lang === 'en' ? 'Online charts' : 'Графики онлайна'; ?></h3>
                            <div class="online-chart-range" id="onlineChartRange" role="group" aria-label="<?php echo $lang === 'en' ? 'Chart range' : 'Диапазон графика'; ?>">
                                <button type="button" class="online-chart-range-btn" data-range-days="30" data-label-ru="30 дн." data-label-en="30 days"><?php echo $lang === 'en' ? '30 days' : '30 дн.'; ?></button>
                                <button type="button" class="online-chart-range-btn is-active" data-range-days="7" data-label-ru="7 дн." data-label-en="7 days"><?php echo $lang === 'en' ? '7 days' : '7 дн.'; ?></button>
                                <button type="button" class="online-chart-range-btn" data-range-days="1" data-label-ru="1 день" data-label-en="1 day"><?php echo $lang === 'en' ? '1 day' : '1 день'; ?></button>
                            </div>
                        </div>
                        <div class="online-charts-grid" id="onlineChartsGrid">
                            <?php foreach ($realmLabels as $realm => $label): ?>
                                <article class="online-chart-card">
                                    <h4 class="online-chart-title"><?php echo htmlspecialchars($label, ENT_QUOTES, 'UTF-8'); ?></h4>
                                    <div class="online-chart-wrap">
                                        <canvas id="onlineChart-<?php echo htmlspecialchars($realm, ENT_QUOTES, 'UTF-8'); ?>" aria-label="<?php echo htmlspecialchars($label, ENT_QUOTES, 'UTF-8'); ?>"></canvas>
                                    </div>
                                </article>
                            <?php endforeach; ?>
                        </div>
                    </section>
                </aside>
            </div>

            <?php endif; ?>
        </main>

<?php require __DIR__ . '/../../includes/site_footer.php'; ?>

    <script>
        window.ABS_ONLINE_LANG = <?php echo json_encode($lang); ?>;
        window.ABS_ONLINE_EMPTY_MESSAGE = <?php echo json_encode($emptyMessage, JSON_UNESCAPED_UNICODE); ?>;
        window.ABS_ONLINE_DATA = <?php echo json_encode($data, JSON_UNESCAPED_UNICODE); ?>;
        window.ABS_ONLINE_CHARTS = <?php echo json_encode($charts, JSON_UNESCAPED_UNICODE); ?>;
        window.ABS_ONLINE_REALM_LABELS = <?php echo json_encode($realmLabels, JSON_UNESCAPED_UNICODE); ?>;
        window.ABS_ONLINE_SERVER_NAMES = <?php echo json_encode([
            'ru' => OnlineServerNames::exportMap('ru'),
            'en' => OnlineServerNames::exportMap('en'),
        ], JSON_UNESCAPED_UNICODE); ?>;
        window.ABS_ONLINE_UPTIME = <?php echo json_encode($uptime, JSON_UNESCAPED_UNICODE); ?>;
    </script>
    <script src="/js/services/online/index.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
</body>
</html>
