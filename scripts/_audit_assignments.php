<?php
/**
 * Audit tactics_map_assignments vs lesta_maps_metadata.json game separation.
 * Usage: php scripts/_audit_assignments.php
 */
if (php_sapi_name() !== 'cli') {
    exit(1);
}

$metaPath = __DIR__ . '/lesta_maps_metadata.json';
$metadata = json_decode((string) file_get_contents($metaPath), true);
if (!is_array($metadata)) {
    fwrite(STDERR, "Invalid metadata\n");
    exit(1);
}

$lestaOnly = [];
$wotOnly = [];
$allowed = [];
foreach ($metadata as $code => $row) {
    $games = array_values(array_map('strtolower', (array) ($row['games'] ?? [])));
    sort($games);
    if ($games === ['lesta']) {
        $lestaOnly[$code] = true;
    }
    if ($games === ['wot']) {
        $wotOnly[$code] = true;
    }
    foreach ($games as $game) {
        foreach ((array) ($row['modes'] ?? []) as $mode) {
            $allowed[$code][$game][$mode] = true;
        }
    }
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/tactics_helpers.php';

$db = Database::getInstance();
$rows = $db->fetchAll(
    "SELECT map_code, game, battle_mode FROM tactics_map_assignments WHERE game IN ('wot', 'lesta') ORDER BY game, battle_mode, map_code"
);

$bad = [];
foreach ($rows as $row) {
    $code = (string) ($row['map_code'] ?? '');
    $game = tactics_sanitize_game((string) ($row['game'] ?? ''));
    $mode = tactics_sanitize_battle_mode((string) ($row['battle_mode'] ?? ''), $game);

    if ($game === 'wot' && isset($lestaOnly[$code])) {
        $bad[] = "wot assignment for lesta-only map: {$code}/{$mode}";
    }
    if ($game === 'lesta' && isset($wotOnly[$code])) {
        $bad[] = "lesta assignment for wot-only map: {$code}/{$mode}";
    }
    if (!isset($allowed[$code][$game][$mode])) {
        $bad[] = "not in metadata: {$game}/{$code}/{$mode}";
    }
    if (!tactics_map_has_mode_asset($code, $game, $mode)) {
        $bad[] = "missing asset: {$game}/{$code}/{$mode}";
    }
}

echo 'Assignments: ' . count($rows) . PHP_EOL;
echo 'Bad: ' . count($bad) . PHP_EOL;
foreach ($bad as $line) {
    echo $line . PHP_EOL;
}
