<?php

require_once __DIR__ . '/game_api.php';
require_once __DIR__ . '/user_auth.php';
require_once __DIR__ . '/wg_openid_client.php';
require_once __DIR__ . '/../config/ensure_clan_reserves.php';

function clan_reserve_normalize_provider(string $provider): string {
    $provider = strtolower(trim($provider));

    return $provider === 'lesta' ? 'lesta' : 'wg';
}

function clan_reserve_realm_for_provider(string $provider, string $realm): string {
    $provider = clan_reserve_normalize_provider($provider);
    if ($provider === 'lesta') {
        return 'ru';
    }

    return user_normalize_wg_realm($realm);
}

function clan_reserve_all_slots(): array {
    return [
        ['provider' => 'wg', 'realm' => 'eu'],
        ['provider' => 'wg', 'realm' => 'na'],
        ['provider' => 'wg', 'realm' => 'asia'],
        ['provider' => 'lesta', 'realm' => 'ru'],
    ];
}

function clan_reserve_slot_label(string $provider, string $realm): string {
    if (clan_reserve_normalize_provider($provider) === 'lesta') {
        return 'LESTA';
    }

    return strtoupper(clan_reserve_realm_for_provider($provider, $realm));
}

function clan_reserve_profile_matches_slot(array $profile, string $provider, string $realm): bool {
    $provider = clan_reserve_normalize_provider($provider);
    $realm = clan_reserve_realm_for_provider($provider, $realm);
    if ($provider === 'lesta') {
        return user_lesta_is_linked($profile);
    }

    if (!user_wg_api_is_linked($profile)) {
        return false;
    }

    return user_normalize_wg_realm((string) ($profile['wg_realm'] ?? '')) === $realm;
}

function clan_reserve_profile_nickname_for_slot(array $profile, string $provider, string $realm): string {
    $provider = clan_reserve_normalize_provider($provider);
    if ($provider === 'lesta') {
        return trim((string) ($profile['lesta_nickname'] ?? $profile['wg_nickname'] ?? ''));
    }

    return trim((string) ($profile['wg_nickname'] ?? ''));
}

function clan_reserve_profile_account_for_slot(array $profile, string $provider, string $realm): int {
    $provider = clan_reserve_normalize_provider($provider);
    if ($provider === 'lesta') {
        $accountId = (int) ($profile['lesta_account_id'] ?? 0);
        if ($accountId <= 0 && user_normalize_wg_realm((string) ($profile['wg_realm'] ?? '')) === 'ru') {
            $accountId = (int) ($profile['wg_account_id'] ?? 0);
        }

        return $accountId;
    }

    return (int) ($profile['wg_account_id'] ?? 0);
}

function clan_reserve_fetch_token_row($db, int $userId, string $provider, string $realm, ?int $accountId = null): ?array {
    ensure_clan_reserves_tables($db);
    $provider = clan_reserve_normalize_provider($provider);
    $realm = clan_reserve_realm_for_provider($provider, $realm);
    if ($accountId !== null && $accountId > 0) {
        $row = $db->fetchOne(
            'SELECT id, account_id, nickname, access_token_enc, expires_at, provider, realm
             FROM site_user_game_tokens
             WHERE user_id = ? AND provider = ? AND realm = ? AND account_id = ? LIMIT 1',
            [$userId, $provider, $realm, $accountId]
        );

        return is_array($row) ? $row : null;
    }

    $row = $db->fetchOne(
        'SELECT id, account_id, nickname, access_token_enc, expires_at, provider, realm
         FROM site_user_game_tokens
         WHERE user_id = ? AND provider = ? AND realm = ? ORDER BY id ASC LIMIT 1',
        [$userId, $provider, $realm]
    );

    return is_array($row) ? $row : null;
}

function clan_reserve_fetch_token_by_id($db, int $userId, int $linkId): ?array {
    ensure_clan_reserves_tables($db);
    if ($linkId <= 0) {
        return null;
    }
    $row = $db->fetchOne(
        'SELECT id, user_id, account_id, nickname, access_token_enc, expires_at, provider, realm
         FROM site_user_game_tokens WHERE id = ? AND user_id = ? LIMIT 1',
        [$linkId, $userId]
    );

    return is_array($row) ? $row : null;
}

