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
         WHERE user_id = ? AND provider = ? AND realm = ? ORDER BY id DESC LIMIT 1',
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
        'SELECT id, user_id, account_id, nickname, access_token_enc, application_id, expires_at, provider, realm
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
    require_once __DIR__ . '/tanki_client.php';
    $realm = TankiClient::normalizeRealm($realm);
    $lang = strtolower(trim($lang));

    if ($realm === TankiClient::REALM_RU) {
        return $lang === 'en' ? 'en' : 'ru';
    }

    if ($lang === 'en') {
        return 'en';
    }

    $wgLangs = ['de', 'pl', 'fr', 'es', 'cs', 'tr'];

    return in_array($lang, $wgLangs, true) ? $lang : 'en';
}

function clan_reserve_legacy_key_from_app_ids(string $wg, string $lesta): ?string {
    $seed = $wg . '|' . $lesta . '|chadow-reserve-tokens-v1';
    if ($seed === '|chadow-reserve-tokens-v1') {
        return null;
    }

    return hash('sha256', $seed, true);
}

function clan_reserve_legacy_key_db_only($db): ?string {
    ensure_site_settings_table($db);
    $wg = trim((string) get_site_setting($db, 'wg_application_id', ''));
    $lesta = trim((string) get_site_setting($db, 'lesta_application_id', ''));

    return clan_reserve_legacy_key_from_app_ids($wg, $lesta);
}

function clan_reserve_legacy_key_env_seed($db): ?string {
    return clan_reserve_legacy_key_from_app_ids(
        game_api_wg_application_id($db),
        game_api_lesta_application_id($db)
    );
}

function clan_reserve_encryption_key_from_env(): ?string {
    $raw = getenv('GAME_TOKEN_ENC_KEY');
    if (!is_string($raw) || trim($raw) === '') {
        return null;
    }
    $decoded = base64_decode(trim($raw), true);
    if ($decoded === false || strlen($decoded) !== 32) {
        return null;
    }

    return $decoded;
}

function clan_reserve_persist_token_key($db, string $key): void {
    if ($key === '') {
        return;
    }

    ensure_site_settings_table($db);
    $encoded = base64_encode($key);
    $stored = trim((string) get_site_setting($db, 'clan_reserve_token_key', ''));
    if ($stored !== $encoded) {
        set_site_setting($db, 'clan_reserve_token_key', $encoded);
    }
}

function clan_reserve_primary_encryption_key($db): ?string {
    $envKey = clan_reserve_encryption_key_from_env();
    if ($envKey !== null) {
        clan_reserve_persist_token_key($db, $envKey);

        return $envKey;
    }

    ensure_site_settings_table($db);
    $stored = trim((string) get_site_setting($db, 'clan_reserve_token_key', ''));
    if ($stored !== '') {
        $decoded = base64_decode($stored, true);
        if ($decoded !== false && strlen($decoded) === 32) {
            return $decoded;
        }
    }

    $legacyDb = clan_reserve_legacy_key_db_only($db);
    if ($legacyDb === null) {
        return null;
    }

    clan_reserve_persist_token_key($db, $legacyDb);

    return $legacyDb;
}

function clan_reserve_encryption_key_variants($db): array {
    $variants = [];
    $add = static function (?string $key) use (&$variants): void {
        if ($key === null) {
            return;
        }
        $hash = bin2hex($key);
        if (!isset($variants[$hash])) {
            $variants[$hash] = $key;
        }
    };

    $add(clan_reserve_encryption_key_from_env());
    ensure_site_settings_table($db);
    $stored = trim((string) get_site_setting($db, 'clan_reserve_token_key', ''));
    if ($stored !== '') {
        $decoded = base64_decode($stored, true);
        if ($decoded !== false && strlen($decoded) === 32) {
            $add($decoded);
        }
    }
    $add(clan_reserve_primary_encryption_key($db));
    $add(clan_reserve_legacy_key_db_only($db));
    $add(clan_reserve_legacy_key_env_seed($db));

    return array_values($variants);
}

function clan_reserve_encryption_key($db): ?string {
    return clan_reserve_primary_encryption_key($db);
}

