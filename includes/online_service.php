<?php

require_once __DIR__ . '/../config/ensure_online_cache.php';
require_once __DIR__ . '/game_api.php';
require_once __DIR__ . '/tanki_client.php';
require_once __DIR__ . '/online_server_names.php';
require_once __DIR__ . '/online_health.php';

class OnlineService
{
    public const CACHE_WINDOW_SECONDS = 60;
    public const CACHE_MIN_INTERVAL_SECONDS = 30;
    public const BACKGROUND_REFRESH_INTERVAL_SECONDS = 30;
    public const CACHE_MAX_FETCHES_PER_WINDOW = 5;
    public const CACHE_ROW_ID = 1;
    public const CHART_MAX_POINTS = 2000;
    public const CHART_RETENTION_SECONDS = 30 * 24 * 3600;
    public const CHART_STORAGE_BUCKET_SECONDS = 60;
    public const ERROR_API_UNAVAILABLE = 'api_unavailable';
    public const SOURCE_WGN_API = 'wgn_api';

    private $db;

    public function __construct($db)
    {
        $this->db = $db;
        ensure_wot_online_cache_table($db);
    }

    public static function apiUnavailableMessage(string $lang): string
    {
        return $lang === 'en' ? 'API unavailable' : 'API недоступен';
    }

    /**
     * @return array<string, string>
     */
    public static function realmDisplayLabels(string $lang = 'ru'): array
    {
        $isEn = $lang === 'en';

        return [
            'ru' => $isEn ? 'MT RUBY (RU)' : 'МТ RUBY (RU)',
            'eu' => 'WoT EU',
            'na' => 'WoT NA',
            'asia' => 'WoT ASIA',
        ];
    }

    /**
     * @return list<string>
     */
    public function enabledRealms(): array
    {
        $realms = [];
        foreach (TankiClient::supportedRealms() as $realm) {
            if (game_api_is_configured_for_realm($realm, $this->db)) {
                $realms[] = $realm;
            }
        }

        return $realms;
    }

    /**
     * @return array<string, string>
     */
    public function enabledRealmLabels(string $lang = 'ru'): array
    {
        $labels = self::realmDisplayLabels($lang);
        $enabled = [];
        foreach ($this->enabledRealms() as $realm) {
            if (isset($labels[$realm])) {
                $enabled[$realm] = $labels[$realm];
            }
        }

        return $enabled;
    }

    /**
     * @param array<string, mixed>|null $data
     * @return array<string, mixed>|null
     */
    public function filterDataForEnabledRealms(?array $data): ?array
    {
        if (!is_array($data)) {
            return $data;
        }

        $enabled = array_flip($this->enabledRealms());
        $summary = is_array($data['summary'] ?? null) ? $data['summary'] : [];
        $clusters = is_array($data['clusters'] ?? null) ? $data['clusters'] : [];

        if ($enabled === []) {
            return [
                'source' => $data['source'] ?? self::SOURCE_WGN_API,
                'summary' => [],
                'clusters' => [],
            ];
        }

        return [
            'source' => $data['source'] ?? self::SOURCE_WGN_API,
            'summary' => array_values(array_filter(
                $summary,
                static fn($item) => is_array($item) && isset($enabled[(string) ($item['flag'] ?? '')])
            )),
            'clusters' => array_values(array_filter(
                $clusters,
                static fn($item) => is_array($item) && isset($enabled[(string) ($item['flag'] ?? '')])
            )),
        ];
    }