function clan_reserve_list_token_rows($db, int $userId, string $provider, string $realm): array {
    ensure_clan_reserves_tables($db);
    $provider = clan_reserve_normalize_provider($provider);
    $realm = clan_reserve_realm_for_provider($provider, $realm);
    $rows = $db->fetchAll(
        'SELECT id, account_id, nickname, access_token_enc, expires_at, provider, realm
         FROM site_user_game_tokens
         WHERE user_id = ? AND provider = ? AND realm = ?
         ORDER BY id ASC',
        [$userId, $provider, $realm]
    );

    return is_array($rows) ? $rows : [];
}

function clan_reserve_token_status_light(array $row): array {
    $enc = trim((string) ($row['access_token_enc'] ?? ''));
    if ($enc === '') {
        return ['token_ok' => false, 'needs_relink' => true];
    }

    $expiresAt = (int) ($row['expires_at'] ?? 0);
    $tokenOk = $expiresAt <= 0 || $expiresAt > time();

    return [
        'token_ok' => $tokenOk,
        'needs_relink' => !$tokenOk,
    ];
}

function clan_reserve_format_account_link($db, int $userId, array $row, array $profile = [], bool $validateToken = false): array {
    $provider = clan_reserve_normalize_provider((string) ($row['provider'] ?? 'wg'));
    $realm = clan_reserve_realm_for_provider($provider, (string) ($row['realm'] ?? 'eu'));
    $linkId = (int) ($row['id'] ?? 0);
    $accountId = (int) ($row['account_id'] ?? 0);
    $nickname = trim((string) ($row['nickname'] ?? ''));
    if ($nickname === '' && $accountId > 0) {
        $nickname = '#' . $accountId;
    }

    $tokenOk = false;
    $needsRelink = false;
    if ($linkId > 0) {
        if ($validateToken) {
            $tokenState = clan_reserve_get_valid_token($db, $userId, $linkId);
            $tokenOk = !empty($tokenState['ok']);
            $needsRelink = !$tokenOk && !empty($tokenState['needs_relink']);
        } else {
            $tokenState = clan_reserve_token_status_light($row);
            $tokenOk = !empty($tokenState['token_ok']);
            $needsRelink = !empty($tokenState['needs_relink']);
        }
    }

    return [
        'link_id' => $linkId,
        'provider' => $provider,
        'realm' => $realm,
        'slot_label' => clan_reserve_slot_label($provider, $realm),
        'account_id' => $accountId,
        'nickname' => $nickname,
        'has_token' => true,
        'from_profile' => false,
        'linked' => true,
        'token_ok' => $tokenOk,
        'needs_relink' => $needsRelink,
        'usable' => $tokenOk,
    ];
}

function clan_reserve_user_regions_state($db, int $userId, array $profile): array {
    $regions = [];
    foreach (clan_reserve_all_slots() as $slot) {
        $provider = clan_reserve_normalize_provider($slot['provider']);
        $realm = clan_reserve_realm_for_provider($provider, $slot['realm']);
        $configured = game_api_is_configured_for_realm($realm, $db);
        $rows = clan_reserve_list_token_rows($db, $userId, $provider, $realm);
        $accounts = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $formatted = clan_reserve_format_account_link($db, $userId, $row, $profile);
            $accounts[] = $formatted;
        }

        $regions[] = [
            'provider' => $provider,
            'realm' => $realm,
            'slot_label' => clan_reserve_slot_label($provider, $realm),
            'configured' => $configured,
            'accounts' => $accounts,
        ];
    }

    return $regions;
}

function clan_reserve_user_links_state($db, int $userId, array $profile): array {
    $links = [];
    foreach (clan_reserve_user_regions_state($db, $userId, $profile) as $region) {
        foreach ($region['accounts'] as $account) {
            $links[] = array_merge($account, [
                'configured' => !empty($region['configured']),
            ]);
        }
    }

    return $links;
}

function clan_reserve_api_language(string $realm, string $lang = 'ru'): string {
    $realm = strtolower(trim($realm));
    if ($realm === 'ru') {
        return $lang === 'en' ? 'en' : 'ru';
    }

    $wgLangs = ['en', 'de', 'pl', 'fr', 'es', 'cs', 'tr'];

    return in_array($lang, $wgLangs, true) ? $lang : 'en';
}

