<?php

if (php_sapi_name() !== 'cli') {
    fwrite(STDERR, "CLI only\n");
    exit(1);
}

require_once __DIR__ . '/../includes/cli_env.php';
chadow_load_cli_env();

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/ensure_clan_reserves.php';
require_once __DIR__ . '/../includes/clan_reserve_helpers.php';
require_once __DIR__ . '/../includes/clan_reserve_service.php';

$argv = $argv ?? [];
$linkId = 0;
$userId = 0;
$testApi = in_array('--test-api', $argv, true);
$testActivate = in_array('--test-activate', $argv, true);

foreach ($argv as $arg) {
    if (str_starts_with($arg, '--link-id=')) {
        $linkId = (int) substr($arg, 10);
    } elseif (str_starts_with($arg, '--user-id=')) {
        $userId = (int) substr($arg, 10);
    }
}

$db = Database::getInstance();
ensure_clan_reserves_tables($db);
chadow_sync_reserves_cli_env($db);

if ($linkId <= 0) {
    $row = $db->fetchOne(
        'SELECT id, user_id FROM site_user_game_tokens ORDER BY id DESC LIMIT 1'
    );
    if (!is_array($row)) {
        fwrite(STDERR, "No tokens in DB. Pass --link-id= and --user-id=\n");
        exit(1);
    }
    $linkId = (int) ($row['id'] ?? 0);
    $userId = (int) ($row['user_id'] ?? 0);
}

if ($userId <= 0) {
    $row = $db->fetchOne(
        'SELECT user_id FROM site_user_game_tokens WHERE id = ? LIMIT 1',
        [$linkId]
    );
    $userId = is_array($row) ? (int) ($row['user_id'] ?? 0) : 0;
}

if ($linkId <= 0 || $userId <= 0) {
    fwrite(STDERR, "Invalid --link-id or --user-id\n");
    exit(1);
}

$tokenRow = clan_reserve_fetch_token_by_id($db, $userId, $linkId);
if (!is_array($tokenRow)) {
    fwrite(STDERR, "Token row not found for user_id={$userId} link_id={$linkId}\n");
    exit(1);
}

$storedKey = trim((string) get_site_setting($db, 'clan_reserve_token_key', ''));
$wgDb = game_api_wg_application_id_from_db($db);
$wgEnv = trim((string) getenv('WG_APPLICATION_ID'));
$lestaDb = game_api_lesta_application_id_from_db($db);
$variants = clan_reserve_encryption_key_variants($db);
$plain = clan_reserve_decrypt_token((string) ($tokenRow['access_token_enc'] ?? ''), $db);
$tokenResult = clan_reserve_get_valid_token($db, $userId, $linkId);

echo "user_id={$userId} link_id={$linkId}\n";
echo 'provider=' . ($tokenRow['provider'] ?? '') . ' realm=' . ($tokenRow['realm'] ?? '') . "\n";
echo 'application_id=' . ($tokenResult['application_id'] ?? $tokenRow['application_id'] ?? '-') . "\n";
echo 'wg_application_id_db=' . ($wgDb !== '' ? $wgDb : 'missing')
    . ' env=' . ($wgEnv !== '' ? $wgEnv : 'missing') . "\n";
echo 'lesta_application_id_db=' . ($lestaDb !== '' ? $lestaDb : 'missing') . "\n";
echo 'GAME_TOKEN_ENC_KEY=' . (getenv('GAME_TOKEN_ENC_KEY') !== false ? 'set' : 'missing') . "\n";
echo 'clan_reserve_token_key=' . ($storedKey !== '' ? 'set' : 'missing') . "\n";
echo 'encryption_variants=' . count($variants) . "\n";
echo 'decrypt_ok=' . ($plain !== null ? 'yes' : 'no')
    . ' token_len=' . ($plain !== null ? strlen($plain) : 0) . "\n";
echo 'get_valid_token=' . (!empty($tokenResult['ok']) ? 'ok' : 'fail')
    . ' error=' . ($tokenResult['error'] ?? '-') . "\n";

$exitCode = !empty($tokenResult['ok']) ? 0 : 1;

