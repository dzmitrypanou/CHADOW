<?php

class TankiClient
{
    public const REALM_RU = 'ru';
    public const REALM_EU = 'eu';
    public const REALM_NA = 'na';
    public const REALM_ASIA = 'asia';

    private const HTTP_TIMEOUT = 12;

    private string $realm;
    private string $baseUrl;
    private string $mtupBase;
    private string $communityLocale;
    private string $clanBaseUrl;

    private static array $clanTagPortalUrlCache = [];

    public static function normalizeRealm(?string $realm): string
    {
        $realm = strtolower(trim((string) $realm));
        return in_array($realm, [self::REALM_RU, self::REALM_EU, self::REALM_NA, self::REALM_ASIA], true)
            ? $realm
            : self::REALM_RU;
    }

    public static function supportedRealms(): array
    {
        return [self::REALM_RU, self::REALM_EU, self::REALM_NA, self::REALM_ASIA];
    }

    public static function realmLabel(string $realm, string $lang = 'ru'): string
    {
        $isEn = $lang === 'en';
        switch (self::normalizeRealm($realm)) {
            case self::REALM_EU:
                return $isEn ? 'WoT EU' : 'WoT EU';
            case self::REALM_NA:
                return $isEn ? 'WoT NA' : 'WoT NA';
            case self::REALM_ASIA:
                return $isEn ? 'WoT ASIA' : 'WoT ASIA';
            default:
                return $isEn ? 'WoT RU (Lesta)' : 'WoT RU (Lesta)';
        }
    }

    public static function forRealm(string $realm): self
    {
        return new self($realm);
    }

    public function __construct(string $realm = self::REALM_RU)
    {
        $this->realm = self::normalizeRealm($realm);
        $config = self::realmConfig($this->realm);
        $this->baseUrl = $config['base_url'];
        $this->mtupBase = $config['mtup_base'];
        $this->communityLocale = $config['community_locale'];
        $this->clanBaseUrl = $config['clan_base_url'];
    }

    public function getRealm(): string
    {
        return $this->realm;
    }

    public function usesPortalParser(): bool
    {
        return $this->realm === self::REALM_RU;
    }

    private static function realmConfig(string $realm): array
    {
        switch ($realm) {
            case self::REALM_EU:
                return [
                    'base_url' => 'https://worldoftanks.eu',
                    'mtup_base' => 'https://worldoftanks.eu/wotup/profile',
                    'community_locale' => 'en',
                    'clan_base_url' => 'https://eu.wargaming.net/clans/wot/',
                ];
            case self::REALM_NA:
                return [
                    'base_url' => 'https://worldoftanks.com',
                    'mtup_base' => 'https://worldoftanks.com/wotup/profile',
                    'community_locale' => 'en',
                    'clan_base_url' => 'https://na.wargaming.net/clans/wot/',
                ];
            case self::REALM_ASIA:
                return [
                    'base_url' => 'https://worldoftanks.asia',
                    'mtup_base' => 'https://worldoftanks.asia/wotup/profile',
                    'community_locale' => 'en',
                    'clan_base_url' => 'https://asia.wargaming.net/clans/wot/',
                ];
            default:
                return [
                    'base_url' => 'https://tanki.su',
                    'mtup_base' => 'https://tanki.su/mtup/profile',
                    'community_locale' => 'ru',
                    'clan_base_url' => 'https://lesta.ru/clans/wot/',
                ];
        }
    }

    public static function nicknameSlug(string $nickname): string
    {
        $slug = strtolower(trim($nickname));
        $slug = preg_replace('/[^a-z0-9_\-]+/u', '-', $slug) ?? '';
        $slug = trim($slug, '-');
        return $slug !== '' ? $slug : 'player';
    }

    public function buildPortalProfileUrl(int $spaId, string $nicknameSlug = ''): string
    {
        $slug = $nicknameSlug !== '' ? $nicknameSlug : 'player';
        return rtrim($this->baseUrl, '/') . '/' . $this->communityLocale
            . '/community/accounts/' . $spaId . '-' . rawurlencode($slug) . '/';
    }

