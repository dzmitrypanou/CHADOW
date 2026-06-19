<?php
if (php_sapi_name() !== 'cli') {
    exit(1);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/tactics_map_catalog.php';
require_once __DIR__ . '/../includes/tactics_helpers.php';

$metadata = json_decode((string) file_get_contents(__DIR__ . '/lesta_maps_metadata.json'), true);
$lestaOnly = [];
$wotOnly = [];
foreach ($metadata as $code => $row) {
    $games = array_values(array_map('strtolower', (array) ($row['games'] ?? [])));
    sort($games);
    if ($games === ['lesta']) {
        $lestaOnly[$code] = true;
    }
    if ($games === ['wot']) {
        $wotOnly[$code] = true;
    }
}

$db = Database::getInstance();
$rows = $db->fetchAll('SELECT map_code, display_name_ru, display_name_en, side_length FROM map_dictionary');
$catalog = tactics_build_map_catalog($rows, 'ru', $db);

$bad = [];
foreach (['wot', 'lesta'] as $game) {
    echo strtoupper($game) . PHP_EOL;
    foreach (tactics_game_modes($game) as $mode) {
        $codes = array_column($catalog['games'][$game]['modes'][$mode] ?? [], 'map_code');
        sort($codes);
        echo "  {$mode}: " . count($codes) . PHP_EOL;
        foreach ($codes as $code) {
            if ($game === 'wot' && isset($lestaOnly[$code])) {
                $bad[] = "wot/{$mode} has lesta-only {$code}";
            }
            if ($game === 'lesta' && isset($wotOnly[$code])) {
                $bad[] = "lesta/{$mode} has wot-only {$code}";
            }
        }
    }
    echo PHP_EOL;
}

echo 'Catalog issues: ' . count($bad) . PHP_EOL;
foreach ($bad as $line) {
    echo $line . PHP_EOL;
}