if ($testApi && !empty($tokenResult['ok'])) {
    $service = new ClanReserveService($db);
    $realm = (string) ($tokenResult['realm'] ?? 'eu');
    $catalog = $service->fetchClanReserves(
        (string) ($tokenResult['access_token'] ?? ''),
        $realm,
        'ru',
        trim((string) ($tokenResult['application_id'] ?? '')) ?: null
    );
    echo 'catalog_api=' . (!empty($catalog['ok']) ? 'ok' : 'fail')
        . ' error=' . ($catalog['error'] ?? '-') . "\n";
    if (!empty($catalog['ok']) && is_array($catalog['items'] ?? null)) {
        foreach ($catalog['items'] as $item) {
            if (!is_array($item)) {
                continue;
            }
            $type = (string) ($item['type'] ?? '');
            foreach (is_array($item['levels'] ?? null) ? $item['levels'] : [] as $levelRow) {
                if (!is_array($levelRow)) {
                    continue;
                }
                echo '  reserve ' . $type . ' lvl=' . (int) ($levelRow['level'] ?? 0)
                    . ' status=' . (string) ($levelRow['status'] ?? '-')
                    . ' amount=' . (int) ($levelRow['amount'] ?? 0) . "\n";
            }
        }
    }
    if (empty($catalog['ok'])) {
        $exitCode = 1;
    } elseif ($testActivate) {
        $targetType = '';
        $targetLevel = 0;
        foreach ($catalog['items'] as $item) {
            if (!is_array($item)) {
                continue;
            }
            foreach (is_array($item['levels'] ?? null) ? $item['levels'] : [] as $levelRow) {
                if (!is_array($levelRow) || (string) ($levelRow['status'] ?? '') !== 'ready') {
                    continue;
                }
                $targetType = (string) ($item['type'] ?? '');
                $targetLevel = (int) ($levelRow['level'] ?? 0);
                break 2;
            }
        }
        if ($targetType === '' || $targetLevel <= 0) {
            echo "activate_test=skip no ready reserve\n";
        } else {
            echo "activate_test=try type={$targetType} lvl={$targetLevel}\n";
            $provider = (string) ($tokenResult['provider'] ?? 'wg');
            $resolvedLinkId = clan_reserve_resolve_link_id($db, $userId, $linkId, $provider, (string) ($tokenResult['realm'] ?? 'eu'));
            $result = $service->activateForUser(
                $userId,
                $resolvedLinkId > 0 ? $resolvedLinkId : $linkId,
                $targetType,
                $targetLevel,
                'manual',
                null,
                'ru'
            );
            echo 'activate_api=' . (!empty($result['ok']) ? 'ok' : 'fail')
                . ' error=' . ($result['error'] ?? '-')
                . ' code=' . (int) ($result['code'] ?? 0) . "\n";
            if (empty($result['ok'])) {
                $exitCode = 1;
            }
        }
    }
}

$rules = $db->fetchAll(
    'SELECT id, link_id, reserve_type, reserve_level, enabled, paused_no_stock, last_status, last_error
     FROM clan_reserve_rules WHERE user_id = ? ORDER BY id ASC',
    [$userId]
);
if (is_array($rules) && $rules !== []) {
    echo "rules:\n";
    foreach ($rules as $rule) {
        if (!is_array($rule)) {
            continue;
        }
        $normalized = clan_reserve_normalize_reserve_type((string) ($rule['reserve_type'] ?? ''));
        echo '  id=' . (int) ($rule['id'] ?? 0)
            . ' link_id=' . (int) ($rule['link_id'] ?? 0)
            . ' type=' . ($rule['reserve_type'] ?? '')
            . ' normalized=' . $normalized
            . ' lvl=' . (int) ($rule['reserve_level'] ?? 0)
            . ' enabled=' . (int) ($rule['enabled'] ?? 0)
            . ' paused=' . (int) ($rule['paused_no_stock'] ?? 0)
            . ' last=' . ($rule['last_status'] ?? '-')
            . ' err=' . ($rule['last_error'] ?? '-') . "\n";
    }
}

exit($exitCode);