    public function buildClanUrl(int $clanId): string
    {
        if ($clanId <= 0) {
            return '';
        }

        if ($this->realm === self::REALM_RU) {
            return $this->clanBaseUrl . $clanId . '/?utm_source=mt-portal&utm_medium=global-nav';
        }

        return rtrim($this->clanBaseUrl, '/') . '/' . $clanId . '/';
    }

    public function fetchWgnServersInfo(string $applicationId, string $game = 'wot'): array
    {
        $applicationId = trim($applicationId);
        if ($applicationId === '') {
            return ['ok' => false, 'servers' => [], 'error' => 'application_id missing'];
        }

        $url = $this->wgnApiBaseUrl() . '/wgn/servers/info/?' . http_build_query([
            'application_id' => $applicationId,
            'game' => $game,
        ]);
        $res = $this->httpGet($url, ['Accept: application/json']);
        if (!$res['ok'] || !is_array($res['json'])) {
            return ['ok' => false, 'servers' => [], 'error' => $res['error'] ?: ('HTTP ' . $res['status'])];
        }
        if (($res['json']['status'] ?? '') !== 'ok') {
            $msg = 'API status error';
            if (isset($res['json']['error']['message'])) {
                $msg = (string) $res['json']['error']['message'];
            }
            return ['ok' => false, 'servers' => [], 'error' => $msg];
        }

        $data = $res['json']['data'] ?? null;
        if (!is_array($data)) {
            return ['ok' => false, 'servers' => [], 'error' => 'invalid response'];
        }

        $serversRaw = $data[$game] ?? null;
        if (!is_array($serversRaw)) {
            return ['ok' => false, 'servers' => [], 'error' => 'no server list'];
        }

        $servers = [];
        foreach ($serversRaw as $item) {
            if (!is_array($item)) {
                continue;
            }
            $name = trim((string) ($item['server'] ?? ''));
            if ($name === '') {
                continue;
            }
            $servers[] = [
                'server' => $name,
                'players_online' => isset($item['players_online']) ? (int) $item['players_online'] : 0,
            ];
        }

        if ($servers === []) {
            return ['ok' => false, 'servers' => [], 'error' => 'empty server list'];
        }

        usort($servers, static function (array $a, array $b): int {
            return strnatcasecmp($a['server'], $b['server']);
        });

        return ['ok' => true, 'servers' => $servers, 'error' => null];
    }

    public static function onlineClusterTitle(string $realm, string $lang = 'ru'): string
    {
        $isEn = $lang === 'en';
        switch (self::normalizeRealm($realm)) {
            case self::REALM_EU:
                return 'WoT EU';
            case self::REALM_NA:
                return 'WoT NA';
            case self::REALM_ASIA:
                return 'WoT ASIA';
            default:
                return $isEn ? 'MT RUBY' : 'МТ RUBY';
        }
    }

    public function wgnApiBaseUrl(): string
    {
        switch ($this->realm) {
            case self::REALM_EU:
                return 'https://api.worldoftanks.eu';
            case self::REALM_NA:
                return 'https://api.worldoftanks.com';
            case self::REALM_ASIA:
                return 'https://api.worldoftanks.asia';
            default:
                return 'https://api.tanki.su';
        }
    }

    public function resolveClanIdByTag(string $tag, string $applicationId): ?int
    {
        $tag = trim($tag);
        $applicationId = trim($applicationId);
        if ($tag === '' || $applicationId === '') {
            return null;
        }

        $url = $this->wgnApiBaseUrl() . '/wgn/clans/list/?' . http_build_query([
            'application_id' => $applicationId,
            'search' => $tag,
            'limit' => 100,
        ]);
        $res = $this->httpGet($url, ['Accept: application/json']);
        if (!$res['ok'] || !is_array($res['json'])) {
            return null;
        }
        if (($res['json']['status'] ?? '') !== 'ok' || !is_array($res['json']['data'] ?? null)) {
            return null;
        }

        $tagNorm = mb_strtoupper($tag, 'UTF-8');
        foreach ($res['json']['data'] as $item) {
            if (!is_array($item)) {
                continue;
            }
            $itemTag = trim((string) ($item['tag'] ?? ''));
            $clanId = self::parseAccountId($item['clan_id'] ?? 0);
            if ($clanId <= 0 || $itemTag === '') {
                continue;
            }
            if (mb_strtoupper($itemTag, 'UTF-8') === $tagNorm) {
                return $clanId;
            }
        }

        return null;
    }

