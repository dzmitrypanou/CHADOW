<?php

require_once __DIR__ . '/clan_reserve_helpers.php';
require_once __DIR__ . '/wg_openid_client.php';

class ClanReserveService
{
    private $db;

    public function __construct($db)
    {
        $this->db = $db;
        ensure_clan_reserves_tables($db);
    }

    public function fetchClanReserves(string $accessToken, string $realm, string $lang = 'ru'): array
    {
        $realm = clan_reserve_realm_for_provider('wg', $realm);
        $appId = game_api_application_id_for_realm($realm, $this->db);
        if ($appId === '') {
            return ['ok' => false, 'error' => 'application_id missing'];
        }

        $apiBase = WgOpenIdClient::apiBaseForRealm($realm);
        $url = $apiBase . '/wot/stronghold/clanreserves/?' . http_build_query([
            'application_id' => $appId,
            'access_token' => $accessToken,
            'language' => clan_reserve_api_language($realm, $lang),
        ]);

        $response = $this->httpGet($url);
        if (!$response['ok']) {
            return $response;
        }

        $data = $response['data'];
        if (!is_array($data) || ($data['status'] ?? '') !== 'ok') {
            $message = is_array($data['error'] ?? null)
                ? (string) ($data['error']['message'] ?? 'api_error')
                : (string) ($data['status'] ?? 'api_error');

            return ['ok' => false, 'error' => $message, 'code' => (int) ($data['error']['code'] ?? 0)];
        }

        $items = is_array($data['data'] ?? null) ? $data['data'] : [];

        return [
            'ok' => true,
            'items' => $this->normalizeCatalog($items),
            'raw' => $items,
        ];
    }

    public function fetchClanProfileForUser(
        string $provider,
        string $realm,
        int $accountId,
        ?string $accessToken = null
    ): array {
        $provider = clan_reserve_normalize_provider($provider);
        $realm = clan_reserve_realm_for_provider($provider, $realm);
        $appId = game_api_application_id_for_realm($realm, $this->db);
        if ($appId === '' || $accountId <= 0) {
            return ['ok' => false, 'error' => 'invalid_request'];
        }

        $batch = $this->fetchClanProfilesByAccountIds($provider, $realm, [$accountId]);
        $profile = $batch[$accountId] ?? null;
        if (!is_array($profile)) {
            return ['ok' => false, 'error' => 'clan_fetch_failed'];
        }
        if (!empty($profile['no_clan'])) {
            return ['ok' => false, 'error' => 'no_clan'];
        }
        if (empty($profile['ok'])) {
            return ['ok' => false, 'error' => (string) ($profile['error'] ?? 'clan_fetch_failed')];
        }

        return [
            'ok' => true,
            'clan_id' => (int) ($profile['clan_id'] ?? 0),
            'tag' => (string) ($profile['tag'] ?? ''),
            'name' => (string) ($profile['name'] ?? ''),
            'emblem_url' => (string) ($profile['emblem_url'] ?? ''),
        ];
    }

