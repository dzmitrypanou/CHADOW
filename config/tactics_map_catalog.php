<?php

const TACTICS_GAMES = ['wot', 'lesta', 'dota2', 'cs2'];

const TACTICS_BATTLE_MODES = ['random', 'encounter', 'assault', 'custom', 'standard', 'defuse', 'hostage', 'wingman'];

const TACTICS_WOT_MODES = ['random', 'encounter', 'assault'];

const TACTICS_DOTA2_MODES = ['standard', 'custom'];

const TACTICS_CS2_MODES = ['defuse', 'hostage', 'wingman', 'custom'];

const TACTICS_DOTA2_CUSTOM_MAP_CODE = 'dota2_custom';

const TACTICS_CS2_CUSTOM_MAP_CODE = 'cs2_custom';

const TACTICS_LESTA_ONLY_MAPS = [
    'battle_for_moscow',
    'caucasus',
    'kamchatka',
    'minsk',
    'er_clime',
    'japort',
];

const TACTICS_WOT_ONLY_MAPS = [
    'sweden',
    'westfeld',
    'monastery',
    'eiffel_tower_ctf',
    'dday',
    'lost_paradise_v',
    'campania_big',
    'last_frontier_v',
];

const TACTICS_ENCOUNTER_MAPS = [
    'airfield',
    'cliff',
    'desert',
    'ensk',
    'erlenberg',
    'fishing_bay',
    'fjord',
    'hills',
    'himmelsdorf',
    'lakeville',
    'malinovka',
    'mannerheim_line',
    'munchen',
    'north_america',
    'prohorovka',
    'redshire',
    'ruinberg',
    'siegfried_line',
    'steppes',
    'tundra',
    'germany',
    'poland',
    'stalingrad',
    'asia_great_wall',
    'asia_miao',
    'canada_a',
    'lost_city_ctf',
    'murovanka',
    'kaliningrad',
];

const TACTICS_ASSAULT_MAPS = [
    'murovanka',
    'ruinberg',
    'siegfried_line',
    'germany',
    'steppes',
    'erlenberg',
    'poland',
    'tundra',
    'cliff',
    'himmelsdorf',
    'mannerheim_line',
    'north_america',
    'highway',
];

/** Maps that exist only in random battle (never encounter/assault). */
const TACTICS_RANDOM_ONLY_MAPS = [
    'karelia',
];

function tactics_map_allowed_for_mode(string $code, string $mode, string $game = 'wot'): bool {
    $game = tactics_sanitize_game($game);
    $code = strtolower(trim($code));
    if ($code === '' || tactics_is_variant_map_code($code)) {
        return false;
    }
    if (!tactics_game_uses_legacy_catalog($game)) {
        return true;
    }
    $mode = tactics_sanitize_battle_mode($mode, $game);
    if ($mode !== 'random' && in_array($code, TACTICS_RANDOM_ONLY_MAPS, true)) {
        return false;
    }

    return in_array($code, tactics_filter_maps_for_mode([$code], $mode), true);
}

function tactics_sort_map_rows(array $rows, string $lang = 'ru'): array {
    $isEn = $lang === 'en';
    usort($rows, static function (array $a, array $b) use ($isEn): int {
        $nameA = $isEn ? ($a['display_name_en'] ?? $a['map_code']) : ($a['display_name_ru'] ?? $a['map_code']);
        $nameB = $isEn ? ($b['display_name_en'] ?? $b['map_code']) : ($b['display_name_ru'] ?? $b['map_code']);
        $cmp = strcasecmp((string) $nameA, (string) $nameB);

        return $cmp !== 0 ? $cmp : strcasecmp((string) ($a['map_code'] ?? ''), (string) ($b['map_code'] ?? ''));
    });

    return $rows;
}

function tactics_sanitize_game(string $game): string {
    $game = strtolower(trim($game));

    return in_array($game, TACTICS_GAMES, true) ? $game : 'wot';
}