    public function buildClanTagPortalUrl(string $tag, string $applicationId = ''): ?string
    {
        $tag = trim($tag);
        if ($tag === '') {
            return null;
        }

        $cacheKey = $this->realm . ':' . mb_strtoupper($tag, 'UTF-8');
        if (array_key_exists($cacheKey, self::$clanTagPortalUrlCache)) {
            return self::$clanTagPortalUrlCache[$cacheKey];
        }

        $clanId = $this->resolveClanIdByTag($tag, $applicationId);
        if ($clanId === null || $clanId <= 0) {
            self::$clanTagPortalUrlCache[$cacheKey] = null;
            return null;
        }

        $url = $this->buildClanUrl($clanId);
        $resolved = $url !== '' ? $url : null;
        self::$clanTagPortalUrlCache[$cacheKey] = $resolved;

        return $resolved;
    }

    public static function extractClanId(?array $bootstrap): int
    {
        if (!is_array($bootstrap)) {
            return 0;
        }

        return (int) ($bootstrap['clan_info']['id'] ?? 0);
    }

    private function defaultHttpHeaders(array $extra = []): array
    {
        return array_merge([
            'Accept: application/json, text/html;q=0.9,*/*;q=0.8',
            'Accept-Language: en-US,en;q=0.9,ru;q=0.8',
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer: ' . rtrim($this->baseUrl, '/') . '/',
        ], $extra);
    }

    private static function parseAccountId($value): int
    {
        if ($value === null || $value === '') {
            return 0;
        }
        if (!is_numeric($value)) {
            return 0;
        }
        $id = (int) $value;
        return $id > 0 ? $id : 0;
    }

    private static function mapPortalSearchItems(array $items): array
    {
        $results = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $spaId = self::parseAccountId($item['account_id'] ?? 0);
            $nickname = trim((string) ($item['account_name'] ?? ''));
            if ($spaId <= 0 || $nickname === '') {
                continue;
            }
            if (isset($results[$spaId])) {
                continue;
            }
            $results[$spaId] = [
                'spa_id' => $spaId,
                'nickname' => $nickname,
                'nickname_slug' => self::nicknameSlug($nickname),
                'clan_tag' => trim((string) ($item['clan_tag'] ?? '')),
            ];
        }