    public function fetchClanProfilesForLinks(int $userId, array $linkIds, bool $forceRefresh = false): array {
        $linkIds = array_values(array_unique(array_filter(array_map('intval', $linkIds), static fn(int $id): bool => $id > 0)));
        if ($userId <= 0 || $linkIds === []) {
            return [];
        }

        $cached = clan_reserve_get_clan_cache_batch($this->db, $userId, $linkIds);
        $results = [];
        $pending = [];

        foreach ($linkIds as $linkId) {
            $cache = $cached[$linkId] ?? null;
            if (!$forceRefresh && is_array($cache) && !clan_reserve_clan_cache_is_stale($cache)) {
                $results[$linkId] = $this->formatLinkClanResult($linkId, $cache);
                continue;
            }

            $row = clan_reserve_fetch_token_by_id($this->db, $userId, $linkId);
            if (!is_array($row)) {
                $results[$linkId] = ['ok' => false, 'error' => 'token_missing'];
                continue;
            }

            $tokenState = clan_reserve_token_status_light($row);
            if (empty($tokenState['token_ok'])) {
                $results[$linkId] = ['ok' => false, 'error' => 'token_expired'];
                continue;
            }

            $provider = clan_reserve_normalize_provider((string) ($row['provider'] ?? 'wg'));
            $realm = clan_reserve_realm_for_provider($provider, (string) ($row['realm'] ?? 'eu'));
            $accountId = (int) ($row['account_id'] ?? 0);
            if ($accountId <= 0) {
                $results[$linkId] = ['ok' => false, 'error' => 'invalid_request'];
                continue;
            }

            $groupKey = $provider . ':' . $realm;
            if (!isset($pending[$groupKey])) {
                $pending[$groupKey] = [
                    'provider' => $provider,
                    'realm' => $realm,
                    'links' => [],
                ];
            }

            $pending[$groupKey]['links'][] = [
                'link_id' => $linkId,
                'account_id' => $accountId,
                'nickname' => trim((string) ($row['nickname'] ?? '')),
                'access_token' => clan_reserve_decrypt_token((string) ($row['access_token_enc'] ?? ''), $this->db) ?? '',
            ];
        }

        foreach ($pending as $group) {
            $accountIds = array_values(array_unique(array_map(
                static fn(array $link): int => (int) ($link['account_id'] ?? 0),
                $group['links']
            )));
            $authByAccountId = [];
            foreach ($group['links'] as $link) {
                $accountId = (int) ($link['account_id'] ?? 0);
                $accessToken = trim((string) ($link['access_token'] ?? ''));
                if ($accountId > 0 && $accessToken !== '') {
                    $authByAccountId[$accountId] = $accessToken;
                }
            }
            $profiles = $this->fetchClanProfilesByAccountIds(
                (string) $group['provider'],
                (string) $group['realm'],
                $accountIds,
                $authByAccountId
            );

            foreach ($group['links'] as $link) {
                $linkId = (int) ($link['link_id'] ?? 0);
                $accountId = (int) ($link['account_id'] ?? 0);
                $nickname = trim((string) ($link['nickname'] ?? ''));
                $profile = $profiles[$accountId] ?? null;

                if (!is_array($profile)) {
                    $results[$linkId] = ['ok' => false, 'error' => 'clan_fetch_failed'];
                    continue;
                }

                if (!empty($profile['no_clan'])) {
                    if (!empty($profile['auth_checked'])) {
                        clan_reserve_save_clan_cache($this->db, $userId, $linkId, [
                            'nickname' => $nickname,
                            'no_clan' => true,
                        ]);
                    }
                    $results[$linkId] = [
                        'ok' => true,
                        'link_id' => $linkId,
                        'clan' => null,
                        'no_clan' => true,
                        'nickname' => $nickname,
                    ];
                    continue;
                }

                if (empty($profile['ok'])) {
                    $results[$linkId] = [
                        'ok' => false,
                        'error' => (string) ($profile['error'] ?? 'clan_fetch_failed'),
                        'nickname' => $nickname,
                    ];
                    continue;
                }

                clan_reserve_save_clan_cache($this->db, $userId, $linkId, [
                    'nickname' => $nickname,
                    'clan_id' => (int) ($profile['clan_id'] ?? 0),
                    'tag' => (string) ($profile['tag'] ?? ''),
                    'name' => (string) ($profile['name'] ?? ''),
                    'emblem_url' => (string) ($profile['emblem_url'] ?? ''),
                    'no_clan' => false,
                ]);

                $results[$linkId] = [
                    'ok' => true,
                    'link_id' => $linkId,
                    'clan' => [
                        'tag' => (string) ($profile['tag'] ?? ''),
                        'name' => (string) ($profile['name'] ?? ''),
                        'emblem_url' => (string) ($profile['emblem_url'] ?? ''),
                    ],
                    'no_clan' => false,
                    'nickname' => $nickname,
                ];
            }
        }

        return $results;
    }