function tactics_game_modes(string $game): array {
    $game = tactics_sanitize_game($game);
    $map = [
        'wot' => TACTICS_WOT_MODES,
        'lesta' => TACTICS_WOT_MODES,
        'dota2' => TACTICS_DOTA2_MODES,
        'cs2' => TACTICS_CS2_MODES,
    ];

    return $map[$game] ?? TACTICS_WOT_MODES;
}

function tactics_sanitize_battle_mode(string $mode, ?string $game = null): string {
    $mode = strtolower(trim($mode));
    if ($game !== null) {
        $allowed = tactics_game_modes($game);

        return in_array($mode, $allowed, true) ? $mode : $allowed[0];
    }

    return in_array($mode, TACTICS_BATTLE_MODES, true) ? $mode : 'random';
}

function tactics_game_label(string $game, string $lang = 'ru'): string {
    $game = tactics_sanitize_game($game);
    $isEn = $lang === 'en';
    $labels = [
        'wot' => ['ru' => 'World of Tanks', 'en' => 'World of Tanks'],
        'lesta' => ['ru' => 'Мир танков', 'en' => 'Mir Tankov'],
        'dota2' => ['ru' => 'Dota 2', 'en' => 'Dota 2'],
        'cs2' => ['ru' => 'CS2', 'en' => 'CS2'],
    ];

    return $labels[$game][$isEn ? 'en' : 'ru'] ?? $game;
}

function tactics_battle_mode_label(string $mode, string $lang = 'ru', ?string $game = null): string {
    $game = $game !== null ? tactics_sanitize_game($game) : null;
    $mode = $game !== null ? tactics_sanitize_battle_mode($mode, $game) : tactics_sanitize_battle_mode($mode);
    $isEn = $lang === 'en';
    $labels = [
        'random' => ['ru' => 'Случайный бой', 'en' => 'Random battle'],
        'encounter' => ['ru' => 'Встречный бой', 'en' => 'Encounter'],
        'assault' => ['ru' => 'Атака/оборона', 'en' => 'Assault'],
        'custom' => ['ru' => 'Остальное', 'en' => 'Other'],
        'standard' => ['ru' => 'Стандарт', 'en' => 'Standard'],
        'defuse' => ['ru' => 'Обезвреживание бомб', 'en' => 'Bomb defusal'],
        'hostage' => ['ru' => 'Спасение заложников', 'en' => 'Hostage rescue'],
        'wingman' => ['ru' => 'Напарники', 'en' => 'Wingman'],
    ];
    if (in_array($game, ['cs2', 'dota2'], true) && $mode === 'custom') {
        return $isEn ? 'Custom' : 'Кастом';
    }

    return $labels[$mode][$isEn ? 'en' : 'ru'] ?? $mode;
}

function tactics_mode_field_label(string $game, string $lang = 'ru'): string {
    $game = tactics_sanitize_game($game);

    return in_array($game, ['cs2', 'dota2'], true)
        ? ($lang === 'en' ? 'Map type' : 'Тип карты')
        : ($lang === 'en' ? 'Battle mode' : 'Режим боя');
}

function tactics_game_uses_legacy_catalog(string $game): bool {
    return in_array(tactics_sanitize_game($game), ['wot', 'lesta'], true);
}

function tactics_load_map_metadata_games(): array {
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }

    $cache = [];
    $path = __DIR__ . '/../scripts/lesta_maps_metadata.json';
    $raw = @file_get_contents($path);
    $data = $raw ? json_decode($raw, true) : null;
    if (!is_array($data)) {
        return $cache;
    }

    foreach ($data as $code => $row) {
        $code = strtolower(trim((string) $code));
        if ($code === '') {
            continue;
        }
        $games = [];
        foreach ((array) ($row['games'] ?? []) as $game) {
            $games[] = tactics_sanitize_game((string) $game);
        }
        $cache[$code] = array_values(array_unique($games));
    }

    return $cache;
}