    /**
     * @param array<string, mixed> $charts
     * @return array<string, mixed>
     */
    public function filterChartsForEnabledRealms(array $charts): array
    {
        $enabled = array_flip($this->enabledRealms());
        $filtered = [];
        foreach ($charts as $realm => $chart) {
            if (isset($enabled[$realm])) {
                $filtered[$realm] = $chart;
            }
        }

        return $filtered;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getCachedRow(): ?array
    {
        try {
            $row = $this->db->fetchOne('SELECT * FROM wot_online_cache WHERE id = ?', [self::CACHE_ROW_ID]);
            return is_array($row) ? $row : null;
        } catch (Throwable $e) {
            return null;
        }
    }

    /**
     * @return array{allowed:bool,remaining:int,wait_seconds:int,fetches_in_window:int}
     */
    public function getFetchRateState(?array $row): array
    {
        $now = time();
        $log = $this->pruneFetchLog($this->decodeFetchLog($row['fetch_log_json'] ?? null), $now);
        $remaining = max(0, self::CACHE_MAX_FETCHES_PER_WINDOW - count($log));
        $allowed = $remaining > 0;
        $waitSeconds = 0;

        if ($allowed) {
            $lastFetchTs = $log !== [] ? max($log) : 0;
            if ($lastFetchTs <= 0 && $row && !empty($row['fetched_at'])) {
                $lastFetchTs = strtotime((string) $row['fetched_at'] . ' UTC') ?: 0;
            }
            if ($lastFetchTs > 0) {
                $elapsed = $now - $lastFetchTs;
                if ($elapsed < self::CACHE_MIN_INTERVAL_SECONDS) {
                    $allowed = false;
                    $waitSeconds = self::CACHE_MIN_INTERVAL_SECONDS - $elapsed;
                }
            }
        }

        if (!$allowed && $remaining === 0 && $log !== []) {
            $oldest = min($log);
            $waitSeconds = max($waitSeconds, self::CACHE_WINDOW_SECONDS - ($now - $oldest));
        }

        return [
            'allowed' => $allowed,
            'remaining' => $remaining,
            'wait_seconds' => max(0, $waitSeconds),
            'fetches_in_window' => count($log),
        ];
    }

    /**
     * Быстрая отдача из кэша без запроса к API (для SSR).
     *
     * @return array{success:bool,data:?array,charts:?array,from_cache:bool,stale:bool,fetched_at:?string,fetch_status:string,error:?string,rate_limit:array,rate_limited:bool}
     */
    public function getStatusFromCache(): array
    {
        $row = $this->getCachedRow();
        if ($this->isValidCacheRow($row)) {
            return $this->returnCachedRow($row, true);
        }

        $rate = $this->getFetchRateState($row);

        return [
            'success' => false,
            'data' => null,
            'charts' => null,
            'from_cache' => false,
            'stale' => false,
            'fetched_at' => null,
            'fetch_status' => (string) ($row['fetch_status'] ?? 'pending'),
            'error' => self::ERROR_API_UNAVAILABLE,
            'rate_limit' => $rate,
            'rate_limited' => !$rate['allowed'],
        ];
    }

    /**
     * @param array<string, mixed>|null $row
     */
    public function isCacheStale(?array $row): bool
    {
        if (!$this->isValidCacheRow($row)) {
            return true;
        }

        $fetchedAt = (string) ($row['fetched_at'] ?? '');
        if ($fetchedAt === '') {
            return true;
        }

        $fetchedTs = strtotime($fetchedAt . ' UTC');
        if ($fetchedTs === false) {
            return true;
        }

        return (time() - $fetchedTs) >= self::CACHE_MIN_INTERVAL_SECONDS;
    }

    /**
     * Фоновое обновление по расписанию (systemd --loop / cron): не чаще BACKGROUND_REFRESH_INTERVAL_SECONDS.
     *
     * @return array{success:bool,data:?array,charts:?array,from_cache:bool,stale:bool,fetched_at:?string,fetch_status:string,error:?string,rate_limit:array,rate_limited:bool,skipped?:bool}
     */
    public function runScheduledRefresh(bool $force = false): array
    {
        $row = $this->getCachedRow();
        if (!$force && !$this->isBackgroundRefreshDue($row)) {
            if ($this->isValidCacheRow($row)) {
                $cached = $this->returnCachedRow($row, false);
                $cached['skipped'] = true;

                return $cached;
            }
        }

        $result = $this->getStatus(true);
        $result['skipped'] = false;

        return $result;
    }

    /**
     * @param array<string, mixed>|null $row
     */
    public function isBackgroundRefreshDue(?array $row): bool
    {
        if (!$row || ($row['fetch_status'] ?? '') !== 'ok') {
            return true;
        }

        $fetchedAt = (string) ($row['fetched_at'] ?? '');
        if ($fetchedAt === '') {
            return true;
        }

        $fetchedTs = strtotime($fetchedAt . ' UTC');
        if ($fetchedTs === false) {
            return true;
        }

        return (time() - $fetchedTs) >= self::BACKGROUND_REFRESH_INTERVAL_SECONDS;
    }

    /**
     * @return array{success:bool,data:?array,charts:?array,from_cache:bool,stale:bool,fetched_at:?string,fetch_status:string,error:?string,rate_limit:array,rate_limited:bool}
     */
    public function getStatus(bool $forceRefresh = false): array
    {
        $row = $this->getCachedRow();
        $rate = $this->getFetchRateState($row);
        $needsInitial = !$row || ($row['fetch_status'] ?? '') !== 'ok';
        $needsStaleRefresh = $this->isCacheStale($row);
        $shouldFetch = ($needsInitial || $forceRefresh || $needsStaleRefresh) && $rate['allowed'];

        if ($shouldFetch) {
            $fetched = $this->fetchAndStore();
            if ($fetched['success']) {
                return $fetched;
            }
            if ($this->isValidCacheRow($row)) {
                return $this->returnCachedRow($row, true);
            }
            return $fetched;
        }

        if ($this->isValidCacheRow($row)) {
            return $this->returnCachedRow($row, false);
        }

        return $this->fetchAndStore();
    }

    /**
     * @return array{success:bool,data:?array,charts:?array,from_cache:bool,stale:bool,fetched_at:?string,fetch_status:string,error:?string,rate_limit:array,rate_limited:bool}
     */
    private function returnCachedRow(array $row, bool $stale): array
    {
        $rate = $this->getFetchRateState($row);
        $uptime = $this->filterUptimeForEnabledRealms($this->decodeJsonField($row['uptime_json'] ?? null) ?? []);
        $rawData = $this->decodeJsonField($row['data_json'] ?? null);
        if (!is_array($rawData)) {
            $rawData = ['summary' => [], 'clusters' => []];
        }
        $data = $this->filterDataForEnabledRealms(OnlineHealth::enrichData($rawData, $uptime));
        $charts = $this->filterChartsForEnabledRealms($this->filterChartsForSummary(
            $this->sanitizeCharts($this->decodeJsonField($row['charts_json'] ?? null) ?? []),
            is_array($data) ? ($data['summary'] ?? []) : []
        ));

        return [
            'success' => true,
            'data' => $data,
            'charts' => $charts,
            'uptime' => OnlineHealth::exportTimeline($uptime),
            'from_cache' => true,
            'stale' => $stale,
            'fetched_at' => $row['fetched_at'] ?? null,
            'fetch_status' => (string) ($row['fetch_status'] ?? 'ok'),
            'error' => null,
            'rate_limit' => $rate,
            'rate_limited' => !$rate['allowed'],
        ];
    }

    /**
     * @param array<string, mixed>|null $row
     */
    private function isValidCacheRow(?array $row): bool
    {
        if (!$row || ($row['fetch_status'] ?? '') !== 'ok') {
            return false;
        }

        $data = $this->decodeJsonField($row['data_json'] ?? null);
        if (!is_array($data)) {
            return false;
        }

        if (($data['source'] ?? '') !== self::SOURCE_WGN_API) {
            return false;
        }

        return !empty($data['summary']) || !empty($data['clusters']);
    }

    /**
     * @param array<string, mixed> $charts
     * @return array<string, mixed>
     */
    private function sanitizeCharts(array $charts): array
    {
        $sanitized = [];
        foreach ($charts as $realm => $chart) {
            if (!is_string($realm) || !is_array($chart)) {
                continue;
            }
            $series = self::normalizeChartSeries($chart['series'] ?? []);
            if ($series === []) {
                continue;
            }
            $sanitized[$realm] = [
                'id' => (string) ($chart['id'] ?? 'history'),
                'series' => $series,
            ];
        }

        return $sanitized;
    }

    /**
     * @param array<string, mixed> $charts
     * @param array<int, array<string, mixed>> $summary
     * @return array<string, mixed>
     */
    private function filterChartsForSummary(array $charts, array $summary): array
    {
        $summaryRealms = [];
        foreach ($summary as $item) {
            if (!is_array($item)) {
                continue;
            }
            $realm = (string) ($item['flag'] ?? '');
            if ($realm !== '') {
                $summaryRealms[$realm] = true;
            }
        }

        $enabled = array_flip($this->enabledRealms());
        $filtered = [];
        foreach ($charts as $realm => $chart) {
            if (!isset($enabled[$realm]) || !is_array($chart)) {
                continue;
            }
            if (isset($summaryRealms[$realm]) || !empty($chart['series'])) {
                $filtered[$realm] = $chart;
            }
        }

        return $filtered;
    }

    /**
     * @return array<int, int>
     */
    private function decodeFetchLog($value): array
    {
        if ($value === null || $value === '') {
            return [];
        }
        $decoded = is_array($value) ? $value : json_decode((string) $value, true);
        if (!is_array($decoded)) {
            return [];
        }
        $log = [];
        foreach ($decoded as $ts) {
            $ts = (int) $ts;
            if ($ts > 0) {
                $log[] = $ts;
            }
        }
        return $log;
    }

    /**
     * @param array<int, int> $log
     * @return array<int, int>
     */
    private function pruneFetchLog(array $log, ?int $now = null): array
    {
        $now = $now ?? time();
        $cutoff = $now - self::CACHE_WINDOW_SECONDS;
        $log = array_values(array_filter($log, static function (int $ts) use ($cutoff): bool {
            return $ts >= $cutoff;
        }));
        sort($log);
        return $log;
    }

    /**
     * @return array{success:bool,data:?array,charts:?array,from_cache:bool,stale:bool,fetched_at:?string,fetch_status:string,error:?string,rate_limit:array,rate_limited:bool}
     */
    private function fetchAndStore(): array
    {
        $existing = $this->getCachedRow();
        $rate = $this->getFetchRateState($existing);
        if (!$rate['allowed']) {
            if ($this->isValidCacheRow($existing)) {
                $cached = $this->returnCachedRow($existing, false);
                $cached['rate_limited'] = true;
                return $cached;
            }
        }

        $fetched = $this->fetchFromApis();
        if (!$fetched['ok'] || !is_array($fetched['data'])) {
            return [
                'success' => false,
                'data' => null,
                'charts' => null,
                'from_cache' => false,
                'stale' => false,
                'fetched_at' => null,
                'fetch_status' => 'error',
                'error' => self::ERROR_API_UNAVAILABLE,
                'rate_limit' => $rate,
                'rate_limited' => false,
            ];
        }

        $existingCharts = $this->decodeJsonField($existing['charts_json'] ?? null) ?? [];
        $existingData = $this->decodeJsonField($existing['data_json'] ?? null);
        if (!is_array($existingData) || ($existingData['source'] ?? '') !== self::SOURCE_WGN_API) {
            $existingCharts = [];
            $existingData = null;
        }

        $freshData = $fetched['data'];
        $mergedData = $this->mergeDataWithExisting($freshData, $existingData);
        $freshRealms = $this->realmFlagsFromSummary($freshData['summary'] ?? []);
        $existingUptime = $this->decodeJsonField($existing['uptime_json'] ?? null) ?? [];
        $uptime = OnlineHealth::appendSample($existingUptime, $mergedData, $freshRealms);
        $mergedData = OnlineHealth::enrichData($mergedData, $uptime);
        $charts = $this->filterChartsForSummary(
            $this->appendChartHistory(
                $existingCharts,
                $mergedData['summary'] ?? [],
                $mergedData['clusters'] ?? []
            ),
            $mergedData['summary'] ?? []
        );
        $fetchedAt = gmdate('Y-m-d H:i:s');

        $fetchLog = $this->pruneFetchLog($this->decodeFetchLog($existing['fetch_log_json'] ?? null));
        $fetchLog[] = time();

        $this->upsertCache([
            'data_json' => $mergedData,
            'charts_json' => $charts,
            'uptime_json' => $uptime,
            'fetched_at' => $fetchedAt,
            'fetch_status' => 'ok',
            'fetch_error' => null,
            'fetch_log_json' => $fetchLog,
        ]);

        $row = $this->getCachedRow();
        $rate = $this->getFetchRateState($row);
        $filteredUptime = $this->filterUptimeForEnabledRealms($uptime);

        return [
            'success' => true,
            'data' => $this->filterDataForEnabledRealms($mergedData),
            'charts' => $this->filterChartsForEnabledRealms($charts),
            'uptime' => OnlineHealth::exportTimeline($filteredUptime),
            'from_cache' => false,
            'stale' => false,
            'fetched_at' => $fetchedAt,
            'fetch_status' => 'ok',
            'error' => null,
            'rate_limit' => $rate,
            'rate_limited' => false,
        ];
    }

    /**
     * @param array<string, mixed> $fetchedData
     * @param array<string, mixed>|null $existingData
     * @return array<string, mixed>
     */
    private function mergeDataWithExisting(array $fetchedData, ?array $existingData): array
    {
        if (!is_array($existingData) || ($existingData['source'] ?? '') !== self::SOURCE_WGN_API) {
            return $fetchedData;
        }

        $fetchedRealms = [];
        foreach ($fetchedData['summary'] ?? [] as $item) {
            if (!is_array($item)) {
                continue;
            }
            $realm = (string) ($item['flag'] ?? '');
            if ($realm !== '') {
                $fetchedRealms[$realm] = true;
            }
        }

        $missingRealms = [];
        foreach ($this->enabledRealms() as $realm) {
            if (!isset($fetchedRealms[$realm])) {
                $missingRealms[] = $realm;
            }
        }

        if ($missingRealms === []) {
            return $fetchedData;
        }

        $existingSummary = is_array($existingData['summary'] ?? null) ? $existingData['summary'] : [];
        $existingClusters = is_array($existingData['clusters'] ?? null) ? $existingData['clusters'] : [];
        $mergedSummary = $fetchedData['summary'] ?? [];
        $mergedClusters = $fetchedData['clusters'] ?? [];

        foreach ($missingRealms as $realm) {
            foreach ($existingSummary as $item) {
                if (is_array($item) && (string) ($item['flag'] ?? '') === $realm) {
                    $mergedSummary[] = $item;
                    break;
                }
            }
            foreach ($existingClusters as $cluster) {
                if (is_array($cluster) && (string) ($cluster['flag'] ?? '') === $realm) {
                    $mergedClusters[] = $cluster;
                    break;
                }
            }
        }

        $realmOrder = array_flip($this->enabledRealms());
        $sortByRealm = static function (array $a, array $b) use ($realmOrder): int {
            $left = $realmOrder[(string) ($a['flag'] ?? '')] ?? 99;
            $right = $realmOrder[(string) ($b['flag'] ?? '')] ?? 99;
            return $left <=> $right;
        };
        usort($mergedSummary, $sortByRealm);
        usort($mergedClusters, $sortByRealm);

        return [
            'source' => self::SOURCE_WGN_API,
            'summary' => array_values($mergedSummary),
            'clusters' => array_values($mergedClusters),
        ];
    }

    /**
     * @return array{cluster:array<string,mixed>,summary:array<string,mixed>}|null
     */
    private function fetchRealmData(string $realm, string $appId): ?array
    {
        $client = TankiClient::forRealm($realm);
        $response = $client->fetchWgnServersInfo($appId);
        if (!$response['ok']) {
            usleep(300000);
            $response = $client->fetchWgnServersInfo($appId);
            if (!$response['ok']) {
                return null;
            }
        }

        return self::buildRealmData($realm, $response['servers']);
    }

    /**
     * @return array{ok:bool,data:?array}
     */
    private function fetchFromApis(): array
    {
        $clusters = [];
        $summary = [];
        $realmIndex = 0;

        foreach (TankiClient::supportedRealms() as $realm) {
            $appId = game_api_application_id_for_realm($realm, $this->db);
            if ($appId === '') {
                continue;
            }

            if ($realmIndex > 0) {
                usleep(200000);
            }
            $realmIndex++;

            $built = $this->fetchRealmData($realm, $appId);
            if ($built === null) {
                continue;
            }

            $clusters[] = $built['cluster'];
            $summary[] = $built['summary'];
        }

        if ($clusters === []) {
            return ['ok' => false, 'data' => null];
        }

        return [
            'ok' => true,
            'data' => [
                'source' => self::SOURCE_WGN_API,
                'summary' => $summary,
                'clusters' => $clusters,
            ],
        ];
    }

    /**
     * @param array<int, array{server:string,players_online:int}> $servers
     * @return array{cluster:array<string,mixed>,summary:array<string,mixed>}
     */
    private static function buildRealmData(string $realm, array $servers): array
    {
        $realm = TankiClient::normalizeRealm($realm);
        $totalOnline = 0;
        $normalizedServers = [];

        foreach ($servers as $server) {
            $online = (int) ($server['players_online'] ?? 0);
            $code = OnlineServerNames::canonicalId($realm, (string) ($server['server'] ?? ''));
            $totalOnline += $online;
            $normalizedServers[] = [
                'code' => $code,
                'name' => OnlineServerNames::label($realm, $code, 'ru'),
                'majority' => '',
                'recommendation' => 'available',
                'status' => 'online',
                'online' => $online,
            ];
        }

        usort($normalizedServers, static function (array $a, array $b): int {
            $onlineCmp = ($b['online'] ?? 0) <=> ($a['online'] ?? 0);
            if ($onlineCmp !== 0) {
                return $onlineCmp;
            }

            return strnatcasecmp((string) ($a['name'] ?? ''), (string) ($b['name'] ?? ''));
        });

        $summaryTitle = TankiClient::realmLabel($realm, 'ru');
        if ($realm === TankiClient::REALM_RU) {
            $summaryTitle = 'МТ RUBY (RU)';
        }

        return [
            'cluster' => [
                'title' => TankiClient::onlineClusterTitle($realm, 'ru'),
                'flag' => $realm,
                'online' => $totalOnline,
                'version' => null,
                'servers' => $normalizedServers,
            ],
            'summary' => [
                'title' => $summaryTitle,
                'online' => $totalOnline,
                'flag' => $realm,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $charts
     * @param array<int, array<string, mixed>> $summary
     * @param array<int, array<string, mixed>> $clusters
     * @return array<string, mixed>
     */
    private function appendChartHistory(array $charts, array $summary, array $clusters = []): array
    {
        $bucketSeconds = max(60, self::CHART_STORAGE_BUCKET_SECONDS);
        $timestamp = (int) (floor(time() / $bucketSeconds) * $bucketSeconds * 1000);
        $serversByRealm = [];

        foreach ($clusters as $cluster) {
            if (!is_array($cluster)) {
                continue;
            }
            $realm = (string) ($cluster['flag'] ?? '');
            if ($realm === '') {
                continue;
            }
            $servers = [];
            foreach (is_array($cluster['servers'] ?? null) ? $cluster['servers'] : [] as $server) {
                if (!is_array($server)) {
                    continue;
                }
                $code = OnlineServerNames::canonicalId($realm, (string) ($server['code'] ?? ''));
                if ($code === '') {
                    continue;
                }
                $servers[$code] = (int) ($server['online'] ?? 0);
            }
            $serversByRealm[$realm] = $servers;
        }

        foreach ($summary as $item) {
            if (!is_array($item)) {
                continue;
            }
            $realm = (string) ($item['flag'] ?? '');
            if ($realm === '') {
                continue;
            }
            $online = isset($item['online']) ? (int) $item['online'] : 0;

            if (!isset($charts[$realm]) || !is_array($charts[$realm])) {
                $charts[$realm] = [
                    'id' => 'history',
                    'series' => [],
                ];
            }

            $this->appendSeriesPoint($charts[$realm], 'chart_total', $timestamp, $online);

            foreach ($serversByRealm[$realm] ?? [] as $serverCode => $serverOnline) {
                $this->appendSeriesPoint($charts[$realm], $serverCode, $timestamp, $serverOnline);
            }
        }

        return $charts;
    }

    /**
     * @param array<string, mixed> $chart
     */
    private function appendSeriesPoint(array &$chart, string $seriesName, int $timestamp, int $value): void
    {
        if (!isset($chart['series']) || !is_array($chart['series'])) {
            $chart['series'] = [];
        }

        $seriesIndex = null;
        foreach ($chart['series'] as $index => $series) {
            if (!is_array($series)) {
                continue;
            }
            if ((string) ($series['name'] ?? '') === $seriesName) {
                $seriesIndex = $index;
                break;
            }
        }

        if ($seriesIndex === null) {
            $chart['series'][] = ['name' => $seriesName, 'data' => []];
            $seriesIndex = count($chart['series']) - 1;
        }

        $data = $chart['series'][$seriesIndex]['data'] ?? [];
        if (!is_array($data)) {
            $data = [];
        }
        $normalized = [];
        foreach ($data as $point) {
            if (!is_array($point) || count($point) < 2) {
                continue;
            }
            $ts = self::normalizeTimestampMs((int) $point[0]);
            if ($ts <= 0) {
                continue;
            }
            $normalized[$ts] = (int) $point[1];
        }

        $timestamp = self::normalizeTimestampMs($timestamp);
        if ($timestamp <= 0) {
            return;
        }
        $normalized[$timestamp] = $value;
        ksort($normalized);

        $data = [];
        foreach ($normalized as $ts => $pointValue) {
            $data[] = [(int) $ts, (int) $pointValue];
        }
        $retentionStartMs = (int) ((time() - self::CHART_RETENTION_SECONDS) * 1000);
        $data = array_values(array_filter($data, static function (array $point) use ($retentionStartMs): bool {
            return (int) ($point[0] ?? 0) >= $retentionStartMs;
        }));

        if (count($data) > self::CHART_MAX_POINTS) {
            $data = self::downsampleSeries($data, self::CHART_MAX_POINTS);
        }

        $chart['series'][$seriesIndex]['data'] = $data;
    }

    /**
     * @param mixed $seriesPayload
     * @return array<int, array<string, mixed>>
     */
    public static function normalizeChartSeries($seriesPayload): array
    {
        if (!is_array($seriesPayload)) {
            return [];
        }

        $normalized = [];
        foreach ($seriesPayload as $series) {
            if (!is_array($series)) {
                continue;
            }
            $name = (string) ($series['name'] ?? '');
            if ($name === '') {
                continue;
            }
            $points = [];
            if (isset($series['data']) && is_array($series['data'])) {
                foreach ($series['data'] as $point) {
                    if (!is_array($point) || count($point) < 2) {
                        continue;
                    }
                    $ts = self::normalizeTimestampMs((int) $point[0]);
                    if ($ts <= 0) {
                        continue;
                    }
                    $points[] = [$ts, (int) $point[1]];
                }
            }
            if ($points !== []) {
                usort($points, static fn(array $a, array $b): int => $a[0] <=> $b[0]);
                $deduped = [];
                foreach ($points as $point) {
                    $deduped[$point[0]] = $point[1];
                }
                $points = [];
                foreach ($deduped as $ts => $value) {
                    $points[] = [(int) $ts, (int) $value];
                }
                $retentionStartMs = (int) ((time() - self::CHART_RETENTION_SECONDS) * 1000);
                $points = array_values(array_filter($points, static function (array $point) use ($retentionStartMs): bool {
                    return (int) ($point[0] ?? 0) >= $retentionStartMs;
                }));
            }
            $normalized[] = [
                'name' => $name,
                'data' => count($points) > self::CHART_MAX_POINTS
                    ? self::downsampleSeries($points, self::CHART_MAX_POINTS)
                    : $points,
            ];
        }

        return $normalized;
    }

    /**
     * @param array<int, array{0:int,1:int}> $points
     * @return array<int, array{0:int,1:int}>
     */
    public static function downsampleSeries(array $points, int $maxPoints): array
    {
        $count = count($points);
        if ($count <= $maxPoints || $maxPoints < 2) {
            return $points;
        }

        $step = ($count - 1) / ($maxPoints - 1);
        $sampled = [];
        for ($i = 0; $i < $maxPoints; $i++) {
            $index = (int) round($i * $step);
            if ($index >= $count) {
                $index = $count - 1;
            }
            $sampled[] = $points[$index];
        }

        return $sampled;
    }

    private static function normalizeTimestampMs(int $timestamp): int
    {
        if ($timestamp <= 0) {
            return 0;
        }

        // Legacy cache rows could contain Unix seconds. Convert those to milliseconds.
        if ($timestamp < 100000000000) {
            return $timestamp * 1000;
        }

        return $timestamp;
    }

    /**
     * @param array<int, array<string, mixed>> $summary
     * @return array<string, bool>
     */
    private function realmFlagsFromSummary(array $summary): array
    {
        $flags = [];
        foreach ($summary as $item) {
            if (!is_array($item)) {
                continue;
            }
            $realm = (string) ($item['flag'] ?? '');
            if ($realm !== '') {
                $flags[$realm] = true;
            }
        }

        return $flags;
    }

    /**
     * @param array<string, mixed> $uptime
     * @return array<string, mixed>
     */
    public function filterUptimeForEnabledRealms(array $uptime): array
    {
        $enabled = array_flip($this->enabledRealms());
        $filtered = [];
        foreach ($uptime as $realm => $realmData) {
            if (isset($enabled[$realm]) && is_array($realmData)) {
                $filtered[$realm] = $realmData;
            }
        }

        return $filtered;
    }

    /**
     * @param array<string, mixed> $fields
     */
    private function upsertCache(array $fields): void
    {
        $existing = $this->getCachedRow();
        $this->db->query(
            'INSERT INTO wot_online_cache (id, data_json, charts_json, uptime_json, fetched_at, fetch_status, fetch_error, fetch_log_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                data_json = VALUES(data_json),
                charts_json = VALUES(charts_json),
                uptime_json = VALUES(uptime_json),
                fetched_at = VALUES(fetched_at),
                fetch_status = VALUES(fetch_status),
                fetch_error = VALUES(fetch_error),
                fetch_log_json = COALESCE(VALUES(fetch_log_json), fetch_log_json)',
            [
                self::CACHE_ROW_ID,
                isset($fields['data_json']) ? json_encode($fields['data_json'], JSON_UNESCAPED_UNICODE) : null,
                isset($fields['charts_json']) ? json_encode($fields['charts_json'], JSON_UNESCAPED_UNICODE) : null,
                isset($fields['uptime_json']) ? json_encode($fields['uptime_json'], JSON_UNESCAPED_UNICODE) : null,
                $fields['fetched_at'] ?? ($existing['fetched_at'] ?? null),
                (string) ($fields['fetch_status'] ?? 'pending'),
                $fields['fetch_error'] ?? null,
                isset($fields['fetch_log_json']) ? json_encode(array_values($fields['fetch_log_json'])) : ($existing['fetch_log_json'] ?? null),
            ]
        );
    }

    /**
     * @return array<string, mixed>|null
     */
    private function decodeJsonField($value): ?array
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_array($value)) {
            return $value;
        }
        $decoded = json_decode((string) $value, true);
        return is_array($decoded) ? $decoded : null;
    }
}