    private function formatLinkClanResult(int $linkId, array $cache): array {
        if (!empty($cache['no_clan'])) {
            return [
                'ok' => true,
                'link_id' => $linkId,
                'clan' => null,
                'no_clan' => true,
                'nickname' => trim((string) ($cache['nickname'] ?? '')),
                'cached' => true,
            ];
        }

        return [
            'ok' => true,
            'link_id' => $linkId,
            'clan' => [
                'tag' => (string) ($cache['tag'] ?? ''),
                'name' => (string) ($cache['name'] ?? ''),
                'emblem_url' => (string) ($cache['emblem_url'] ?? ''),
            ],
            'no_clan' => false,
            'nickname' => trim((string) ($cache['nickname'] ?? '')),
            'cached' => true,
        ];
    }

    private function fetchClanProfilesByAccountIds(
        string $provider,
        string $realm,
        array $accountIds,
        array $authByAccountId = []
    ): array {
        $provider = clan_reserve_normalize_provider($provider);
        $realm = clan_reserve_realm_for_provider($provider, $realm);
        $accountIds = array_values(array_unique(array_filter(array_map('intval', $accountIds), static fn(int $id): bool => $id > 0)));
        if ($accountIds === []) {
            return [];
        }

        $appId = game_api_application_id_for_realm($realm, $this->db);
        if ($appId === '') {
            return array_fill_keys($accountIds, ['ok' => false, 'error' => 'application_id missing']);
        }

        $apiBase = WgOpenIdClient::apiBaseForRealm($realm);
        $clanIdsByAccount = [];
        $authChecked = [];

        if ($authByAccountId !== []) {
            $authClanIds = $this->fetchClanIdsWithAuth($apiBase, $appId, $authByAccountId);
            foreach ($accountIds as $accountId) {
                if (!array_key_exists($accountId, $authClanIds)) {
                    continue;
                }

                $clanIdsByAccount[$accountId] = $authClanIds[$accountId];
                if ($authClanIds[$accountId] !== null) {
                    $authChecked[$accountId] = true;
                }
            }
        }

        $needsPublicLookup = [];
        foreach ($accountIds as $accountId) {
            if (!empty($authChecked[$accountId])) {
                continue;
            }
            $needsPublicLookup[] = $accountId;
        }

        if ($needsPublicLookup !== []) {
            $accountResponse = $this->httpGet($this->buildWgApiUrl($apiBase . '/wot/account/info/', [
                'application_id' => $appId,
                'fields' => 'clan_id',
            ], $needsPublicLookup));
            if (!$accountResponse['ok']) {
                foreach ($needsPublicLookup as $accountId) {
                    if (!isset($clanIdsByAccount[$accountId])) {
                        $clanIdsByAccount[$accountId] = null;
                    }
                }
            } else {
                foreach ($needsPublicLookup as $accountId) {
                    $clanIdsByAccount[$accountId] = $this->extractClanIdFromAccountResponse(
                        $accountResponse['data'] ?? null,
                        $accountId
                    );
                }
            }
        }

        $uniqueClanIds = [];
        foreach ($accountIds as $accountId) {
            $clanId = $clanIdsByAccount[$accountId] ?? null;
            if ($clanId === null) {
                continue;
            }
            if ((int) $clanId > 0) {
                $uniqueClanIds[(int) $clanId] = (int) $clanId;
            }
        }

        $clansById = [];
        if ($uniqueClanIds !== []) {
            $clanResponse = $this->httpGet($this->buildWgApiUrl($apiBase . '/wot/clans/info/', [
                'application_id' => $appId,
                'fields' => 'name,tag,emblems',
            ], array_values($uniqueClanIds), 'clan_id'));
            if (!$clanResponse['ok']) {
                return array_fill_keys($accountIds, ['ok' => false, 'error' => 'clan_info_failed']);
            }

            foreach ($uniqueClanIds as $clanId) {
                $clan = $this->extractClanFromInfoResponse($clanResponse['data'] ?? null, $clanId);
                if ($clan !== null) {
                    $clansById[$clanId] = $clan;
                }
            }
        }

        $results = [];
        foreach ($accountIds as $accountId) {
            if (!array_key_exists($accountId, $clanIdsByAccount)) {
                $results[$accountId] = ['ok' => false, 'error' => 'account_info_failed'];
                continue;
            }

            $clanIdValue = $clanIdsByAccount[$accountId];
            if ($clanIdValue === null) {
                $results[$accountId] = ['ok' => false, 'error' => 'account_info_failed'];
                continue;
            }

            $clanId = (int) $clanIdValue;
            if ($clanId <= 0) {
                $results[$accountId] = [
                    'ok' => false,
                    'no_clan' => !empty($authChecked[$accountId]),
                    'auth_checked' => !empty($authChecked[$accountId]),
                    'error' => 'no_clan',
                ];
                continue;
            }

            $clan = $clansById[$clanId] ?? null;
            if ($clan === null) {
                $results[$accountId] = ['ok' => false, 'error' => 'clan_info_failed'];
                continue;
            }

            $results[$accountId] = [
                'ok' => true,
                'clan_id' => $clanId,
                'tag' => (string) ($clan['tag'] ?? ''),
                'name' => (string) ($clan['name'] ?? ''),
                'emblem_url' => (string) ($clan['emblem_url'] ?? ''),
            ];
        }

        return $results;
    }