function tactics_map_allowed_for_game(string $code, string $game): bool {
    $game = tactics_sanitize_game($game);
    if (!in_array($game, ['wot', 'lesta'], true)) {
        return true;
    }

    $code = strtolower(trim($code));
    $metaGames = tactics_load_map_metadata_games();
    if (isset($metaGames[$code])) {
        return in_array($game, $metaGames[$code], true);
    }

    $filtered = tactics_filter_maps_for_game([$code], $game);

    return in_array($code, $filtered, true);
}

function tactics_is_variant_map_code(string $mapCode): bool {
    return (bool) preg_match('/(_att|_def|_ny)$/', $mapCode)
        || strpos($mapCode, 'bf_epic_') === 0
        || strpos($mapCode, 'epic_') === 0;
}

function tactics_filter_maps_for_game(array $mapCodes, string $game): array {
    $game = tactics_sanitize_game($game);
    $lestaOnly = array_flip(TACTICS_LESTA_ONLY_MAPS);
    $wotOnly = array_flip(TACTICS_WOT_ONLY_MAPS);

    return array_values(array_filter($mapCodes, static function (string $code) use ($game, $lestaOnly, $wotOnly): bool {
        if ($game === 'lesta' && isset($wotOnly[$code])) {
            return false;
        }
        if ($game === 'wot' && isset($lestaOnly[$code])) {
            return false;
        }

        return true;
    }));
}

function tactics_filter_maps_for_mode(array $mapCodes, string $mode): array {
    $mode = tactics_sanitize_battle_mode($mode);

    if ($mode === 'random') {
        return array_values(array_filter($mapCodes, static function (string $code): bool {
            return !tactics_is_variant_map_code($code);
        }));
    }

    if ($mode === 'encounter') {
        $allowed = array_flip(TACTICS_ENCOUNTER_MAPS);

        return array_values(array_filter($mapCodes, static function (string $code) use ($allowed): bool {
            return isset($allowed[$code]);
        }));
    }

    if ($mode === 'assault') {
        $allowed = array_flip(TACTICS_ASSAULT_MAPS);

        return array_values(array_filter($mapCodes, static function (string $code) use ($allowed): bool {
            return isset($allowed[$code]);
        }));
    }

    return [];
}

function tactics_map_in_legacy_mode(string $code, array $gameCodes, string $mode, string $game = 'wot'): bool {
    if (!tactics_game_uses_legacy_catalog($game)) {
        return false;
    }
    if (!in_array($code, $gameCodes, true)) {
        return false;
    }
    $filtered = tactics_filter_maps_for_mode($gameCodes, $mode);

    return in_array($code, $filtered, true);
}

function tactics_custom_map_code_for_game(string $game): ?string {
    $game = tactics_sanitize_game($game);
    if ($game === 'cs2') {
        return TACTICS_CS2_CUSTOM_MAP_CODE;
    }
    if ($game === 'dota2') {
        return TACTICS_DOTA2_CUSTOM_MAP_CODE;
    }

    return null;
}

function tactics_custom_map_row(string $game, string $lang = 'ru'): array {
    $code = tactics_custom_map_code_for_game($game) ?? 'custom';

    return [
        'map_code' => $code,
        'display_name_ru' => 'Своя карта (загрузка в комнате)',
        'display_name_en' => 'Custom map (upload in room)',
        'side_length' => null,
        'upload_in_room' => true,
    ];
}

function tactics_cs2_custom_map_row(string $lang = 'ru'): array {
    return tactics_custom_map_row('cs2', $lang);
}

function tactics_map_names_index(): array {
    static $index = null;
    if ($index !== null) {
        return $index;
    }
    $path = __DIR__ . '/tactics_map_names.json';
    if (!is_file($path)) {
        $index = ['by_code' => [], 'by_arena' => []];

        return $index;
    }
    $json = json_decode((string) file_get_contents($path), true);
    $index = is_array($json) ? $json : ['by_code' => [], 'by_arena' => []];

    return $index;
}

