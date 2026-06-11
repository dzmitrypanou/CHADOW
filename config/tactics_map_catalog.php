<?php

const TACTICS_GAMES = ['wot', 'lesta', 'dota2', 'cs2'];

const TACTICS_BATTLE_MODES = ['random', 'encounter', 'assault', 'custom', 'standard', 'defuse', 'hostage', 'wingman'];

const TACTICS_WOT_MODES = ['random', 'encounter', 'assault', 'custom'];

const TACTICS_DOTA2_MODES = ['standard', 'custom'];

const TACTICS_CS2_MODES = ['defuse', 'hostage', 'wingman', 'custom'];

const TACTICS_DOTA2_CUSTOM_MAP_CODE = 'dota2_custom';

const TACTICS_CS2_CUSTOM_MAP_CODE = 'cs2_custom';

/** Карты только на Lesta / «Мир танков». */
const TACTICS_LESTA_ONLY_MAPS = [
    'battle_for_moscow',
    'caucasus',
    'kamchatka',
    'minsk',
    'er_clime',
    'japort',
    'erlenberg_se22_def',
    'poland_se22_def',
    'turningpoint_def',
    'steppes_def',
    'germany_att',
    'ruinberg_att',
    'siegfried_line_att',
    'cosmic_2026',
];

/** Карты только на Wargaming / World of Tanks (нет на Lesta). */
const TACTICS_WOT_ONLY_MAPS = [
    'sweden',
    'westfeld',
    'monastery',
    'eiffel_tower_ctf',
    'dday',
    'bf_epic_desert',
    'bf_epic_normandy',
    'epic_random_valley_att',
    'epic_suburbia',
    'lost_paradise_v',
    'campania_big',
    'last_frontier_v',
];

/** Карты «Остальное»: ивенты, epic, варианты режимов и прочие нестандартные. */
const TACTICS_OTHER_MAPS = [
    'sweden',
    'westfeld',
    'monastery',
    'eiffel_tower_ctf',
    'dday',
    'bf_epic_desert',
    'bf_epic_normandy',
    'epic_random_valley_att',
    'epic_suburbia',
    'lost_paradise_v',
    'campania_big',
    'last_frontier_v',
    'cosmic_2026',
    'battle_for_moscow',
    'caucasus',
    'kamchatka',
    'minsk',
    'er_clime',
    'japort',
];

/** Встречный бой — базовые карты (без суффиксов режимов). */
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
    'karelia',
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

/** Атака/оборона — варианты карт и отдельные коды из словаря. */
const TACTICS_ASSAULT_MAPS = [
    'germany_att',
    'ruinberg_att',
    'siegfried_line_att',
    'steppes_def',
    'erlenberg_se22_def',
    'poland_se22_def',
    'turningpoint_def',
    'karelia',
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
];

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
    if (in_array($game, ['wot', 'lesta'], true) && $mode === 'custom') {
        return $labels['custom'][$isEn ? 'en' : 'ru'];
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

    $other = array_flip(TACTICS_OTHER_MAPS);

    return array_values(array_filter($mapCodes, static function (string $code) use ($other): bool {
        return tactics_is_variant_map_code($code) || isset($other[$code]);
    }));
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

/**
 * @param array<int, array<string, mixed>> $rows map_dictionary rows
 * @param Database|null $db
 * @return array<string, mixed>
 */
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
        $byCode[$code] = [
            'map_code' => $code,
            'display_name_ru' => (string) ($row['display_name_ru'] ?? $code),
            'display_name_en' => (string) ($row['display_name_en'] ?? $code),
            'side_length' => isset($row['side_length']) && (int) $row['side_length'] > 0
                ? (int) $row['side_length']
                : null,
        ];
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
                if (!tactics_map_has_uploaded_asset($code, $game, $mode)) {
                    continue;
                }
                $modeCodes[] = $code;
            }
            $modeCodes = array_values(array_unique($modeCodes));
            sort($modeCodes, SORT_STRING);
            $modes[$mode] = array_values(array_map(
                static fn (string $code) => $byCode[$code] ?? [
                    'map_code' => $code,
                    'display_name_ru' => $code,
                    'display_name_en' => $code,
                    'side_length' => null,
                ],
                $modeCodes
            ));
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
        'default_game' => 'wot',
        'default_mode' => 'random',
    ];
}