    private function fetchClanIdsWithAuth(string $apiBase, string $appId, array $authByAccountId): array {
        $urls = [];
        foreach ($authByAccountId as $accountId => $accessToken) {
            $accountId = (int) $accountId;
            $accessToken = trim((string) $accessToken);
            if ($accountId <= 0 || $accessToken === '') {
                continue;
            }

            $urls[$accountId] = $apiBase . '/wot/account/info/?' . http_build_query([
                'application_id' => $appId,
                'access_token' => $accessToken,
                'account_id' => $accountId,
                'fields' => 'clan_id',
            ]);
        }

        if ($urls === []) {
            return [];
        }

        $responses = $this->httpGetMulti($urls);
        $clanIds = [];
        foreach ($urls as $accountId => $_url) {
            $response = $responses[$accountId] ?? ['ok' => false];
            if (empty($response['ok'])) {
                $clanIds[$accountId] = null;
                continue;
            }

            $clanIds[$accountId] = $this->extractClanIdFromAccountResponse($response['data'] ?? null, $accountId);
        }

        return $clanIds;
    }

    private function buildWgApiUrl(string $endpoint, array $query, array $ids, string $idKey = 'account_id'): string {
        $parts = [http_build_query($query)];
        foreach ($ids as $id) {
            $parts[] = rawurlencode($idKey) . '=' . (int) $id;
        }

        return rtrim($endpoint, '/?') . '/?' . implode('&', $parts);
    }

    public function activateReserve(
        string $accessToken,
        string $realm,
        string $reserveType,
        int $reserveLevel,
        string $lang = 'ru'
    ): array {
        $realm = clan_reserve_realm_for_provider('wg', $realm);
        $appId = game_api_application_id_for_realm($realm, $this->db);
        if ($appId === '') {
            return ['ok' => false, 'error' => 'application_id missing'];
        }

        $apiBase = WgOpenIdClient::apiBaseForRealm($realm);
        $url = $apiBase . '/wot/stronghold/activateclanreserve/?' . http_build_query([
            'application_id' => $appId,
            'access_token' => $accessToken,
            'reserve_type' => $reserveType,
            'reserve_level' => max(1, min(10, $reserveLevel)),
            'language' => clan_reserve_api_language($realm, $lang),
        ]);

        $response = $this->httpGet($url);
        if (!$response['ok']) {
            return $response;
        }

        $data = $response['data'];
        if (!is_array($data) || ($data['status'] ?? '') !== 'ok') {
            $message = is_array($data['error'] ?? null)
                ? (string) ($data['error']['message'] ?? 'activation_failed')
                : (string) ($data['status'] ?? 'activation_failed');
            $code = is_array($data['error'] ?? null) ? (int) ($data['error']['code'] ?? 0) : 0;

            return ['ok' => false, 'error' => $message, 'code' => $code];
        }

        $payload = is_array($data['data'] ?? null) ? $data['data'] : [];

        return [
            'ok' => true,
            'activated_at' => $payload['activated_at'] ?? null,
        ];
    }

