<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: public, max-age=15');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/lang.php';
require_once __DIR__ . '/../includes/online_service.php';
require_once __DIR__ . '/../includes/online_server_names.php';
require_once __DIR__ . '/../includes/perf_metrics.php';
chadow_perf_start('api_get_online');

$lang = abs_detect_lang();
$reqLang = $_GET['lang'] ?? '';
if (is_string($reqLang)) {
    $reqLang = strtolower(trim($reqLang));
    if ($reqLang === 'en' || $reqLang === 'ru') {
        $lang = $reqLang;
    }
}

$forceRequested = isset($_GET['refresh']) && ($_GET['refresh'] === '1' || $_GET['refresh'] === 'true');

try {
    $service = new OnlineService(Database::getInstance());
    $result = $service->getStatusFromCache();

    if (!$result['success'] && $forceRequested && php_sapi_name() === 'cli') {
        $result = $service->runScheduledRefresh(true);
    }
    if (!$result['success'] || !is_array($result['data'])) {
        http_response_code(502);
        echo json_encode([
            'success' => false,
            'error' => OnlineService::apiUnavailableMessage($lang),
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $rateLimit = $result['rate_limit'] ?? $service->getFetchRateState($service->getCachedRow());

    echo json_encode([
        'success' => true,
        'data' => $service->filterDataForEnabledRealms($result['data']),
        'charts' => $service->filterChartsForEnabledRealms(is_array($result['charts'] ?? null) ? $result['charts'] : []),
        'uptime' => $service->filterUptimeForEnabledRealms(is_array($result['uptime'] ?? null) ? $result['uptime'] : []),
        'realm_labels' => $service->enabledRealmLabels($lang),
        'server_names' => [
            'ru' => OnlineServerNames::exportMap('ru'),
            'en' => OnlineServerNames::exportMap('en'),
        ],
        'from_cache' => $result['from_cache'],
        'stale' => $result['stale'],
        'fetched_at' => $result['fetched_at'],
        'rate_limited' => !empty($result['rate_limited']),
        'rate_limit' => $rateLimit,
        'poll_interval_seconds' => OnlineService::CACHE_MIN_INTERVAL_SECONDS,
    ], JSON_UNESCAPED_UNICODE);
    chadow_perf_finish('api_get_online', [
        'from_cache' => !empty($result['from_cache']),
        'stale' => !empty($result['stale']),
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $lang === 'en' ? 'Server error' : 'Ошибка сервера',
    ], JSON_UNESCAPED_UNICODE);
}