function clan_reserve_decrypt_token_with_key(string $encoded, string $key): ?string {
    if ($encoded === '' || $key === '') {
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

function clan_reserve_encrypt_token(string $plain, $db): ?string {
    $key = clan_reserve_primary_encryption_key($db);
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
    if ($encoded === '') {
        return null;
    }

    foreach (clan_reserve_encryption_key_variants($db) as $key) {
        $plain = clan_reserve_decrypt_token_with_key($encoded, $key);
        if ($plain !== null) {
            return $plain;
        }
    }

    return null;
}

function clan_reserve_reencrypt_token_if_needed(
    $db,
    int $linkId,
    int $userId,
    string $plainToken,
    string $storedEnc = ''
): void {
    if ($linkId <= 0 || $userId <= 0 || trim($plainToken) === '') {
        return;
    }

    $primary = clan_reserve_primary_encryption_key($db);
    if ($primary === null) {
        return;
    }

    $plainToken = trim($plainToken);
    if ($storedEnc !== '' && clan_reserve_decrypt_token_with_key($storedEnc, $primary) === $plainToken) {
        return;
    }

    $encrypted = clan_reserve_encrypt_token($plainToken, $db);
    if ($encrypted === null) {
        return;
    }

    $db->update(
        'UPDATE site_user_game_tokens SET access_token_enc = ? WHERE id = ? AND user_id = ?',
        [$encrypted, $linkId, $userId]
    );
}

function chadow_sync_reserves_cli_env($db): void {
    if (PHP_SAPI !== 'cli') {
        return;
    }

    require_once __DIR__ . '/cli_env.php';

    clan_reserve_primary_encryption_key($db);

    ensure_site_settings_table($db);
    chadow_putenv_if_unset(
        'WG_APPLICATION_ID',
        trim((string) get_site_setting($db, 'wg_application_id', ''))
    );
    chadow_putenv_if_unset(
        'LESTA_APPLICATION_ID',
        trim((string) get_site_setting($db, 'lesta_application_id', ''))
    );

    if (getenv('GAME_TOKEN_ENC_KEY') === false) {
        $stored = trim((string) get_site_setting($db, 'clan_reserve_token_key', ''));
        if ($stored !== '') {
            chadow_putenv_if_unset('GAME_TOKEN_ENC_KEY', $stored);
        }
    }
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
    if (clan_reserve_decrypt_token($encrypted, $db) !== trim($accessToken)) {
        return 0;
    }
    $nickname = $nickname !== null ? trim($nickname) : null;
    if ($nickname === '') {
        $nickname = null;
    }
    $applicationId = game_api_application_id_for_realm_resolved($realm, $db);

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
                 SET nickname = ?, access_token_enc = ?, application_id = ?, expires_at = ?
                 WHERE id = ? AND user_id = ?',
                [$nickname, $encrypted, $applicationId !== '' ? $applicationId : null, max(0, $expiresAt), $linkId, $userId]
            );
        } else {
            $db->update(
                'UPDATE site_user_game_tokens
                 SET access_token_enc = ?, application_id = ?, expires_at = ?
                 WHERE id = ? AND user_id = ?',
                [$encrypted, $applicationId !== '' ? $applicationId : null, max(0, $expiresAt), $linkId, $userId]
            );
        }

        clan_reserve_delete_clan_cache($db, $linkId, $userId);

        return $linkId;
    }

    return (int) $db->insert(
        'INSERT INTO site_user_game_tokens (user_id, provider, realm, account_id, nickname, access_token_enc, application_id, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [$userId, $provider, $realm, $accountId, $nickname, $encrypted, $applicationId !== '' ? $applicationId : null, max(0, $expiresAt)]
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
    $accessToken = trim($accessToken);
    if ($accessToken === '') {
        return ['ok' => false, 'needs_relink' => true, 'error' => 'token_empty'];
    }

    clan_reserve_reencrypt_token_if_needed(
        $db,
        $linkId,
        $userId,
        $accessToken,
        (string) ($row['access_token_enc'] ?? '')
    );

    $applicationId = trim((string) ($row['application_id'] ?? ''));
    if ($applicationId === '') {
        $applicationId = game_api_application_id_for_realm_resolved($realm, $db);
        if ($applicationId !== '') {
            $db->update(
                'UPDATE site_user_game_tokens SET application_id = ? WHERE id = ? AND user_id = ?',
                [$applicationId, $linkId, $userId]
            );
        }
    }

    $client = new WgOpenIdClient($db, true);
    $expiresAt = (int) ($row['expires_at'] ?? 0);
    if ($expiresAt > 0 && $expiresAt < time() + 3600) {
        $prolong = $client->prolongateToken($accessToken, $realm);
        if (!$prolong['ok']) {
            return ['ok' => false, 'needs_relink' => true, 'error' => (string) ($prolong['error'] ?? 'prolongate_failed')];
        }
        $prolongToken = trim((string) ($prolong['access_token'] ?? $accessToken));
        if ($prolongToken === '') {
            return ['ok' => false, 'needs_relink' => true, 'error' => 'token_empty'];
        }
        $accessToken = $prolongToken;
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

    $accessToken = trim($accessToken);
    if ($accessToken === '') {
        return ['ok' => false, 'needs_relink' => true, 'error' => 'token_empty'];
    }

    return [
        'ok' => true,
        'link_id' => $linkId,
        'access_token' => $accessToken,
        'application_id' => $applicationId,
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

function clan_reserve_build_log_filter(
    $db,
    int $userId,
    int $filterLinkId = 0,
    string $filterProvider = '',
    string $filterRealm = ''
): array {
    $params = [$userId];
    $where = 'user_id = ?';

    if ($filterLinkId > 0) {
        $link = clan_reserve_fetch_token_by_id($db, $userId, $filterLinkId);
        if (is_array($link)) {
            $provider = clan_reserve_normalize_provider((string) ($link['provider'] ?? 'wg'));
            $realm = clan_reserve_realm_for_provider($provider, (string) ($link['realm'] ?? 'eu'));
            $where .= ' AND provider = ? AND realm = ?';
            $params[] = $provider;
            $params[] = $realm;
        }
    } elseif ($filterProvider !== '' && $filterRealm !== '') {
        $provider = clan_reserve_normalize_provider($filterProvider);
        $realm = clan_reserve_realm_for_provider($provider, $filterRealm);
        $where .= ' AND provider = ? AND realm = ?';
        $params[] = $provider;
        $params[] = $realm;
    }

    return ['where' => $where, 'params' => $params];
}

function clan_reserve_clear_activation_log($db, int $userId, array $filter): int {
    ensure_clan_reserves_tables($db);
    if ($userId <= 0) {
        return 0;
    }

    $where = (string) ($filter['where'] ?? 'user_id = ?');
    $params = is_array($filter['params'] ?? null) ? $filter['params'] : [$userId];

    return (int) $db->delete('DELETE FROM clan_reserve_activation_log WHERE ' . $where, $params);
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
    $enabled = (int) ($row['enabled'] ?? 0) === 1;
    $pausedNoStock = (int) ($row['paused_no_stock'] ?? 0) === 1;

    return [
        'id' => (int) ($row['id'] ?? 0),
        'link_id' => (int) ($row['link_id'] ?? 0),
        'provider' => (string) ($row['provider'] ?? 'wg'),
        'realm' => (string) ($row['realm'] ?? 'eu'),
        'reserve_type' => (string) ($row['reserve_type'] ?? ''),
        'reserve_level' => (int) ($row['reserve_level'] ?? 0),
        'time_local' => substr((string) ($row['time_local'] ?? '00:00:00'), 0, 5),
        'days_mask' => (int) ($row['days_mask'] ?? 127),
        'days' => clan_reserve_days_from_mask((int) ($row['days_mask'] ?? 127)),
        'timezone' => (string) ($row['timezone'] ?? 'Europe/Moscow'),
        'enabled' => $enabled,
        'paused_no_stock' => $pausedNoStock,
        'active' => $enabled && !$pausedNoStock,
        'last_run_at' => $row['last_run_at'] ?? null,
        'last_status' => $row['last_status'] ?? null,
        'last_error' => $row['last_error'] ?? null,
    ];
}

function clan_reserve_normalize_reserve_type(string $type): string {
    $type = trim($type);
    if ($type === '') {
        return '';
    }
    if (preg_match('/^[A-Z][A-Z0-9_]*$/', $type)) {
        return $type;
    }
    $snake = preg_replace('/([a-z0-9])([A-Z])/', '$1_$2', $type);
    $snake = str_replace(['-', ' '], '_', $snake);

    return strtoupper($snake);
}

function clan_reserve_reserve_types_match(string $a, string $b): bool {
    return clan_reserve_normalize_reserve_type($a) === clan_reserve_normalize_reserve_type($b);
}

function clan_reserve_resolve_link_id($db, int $userId, int $linkId, string $provider, string $realm): int {
    $provider = clan_reserve_normalize_provider($provider);
    $realm = clan_reserve_realm_for_provider($provider, $realm);

    if ($linkId > 0) {
        $token = clan_reserve_get_valid_token($db, $userId, $linkId);
        if (!empty($token['ok'])) {
            return $linkId;
        }
    }

    $tokenRow = clan_reserve_fetch_token_row($db, $userId, $provider, $realm);
    if (!is_array($tokenRow)) {
        return 0;
    }

    $resolved = (int) ($tokenRow['id'] ?? 0);
    if ($resolved <= 0) {
        return 0;
    }

    $token = clan_reserve_get_valid_token($db, $userId, $resolved);

    return !empty($token['ok']) ? $resolved : 0;
}

function clan_reserve_heal_enabled_rules_links($db, int $userId = 0): int {
    ensure_clan_reserves_tables($db);

    $params = [];
    $where = 'enabled = 1';
    if ($userId > 0) {
        $where .= ' AND user_id = ?';
        $params[] = $userId;
    }

    $rows = $db->fetchAll(
        'SELECT id, user_id, link_id, provider, realm FROM clan_reserve_rules WHERE ' . $where,
        $params
    );

    $updated = 0;
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $ruleUserId = (int) ($row['user_id'] ?? 0);
        $ruleId = (int) ($row['id'] ?? 0);
        if ($ruleUserId <= 0 || $ruleId <= 0) {
            continue;
        }

        $provider = clan_reserve_normalize_provider((string) ($row['provider'] ?? 'wg'));
        $realm = clan_reserve_realm_for_provider($provider, (string) ($row['realm'] ?? 'eu'));
        $resolved = clan_reserve_resolve_link_id(
            $db,
            $ruleUserId,
            (int) ($row['link_id'] ?? 0),
            $provider,
            $realm
        );
        if ($resolved <= 0 || $resolved === (int) ($row['link_id'] ?? 0)) {
            continue;
        }

        $db->update(
            'UPDATE clan_reserve_rules SET link_id = ? WHERE id = ? AND user_id = ?',
            [$resolved, $ruleId, $ruleUserId]
        );
        $updated += 1;
    }

    return $updated;
}

function clan_reserve_catalog_level_status(array $items, string $type, int $level): ?string {
    foreach ($items as $item) {
        if (!is_array($item) || !clan_reserve_reserve_types_match((string) ($item['type'] ?? ''), $type)) {
            continue;
        }
        foreach (is_array($item['levels'] ?? null) ? $item['levels'] : [] as $levelRow) {
            if (!is_array($levelRow) || (int) ($levelRow['level'] ?? 0) !== $level) {
                continue;
            }

            return (string) ($levelRow['status'] ?? 'unavailable');
        }
    }

    return null;
}

function clan_reserve_catalog_level_ready(array $items, string $type, int $level): bool {
    return clan_reserve_catalog_level_status($items, $type, $level) === 'ready';
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

function clan_reserve_local_icon_path(string $type, string $name = ''): string {
    static $byType = [
        'additionalbriefing' => 'additional-briefing.png',
        'battlepayments' => 'battle-payments.png',
        'militarymaneuvers' => 'military-maneuvers.png',
        'tacticaltraining' => 'tactical-training.png',
    ];

    static $byName = [
        'additional briefing' => 'additional-briefing.png',
        'дополнительный инструктаж' => 'additional-briefing.png',
        'battle payments' => 'battle-payments.png',
        'боевые выплаты' => 'battle-payments.png',
        'military maneuvers' => 'military-maneuvers.png',
        'military manoeuvres' => 'military-maneuvers.png',
        'военные маневры' => 'military-maneuvers.png',
        'военные манёвры' => 'military-maneuvers.png',
        'tactical training' => 'tactical-training.png',
        'тактическая подготовка' => 'tactical-training.png',
    ];

    $typeKey = preg_replace('/[^a-z]/', '', strtolower(trim($type)));
    if ($typeKey !== '' && isset($byType[$typeKey])) {
        return clan_reserve_icon_public_path($byType[$typeKey]);
    }

    $nameKey = mb_strtolower(trim($name));
    if ($nameKey !== '' && isset($byName[$nameKey])) {
        return clan_reserve_icon_public_path($byName[$nameKey]);
    }

    return '';
}

function clan_reserve_icon_public_path(string $filename): string {
    $filename = basename(trim($filename));
    if ($filename === '') {
        return '';
    }

    $path = __DIR__ . '/../assets/icons/reserves/' . $filename;
    if (!is_file($path)) {
        return '';
    }

    return '/assets/icons/reserves/' . $filename;
}