    public function activateForUser(
        int $userId,
        int $linkId,
        string $reserveType,
        int $reserveLevel,
        string $triggerType,
        ?int $ruleId,
        string $lang = 'ru'
    ): array {
        $tokenResult = clan_reserve_get_valid_token($this->db, $userId, $linkId);
        if (!$tokenResult['ok']) {
            return $tokenResult;
        }

        $provider = (string) ($tokenResult['provider'] ?? 'wg');
        $realm = (string) ($tokenResult['realm'] ?? 'eu');

        $result = $this->activateReserve(
            (string) $tokenResult['access_token'],
            $realm,
            $reserveType,
            $reserveLevel,
            $lang
        );

        $status = $result['ok'] ? 'success' : 'error';
        clan_reserve_log_activation(
            $this->db,
            $userId,
            $ruleId,
            $provider,
            $realm,
            $reserveType,
            $reserveLevel,
            $triggerType,
            $status,
            $result['ok'] ? null : (string) ($result['error'] ?? 'error'),
            $result['ok'] ? (string) ($result['activated_at'] ?? gmdate('Y-m-d H:i:s')) : null
        );

        if ($ruleId !== null && $ruleId > 0) {
            $this->db->update(
                'UPDATE clan_reserve_rules SET last_run_at = NOW(), last_status = ?, last_error = ? WHERE id = ? AND user_id = ?',
                [
                    $status,
                    $result['ok'] ? null : mb_substr((string) ($result['error'] ?? ''), 0, 512),
                    $ruleId,
                    $userId,
                ]
            );
        }

        return $result;
    }

    public function evaluateRuleDue(array $rule, DateTimeInterface $now): bool {
        if ((int) ($rule['enabled'] ?? 0) !== 1) {
            return false;
        }

        $tzName = (string) ($rule['timezone'] ?? 'Europe/Moscow');
        try {
            $tz = new DateTimeZone($tzName);
        } catch (Throwable $e) {
            $tz = new DateTimeZone('Europe/Moscow');
        }

        $local = DateTimeImmutable::createFromInterface($now)->setTimezone($tz);
        $dow = (int) $local->format('N') - 1;
        $dayBit = 1 << $dow;
        if (((int) ($rule['days_mask'] ?? 0) & $dayBit) === 0) {
            return false;
        }

        $timeLocal = substr((string) ($rule['time_local'] ?? '00:00:00'), 0, 5);
        $parts = explode(':', $timeLocal);
        $targetHour = (int) ($parts[0] ?? 0);
        $targetMinute = (int) ($parts[1] ?? 0);
        $currentMinutes = ((int) $local->format('H')) * 60 + (int) $local->format('i');
        $targetMinutes = $targetHour * 60 + $targetMinute;
        if (abs($currentMinutes - $targetMinutes) > 5) {
            return false;
        }

        $lastRunAt = $rule['last_run_at'] ?? null;
        if ($lastRunAt !== null && $lastRunAt !== '') {
            try {
                $lastRun = new DateTimeImmutable((string) $lastRunAt, $tz);
                if ($lastRun->format('Y-m-d H:i') === $local->format('Y-m-d H:i')) {
                    return false;
                }
            } catch (Throwable $e) {
            }
        }

        return true;
    }