function clan_reserve_encryption_key($db): ?string {
    $raw = getenv('GAME_TOKEN_ENC_KEY');
    if (is_string($raw) && trim($raw) !== '') {
        $key = base64_decode(trim($raw), true);
        if ($key !== false && strlen($key) === 32) {
            return $key;
        }
    }

    $seed = game_api_wg_application_id($db) . '|' . game_api_lesta_application_id($db) . '|chadow-reserve-tokens-v1';
    if ($seed === '|chadow-reserve-tokens-v1') {
        return null;
    }

    return hash('sha256', $seed, true);
}

function clan_reserve_encrypt_token(string $plain, $db): ?string {
    $key = clan_reserve_encryption_key($db);
    if ($key === null || $plain === '') {
        return null;
    }
    $iv = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    if ($cipher === false) {
        return null;
    }

    return base64_encode($iv . $tag . $cipher);
}

function clan_reserve_decrypt_token(string $encoded, $db): ?string {
    $key = clan_reserve_encryption_key($db);
    if ($key === null || $encoded === '') {
        return null;
    }
    $raw = base64_decode($encoded, true);
    if ($raw === false || strlen($raw) < 29) {
        return null;
    }
    $iv = substr($raw, 0, 12);
    $tag = substr($raw, 12, 16);
    $cipher = substr($raw, 28);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);

    return is_string($plain) && $plain !== '' ? $plain : null;
}

function clan_reserve_user_link_context(array $profile): ?array {
    if (user_lesta_is_linked($profile)) {
        $accountId = (int) ($profile['lesta_account_id'] ?? 0);
        if ($accountId <= 0 && user_normalize_wg_realm((string) ($profile['wg_realm'] ?? '')) === 'ru') {
            $accountId = (int) ($profile['wg_account_id'] ?? 0);
        }

        return [
            'provider' => 'lesta',
            'realm' => 'ru',
            'account_id' => $accountId,
            'nickname' => trim((string) ($profile['lesta_nickname'] ?? $profile['wg_nickname'] ?? '')),
            'linked' => $accountId > 0,
        ];
    }

    if (user_wg_api_is_linked($profile)) {
        $realm = user_normalize_wg_realm((string) ($profile['wg_realm'] ?? ''));

        return [
            'provider' => 'wg',
            'realm' => $realm,
            'account_id' => (int) ($profile['wg_account_id'] ?? 0),
            'nickname' => trim((string) ($profile['wg_nickname'] ?? '')),
            'linked' => true,
        ];
    }

    return null;
}

function clan_reserve_save_user_token(
    $db,
    int $userId,
    string $provider,
    string $realm,
    int $accountId,
    string $accessToken,
    int $expiresAt,
    ?string $nickname = null
): int {
    ensure_clan_reserves_tables($db);
    $provider = clan_reserve_normalize_provider($provider);
    $realm = clan_reserve_realm_for_provider($provider, $realm);
    $encrypted = clan_reserve_encrypt_token(trim($accessToken), $db);
    if ($encrypted === null) {
        return 0;
    }
    $nickname = $nickname !== null ? trim($nickname) : null;
    if ($nickname === '') {
        $nickname = null;
    }

    $existing = $db->fetchOne(
        'SELECT id FROM site_user_game_tokens
         WHERE user_id = ? AND provider = ? AND realm = ? AND account_id = ? LIMIT 1',
        [$userId, $provider, $realm, $accountId]
    );

    if (is_array($existing)) {
        $linkId = (int) ($existing['id'] ?? 0);
        if ($nickname !== null) {
            $db->update(
                'UPDATE site_user_game_tokens
                 SET nickname = ?, access_token_enc = ?, expires_at = ?
                 WHERE id = ? AND user_id = ?',
                [$nickname, $encrypted, max(0, $expiresAt), $linkId, $userId]
            );
        } else {
            $db->update(
                'UPDATE site_user_game_tokens
                 SET access_token_enc = ?, expires_at = ?
                 WHERE id = ? AND user_id = ?',
                [$encrypted, max(0, $expiresAt), $linkId, $userId]
            );
        }

        clan_reserve_delete_clan_cache($db, $linkId, $userId);

        return $linkId;
    }

    return (int) $db->insert(
        'INSERT INTO site_user_game_tokens (user_id, provider, realm, account_id, nickname, access_token_enc, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)',
        [$userId, $provider, $realm, $accountId, $nickname, $encrypted, max(0, $expiresAt)]
    );
}

