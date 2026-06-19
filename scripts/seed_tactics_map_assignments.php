<?php
/**
 * Seed map_dictionary and tactics_map_assignments from scripts/lesta_maps_metadata.json
 * produced by scripts/extract_lesta_maps.py
 *
 * Usage: php scripts/seed_tactics_map_assignments.php [--dry-run]
 */
if (php_sapi_name() !== 'cli') {
    fwrite(STDERR, "CLI only\n");
    exit(1);
}

$dryRun = in_array('--dry-run', $argv, true);
$metaPath = __DIR__ . '/lesta_maps_metadata.json';
if (!is_file($metaPath)) {
    fwrite(STDERR, "Missing {$metaPath}. Run: python scripts/extract_lesta_maps.py\n");
    exit(1);
}

$metadata = json_decode((string) file_get_contents($metaPath), true);
if (!is_array($metadata)) {
    fwrite(STDERR, "Invalid metadata JSON\n");
    exit(1);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/ensure_map_dictionary.php';
require_once __DIR__ . '/../config/ensure_tactics.php';
require_once __DIR__ . '/../config/tactics_map_catalog.php';
require_once __DIR__ . '/../includes/tactics_helpers.php';

$db = Database::getInstance();
ensure_map_dictionary_table($db);
ensure_map_dictionary_admin_columns($db);
ensure_tactics_map_assignments_table($db);

$dictUpserts = 0;
$assignments = 0;

function tactics_prune_imported_map_assets(array $metadata): int {
    $valid = [];
    foreach ($metadata as $mapCode => $row) {
        $mapCode = strtolower(trim((string) $mapCode));
        if ($mapCode === '') {
            continue;
        }
        foreach ((array) ($row['games'] ?? []) as $game) {
            $game = tactics_sanitize_game((string) $game);
            foreach ((array) ($row['modes'] ?? []) as $mode) {
                $mode = tactics_sanitize_battle_mode((string) $mode, $game);
                $valid[$game][$mode][$mapCode] = true;
            }
        }
    }

    $removed = 0;
    $root = dirname(__DIR__) . '/assets/tactics/maps';
    foreach (['wot', 'lesta'] as $game) {
        $gameDir = $root . '/' . $game;
        if (!is_dir($gameDir)) {
            continue;
        }
        foreach (scandir($gameDir) ?: [] as $mode) {
            if ($mode === '.' || $mode === '..') {
                continue;
            }
            $modeDir = $gameDir . '/' . $mode;
            if (!is_dir($modeDir)) {
                continue;
            }
            foreach (scandir($modeDir) ?: [] as $fileName) {
                if ($fileName === '.' || $fileName === '..') {
                    continue;
                }
                $path = $modeDir . '/' . $fileName;
                if (!is_file($path)) {
                    continue;
                }
                $code = strtolower((string) pathinfo($fileName, PATHINFO_FILENAME));
                if (!isset($valid[$game][$mode][$code])) {
                    unlink($path);
                    $removed++;
                }
            }
        }
    }

    return $removed;
}

function tactics_prune_stale_map_assignments($db, array $metadata): int {
    $allowed = [];
    foreach ($metadata as $mapCode => $row) {
        $mapCode = strtolower(trim((string) $mapCode));
        if ($mapCode === '') {
            continue;
        }
        foreach ((array) ($row['games'] ?? []) as $game) {
            $game = tactics_sanitize_game((string) $game);
            foreach ((array) ($row['modes'] ?? []) as $mode) {
                $mode = tactics_sanitize_battle_mode((string) $mode, $game);
                $allowed[$mapCode][$game][$mode] = true;
            }
        }
    }

    $removed = 0;
    $rows = $db->fetchAll(
        "SELECT map_code, game, battle_mode FROM tactics_map_assignments WHERE game IN ('wot', 'lesta')"
    );
    foreach ($rows as $row) {
        $mapCode = strtolower((string) ($row['map_code'] ?? ''));
        $game = tactics_sanitize_game((string) ($row['game'] ?? ''));
        $mode = tactics_sanitize_battle_mode((string) ($row['battle_mode'] ?? ''), $game);
        if (!isset($allowed[$mapCode][$game][$mode])) {
            $db->query(
                'DELETE FROM tactics_map_assignments WHERE map_code = ? AND game = ? AND battle_mode = ?',
                [$mapCode, $game, $mode]
            );
            $removed++;
        }
    }

    return $removed;
}

function tactics_prune_invalid_tank_assignments($db): int {
    require_once __DIR__ . '/../config/tactics_map_catalog.php';

    $removed = 0;
    $rows = $db->fetchAll(
        "SELECT map_code, game, battle_mode FROM tactics_map_assignments WHERE game IN ('wot', 'lesta')"
    );
    foreach ($rows as $row) {
        $mapCode = strtolower(trim((string) ($row['map_code'] ?? '')));
        $game = tactics_sanitize_game((string) ($row['game'] ?? ''));
        $rawMode = strtolower(trim((string) ($row['battle_mode'] ?? '')));
        if ($rawMode === 'custom' || tactics_is_variant_map_code($mapCode)) {
            $db->query(
                'DELETE FROM tactics_map_assignments WHERE map_code = ? AND game = ? AND battle_mode = ?',
                [$mapCode, $game, $rawMode]
            );
            $removed++;
            continue;
        }
        if ($rawMode === 'grand' || !tactics_map_allowed_for_mode($mapCode, $rawMode, $game)) {
            $db->query(
                'DELETE FROM tactics_map_assignments WHERE map_code = ? AND game = ? AND battle_mode = ?',
                [$mapCode, $game, $rawMode]
            );
            $removed++;
        }
    }

    return $removed;
}

foreach ($metadata as $mapCode => $row) {
    $mapCode = strtolower(trim((string) $mapCode));
    if ($mapCode === '') {
        continue;
    }

    $ru = trim((string) ($row['display_name_ru'] ?? $mapCode));
    $en = trim((string) ($row['display_name_en'] ?? $ru));
    $named = tactics_apply_map_display_names([
        'map_code' => $mapCode,
        'display_name_ru' => $ru,
        'display_name_en' => $en,
    ]);
    $ru = (string) $named['display_name_ru'];
    $en = (string) $named['display_name_en'];
    $sideLength = isset($row['side_length']) ? tactics_sanitize_side_length($row['side_length']) : null;
    $games = is_array($row['games'] ?? null) ? $row['games'] : [];
    $modes = is_array($row['modes'] ?? null) ? $row['modes'] : ['random'];

    if ($dryRun) {
        fwrite(STDOUT, "map {$mapCode}: {$ru} / games=" . implode(',', $games) . " modes=" . implode(',', $modes) . "\n");
        $dictUpserts++;
        $assignments += count($games) * count($modes);
        continue;
    }

    $exists = $db->fetchOne('SELECT map_code FROM map_dictionary WHERE map_code = ?', [$mapCode]);
    if ($exists) {
        $db->query(
            'UPDATE map_dictionary SET display_name_ru = ?, display_name_en = ?, side_length = COALESCE(?, side_length), is_moderated = 1 WHERE map_code = ?',
            [$ru, $en, $sideLength, $mapCode]
        );
    } else {
        $db->query(
            'INSERT INTO map_dictionary (map_code, display_name_ru, display_name_en, side_length, is_moderated) VALUES (?, ?, ?, ?, 1)',
            [$mapCode, $ru, $en, $sideLength]
        );
    }
    $dictUpserts++;

    foreach ($games as $game) {
        $game = tactics_sanitize_game((string) $game);
        foreach ($modes as $mode) {
            $mode = tactics_sanitize_battle_mode((string) $mode, $game);
            if (!tactics_map_allowed_for_mode($mapCode, $mode, $game)) {
                continue;
            }
            if (!tactics_map_has_mode_asset($mapCode, $game, $mode)) {
                continue;
            }
            $db->query(
                'INSERT IGNORE INTO tactics_map_assignments (map_code, game, battle_mode) VALUES (?, ?, ?)',
                [$mapCode, $game, $mode]
            );
            $assignments++;
        }
    }
}

fwrite(STDOUT, ($dryRun ? 'Would upsert ' : 'Upserted ') . "{$dictUpserts} map(s), {$assignments} assignment(s).\n");

if (!$dryRun) {
    $pruned = tactics_prune_imported_map_assets($metadata);
    if ($pruned > 0) {
        fwrite(STDOUT, "Removed {$pruned} stale map asset(s).\n");
    }

    $prunedAssignments = tactics_prune_stale_map_assignments($db, $metadata);
    if ($prunedAssignments > 0) {
        fwrite(STDOUT, "Removed {$prunedAssignments} outdated assignment(s) from metadata.\n");
    }

    $invalidTank = tactics_prune_invalid_tank_assignments($db);
    if ($invalidTank > 0) {
        fwrite(STDOUT, "Removed {$invalidTank} invalid tank assignment(s) (custom/variant).\n");
    }

    $removed = 0;
    $rows = $db->fetchAll(
        "SELECT map_code, game, battle_mode FROM tactics_map_assignments WHERE game IN ('wot', 'lesta')"
    );
    foreach ($rows as $row) {
        $mapCode = (string) ($row['map_code'] ?? '');
        $game = tactics_sanitize_game((string) ($row['game'] ?? ''));
        $mode = tactics_sanitize_battle_mode((string) ($row['battle_mode'] ?? ''), $game);
        if (!tactics_map_has_mode_asset($mapCode, $game, $mode)) {
            $db->query(
                'DELETE FROM tactics_map_assignments WHERE map_code = ? AND game = ? AND battle_mode = ?',
                [$mapCode, $game, $mode]
            );
            $removed++;
        }
    }
    if ($removed > 0) {
        fwrite(STDOUT, "Removed {$removed} stale assignment(s) without map assets.\n");
    }
}