    public function runDueRules(?DateTimeInterface $now = null): array {
        $now = $now ?? new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $rows = $this->db->fetchAll(
            'SELECT * FROM clan_reserve_rules WHERE enabled = 1 ORDER BY id ASC'
        );
        $summary = ['checked' => 0, 'triggered' => 0, 'success' => 0, 'errors' => []];

        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $summary['checked'] += 1;
            if (!$this->evaluateRuleDue($row, $now)) {
                continue;
            }
            $summary['triggered'] += 1;
            $userId = (int) ($row['user_id'] ?? 0);
            $linkId = (int) ($row['link_id'] ?? 0);
            if ($linkId <= 0) {
                $tokenRow = clan_reserve_fetch_token_row(
                    $this->db,
                    $userId,
                    (string) ($row['provider'] ?? 'wg'),
                    (string) ($row['realm'] ?? 'eu')
                );
                $linkId = (int) ($tokenRow['id'] ?? 0);
            }
            if ($linkId <= 0) {
                $summary['errors'][] = [
                    'rule_id' => (int) ($row['id'] ?? 0),
                    'error' => 'link_missing',
                ];
                continue;
            }
            $result = $this->activateForUser(
                $userId,
                (int) ($row['link_id'] ?? 0),
                (string) ($row['reserve_type'] ?? ''),
                (int) ($row['reserve_level'] ?? 0),
                'schedule',
                (int) ($row['id'] ?? 0),
                'ru'
            );
            if ($result['ok']) {
                $summary['success'] += 1;
            } else {
                $summary['errors'][] = [
                    'rule_id' => (int) ($row['id'] ?? 0),
                    'error' => (string) ($result['error'] ?? 'error'),
                ];
            }
        }