function clan_reserve_delete_user_token($db, int $userId, string $provider, string $realm, ?int $accountId = null): void {
    ensure_clan_reserves_tables($db);
    $provider = clan_reserve_normalize_provider($provider);
    $realm = clan_reserve_realm_for_provider($provider, $realm);
    if ($accountId !== null && $accountId > 0) {
        $db->update(
            'DELETE FROM site_user_game_tokens WHERE user_id = ? AND provider = ? AND realm = ? AND account_id = ?',
            [$userId, $provider, $realm, $accountId]
        );

        return;
    }
    $db->update(
        'DELETE FROM site_user_game_tokens WHERE user_id = ? AND provider = ? AND realm = ?',
        [$userId, $provider, $realm]
    );
}

function clan_reserve_delete_user_token_by_id($db, int $userId, int $linkId): void {
    ensure_clan_reserves_tables($db);
    if ($linkId <= 0) {
        return;
    }
    clan_reserve_delete_clan_cache($db, $linkId, $userId);
    $db->update(
        'DELETE FROM site_user_game_tokens WHERE id = ? AND user_id = ?',
        [$linkId, $userId]
    );
}

function clan_reserve_clan_cache_ttl(): int {
    return 600;
}

function clan_reserve_format_clan_cache_row(?array $row): ?array {
    if (!is_array($row)) {
        return null;
    }

    $fetchedAt = strtotime((string) ($row['fetched_at'] ?? ''));
    if ($fetchedAt <= 0) {
        $fetchedAt = time();
    }

    return [
        'link_id' => (int) ($row['link_id'] ?? 0),
        'nickname' => trim((string) ($row['nickname'] ?? '')),
        'clan_id' => max(0, (int) ($row['clan_id'] ?? 0)),
        'tag' => trim((string) ($row['tag'] ?? '')),
        'name' => trim((string) ($row['name'] ?? '')),
        'emblem_url' => trim((string) ($row['emblem_url'] ?? '')),
        'no_clan' => (int) ($row['no_clan'] ?? 0) === 1,
        'fetched_at' => $fetchedAt,
    ];
}

function clan_reserve_clan_cache_is_stale(array $cache): bool {
    if (!empty($cache['no_clan'])) {
        return true;
    }

    $fetchedAt = (int) ($cache['fetched_at'] ?? 0);
    if ($fetchedAt <= 0) {
        return true;
    }

    return (time() - $fetchedAt) >= clan_reserve_clan_cache_ttl();
}

function clan_reserve_get_clan_cache($db, int $userId, int $linkId): ?array {
    ensure_clan_reserves_tables($db);
    if ($userId <= 0 || $linkId <= 0) {
        return null;
    }

    $row = $db->fetchOne(
        'SELECT link_id, nickname, clan_id, tag, name, emblem_url, no_clan, fetched_at
         FROM clan_reserve_clan_cache
         WHERE link_id = ? AND user_id = ?
         LIMIT 1',
        [$linkId, $userId]
    );

    return clan_reserve_format_clan_cache_row(is_array($row) ? $row : null);
}

function clan_reserve_get_clan_cache_batch($db, int $userId, array $linkIds): array {
    ensure_clan_reserves_tables($db);
    if ($userId <= 0 || $linkIds === []) {
        return [];
    }

    $ids = array_values(array_unique(array_filter(array_map('intval', $linkIds), static fn(int $id): bool => $id > 0)));
    if ($ids === []) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $params = array_merge($ids, [$userId]);
    $rows = $db->fetchAll(
        "SELECT link_id, nickname, clan_id, tag, name, emblem_url, no_clan, fetched_at
         FROM clan_reserve_clan_cache
         WHERE link_id IN ({$placeholders}) AND user_id = ?",
        $params
    );

    $cache = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $formatted = clan_reserve_format_clan_cache_row($row);
        if ($formatted !== null && $formatted['link_id'] > 0) {
            $cache[$formatted['link_id']] = $formatted;
        }
    }

    return $cache;
}