function tactics_map_lookup_code(string $mapCode): string {
    $mapCode = strtolower(trim($mapCode));
    if ($mapCode === '') {
        return '';
    }
    if (preg_match('/_sw$/', $mapCode)) {
        $mapCode = substr($mapCode, 0, -3);
    }
    if (preg_match('/^\d+_(.+)$/', $mapCode, $m)) {
        return $m[1];
    }

    return $mapCode;
}

function tactics_map_name_entry(string $mapCode): ?array {
    $mapCode = strtolower(trim($mapCode));
    if ($mapCode === '') {
        return null;
    }
    $index = tactics_map_names_index();
    $byCode = $index['by_code'] ?? [];
    $byArena = $index['by_arena'] ?? [];
    if (isset($byCode[$mapCode])) {
        return $byCode[$mapCode];
    }
    if (isset($byArena[$mapCode])) {
        return $byArena[$mapCode];
    }
    $lookup = tactics_map_lookup_code($mapCode);
    if ($lookup !== $mapCode && isset($byCode[$lookup])) {
        return $byCode[$lookup];
    }

    return null;
}

function tactics_map_display_name(string $mapCode, string $lang = 'ru'): ?string {
    $entry = tactics_map_name_entry($mapCode);
    if ($entry === null) {
        return null;
    }
    $isEn = $lang === 'en';
    $name = $isEn ? (string) ($entry['en'] ?? '') : (string) ($entry['ru'] ?? '');
    if ($name === '') {
        $name = $isEn ? (string) ($entry['ru'] ?? '') : (string) ($entry['en'] ?? '');
    }

    return $name !== '' ? $name : null;
}

function tactics_apply_map_display_names(array $row): array {
    $code = (string) ($row['map_code'] ?? '');
    $resolved = tactics_map_name_entry($code);
    if ($resolved === null) {
        return $row;
    }
    $row['display_name_ru'] = (string) ($resolved['ru'] ?? $row['display_name_ru'] ?? $code);
    $row['display_name_en'] = (string) ($resolved['en'] ?? $row['display_name_en'] ?? $code);

    return $row;
}

function tactics_spawn_overrides_path(): string {
    return __DIR__ . '/tactics_map_spawns_overrides.json';
}

function tactics_load_spawn_overrides_raw(): array {
    $path = tactics_spawn_overrides_path();
    if (!is_file($path)) {
        return [];
    }
    $json = json_decode((string) file_get_contents($path), true);

    return is_array($json) ? $json : [];
}

function tactics_tankist_spawn_entry(string $mapCode): ?array {
    static $maps = null;
    if ($maps === null) {
        $path = __DIR__ . '/tactics_tankist_spawns.json';
        if (!is_file($path)) {
            $maps = [];

            return null;
        }
        $json = json_decode((string) file_get_contents($path), true);
        $maps = is_array($json['maps'] ?? null) ? $json['maps'] : [];
    }
    $code = strtolower(trim($mapCode));
    if ($code === '') {
        return null;
    }
    $entry = $maps[$code] ?? null;

    return is_array($entry) ? $entry : null;
}

function tactics_normalize_marker_scale($value): float {
    if (!is_numeric($value)) {
        return 1.0;
    }
    $scale = (float) $value;
    if ($scale < 0.5) {
        $scale = 0.5;
    } elseif ($scale > 2.0) {
        $scale = 2.0;
    }

    return round($scale, 2);
}

