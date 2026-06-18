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

$argv = $argv ?? [];
$linkId = 0;
$userId = 0;

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
$wgApp = game_api_wg_application_id($db);
$lestaApp = game_api_lesta_application_id($db);
$variants = clan_reserve_encryption_key_variants($db);
$plain = clan_reserve_decrypt_token((string) ($tokenRow['access_token_enc'] ?? ''), $db);
$tokenResult = clan_reserve_get_valid_token($db, $userId, $linkId);

echo "user_id={$userId} link_id={$linkId}\n";
echo 'provider=' . ($tokenRow['provider'] ?? '') . ' realm=' . ($tokenRow['realm'] ?? '') . "\n";
echo 'wg_application_id=' . ($wgApp !== '' ? 'set' : 'missing')
    . ' lesta_application_id=' . ($lestaApp !== '' ? 'set' : 'missing') . "\n";
echo 'GAME_TOKEN_ENC_KEY=' . (getenv('GAME_TOKEN_ENC_KEY') !== false ? 'set' : 'missing') . "\n";
echo 'clan_reserve_token_key=' . ($storedKey !== '' ? 'set' : 'missing') . "\n";
echo 'encryption_variants=' . count($variants) . "\n";
echo 'decrypt_ok=' . ($plain !== null ? 'yes' : 'no')
    . ' token_len=' . ($plain !== null ? strlen($plain) : 0) . "\n";
echo 'get_valid_token=' . (!empty($tokenResult['ok']) ? 'ok' : 'fail')
    . ' error=' . ($tokenResult['error'] ?? '-') . "\n";

exit(!empty($tokenResult['ok']) ? 0 : 1);