        return array_values($results);
    }

    public function httpGet(string $url, array $headers = []): array
    {
        $ch = curl_init($url);
        if ($ch === false) {
            return ['ok' => false, 'status' => 0, 'body' => '', 'json' => null, 'error' => 'curl_init failed'];
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => self::HTTP_TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_HTTPHEADER => $this->defaultHttpHeaders($headers),
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($body === false) {
            return ['ok' => false, 'status' => $status, 'body' => '', 'json' => null, 'error' => $err ?: 'request failed'];
        }
        $json = json_decode($body, true);
        return [
            'ok' => $status >= 200 && $status < 300,
            'status' => $status,
            'body' => (string) $body,
            'json' => is_array($json) ? $json : null,
            'error' => null,
        ];
    }

    public function mtupGet(string $endpoint, array $params = [], ?int $spaId = null): array
    {
        if (!$this->usesPortalParser()) {
            return ['ok' => false, 'data' => null, 'error' => 'MTUP disabled for this realm'];
        }

        $url = rtrim($this->mtupBase, '/') . '/' . ltrim($endpoint, '/');
        if ($params !== []) {
            $url .= '?' . http_build_query($params);
        }
        $headers = [];
        if ($spaId !== null && $spaId > 0) {
            $headers[] = 'Referer: ' . $this->buildPortalProfileUrl($spaId);
        }
        $res = $this->httpGet($url, $headers);
        if (!$res['ok'] || !is_array($res['json'])) {
            return ['ok' => false, 'data' => null, 'error' => $res['error'] ?: ('HTTP ' . $res['status'])];
        }
        if (($res['json']['status'] ?? '') !== 'ok') {
            return ['ok' => false, 'data' => null, 'error' => 'MTUP status error'];
        }
        return ['ok' => true, 'data' => $res['json']['data'] ?? null, 'error' => null];
    }

    public function fetchSummary(int $spaId, string $battleType = 'random'): array
    {
        return $this->mtupGet('summary/', [
            'spa_id' => $spaId,
            'battle_type' => $battleType,
        ], $spaId);
    }

    public function fetchStatistics(int $spaId, string $battleType = 'random'): array
    {
        return $this->mtupGet('statistics/', [
            'spa_id' => $spaId,
            'battle_type' => $battleType,
        ], $spaId);
    }

    public function fetchAchievementsShort(int $spaId, string $battleType = 'random'): array
    {
        return $this->mtupGet('achievements/short/', [
            'spa_id' => $spaId,
            'battle_type' => $battleType,
        ], $spaId);
    }

    public static function extractJsonAssignment(string $html, string $varName): ?array
    {
        $marker = $varName . ' = {';
        $start = strpos($html, $marker);
        if ($start === false) {
            return null;
        }
        $pos = $start + strlen($varName) + 2;
        $len = strlen($html);
        while ($pos < $len && ctype_space($html[$pos])) {
            $pos++;
        }
        if ($pos >= $len || $html[$pos] !== '{') {
            return null;
        }

        $depth = 0;
        $inString = false;
        $escaped = false;
        for ($i = $pos; $i < $len; $i++) {
            $ch = $html[$i];
            if ($inString) {
                if ($escaped) {
                    $escaped = false;
                    continue;
                }
                if ($ch === '\\') {
                    $escaped = true;
                    continue;
                }
                if ($ch === '"') {
                    $inString = false;
                }
                continue;
            }
            if ($ch === '"') {
                $inString = true;
                continue;
            }
            if ($ch === '{') {
                $depth++;
                continue;
            }
            if ($ch === '}') {
                $depth--;
                if ($depth === 0) {
                    $json = substr($html, $pos, $i - $pos + 1);
                    $data = json_decode($json, true);
                    return is_array($data) ? $data : null;
                }
            }
        }

        return null;
    }

    public function fetchProfileBootstrap(int $spaId, string $nicknameSlug = ''): array
    {
        if (!$this->usesPortalParser()) {
            return ['ok' => false, 'data' => null, 'error' => 'portal parser disabled for this realm'];
        }

        $slugs = [];
        if ($nicknameSlug !== '') {
            $slugs[] = $nicknameSlug;
        }
        if (!in_array('player', $slugs, true)) {
            $slugs[] = 'player';
        }

        $lastError = 'USER_DATA not found';
        foreach ($slugs as $slug) {
            $url = $this->buildPortalProfileUrl($spaId, $slug);
            $res = $this->httpGet($url, ['Accept: text/html']);
            if (!$res['ok'] || $res['body'] === '') {
                $lastError = $res['error'] ?: ('HTTP ' . $res['status']);
                continue;
            }
            $data = self::extractJsonAssignment($res['body'], 'USER_DATA');
            if (!is_array($data)) {
                $lastError = 'USER_DATA not found';
                continue;
            }
            return ['ok' => true, 'data' => $data, 'error' => null];
        }

        return ['ok' => false, 'data' => null, 'error' => $lastError];
    }

    public function searchByNickname(string $query, string $applicationId = ''): array
    {
        $query = trim($query);
        if (mb_strlen($query, 'UTF-8') < 3) {
            return [];
        }

        $applicationId = trim($applicationId);
        if ($applicationId !== '') {
            $results = $this->searchByNicknameViaWgApi($query, $applicationId, 'startswith', 25);
            if ($results !== []) {
                return $results;
            }

            return $this->searchByNicknameViaWgApi($query, $applicationId, 'exact', 5);
        }

        if (!$this->usesPortalParser()) {
            return [];
        }

        return $this->searchByNicknameViaPortal($query);
    }

    private function searchByNicknameViaPortal(string $query): array
    {
        $accountsPath = '/' . $this->communityLocale . '/community/accounts/';
        $url = rtrim($this->baseUrl, '/') . $accountsPath . 'search/?' . http_build_query(['name' => $query]);
        $res = $this->httpGet($url, [
            'Accept: application/json',
            'X-Requested-With: XMLHttpRequest',
            'Referer: ' . rtrim($this->baseUrl, '/') . $accountsPath,
        ]);
        if ($res['ok'] && is_array($res['json'])) {
            $items = $res['json']['response'] ?? null;
            if (is_array($items) && $items !== []) {
                return self::mapPortalSearchItems($items);
            }
        }

        return $this->resolveExactNickname($query);
    }

    public function searchByNicknameViaWgApi(
        string $query,
        string $applicationId,
        string $type = 'startswith',
        int $limit = 25
    ): array {
        $query = trim($query);
        $applicationId = trim($applicationId);
        if ($query === '' || mb_strlen($query, 'UTF-8') < 3 || $applicationId === '') {
            return [];
        }

        $apiBase = $this->wgApiBaseUrl();
        if ($apiBase === null) {
            return [];
        }

        $limit = max(1, min(100, $limit));
        $searchType = in_array($type, ['exact', 'startswith'], true) ? $type : 'startswith';
        $url = $apiBase . '/wot/account/list/?' . http_build_query([
            'application_id' => $applicationId,
            'search' => $query,
            'type' => $searchType,
            'limit' => $limit,
        ]);
        $res = $this->httpGet($url, ['Accept: application/json']);
        if (!$res['ok'] || !is_array($res['json'])) {
            return [];
        }
        if (($res['json']['status'] ?? '') !== 'ok' || !is_array($res['json']['data'] ?? null)) {
            return [];
        }

        $results = [];
        foreach ($res['json']['data'] as $item) {
            if (!is_array($item)) {
                continue;
            }
            $spaId = self::parseAccountId($item['account_id'] ?? 0);
            $nickname = trim((string) ($item['nickname'] ?? ''));
            if ($spaId <= 0 || $nickname === '') {
                continue;
            }
            if (isset($results[$spaId])) {
                continue;
            }
            $results[$spaId] = [
                'spa_id' => $spaId,
                'nickname' => $nickname,
                'nickname_slug' => self::nicknameSlug($nickname),
                'clan_tag' => '',
            ];
        }

        return array_values($results);
    }

    private function resolveExactNickname(string $query): array
    {
        $accountsPath = '/' . $this->communityLocale . '/community/accounts/';
        $url = rtrim($this->baseUrl, '/') . $accountsPath . 'named/?' . http_build_query(['user' => $query]);
        $ch = curl_init($url);
        if ($ch === false) {
            return [];
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_HEADER => true,
            CURLOPT_TIMEOUT => self::HTTP_TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_HTTPHEADER => $this->defaultHttpHeaders([
                'Accept: text/html',
                'Referer: ' . rtrim($this->baseUrl, '/') . $accountsPath,
            ]),
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $response = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false || ($status !== 301 && $status !== 302 && $status !== 303 && $status !== 307 && $status !== 308)) {
            return [];
        }

        $location = '';
        if (preg_match('/^Location:\s*(.+)$/mi', (string) $response, $m)) {
            $location = trim($m[1]);
        }
        if ($location === '') {
            return [];
        }
        if (!preg_match('#/community/accounts/(\d+)-([^/]+)/?#', $location, $m)) {
            return [];
        }

        $spaId = (int) $m[1];
        $slug = rawurldecode((string) $m[2]);
        if ($spaId <= 0 || $slug === '') {
            return [];
        }

        return [[
            'spa_id' => $spaId,
            'nickname' => $slug,
            'nickname_slug' => self::nicknameSlug($slug),
            'clan_tag' => '',
        ]];
    }

    public function wgApiBaseUrl(): ?string
    {
        switch ($this->realm) {
            case self::REALM_EU:
                return 'https://api.worldoftanks.eu';
            case self::REALM_NA:
                return 'https://api.worldoftanks.com';
            case self::REALM_ASIA:
                return 'https://api.worldoftanks.asia';
            default:
                return 'https://api.tanki.su';
        }
    }

    public static function computeHitsRatioFromRandom(array $random): ?float
    {
        foreach (['hits_percents', 'hits_percent'] as $key) {
            if (isset($random[$key]) && is_numeric($random[$key])) {
                return round((float) $random[$key], 2);
            }
        }

        $shots = $random['shots'] ?? null;
        $hits = $random['hits'] ?? null;
        if (is_numeric($shots) && is_numeric($hits) && (float) $shots > 0) {
            return round((float) $hits / (float) $shots * 100, 2);
        }

        return null;
    }

    public static function computePerBattleAverage($total, int $battles, int $decimals = 2): ?float
    {
        if ($battles <= 0 || !is_numeric($total)) {
            return null;
        }

        return round((float) $total / $battles, $decimals);
    }

    public static function mapRandomStatsToSummary(array $random): array
    {
        $battles = (int) ($random['battles'] ?? 0);
        $summary = [];

        if ($battles <= 0) {
            return $summary;
        }

        $summary['battles_count'] = $battles;

        $wins = (int) ($random['wins'] ?? 0);
        if ($wins > 0 || isset($random['wins'])) {
            $summary['wins_count'] = $wins;
            $summary['wins_ratio'] = round($wins / $battles * 100, 2);
        }

        foreach (['losses' => 'losses_count', 'draws' => 'draws_count'] as $src => $dst) {
            if (isset($random[$src]) && is_numeric($random[$src])) {
                $summary[$dst] = (int) $random[$src];
            }
        }

        if (isset($random['damage_dealt']) && is_numeric($random['damage_dealt'])) {
            $summary['damage_per_battle_average'] = (int) round((float) $random['damage_dealt'] / $battles);
        }

        if (isset($random['xp']) && is_numeric($random['xp'])) {
            $summary['xp_per_battle_average'] = (int) round((float) $random['xp'] / $battles);
        } elseif (isset($random['battle_avg_xp']) && is_numeric($random['battle_avg_xp'])) {
            $summary['xp_per_battle_average'] = (int) round((float) $random['battle_avg_xp']);
        }

        $hitsRatio = self::computeHitsRatioFromRandom($random);
        if ($hitsRatio !== null) {
            $summary['hits_ratio'] = $hitsRatio;
        }

        foreach ([
            'frags' => 'frags_per_battle_average',
            'spotted' => 'spotted_per_battle_average',
            'shots' => 'shots_per_battle_average',
            'hits' => 'hits_per_battle_average',
            'piercings' => 'piercings_per_battle_average',
            'damage_received' => 'damage_received_per_battle_average',
            'capture_points' => 'capture_points_per_battle_average',
            'dropped_capture_points' => 'dropped_capture_points_per_battle_average',
        ] as $src => $dst) {
            $avg = self::computePerBattleAverage($random[$src] ?? null, $battles, $src === 'frags' ? 2 : 2);
            if ($avg !== null) {
                $summary[$dst] = $avg;
            }
        }

        if (isset($random['survived_battles']) && is_numeric($random['survived_battles'])) {
            $summary['survival_ratio'] = round((float) $random['survived_battles'] / $battles * 100, 2);
        }

        foreach ([
            'avg_damage_assisted_radio' => 'damage_assisted_radio_average',
            'avg_damage_assisted_track' => 'damage_assisted_track_average',
            'avg_damage_blocked' => 'damage_blocked_average',
        ] as $src => $dst) {
            if (isset($random[$src]) && is_numeric($random[$src])) {
                $summary[$dst] = round((float) $random[$src], 2);
            }
        }

        if (isset($random['piercings'], $random['hits'])
            && is_numeric($random['piercings'])
            && is_numeric($random['hits'])
            && (float) $random['hits'] > 0
        ) {
            $summary['piercings_ratio'] = round((float) $random['piercings'] / (float) $random['hits'] * 100, 2);
        }

        return $summary;
    }

    public function fetchRandomHitsPercents(int $spaId, string $applicationId): ?float
    {
        $applicationId = trim($applicationId);
        if ($applicationId === '' || $spaId <= 0) {
            return null;
        }

        $info = $this->fetchAccountInfo(
            $spaId,
            $applicationId,
            'statistics.random.shots,statistics.random.hits,statistics.random'
        );
        if (!$info['ok'] || !is_array($info['data'])) {
            return null;
        }

        $random = is_array($info['data']['statistics']['random'] ?? null)
            ? $info['data']['statistics']['random']
            : [];

        return self::computeHitsRatioFromRandom($random);
    }

    public function fetchAccountInfo(int $spaId, string $applicationId, string $fields): array
    {
        $applicationId = trim($applicationId);
        if ($applicationId === '' || $spaId <= 0) {
            return ['ok' => false, 'data' => null, 'error' => 'invalid request'];
        }

        $apiBase = $this->wgApiBaseUrl();
        if ($apiBase === null) {
            return ['ok' => false, 'data' => null, 'error' => 'API unavailable'];
        }

        $url = $apiBase . '/wot/account/info/?' . http_build_query([
            'application_id' => $applicationId,
            'account_id' => $spaId,
            'fields' => $fields,
        ]);
        $res = $this->httpGet($url, ['Accept: application/json']);
        if (!$res['ok'] || !is_array($res['json'])) {
            return ['ok' => false, 'data' => null, 'error' => $res['error'] ?: ('HTTP ' . $res['status'])];
        }
        if (($res['json']['status'] ?? '') !== 'ok' || !is_array($res['json']['data'] ?? null)) {
            $apiError = is_array($res['json']['error'] ?? null)
                ? (string) ($res['json']['error']['message'] ?? 'API status error')
                : 'API status error';

            return ['ok' => false, 'data' => null, 'error' => $apiError];
        }

        $account = $res['json']['data'][(string) $spaId] ?? $res['json']['data'][$spaId] ?? null;
        if (!is_array($account)) {
            return ['ok' => false, 'data' => null, 'error' => 'account not found'];
        }

        return ['ok' => true, 'data' => $account, 'error' => null];
    }

    public function fetchClanInfoById(int $clanId, string $applicationId): ?array
    {
        $clanId = (int) $clanId;
        $applicationId = trim($applicationId);
        if ($clanId <= 0 || $applicationId === '') {
            return null;
        }

        $apiBase = $this->wgApiBaseUrl();
        if ($apiBase === null) {
            return null;
        }

        $url = $apiBase . '/wot/clans/info/?' . http_build_query([
            'application_id' => $applicationId,
            'clan_id' => $clanId,
            'fields' => 'name,tag',
        ]);
        $res = $this->httpGet($url, ['Accept: application/json']);
        if (!$res['ok'] || !is_array($res['json'])) {
            return null;
        }
        if (($res['json']['status'] ?? '') !== 'ok' || !is_array($res['json']['data'] ?? null)) {
            return null;
        }

        $clan = $res['json']['data'][(string) $clanId] ?? $res['json']['data'][$clanId] ?? null;
        if (!is_array($clan)) {
            return null;
        }

        $tag = trim((string) ($clan['tag'] ?? ''));
        $name = trim((string) ($clan['name'] ?? ''));
        if ($tag === '' && $name === '') {
            return null;
        }

        return [
            'clan_id' => $clanId,
            'tag' => $tag,
            'name' => $name,
        ];
    }

    public function resolveClanFromAccount(array $account, string $applicationId): array
    {
        $clanId = 0;
        $tag = '';
        $name = '';

        $clan = $account['clan'] ?? null;
        if (is_array($clan)) {
            $clanId = self::parseAccountId($clan['clan_id'] ?? ($clan['id'] ?? 0));
            $tag = trim((string) ($clan['tag'] ?? ''));
            $name = trim((string) ($clan['name'] ?? ''));
        }
        if ($clanId <= 0) {
            $clanId = self::parseAccountId($account['clan_id'] ?? 0);
        }

        if ($clanId > 0 && ($tag === '' || $name === '')) {
            $fetched = $this->fetchClanInfoById($clanId, $applicationId);
            if (is_array($fetched)) {
                $tag = $tag !== '' ? $tag : $fetched['tag'];
                $name = $name !== '' ? $name : $fetched['name'];
            }
        }

        return [
            'clan_id' => $clanId,
            'tag' => $tag,
            'name' => $name,
        ];
    }

    public static function mapPublicApiAccountToSummary(array $account): array
    {
        $random = is_array($account['statistics']['random'] ?? null) ? $account['statistics']['random'] : [];
        $summary = self::mapRandomStatsToSummary($random);

        if (isset($account['global_rating']) && is_numeric($account['global_rating'])) {
            $summary['global_rating'] = (int) $account['global_rating'];
        }

        foreach (['marks_on_gun', 'marks_on_gun_count'] as $key) {
            if (isset($account[$key]) && is_numeric($account[$key])) {
                $summary['marks_on_gun_count'] = (int) $account[$key];
                break;
            }
        }

        return $summary;
    }

    public static function mapPublicApiAccountToStatistics(array $account): array
    {
        $random = is_array($account['statistics']['random'] ?? null) ? $account['statistics']['random'] : [];
        $statistics = [];

        if ($random !== []) {
            $statistics['random'] = $random;
        }

        if (isset($random['max_damage']) && is_numeric($random['max_damage'])) {
            $statistics['damage_max'] = (int) $random['max_damage'];
        }
        if (isset($random['max_xp']) && is_numeric($random['max_xp'])) {
            $statistics['xp_max'] = (int) $random['max_xp'];
        }
        if (isset($random['max_frags']) && is_numeric($random['max_frags'])) {
            $statistics['frags_max'] = (int) $random['max_frags'];
        }

        return $statistics;
    }

    private function buildAccountProfileFieldSets(): array
    {
        $randomStatsFields = implode(',', [
            'statistics.random.battles',
            'statistics.random.wins',
            'statistics.random.losses',
            'statistics.random.draws',
            'statistics.random.damage_dealt',
            'statistics.random.damage_received',
            'statistics.random.xp',
            'statistics.random.battle_avg_xp',
            'statistics.random.shots',
            'statistics.random.hits',
            'statistics.random.piercings',
            'statistics.random.frags',
            'statistics.random.spotted',
            'statistics.random.survived_battles',
            'statistics.random.avg_damage_assisted_radio',
            'statistics.random.avg_damage_assisted_track',
            'statistics.random.avg_damage_blocked',
            'statistics.random.capture_points',
            'statistics.random.dropped_capture_points',
            'statistics.random.max_damage',
            'statistics.random.max_xp',
            'statistics.random.max_frags',
        ]);

        if ($this->usesPortalParser()) {
            return [
                'nickname,clan_id,global_rating,marks_on_gun,statistics.random',
                'nickname,clan_id,global_rating,marks_on_gun,' . $randomStatsFields,
                'nickname,global_rating,statistics',
                'nickname,statistics',
            ];
        }

        return [
            'nickname,clan_id,global_rating,statistics.random',
            'nickname,clan_id,global_rating,' . $randomStatsFields,
            'nickname,clan_id,global_rating,statistics',
            'nickname,global_rating,statistics',
            'nickname,statistics',
        ];
    }

    public function fetchAccountProfile(int $spaId, string $applicationId): array
    {
        $fieldSets = $this->buildAccountProfileFieldSets();

        $lastError = 'API profile failed';
        foreach ($fieldSets as $fields) {
            $info = $this->fetchAccountInfo($spaId, $applicationId, $fields);
            if (!$info['ok'] || !is_array($info['data'])) {
                $lastError = $info['error'] ?? $lastError;
                continue;
            }

            $account = $info['data'];
            $nickname = trim((string) ($account['nickname'] ?? ''));
            if ($nickname === '') {
                $lastError = 'nickname not found';
                continue;
            }

            $clan = $this->resolveClanFromAccount($account, $applicationId);
            $summary = self::mapPublicApiAccountToSummary($account);
            $statistics = self::mapPublicApiAccountToStatistics($account);
            $bootstrap = [
                'nickname' => $nickname,
                'clan_info' => [
                    'id' => $clan['clan_id'],
                    'tag' => $clan['tag'],
                    'name' => $clan['name'],
                ],
            ];

            return [
                'ok' => true,
                'data' => [
                    'nickname' => $nickname,
                    'clan_tag' => $clan['tag'],
                    'clan_name' => $clan['name'],
                    'summary' => $summary,
                    'statistics' => $statistics,
                    'bootstrap' => $bootstrap,
                ],
                'error' => null,
            ];
        }

        return ['ok' => false, 'data' => null, 'error' => $lastError];
    }
}