function tactics_normalize_spawn_points(array $points): array {
    $out = [];
    foreach ($points as $point) {
        if (!is_array($point)) {
            continue;
        }
        $type = strtolower(trim((string) ($point['point_type'] ?? '')));
        $team = strtolower(trim((string) ($point['team'] ?? '')));
        if (!in_array($type, ['spawn', 'base', 'control_point'], true)) {
            continue;
        }
        if ($type !== 'control_point' && $team === '') {
            continue;
        }
        if (!is_numeric($point['x'] ?? null) || !is_numeric($point['y'] ?? null)) {
            continue;
        }
        $row = [
            'point_type' => $type,
            'x' => (float) $point['x'],
            'y' => (float) $point['y'],
        ];
        if ($team !== '') {
            $row['team'] = $team;
        }
        $label = trim((string) ($point['label'] ?? ''));
        if ($label !== '') {
            $row['label'] = $label;
        }
        if ($type === 'base') {
            $baseNumber = trim((string) ($point['base_number'] ?? ''));
            if ($baseNumber !== '' && preg_match('/^[0-9]{1,3}$/', $baseNumber)) {
                $row['base_number'] = $baseNumber;
            }
        }
        if (array_key_exists('marker_scale', $point)) {
            $scale = tactics_normalize_marker_scale($point['marker_scale']);
            if (abs($scale - 1.0) >= 0.001) {
                $row['marker_scale'] = $scale;
            }
        }
        $out[] = $row;
    }

    return $out;
}

function tactics_spawn_bounds_from_entry(?array $entry): ?array {
    if (!is_array($entry)) {
        return null;
    }
    $bounds = $entry['bounds'] ?? null;
    if (!is_array($bounds)) {
        return null;
    }
    foreach (['min_x', 'min_y', 'max_x', 'max_y'] as $key) {
        if (!is_numeric($bounds[$key] ?? null)) {
            return null;
        }
    }

    return [
        'min_x' => (float) $bounds['min_x'],
        'min_y' => (float) $bounds['min_y'],
        'max_x' => (float) $bounds['max_x'],
        'max_y' => (float) $bounds['max_y'],
    ];
}

function tactics_apply_legacy_mode_marker_scale(array $points, $legacyScale): array {
    $scale = tactics_normalize_marker_scale($legacyScale);
    if (abs($scale - 1.0) < 0.001) {
        return $points;
    }
    $out = [];
    foreach ($points as $point) {
        if (!is_array($point)) {
            continue;
        }
        if (!array_key_exists('marker_scale', $point)) {
            $point['marker_scale'] = $scale;
        }
        $out[] = $point;
    }

    return $out;
}

function tactics_spawn_mode_defaults(string $mapCode, string $battleMode): array {
    $entry = tactics_tankist_spawn_entry($mapCode);
    $mode = strtolower(trim($battleMode));
    if ($entry === null || $mode === '') {
        return ['bounds' => null, 'points' => []];
    }
    $modeEntry = $entry['modes'][$mode] ?? null;
    if (!is_array($modeEntry)) {
        return ['bounds' => null, 'points' => []];
    }

    return [
        'bounds' => tactics_spawn_bounds_from_entry($entry),
        'points' => tactics_normalize_spawn_points(is_array($modeEntry['points'] ?? null) ? $modeEntry['points'] : []),
    ];
}

function tactics_spawn_points_equal(array $left, array $right): bool {
    return json_encode($left, JSON_UNESCAPED_UNICODE) === json_encode($right, JSON_UNESCAPED_UNICODE);
}

function tactics_admin_get_map_spawns(string $mapCode, string $battleMode): array {
    $code = strtolower(trim($mapCode));
    $mode = strtolower(trim($battleMode));
    $defaults = tactics_spawn_mode_defaults($code, $mode);
    $overrides = tactics_load_spawn_overrides_raw();
    $custom = $overrides[$code][$mode] ?? null;
    $bounds = $defaults['bounds'];
    $points = $defaults['points'];
    $hasOverride = false;
    if (is_array($custom)) {
        if (is_array($custom['bounds'] ?? null)) {
            $parsedBounds = tactics_spawn_bounds_from_entry(['bounds' => $custom['bounds']]);
            if ($parsedBounds !== null) {
                $bounds = $parsedBounds;
            }
        }
        if (array_key_exists('points', $custom) && is_array($custom['points'])) {
            $rawPoints = $custom['points'];
            if (array_key_exists('marker_scale', $custom)) {
                $rawPoints = tactics_apply_legacy_mode_marker_scale($rawPoints, $custom['marker_scale']);
            }
            $points = tactics_normalize_spawn_points($rawPoints);
        }
        $hasOverride = !tactics_spawn_points_equal($points, $defaults['points'])
            || ($bounds !== null && $defaults['bounds'] !== null
                && json_encode($bounds) !== json_encode($defaults['bounds']));
    }

    return [
        'map_code' => $code,
        'battle_mode' => $mode,
        'bounds' => $bounds,
        'points' => $points,
        'defaults' => $defaults,
        'has_override' => $hasOverride,
    ];
}