function clan_reserve_save_clan_cache($db, int $userId, int $linkId, array $data): void {
    ensure_clan_reserves_tables($db);
    if ($userId <= 0 || $linkId <= 0) {
        return;
    }

    $noClan = !empty($data['no_clan']) ? 1 : 0;
    $clanId = max(0, (int) ($data['clan_id'] ?? 0));
    $nickname = trim((string) ($data['nickname'] ?? ''));
    $tag = trim((string) ($data['tag'] ?? ''));
    $name = trim((string) ($data['name'] ?? ''));
    $emblemUrl = trim((string) ($data['emblem_url'] ?? ''));
    if ($noClan) {
        $clanId = 0;
        $tag = '';
        $name = '';
        $emblemUrl = '';
    }

    $db->insert(
        'INSERT INTO clan_reserve_clan_cache
         (link_id, user_id, nickname, clan_id, tag, name, emblem_url, no_clan, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
            nickname = VALUES(nickname),
            clan_id = VALUES(clan_id),
            tag = VALUES(tag),
            name = VALUES(name),
            emblem_url = VALUES(emblem_url),
            no_clan = VALUES(no_clan),
            fetched_at = NOW()',
        [
            $linkId,
            $userId,
            $nickname !== '' ? $nickname : null,
            $clanId > 0 ? $clanId : null,
            $tag !== '' ? $tag : null,
            $name !== '' ? $name : null,
            $emblemUrl !== '' ? $emblemUrl : null,
            $noClan,
        ]
    );
}

function clan_reserve_delete_clan_cache($db, int $linkId, ?int $userId = null): void {
    ensure_clan_reserves_tables($db);
    if ($linkId <= 0) {
        return;
    }

    if ($userId !== null && $userId > 0) {
        $db->update(
            'DELETE FROM clan_reserve_clan_cache WHERE link_id = ? AND user_id = ?',
            [$linkId, $userId]
        );

        return;
    }

    $db->update('DELETE FROM clan_reserve_clan_cache WHERE link_id = ?', [$linkId]);
}

function clan_reserve_delete_user_tokens($db, int $userId, ?string $provider = null): void {
    ensure_clan_reserves_tables($db);
    if ($provider !== null) {
        $db->update(
            'DELETE FROM site_user_game_tokens WHERE user_id = ? AND provider = ?',
            [$userId, clan_reserve_normalize_provider($provider)]
        );

        return;
    }
    $db->update('DELETE FROM site_user_game_tokens WHERE user_id = ?', [$userId]);
}

function clan_reserve_get_valid_token($db, int $userId, int $linkId): array {
    ensure_clan_reserves_tables($db);
    if ($linkId <= 0) {
        return ['ok' => false, 'needs_relink' => true, 'error' => 'token_missing'];
    }

    $row = clan_reserve_fetch_token_by_id($db, $userId, $linkId);
    if (!is_array($row)) {
        return ['ok' => false, 'needs_relink' => true, 'error' => 'token_missing'];
    }

    $provider = clan_reserve_normalize_provider((string) ($row['provider'] ?? 'wg'));
    $realm = clan_reserve_realm_for_provider($provider, (string) ($row['realm'] ?? 'eu'));

    $accessToken = clan_reserve_decrypt_token((string) ($row['access_token_enc'] ?? ''), $db);
    if ($accessToken === null) {
        return ['ok' => false, 'needs_relink' => true, 'error' => 'token_decrypt_failed'];
    }

    $client = new WgOpenIdClient($db);
    $expiresAt = (int) ($row['expires_at'] ?? 0);
    if ($expiresAt > 0 && $expiresAt < time() + 3600) {
        $prolong = $client->prolongateToken($accessToken, $realm);
        if (!$prolong['ok']) {
            return ['ok' => false, 'needs_relink' => true, 'error' => (string) ($prolong['error'] ?? 'prolongate_failed')];
        }
        $accessToken = (string) ($prolong['access_token'] ?? $accessToken);
        $expiresAt = (int) ($prolong['expires_at'] ?? $expiresAt);
        clan_reserve_save_user_token(
            $db,
            $userId,
            $provider,
            $realm,
            (int) ($row['account_id'] ?? 0),
            $accessToken,
            $expiresAt,
            trim((string) ($row['nickname'] ?? '')) ?: null
        );
    }

    return [
        'ok' => true,
        'link_id' => $linkId,
        'access_token' => $accessToken,
        'account_id' => (int) ($row['account_id'] ?? 0),
        'expires_at' => $expiresAt,
        'provider' => $provider,
        'realm' => $realm,
        'nickname' => trim((string) ($row['nickname'] ?? '')),
    ];
}

function clan_reserve_enabled_realms($db): array {
    $realms = [];
    foreach (['eu', 'na', 'asia', 'ru'] as $realm) {
        if (game_api_is_configured_for_realm($realm, $db)) {
            $realms[] = $realm;
        }
    }

    return $realms;
}

function clan_reserve_find_usable_link(array $links): ?array {
    foreach ($links as $link) {
        if (!empty($link['usable'])) {
            return $link;
        }
    }

    return null;
}

function clan_reserve_find_link(array $links, string $provider, string $realm, ?int $linkId = null): ?array {
    if ($linkId !== null && $linkId > 0) {
        foreach ($links as $link) {
            if ((int) ($link['link_id'] ?? 0) === $linkId) {
                return $link;
            }
        }

        return null;
    }

    $provider = clan_reserve_normalize_provider($provider);
    $realm = clan_reserve_realm_for_provider($provider, $realm);
    foreach ($links as $link) {
        if (($link['provider'] ?? '') === $provider && ($link['realm'] ?? '') === $realm && !empty($link['usable'])) {
            return $link;
        }
    }

    return null;
}

function clan_reserve_find_link_by_id(array $links, int $linkId): ?array {
    foreach ($links as $link) {
        if ((int) ($link['link_id'] ?? 0) === $linkId) {
            return $link;
        }
    }

    return null;
}

function clan_reserve_log_activation(
    $db,
    int $userId,
    ?int $ruleId,
    string $provider,
    string $realm,
    string $reserveType,
    int $reserveLevel,
    string $triggerType,
    string $status,
    ?string $errorMessage = null,
    ?string $activatedAt = null
): void {
    ensure_clan_reserves_tables($db);
    $db->insert(
        'INSERT INTO clan_reserve_activation_log
         (user_id, rule_id, provider, realm, reserve_type, reserve_level, trigger_type, status, error_message, activated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $userId,
            $ruleId,
            clan_reserve_normalize_provider($provider),
            clan_reserve_realm_for_provider($provider, $realm),
            $reserveType,
            max(1, min(10, $reserveLevel)),
            $triggerType === 'schedule' ? 'schedule' : 'manual',
            $status,
            $errorMessage !== null ? mb_substr($errorMessage, 0, 512) : null,
            $activatedAt,
        ]
    );
}

function clan_reserve_format_rule_row(array $row): array {
    return [
        'id' => (int) ($row['id'] ?? 0),
        'link_id' => (int) ($row['link_id'] ?? 0),
        'provider' => (string) ($row['provider'] ?? 'wg'),
        'realm' => (string) ($row['realm'] ?? 'eu'),
        'reserve_type' => (string) ($row['reserve_type'] ?? ''),
        'reserve_level' => (int) ($row['reserve_level'] ?? 0),
        'time_local' => substr((string) ($row['time_local'] ?? '00:00:00'), 0, 5),
        'days_mask' => (int) ($row['days_mask'] ?? 127),
        'timezone' => (string) ($row['timezone'] ?? 'Europe/Moscow'),
        'enabled' => (int) ($row['enabled'] ?? 0) === 1,
        'last_run_at' => $row['last_run_at'] ?? null,
        'last_status' => $row['last_status'] ?? null,
        'last_error' => $row['last_error'] ?? null,
    ];
}

function clan_reserve_days_from_mask(int $mask): array {
    $days = [];
    $labels = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    foreach ($labels as $i => $key) {
        if (($mask & (1 << $i)) !== 0) {
            $days[] = $key;
        }
    }

    return $days;
}

function clan_reserve_mask_from_days(array $days): int {
    $map = ['mon' => 0, 'tue' => 1, 'wed' => 2, 'thu' => 3, 'fri' => 4, 'sat' => 5, 'sun' => 6];
    $mask = 0;
    foreach ($days as $day) {
        $day = strtolower(trim((string) $day));
        if (isset($map[$day])) {
            $mask |= (1 << $map[$day]);
        }
    }

    return $mask > 0 ? $mask : 127;
}