        return $summary;
    }

    private function normalizeCatalog(array $items): array {
        $now = time();
        $normalized = [];

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $type = (string) ($item['type'] ?? '');
            if ($type === '') {
                continue;
            }

            $levels = [];
            $stock = is_array($item['in_stock'] ?? null) ? $item['in_stock'] : [];
            foreach ($stock as $levelRow) {
                if (!is_array($levelRow)) {
                    continue;
                }
                $level = (int) ($levelRow['level'] ?? 0);
                if ($level <= 0) {
                    continue;
                }
                $amount = (int) ($levelRow['amount'] ?? 0);
                $activeTill = (int) ($levelRow['active_till'] ?? 0);
                $statusRaw = strtolower((string) ($levelRow['status'] ?? ''));

                if ($activeTill > $now) {
                    $uiStatus = 'active';
                } elseif ($amount > 0 || in_array($statusRaw, ['ready', 'available', 'prepared'], true)) {
                    $uiStatus = 'ready';
                } else {
                    $uiStatus = 'unavailable';
                }

                $levels[] = [
                    'level' => $level,
                    'amount' => $amount,
                    'status' => $uiStatus,
                    'status_raw' => $statusRaw,
                    'activated_at' => $levelRow['activated_at'] ?? null,
                    'active_till' => $activeTill > 0 ? $activeTill : null,
                    'action_time' => $levelRow['action_time'] ?? null,
                    'x_level_only' => !empty($levelRow['x_level_only']),
                ];
            }

            usort($levels, static fn($a, $b) => ($b['level'] <=> $a['level']));

            $normalized[] = [
                'type' => $type,
                'name' => (string) ($item['name'] ?? $type),
                'bonus_type' => (string) ($item['bonus_type'] ?? ''),
                'disposable' => !empty($item['disposable']),
                'icon' => (string) ($item['icon'] ?? ''),
                'levels' => $levels,
            ];
        }

        return $normalized;
    }

    private function extractClanIdFromAccountResponse(mixed $data, int $accountId = 0): int
    {
        if (!is_array($data) || ($data['status'] ?? '') !== 'ok' || !is_array($data['data'] ?? null)) {
            return 0;
        }

        $payload = $data['data'];
        $account = null;
        if ($accountId > 0) {
            $account = $payload[(string) $accountId] ?? $payload[$accountId] ?? null;
        }
        if (!is_array($account)) {
            foreach ($payload as $row) {
                if (is_array($row)) {
                    $account = $row;
                    break;
                }
            }
        }
        if (!is_array($account)) {
            return 0;
        }

        $clanId = max(0, (int) ($account['clan_id'] ?? 0));
        if ($clanId > 0) {
            return $clanId;
        }

        $clan = $account['clan'] ?? null;
        if (is_array($clan)) {
            return max(0, (int) ($clan['clan_id'] ?? ($clan['id'] ?? 0)));
        }

        return 0;
    }

    private function extractClanFromInfoResponse(mixed $data, int $clanId): ?array
    {
        if (!is_array($data) || ($data['status'] ?? '') !== 'ok' || !is_array($data['data'] ?? null)) {
            return null;
        }

        $clan = $data['data'][(string) $clanId] ?? $data['data'][$clanId] ?? null;
        if (!is_array($clan)) {
            return null;
        }

        $tag = trim((string) ($clan['tag'] ?? ''));
        $name = trim((string) ($clan['name'] ?? ''));
        if ($tag === '' && $name === '') {
            return null;
        }

        return [
            'tag' => $tag,
            'name' => $name,
            'emblem_url' => $this->parseClanEmblemUrl($clan),
        ];
    }

    private function parseClanEmblemUrl(array $clan): string
    {
        $emblems = $clan['emblems'] ?? null;
        if (!is_array($emblems)) {
            return '';
        }

        foreach (['x195', 'x256', 'x64', 'x32'] as $size) {
            if (!empty($emblems[$size]['portal']) && is_string($emblems[$size]['portal'])) {
                return trim($emblems[$size]['portal']);
            }
        }

        foreach ($emblems as $entry) {
            if (is_array($entry) && !empty($entry['portal']) && is_string($entry['portal'])) {
                return trim($entry['portal']);
            }
        }

        return '';
    }

    private function httpGet(string $url): array
    {
        if (!function_exists('curl_init')) {
            return ['ok' => false, 'error' => 'cURL unavailable'];
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $raw = curl_exec($ch);
        $errno = curl_errno($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($errno !== 0 || !is_string($raw)) {
            return ['ok' => false, 'error' => 'network_error'];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return ['ok' => false, 'error' => 'invalid_json', 'http_code' => $httpCode];
        }

        if ($httpCode === 409) {
            $message = is_array($decoded['error'] ?? null)
                ? (string) ($decoded['error']['message'] ?? 'conflict')
                : 'conflict';

            return ['ok' => false, 'error' => $message, 'code' => 409, 'data' => $decoded];
        }

        if ($httpCode < 200 || $httpCode >= 300) {
            return ['ok' => false, 'error' => 'http_' . $httpCode, 'http_code' => $httpCode, 'data' => $decoded];
        }

        return ['ok' => true, 'data' => $decoded];
    }

    private function httpGetMulti(array $urls): array
    {
        if ($urls === []) {
            return [];
        }

        if (!function_exists('curl_multi_init')) {
            $results = [];
            foreach ($urls as $key => $url) {
                $results[$key] = $this->httpGet((string) $url);
            }

            return $results;
        }

        $multi = curl_multi_init();
        $handles = [];
        foreach ($urls as $key => $url) {
            $ch = curl_init((string) $url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 12,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_HTTPHEADER => ['Accept: application/json'],
            ]);
            curl_multi_add_handle($multi, $ch);
            $handles[$key] = $ch;
        }

        $running = null;
        do {
            $status = curl_multi_exec($multi, $running);
            if ($running > 0) {
                curl_multi_select($multi, 1.0);
            }
        } while ($running > 0 && $status === CURLM_OK);

        $results = [];
        foreach ($handles as $key => $ch) {
            $raw = curl_multi_getcontent($ch);
            $errno = curl_errno($ch);
            $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_multi_remove_handle($multi, $ch);
            curl_close($ch);

            if ($errno !== 0 || !is_string($raw)) {
                $results[$key] = ['ok' => false, 'error' => 'network_error'];
                continue;
            }

            $decoded = json_decode($raw, true);
            if (!is_array($decoded)) {
                $results[$key] = ['ok' => false, 'error' => 'invalid_json', 'http_code' => $httpCode];
                continue;
            }

            if ($httpCode < 200 || $httpCode >= 300) {
                $results[$key] = ['ok' => false, 'error' => 'http_' . $httpCode, 'http_code' => $httpCode, 'data' => $decoded];
                continue;
            }

            $results[$key] = ['ok' => true, 'data' => $decoded];
        }

        curl_multi_close($multi);

        return $results;
    }
}