function tactics_admin_save_map_spawns(
    string $mapCode,
    string $battleMode,
    array $points,
    ?array $bounds = null,
): array {
    require_once __DIR__ . '/../includes/tactics_helpers.php';

    $code = strtolower(trim($mapCode));
    $mode = strtolower(trim($battleMode));
    if ($code === '' || $mode === '') {
        return ['ok' => false, 'error' => 'invalid_map'];
    }
    if (!in_array($mode, TACTICS_WOT_MODES, true)) {
        return ['ok' => false, 'error' => 'invalid_mode'];
    }

    $defaults = tactics_spawn_mode_defaults($code, $mode);
    $normalized = tactics_normalize_spawn_points($points);
    $boundsOut = $defaults['bounds'];
    if (is_array($bounds)) {
        $parsedBounds = tactics_spawn_bounds_from_entry(['bounds' => $bounds]);
        if ($parsedBounds !== null) {
            $boundsOut = $parsedBounds;
        }
    }

    $samePoints = tactics_spawn_points_equal($normalized, $defaults['points']);
    $sameBounds = $boundsOut === null || $defaults['bounds'] === null
        || json_encode($boundsOut) === json_encode($defaults['bounds']);
    $sameAsDefault = $samePoints && $sameBounds;

    $overrides = tactics_load_spawn_overrides_raw();
    if ($sameAsDefault) {
        if (isset($overrides[$code][$mode])) {
            unset($overrides[$code][$mode]);
            if ($overrides[$code] === []) {
                unset($overrides[$code]);
            }
        }
    } else {
        if (!isset($overrides[$code]) || !is_array($overrides[$code])) {
            $overrides[$code] = [];
        }
        $entry = [];
        if (!$samePoints) {
            $entry['points'] = $normalized;
        }
        if (!$sameBounds && $boundsOut !== null) {
            $entry['bounds'] = $boundsOut;
        }
        $overrides[$code][$mode] = $entry;
    }

    $path = tactics_spawn_overrides_path();
    $dir = dirname($path);
    if (!tactics_admin_ensure_writable_dir($dir)) {
        return ['ok' => false, 'error' => 'mkdir_failed'];
    }

    $encoded = json_encode($overrides, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($encoded === false || file_put_contents($path, $encoded . "\n", LOCK_EX) === false) {
        return ['ok' => false, 'error' => 'write_failed'];
    }

    return ['ok' => true, 'data' => tactics_admin_get_map_spawns($code, $mode)];
}

function tactics_load_tankist_spawns_for_client(): array {
    static $cache = null;
    static $cacheMtime = null;

    $paths = [
        __DIR__ . '/tactics_tankist_spawns.json',
        tactics_spawn_overrides_path(),
    ];
    $mtime = 0;
    foreach ($paths as $path) {
        if (is_file($path)) {
            $mtime = max($mtime, (int) filemtime($path));
        }
    }
    if ($cache !== null && $cacheMtime === $mtime) {
        return $cache;
    }

    $path = __DIR__ . '/tactics_tankist_spawns.json';
    if (!is_file($path)) {
        $cache = [];
        $cacheMtime = $mtime;

        return $cache;
    }

    $json = json_decode((string) file_get_contents($path), true);
    $maps = is_array($json['maps'] ?? null) ? $json['maps'] : [];
    $overrides = tactics_load_spawn_overrides_raw();
    $out = [];
    foreach ($maps as $code => $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $modes = [];
        $mapBounds = is_array($entry['bounds'] ?? null) ? $entry['bounds'] : null;
        foreach (($entry['modes'] ?? []) as $mode => $modeEntry) {
            if (!is_array($modeEntry)) {
                continue;
            }
            if ($mode !== 'random' && in_array($code, TACTICS_RANDOM_ONLY_MAPS, true)) {
                continue;
            }
            $points = is_array($modeEntry['points'] ?? null) ? $modeEntry['points'] : [];
            $custom = $overrides[$code][$mode] ?? null;
            if (is_array($custom)) {
                if (is_array($custom['points'] ?? null)) {
                    $rawPoints = $custom['points'];
                    if (array_key_exists('marker_scale', $custom)) {
                        $rawPoints = tactics_apply_legacy_mode_marker_scale($rawPoints, $custom['marker_scale']);
                    }
                    $points = tactics_normalize_spawn_points($rawPoints);
                }
                if (is_array($custom['bounds'] ?? null)) {
                    $parsedBounds = tactics_spawn_bounds_from_entry(['bounds' => $custom['bounds']]);
                    if ($parsedBounds !== null) {
                        $mapBounds = $parsedBounds;
                    }
                }
            }
            $modes[$mode] = [
                'label_ru' => (string) ($modeEntry['label_ru'] ?? ''),
                'points' => $points,
            ];
        }
        if ($modes === []) {
            continue;
        }
        $out[(string) $code] = [
            'bounds' => $mapBounds,
            'modes' => $modes,
        ];
        if (is_array($overrides[$code] ?? null)) {
            foreach ($overrides[$code] as $mode => $custom) {
                if (!is_array($custom) || isset($modes[$mode])) {
                    continue;
                }
                $rawPoints = is_array($custom['points'] ?? null) ? $custom['points'] : [];
                if (array_key_exists('marker_scale', $custom)) {
                    $rawPoints = tactics_apply_legacy_mode_marker_scale($rawPoints, $custom['marker_scale']);
                }
                $modes[$mode] = [
                    'label_ru' => '',
                    'points' => tactics_normalize_spawn_points($rawPoints),
                ];
                if (is_array($custom['bounds'] ?? null)) {
                    $parsedBounds = tactics_spawn_bounds_from_entry(['bounds' => $custom['bounds']]);
                    if ($parsedBounds !== null) {
                        $out[(string) $code]['bounds'] = $parsedBounds;
                    }
                }
            }
        }
    }

    $cache = $out;
    $cacheMtime = $mtime;

    return $cache;
}

function tactics_build_map_catalog(array $rows, string $lang = 'ru', $db = null): array {
    require_once __DIR__ . '/../includes/tactics_helpers.php';

    $allCodes = [];
    $byCode = [];
    foreach ($rows as $row) {
        $code = trim((string) ($row['map_code'] ?? ''));
        if ($code === '') {
            continue;
        }
        $allCodes[] = $code;
        $byCode[$code] = tactics_apply_map_display_names([
            'map_code' => $code,
            'display_name_ru' => (string) ($row['display_name_ru'] ?? $code),
            'display_name_en' => (string) ($row['display_name_en'] ?? $code),
            'side_length' => isset($row['side_length']) && (int) $row['side_length'] > 0
                ? (int) $row['side_length']
                : null,
        ]);
    }

    $assignmentIndex = [];
    if ($db !== null) {
        require_once __DIR__ . '/../includes/tactics_helpers.php';
        $assignmentIndex = tactics_fetch_map_assignment_index($db);
    }

    $games = [];
    foreach (TACTICS_GAMES as $game) {
        $modes = [];
        foreach (tactics_game_modes($game) as $mode) {
            if (in_array($game, ['cs2', 'dota2'], true) && $mode === 'custom') {
                $modes[$mode] = [tactics_custom_map_row($game, $lang)];
                continue;
            }

            $modeCodes = [];
            foreach ($assignmentIndex as $code => $gameModes) {
                if (!isset($byCode[$code])) {
                    continue;
                }
                if (empty($gameModes[$game][$mode])) {
                    continue;
                }
                if (!tactics_map_allowed_for_game($code, $game)) {
                    continue;
                }
                if (!tactics_map_has_mode_asset($code, $game, $mode)) {
                    continue;
                }
                if (!tactics_map_allowed_for_mode($code, $mode, $game)) {
                    continue;
                }
                $modeCodes[] = $code;
            }
            $modeCodes = array_values(array_unique($modeCodes));
            $modes[$mode] = tactics_sort_map_rows(array_values(array_map(
                static fn (string $code) => $byCode[$code] ?? [
                    'map_code' => $code,
                    'display_name_ru' => $code,
                    'display_name_en' => $code,
                    'side_length' => null,
                ],
                $modeCodes
            )), $lang);
        }
        $gameModes = tactics_game_modes($game);
        $games[$game] = [
            'id' => $game,
            'label' => tactics_game_label($game, $lang),
            'icon' => tactics_game_icon_url($game),
            'mode_field' => tactics_mode_field_label($game, $lang),
            'modes' => $modes,
            'mode_ids' => $gameModes,
            'default_mode' => $gameModes[0] ?? 'random',
        ];
    }

    $modeLabels = [];
    foreach (TACTICS_GAMES as $game) {
        foreach (tactics_game_modes($game) as $mode) {
            $modeLabels[$mode] = tactics_battle_mode_label($mode, $lang, $game);
        }
    }

    return [
        'games' => $games,
        'mode_labels' => $modeLabels,
        'map_spawns' => tactics_load_tankist_spawns_for_client(),
        'random_only_maps' => TACTICS_RANDOM_ONLY_MAPS,
        'default_game' => 'wot',
        'default_mode' => 'random',
    ];
}

function tactics_game_has_catalog_maps(array $catalogGames, string $game): bool {
    $game = tactics_sanitize_game($game);
    $modes = $catalogGames[$game]['modes'] ?? [];
    foreach ($modes as $rows) {
        if (is_array($rows) && count($rows) > 0) {
            return true;
        }
    }
    return false;
}

function tactics_games_with_catalog_maps(array $catalogGames): array {
    $out = [];
    foreach (TACTICS_GAMES as $game) {
        if (tactics_game_has_catalog_maps($catalogGames, $game)) {
            $out[] = $game;
        }
    }
    return $out;
}

function tactics_project_card_badge_class(string $game): string {
    $map = [
        'wot' => 'project-card-badge--wg',
        'lesta' => 'project-card-badge--lesta',
        'cs2' => 'project-card-badge--cs2',
        'dota2' => 'project-card-badge--dota2',
    ];
    return $map[tactics_sanitize_game($game)] ?? '';
}

function tactics_project_card_badge_label(string $game, string $lang = 'ru'): string {
    if ($game === 'lesta') {
        if (!function_exists('game_api_ru_publisher_name')) {
            require_once __DIR__ . '/../includes/game_api.php';
        }

        return game_api_ru_publisher_name($lang);
    }

    $map = [
        'wot' => 'WG',
        'cs2' => 'CS2',
        'dota2' => 'Dota 2',
    ];
    $game = tactics_sanitize_game($game);
    return $map[$game] ?? tactics_game_label($game);
}

function tactics_project_card_badges_html(array $games, string $lang = 'ru'): string {
    if (!$games) {
        return '';
    }
    $html = '<div class="project-card-badge-row">';
    foreach ($games as $game) {
        if ($game === 'lesta') {
            if (!function_exists('game_api_ru_publisher_badge_span')) {
                require_once __DIR__ . '/../includes/game_api.php';
            }
            $html .= game_api_ru_publisher_badge_span($lang);
            continue;
        }
        $class = tactics_project_card_badge_class($game);
        $label = tactics_project_card_badge_label($game, $lang);
        $html .= '<span class="project-card-badge' . ($class !== '' ? ' ' . $class : '') . '">'
            . htmlspecialchars($label, ENT_QUOTES, 'UTF-8')
            . '</span>';
    }
    return $html . '</div>';
}
