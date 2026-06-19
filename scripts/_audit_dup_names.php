<?php
if (php_sapi_name() !== 'cli') {
    exit(1);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/tactics_map_catalog.php';
require_once __DIR__ . '/../includes/tactics_helpers.php';

$db = Database::getInstance();
$rows = $db->fetchAll('SELECT map_code, display_name_ru FROM map_dictionary');
$catalog = tactics_build_map_catalog($rows, 'ru', $db);

foreach (['lesta', 'wot'] as $game) {
    foreach (['random', 'encounter', 'assault'] as $mode) {
        $maps = $catalog['games'][$game]['modes'][$mode] ?? [];
        echo strtoupper($game) . " {$mode} (" . count($maps) . ")\n";
        $byName = [];
        foreach ($maps as $map) {
            $name = (string) ($map['display_name_ru'] ?? '');
            $byName[$name][] = (string) ($map['map_code'] ?? '');
        }
        foreach ($byName as $name => $codes) {
            if (count($codes) > 1) {
                echo "  DUP {$name}: " . implode(', ', $codes) . "\n";
            }
        }
    }
}

echo "\nAll assignments for variant-like codes:\n";
$assignments = $db->fetchAll(
    "SELECT map_code, game, battle_mode FROM tactics_map_assignments
     WHERE game IN ('wot', 'lesta')
     AND (
         map_code LIKE '%_att' OR map_code LIKE '%_def' OR map_code LIKE '%_ny'
         OR map_code LIKE 'bf_epic_%' OR map_code LIKE 'epic_%'
         OR battle_mode = 'custom'
     )
     ORDER BY game, battle_mode, map_code"
);
foreach ($assignments as $row) {
    echo $row['game'] . '/' . $row['battle_mode'] . ' ' . $row['map_code'] . "\n";
}
