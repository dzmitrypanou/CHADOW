<?php

const BRACKET_FORMATS = ['single', 'double', 'group', 'group_se', 'group_de'];
const BRACKET_MATCH_FORMATS = ['bo1', 'bo3', 'bo7', 'bo9'];
const BRACKET_GAMES = ['wot', 'csgo', 'dota2'];
const BRACKET_WOT_REALMS = ['ru', 'eu', 'na', 'asia'];
const BRACKET_GAME_DEFAULT = 'wot';
const BRACKET_GAME_REALM_DEFAULT = 'ru';
const BRACKET_VISIBILITIES = ['public', 'hidden'];
const BRACKET_STATUSES = ['active', 'hidden'];

const BRACKET_MIN_PARTICIPANTS = 2;
const BRACKET_MAX_PARTICIPANTS = 1024;
const BRACKET_MIN_GROUPS = 2;
const BRACKET_MAX_GROUPS = 32;
const BRACKET_SIZE_OPTIONS = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
const BRACKET_TITLE_MAX_LEN = 120;
const BRACKET_DESCRIPTION_MAX_LEN = 2000;
const BRACKET_PRIZE_VALUE_MAX_LEN = 120;
const BRACKET_GUEST_CREATE_WINDOW_SEC = 3600;
const BRACKET_GUEST_CREATE_MAX = 10;
const BRACKET_GUEST_COOKIE_PREFIX = 'abs_bk_';
const BRACKET_GUEST_COOKIE_TTL_SEC = 86400 * 365;

function bracket_request_is_https(): bool {
    if (function_exists('user_request_is_https')) {
        return user_request_is_https();
    }

    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
}

function bracket_guest_edit_cookie_name(string $publicId): string {
    return BRACKET_GUEST_COOKIE_PREFIX . $publicId;
}

function bracket_guest_edit_cookie_token(string $publicId): ?string {
    if (!bracket_public_id_valid($publicId)) {
        return null;
    }

    $name = bracket_guest_edit_cookie_name($publicId);
    $value = $_COOKIE[$name] ?? null;
    if (!is_string($value) || trim($value) === '') {
        return null;
    }

    return trim($value);
}

function bracket_set_guest_edit_cookie(string $publicId, string $token): void {
    if (!bracket_public_id_valid($publicId) || $token === '' || headers_sent()) {
        return;
    }

    $secure = bracket_request_is_https();
    $name = bracket_guest_edit_cookie_name($publicId);
    $expires = time() + BRACKET_GUEST_COOKIE_TTL_SEC;

    if (PHP_VERSION_ID >= 70300) {
        setcookie($name, $token, [
            'expires' => $expires,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    } else {
        setcookie($name, $token, $expires, '/', '', $secure, true);
    }
}

function bracket_clear_guest_edit_cookie(string $publicId): void {
    if (!bracket_public_id_valid($publicId) || headers_sent()) {
        return;
    }

    $secure = bracket_request_is_https();
    $name = bracket_guest_edit_cookie_name($publicId);

    if (PHP_VERSION_ID >= 70300) {
        setcookie($name, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    } else {
        setcookie($name, '', time() - 3600, '/', '', $secure, true);
    }
}

function bracket_resolve_edit_token(string $publicId, ?string $inputToken): ?string {
    $inputToken = $inputToken !== null ? trim($inputToken) : '';
    if ($inputToken !== '') {
        return $inputToken;
    }

    return bracket_guest_edit_cookie_token($publicId);
}

function bracket_guest_can_edit(array $row, ?string $editToken): bool {
    return bracket_is_guest_owned($row)
        && $editToken !== null
        && $editToken !== ''
        && bracket_edit_token_valid($row, $editToken);
}

function bracket_claim_all_guest_brackets_from_cookies($db, int $userId): array {
    if ($userId <= 0) {
        return [];
    }

    $claimed = [];
    $prefixLen = strlen(BRACKET_GUEST_COOKIE_PREFIX);

    foreach ($_COOKIE as $name => $value) {
        if (!is_string($name) || strpos($name, BRACKET_GUEST_COOKIE_PREFIX) !== 0) {
            continue;
        }
        $publicId = substr($name, $prefixLen);
        if (!bracket_public_id_valid($publicId) || !is_string($value) || trim($value) === '') {
            continue;
        }

        $result = bracket_claim_guest_bracket($db, $publicId, $userId, trim($value));
        if (!empty($result['ok'])) {
            $claimed[] = $publicId;
            bracket_clear_guest_edit_cookie($publicId);
        }
    }

    return $claimed;
}

function bracket_format_valid(string $format): bool {
    return in_array($format, BRACKET_FORMATS, true);
}

function bracket_match_format_valid(string $matchFormat): bool {
    return in_array($matchFormat, BRACKET_MATCH_FORMATS, true);
}

function bracket_match_format_default(): string {
    return 'bo1';
}

function bracket_match_format_wins_needed(string $matchFormat): int {
    $map = ['bo1' => 1, 'bo3' => 2, 'bo7' => 4, 'bo9' => 5];

    return $map[$matchFormat] ?? 1;
}

function bracket_visibility_valid(string $visibility): bool {
    return in_array($visibility, BRACKET_VISIBILITIES, true);
}

function bracket_status_valid(string $status): bool {
    return in_array($status, BRACKET_STATUSES, true);
}

function bracket_public_id_valid(string $publicId): bool {
    return (bool) preg_match('/^[a-zA-Z0-9]{10,16}$/', $publicId);
}

function bracket_format_label(string $format, string $lang = 'ru'): string {
    $labels = [
        'ru' => [
            'single' => 'Single Elimination',
            'double' => 'Double Elimination',
            'group' => 'Group Stage',
            'group_se' => 'Group Stage + SE',
            'group_de' => 'Group Stage + DE',
        ],
        'en' => [
            'single' => 'Single elimination',
            'double' => 'Double elimination',
            'group' => 'Group stage',
            'group_se' => 'Group stage + SE',
            'group_de' => 'Group stage + DE',
        ],
    ];
    $map = $labels[$lang === 'en' ? 'en' : 'ru'] ?? $labels['ru'];

    return $map[$format] ?? $format;
}

function bracket_is_group_family_format(string $format): bool {
    return in_array($format, ['group', 'group_se', 'group_de'], true);
}

function bracket_has_playoff_format(string $format): bool {
    return in_array($format, ['group_se', 'group_de'], true);
}

function bracket_match_format_label(string $matchFormat, string $lang = 'ru'): string {
    $labels = [
        'ru' => [
            'bo1' => 'BO1',
            'bo3' => 'BO3',
            'bo7' => 'BO7',
            'bo9' => 'BO9',
        ],
        'en' => [
            'bo1' => 'BO1',
            'bo3' => 'BO3',
            'bo7' => 'BO7',
            'bo9' => 'BO9',
        ],
    ];
    $map = $labels[$lang === 'en' ? 'en' : 'ru'] ?? $labels['ru'];

    return $map[$matchFormat] ?? strtoupper($matchFormat);
}

function bracket_game_valid(string $game): bool {
    return in_array($game, BRACKET_GAMES, true);
}

function bracket_game_realm_valid(string $realm): bool {
    return in_array($realm, BRACKET_WOT_REALMS, true);
}

function bracket_wot_is_mir_tankov(?string $realm): bool {
    $realm = strtolower(trim((string) ($realm ?? '')));
    return $realm === '' || $realm === 'ru';
}

function bracket_game_icon_url(string $game, ?string $realm = null): string {
    if ($game === 'wot') {
        return bracket_wot_is_mir_tankov($realm)
            ? '/assets/icons/games/mir-tankov.png'
            : '/assets/icons/games/wot-white.png';
    }

    $map = [
        'csgo' => '/assets/icons/games/cs2.png',
        'dota2' => '/assets/icons/games/dota2.png',
    ];

    return $map[$game] ?? bracket_game_icon_url('wot', $realm);
}

function bracket_game_label(string $game, string $lang = 'ru', ?string $realm = null): string {
    if ($game === 'wot') {
        if (bracket_wot_is_mir_tankov($realm)) {
            return $lang === 'en'
                ? 'Mir Tankov'
                : 'Мир танков';
        }

        return 'WoT';
    }

    $labels = [
        'ru' => [
            'csgo' => 'CS2',
            'dota2' => 'Dota 2',
        ],
        'en' => [
            'csgo' => 'CS2',
            'dota2' => 'Dota 2',
        ],
    ];
    $map = $labels[$lang === 'en' ? 'en' : 'ru'] ?? $labels['ru'];

    return $map[$game] ?? $game;
}

function bracket_game_realm_label(string $realm, string $lang = 'ru'): string {
    $labels = [
        'ru' => ['ru' => 'RU', 'eu' => 'EU', 'na' => 'NA', 'asia' => 'ASIA'],
        'en' => ['ru' => 'RU', 'eu' => 'EU', 'na' => 'NA', 'asia' => 'ASIA'],
    ];
    $map = $labels[$lang === 'en' ? 'en' : 'ru'] ?? $labels['ru'];

    return $map[$realm] ?? strtoupper($realm);
}

function bracket_game_display_label(string $game, ?string $realm, string $lang = 'ru'): string {
    if (!bracket_game_valid($game)) {
        return '';
    }

    $label = bracket_game_label($game, $lang, $realm);
    if ($game === 'wot' && $realm !== null && $realm !== '' && bracket_game_realm_valid($realm)
        && !bracket_wot_is_mir_tankov($realm)) {
        return $label . ' · ' . bracket_game_realm_label($realm, $lang);
    }

    return $label;
}

function bracket_validate_game_input(?string $game, ?string $realm, string $lang = 'ru', bool $required = true): array {
    $game = trim((string) ($game ?? ''));
    if ($game === '') {
        if ($required) {
            return ['ok' => false, 'error' => $lang === 'en' ? 'Select a game' : 'Выберите игру'];
        }
        $game = BRACKET_GAME_DEFAULT;
    }

    if (!bracket_game_valid($game)) {
        return ['ok' => false, 'error' => $lang === 'en' ? 'Invalid game' : 'Недопустимая игра'];
    }

    if ($game === 'wot') {
        $realm = trim((string) ($realm ?? ''));
        if ($realm === '') {
            $realm = BRACKET_GAME_REALM_DEFAULT;
        }
        if (!bracket_game_realm_valid($realm)) {
            return ['ok' => false, 'error' => $lang === 'en' ? 'Invalid server region' : 'Недопустимый сервер'];
        }

        return ['ok' => true, 'data' => ['game' => $game, 'game_realm' => $realm]];
    }

    return ['ok' => true, 'data' => ['game' => $game, 'game_realm' => null]];
}

function bracket_visibility_label(string $visibility, string $lang = 'ru'): string {
    $labels = [
        'ru' => ['public' => 'Публичная', 'hidden' => 'По ссылке'],
        'en' => ['public' => 'Public', 'hidden' => 'Unlisted'],
    ];
    $map = $labels[$lang === 'en' ? 'en' : 'ru'] ?? $labels['ru'];

    return $map[$visibility] ?? $visibility;
}

function bracket_status_label(string $status, string $lang = 'ru'): string {
    $labels = [
        'ru' => ['active' => 'Активна', 'hidden' => 'Скрыта модератором'],
        'en' => ['active' => 'Active', 'hidden' => 'Hidden by moderator'],
    ];
    $map = $labels[$lang === 'en' ? 'en' : 'ru'] ?? $labels['ru'];

    return $map[$status] ?? $status;
}

function bracket_generate_public_id($db): string {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $len = strlen($chars);

    for ($attempt = 0; $attempt < 20; $attempt++) {
        $id = '';
        for ($i = 0; $i < 12; $i++) {
            $id .= $chars[random_int(0, $len - 1)];
        }
        $existing = $db->fetchOne(
            'SELECT id FROM tournament_brackets WHERE public_id = ?',
            [$id]
        );
        if (!$existing) {
            return $id;
        }
    }

    throw new RuntimeException('Unable to generate unique public_id');
}

function bracket_generate_edit_token(): string {
    return bin2hex(random_bytes(32));
}

function bracket_bracket_size(int $participantCount): int {
    $n = max(BRACKET_MIN_PARTICIPANTS, min(BRACKET_MAX_PARTICIPANTS, $participantCount));
    $size = 1;
    while ($size < $n) {
        $size *= 2;
    }

    return $size;
}

function bracket_group_winner_prize_tiers(int $groupCount): array {
    $count = max(BRACKET_MIN_GROUPS, min(BRACKET_MAX_GROUPS, $groupCount));
    $tiers = [];
    for ($i = 0; $i < $count; $i++) {
        $tiers[] = 'g' . $i;
    }

    return $tiers;
}

function bracket_resolve_prize_tiers(string $format, int $participantCount, ?array $bracketData = null): array {
    if ($format === 'group') {
        $groupCount = (int) ($bracketData['settings']['groupCount'] ?? BRACKET_MIN_GROUPS);

        return bracket_group_winner_prize_tiers($groupCount);
    }

    return bracket_prize_tiers($participantCount);
}

function bracket_prize_tiers(int $participantCount): array {
    $size = bracket_bracket_size($participantCount);
    $tiers = ['1', '2'];
    if ($size >= 4) {
        $tiers[] = '3-4';
    }
    if ($size >= 8) {
        $tiers[] = '5-8';
    }
    if ($size >= 16) {
        $tiers[] = '9-16';
    }
    if ($size >= 32) {
        $tiers[] = '17-32';
    }
    if ($size >= 64) {
        $tiers[] = '33-64';
    }
    if ($size >= 128) {
        $tiers[] = '65-128';
    }
    if ($size >= 256) {
        $tiers[] = '129-256';
    }
    if ($size >= 512) {
        $tiers[] = '257-512';
    }
    if ($size >= 1024) {
        $tiers[] = '513-1024';
    }

    return $tiers;
}

function bracket_prize_tier_label(string $tier, string $lang = 'ru'): string {
    if (preg_match('/^g(\d+)$/', $tier, $m)) {
        $n = (int) $m[1] + 1;

        return $lang === 'en'
            ? 'Group ' . $n . ' winner'
            : 'Победитель группы ' . $n;
    }
    if (preg_match('/^(\d+)$/', $tier, $m)) {
        $n = (int) $m[1];

        return $lang === 'en' ? bracket_ordinal_en($n) . ' place' : $n . ' место';
    }
    if (preg_match('/^(\d+)-(\d+)$/', $tier, $m)) {
        return $lang === 'en'
            ? $m[1] . '–' . $m[2] . ' place'
            : $m[1] . '–' . $m[2] . ' место';
    }

    return $tier;
}

function bracket_ordinal_en(int $n): string {
    $suffix = 'th';
    if ($n % 100 < 11 || $n % 100 > 13) {
        switch ($n % 10) {
            case 1:
                $suffix = 'st';
                break;
            case 2:
                $suffix = 'nd';
                break;
            case 3:
                $suffix = 'rd';
                break;
        }
    }

    return $n . $suffix;
}

function bracket_tournament_phase(array $row): string {
    if (!empty($row['completed_at'])) {
        return 'completed';
    }

    $starts = $row['starts_at'] ?? null;
    if ($starts !== null && trim((string) $starts) !== '') {
        $ts = strtotime((string) $starts);
        if ($ts !== false && $ts > time()) {
            return 'upcoming';
        }
    }

    return 'live';
}

function bracket_tournament_phase_label(string $phase, string $lang = 'ru'): string {
    $labels = [
        'ru' => [
            'upcoming' => 'Скоро',
            'live' => 'Идёт',
            'completed' => 'Завершён',
        ],
        'en' => [
            'upcoming' => 'Upcoming',
            'live' => 'Live',
            'completed' => 'Completed',
        ],
    ];
    $map = $labels[$lang === 'en' ? 'en' : 'ru'] ?? $labels['ru'];

    return $map[$phase] ?? $phase;
}

function bracket_parse_prize_pool($raw): array {
    if (is_string($raw)) {
        $decoded = json_decode($raw, true);
        $raw = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($raw)) {
        return [];
    }

    $clean = [];
    foreach ($raw as $key => $value) {
        $tier = trim((string) $key);
        if (!preg_match('/^(\d+|\d+-\d+)$/', $tier)) {
            continue;
        }
        $text = trim((string) $value);
        if ($text === '') {
            continue;
        }
        if (mb_strlen($text, 'UTF-8') > BRACKET_PRIZE_VALUE_MAX_LEN) {
            $text = mb_substr($text, 0, BRACKET_PRIZE_VALUE_MAX_LEN, 'UTF-8');
        }
        $clean[$tier] = $text;
    }

    return $clean;
}

function bracket_normalize_starts_at($value): ?string {
    if ($value === null || $value === '') {
        return null;
    }
    $raw = trim((string) $value);
    if ($raw === '') {
        return null;
    }
    $raw = str_replace('T', ' ', $raw);
    $ts = strtotime($raw);
    if ($ts === false) {
        return null;
    }

    return date('Y-m-d H:i:s', $ts);
}

function bracket_validate_prize_pool(array $pool, int $participantCount, string $lang = 'ru', string $format = 'single', ?array $bracketData = null): array {
    $allowed = array_flip(bracket_resolve_prize_tiers($format, $participantCount, $bracketData));
    $clean = [];
    foreach ($pool as $tier => $value) {
        $tierKey = (string) $tier;
        if (!isset($allowed[$tierKey])) {
            continue;
        }
        $text = trim((string) $value);
        if ($text === '') {
            continue;
        }
        if (mb_strlen($text, 'UTF-8') > BRACKET_PRIZE_VALUE_MAX_LEN) {
            return [
                'ok' => false,
                'error' => $lang === 'en' ? 'Prize text too long' : 'Слишком длинное описание приза',
            ];
        }
        $clean[$tierKey] = $text;
    }

    return ['ok' => true, 'data' => $clean];
}

function bracket_validate_meta_input(array $input, string $lang = 'ru', ?int $participantCount = null, string $format = 'single', ?array $bracketData = null): array {
    $result = [];

    if (array_key_exists('description', $input)) {
        $description = trim((string) $input['description']);
        if (mb_strlen($description, 'UTF-8') > BRACKET_DESCRIPTION_MAX_LEN) {
            return [
                'ok' => false,
                'error' => $lang === 'en' ? 'Description too long' : 'Слишком длинное описание',
            ];
        }
        $result['description'] = $description !== '' ? $description : null;
    }

    if (array_key_exists('starts_at', $input)) {
        $starts = $input['starts_at'];
        if ($starts === null || $starts === '') {
            $result['starts_at'] = null;
        } else {
            $normalized = bracket_normalize_starts_at($starts);
            if ($normalized === null) {
                return [
                    'ok' => false,
                    'error' => $lang === 'en' ? 'Invalid start date' : 'Некорректная дата старта',
                ];
            }
            $result['starts_at'] = $normalized;
        }
    }

    if (array_key_exists('prize_pool', $input)) {
        if ($participantCount === null || $participantCount < BRACKET_MIN_PARTICIPANTS) {
            return [
                'ok' => false,
                'error' => $lang === 'en' ? 'Participants required for prizes' : 'Нужны участники для призов',
            ];
        }
        $poolRaw = is_array($input['prize_pool']) ? $input['prize_pool'] : [];
        $poolCheck = bracket_validate_prize_pool($poolRaw, $participantCount, $lang, $format, $bracketData);
        if (!$poolCheck['ok']) {
            return $poolCheck;
        }
        $result['prize_pool'] = $poolCheck['data'];
    }

    if (!empty($input['mark_completed'])) {
        $result['completed_at'] = 'NOW';
    } elseif (!empty($input['reopen_tournament'])) {
        $result['completed_at'] = null;
    }

    return ['ok' => true, 'data' => $result];
}

function bracket_sanitize_participant_name(string $name): string {
    $name = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $name) ?? '');
    if (mb_strlen($name, 'UTF-8') > 80) {
        $name = mb_substr($name, 0, 80, 'UTF-8');
    }

    return $name;
}

function bracket_normalize_bracket_size($size): int {
    $n = (int) $size;

    return in_array($n, BRACKET_SIZE_OPTIONS, true) ? $n : 8;
}

function bracket_normalize_participant_slots(array $participants, ?int $bracketSize = null): array {
    $normalized = [];
    foreach ($participants as $p) {
        if (!is_string($p) && !is_numeric($p)) {
            $normalized[] = '';
            continue;
        }
        $raw = trim((string) $p);
        if ($raw === '') {
            $normalized[] = '';
            continue;
        }
        if (preg_match('/^BYE\b/i', $raw)) {
            $normalized[] = mb_strlen($raw, 'UTF-8') > 80 ? mb_substr($raw, 0, 80, 'UTF-8') : $raw;
            continue;
        }
        $normalized[] = bracket_sanitize_participant_name($raw);
    }

    if ($bracketSize !== null && $bracketSize >= BRACKET_MIN_PARTICIPANTS) {
        $target = bracket_normalize_bracket_size($bracketSize);
        if (count($normalized) < $target) {
            $normalized = array_pad($normalized, $target, '');
        } elseif (count($normalized) > $target) {
            $normalized = array_slice($normalized, 0, $target);
        }
    }

    return $normalized;
}

function bracket_filled_participant_count(array $participants): int {
    $count = 0;
    foreach ($participants as $name) {
        if (!is_string($name)) {
            continue;
        }
        if ($name !== '' && !preg_match('/^BYE\b/i', $name)) {
            $count++;
        }
    }

    return $count;
}

function bracket_validate_bracket_data($data, string $lang = 'ru'): array {
    if (!is_array($data)) {
        return ['ok' => false, 'error' => $lang === 'en' ? 'Invalid bracket data' : 'Некорректные данные сетки'];
    }

    $participants = $data['participants'] ?? null;
    if (!is_array($participants)) {
        return ['ok' => false, 'error' => $lang === 'en' ? 'Participants required' : 'Укажите участников'];
    }

    $settings = is_array($data['settings'] ?? null) ? $data['settings'] : [];
    $bracketSize = null;
    if (array_key_exists('bracketSize', $settings)) {
        $bracketSize = bracket_normalize_bracket_size($settings['bracketSize']);
        $settings['bracketSize'] = $bracketSize;
    }

    $cleanParticipants = bracket_normalize_participant_slots($participants, $bracketSize);

    $count = bracket_filled_participant_count($cleanParticipants);
    if ($count < BRACKET_MIN_PARTICIPANTS) {
        return [
            'ok' => false,
            'error' => $lang === 'en'
                ? 'At least ' . BRACKET_MIN_PARTICIPANTS . ' participants required'
                : 'Минимум ' . BRACKET_MIN_PARTICIPANTS . ' участника',
        ];
    }
    if ($count > BRACKET_MAX_PARTICIPANTS) {
        return [
            'ok' => false,
            'error' => $lang === 'en'
                ? 'Maximum ' . BRACKET_MAX_PARTICIPANTS . ' participants'
                : 'Максимум ' . BRACKET_MAX_PARTICIPANTS . ' участников',
        ];
    }

    $matches = $data['matches'] ?? null;
    if (!is_array($matches)) {
        return ['ok' => false, 'error' => $lang === 'en' ? 'Matches required' : 'Некорректная структура матчей'];
    }

    return [
        'ok' => true,
        'data' => [
            'participants' => $cleanParticipants,
            'settings' => $settings,
            'matches' => $matches,
        ],
    ];
}

function bracket_validate_create_input(array $input, string $lang = 'ru'): array {
    $title = trim((string) ($input['title'] ?? ''));
    if ($title === '') {
        return ['ok' => false, 'error' => $lang === 'en' ? 'Title required' : 'Укажите название'];
    }
    if (mb_strlen($title, 'UTF-8') > BRACKET_TITLE_MAX_LEN) {
        return [
            'ok' => false,
            'error' => $lang === 'en'
                ? 'Title too long (max ' . BRACKET_TITLE_MAX_LEN . ')'
                : 'Название не длиннее ' . BRACKET_TITLE_MAX_LEN . ' символов',
        ];
    }

    $format = trim((string) ($input['format'] ?? ''));
    if (!bracket_format_valid($format)) {
        return ['ok' => false, 'error' => $lang === 'en' ? 'Invalid format' : 'Недопустимый формат'];
    }

    $matchFormat = trim((string) ($input['match_format'] ?? bracket_match_format_default()));
    if ($matchFormat === '') {
        $matchFormat = bracket_match_format_default();
    }
    if (!bracket_match_format_valid($matchFormat)) {
        return ['ok' => false, 'error' => $lang === 'en' ? 'Invalid match format' : 'Недопустимый формат матчей'];
    }

    $gameCheck = bracket_validate_game_input(
        isset($input['game']) ? (string) $input['game'] : BRACKET_GAME_DEFAULT,
        isset($input['game_realm']) ? (string) $input['game_realm'] : BRACKET_GAME_REALM_DEFAULT,
        $lang,
        true
    );
    if (!$gameCheck['ok']) {
        return $gameCheck;
    }

    $visibility = trim((string) ($input['visibility'] ?? 'public'));
    if ($visibility === '') {
        $visibility = 'public';
    }
    if (!bracket_visibility_valid($visibility)) {
        return ['ok' => false, 'error' => $lang === 'en' ? 'Invalid visibility' : 'Недопустимая видимость'];
    }

    $bracketDataCheck = bracket_validate_bracket_data($input['bracket_data'] ?? null, $lang);
    if (!$bracketDataCheck['ok']) {
        return $bracketDataCheck;
    }

    $participantCount = count($bracketDataCheck['data']['participants'] ?? []);
    $metaCheck = bracket_validate_meta_input(
        $input,
        $lang,
        $participantCount,
        $format,
        $bracketDataCheck['data']
    );
    if (!$metaCheck['ok']) {
        return $metaCheck;
    }

    return [
        'ok' => true,
        'data' => array_merge(
            [
                'title' => $title,
                'format' => $format,
                'match_format' => $matchFormat,
                'game' => $gameCheck['data']['game'],
                'game_realm' => $gameCheck['data']['game_realm'],
                'visibility' => $visibility,
                'bracket_data' => $bracketDataCheck['data'],
            ],
            $metaCheck['data']
        ),
    ];
}

function bracket_validate_update_input(array $input, string $lang = 'ru', ?int $participantCountHint = null, string $format = 'single', ?array $bracketDataHint = null): array {
    $result = ['ok' => true, 'data' => []];

    if (array_key_exists('title', $input)) {
        $title = trim((string) $input['title']);
        if ($title === '') {
            return ['ok' => false, 'error' => $lang === 'en' ? 'Title required' : 'Укажите название'];
        }
        if (mb_strlen($title, 'UTF-8') > BRACKET_TITLE_MAX_LEN) {
            return [
                'ok' => false,
                'error' => $lang === 'en' ? 'Title too long' : 'Слишком длинное название',
            ];
        }
        $result['data']['title'] = $title;
    }

    if (array_key_exists('visibility', $input)) {
        $visibility = trim((string) $input['visibility']);
        if (!bracket_visibility_valid($visibility)) {
            return ['ok' => false, 'error' => $lang === 'en' ? 'Invalid visibility' : 'Недопустимая видимость'];
        }
        $result['data']['visibility'] = $visibility;
    }

    if (array_key_exists('match_format', $input)) {
        $matchFormat = trim((string) $input['match_format']);
        if (!bracket_match_format_valid($matchFormat)) {
            return ['ok' => false, 'error' => $lang === 'en' ? 'Invalid match format' : 'Недопустимый формат матчей'];
        }
        $result['data']['match_format'] = $matchFormat;
    }

    if (array_key_exists('game', $input) || array_key_exists('game_realm', $input)) {
        $gameCheck = bracket_validate_game_input(
            array_key_exists('game', $input) ? (string) $input['game'] : BRACKET_GAME_DEFAULT,
            array_key_exists('game_realm', $input) ? (string) $input['game_realm'] : null,
            $lang,
            array_key_exists('game', $input)
        );
        if (!$gameCheck['ok']) {
            return $gameCheck;
        }
        $result['data']['game'] = $gameCheck['data']['game'];
        $result['data']['game_realm'] = $gameCheck['data']['game_realm'];
    }

    $participantCount = null;
    if (array_key_exists('bracket_data', $input)) {
        $bracketDataCheck = bracket_validate_bracket_data($input['bracket_data'], $lang);
        if (!$bracketDataCheck['ok']) {
            return $bracketDataCheck;
        }
        $result['data']['bracket_data'] = $bracketDataCheck['data'];
        $participantCount = count($bracketDataCheck['data']['participants'] ?? []);
    }

    $metaFields = ['description', 'starts_at', 'prize_pool', 'mark_completed', 'reopen_tournament'];
    $hasMeta = false;
    foreach ($metaFields as $field) {
        if (array_key_exists($field, $input)) {
            $hasMeta = true;
            break;
        }
    }

    if ($hasMeta) {
        $metaInput = [];
        foreach (['description', 'starts_at', 'prize_pool', 'mark_completed', 'reopen_tournament'] as $field) {
            if (array_key_exists($field, $input)) {
                $metaInput[$field] = $input[$field];
            }
        }
        if ($participantCount === null && array_key_exists('prize_pool', $metaInput)) {
            $participantCount = $participantCountHint;
        }
        if ($participantCount === null && array_key_exists('prize_pool', $metaInput)) {
            return [
                'ok' => false,
                'error' => $lang === 'en' ? 'Save bracket before editing prizes' : 'Сначала сохраните состав участников',
            ];
        }
        $metaCheck = bracket_validate_meta_input(
            $metaInput,
            $lang,
            $participantCount,
            $format,
            $result['data']['bracket_data'] ?? $bracketDataHint
        );
        if (!$metaCheck['ok']) {
            return $metaCheck;
        }
        $result['data'] = array_merge($result['data'], $metaCheck['data']);
    }

    if ($result['data'] === []) {
        return ['ok' => false, 'error' => $lang === 'en' ? 'Nothing to update' : 'Нет данных для обновления'];
    }

    return $result;
}

function bracket_is_publicly_visible(array $row): bool {
    return (string) ($row['status'] ?? '') === 'active';
}

function bracket_is_catalog_visible(array $row): bool {
    return bracket_is_publicly_visible($row)
        && (string) ($row['visibility'] ?? '') === 'public';
}

function bracket_row_owner_id(array $row): ?int {
    if (!array_key_exists('user_id', $row) || $row['user_id'] === null || $row['user_id'] === '') {
        return null;
    }

    return (int) $row['user_id'];
}

function bracket_creator_display_name($db, array $row, string $lang = 'ru'): ?string {
    $ownerId = bracket_row_owner_id($row);
    if ($ownerId === null) {
        return null;
    }

    $profile = null;
    if (array_key_exists('username', $row) || array_key_exists('owner_username', $row)) {
        $profile = [
            'username' => $row['owner_username'] ?? $row['username'] ?? '',
            'wg_account_id' => $row['owner_wg_account_id'] ?? $row['wg_account_id'] ?? 0,
            'wg_nickname' => $row['owner_wg_nickname'] ?? $row['wg_nickname'] ?? '',
            'wg_realm' => $row['owner_wg_realm'] ?? $row['wg_realm'] ?? '',
            'game_nickname_ru' => $row['owner_game_nickname_ru'] ?? $row['game_nickname_ru'] ?? '',
            'game_nickname_eu' => $row['owner_game_nickname_eu'] ?? $row['game_nickname_eu'] ?? '',
            'game_nickname_na' => $row['owner_game_nickname_na'] ?? $row['game_nickname_na'] ?? '',
            'game_nickname_asia' => $row['owner_game_nickname_asia'] ?? $row['game_nickname_asia'] ?? '',
        ];
    } elseif ($db !== null) {
        if (!function_exists('user_login_row')) {
            require_once __DIR__ . '/user_auth.php';
        }
        $profile = user_login_row($db, $ownerId);
    }
    if (!$profile) {
        return null;
    }

    $game = bracket_game_valid((string) ($row['game'] ?? ''))
        ? (string) $row['game']
        : BRACKET_GAME_DEFAULT;

    if (!function_exists('user_game_nicknames_state')) {
        require_once __DIR__ . '/user_auth.php';
    }

    if ($game === 'wot') {
        $realm = bracket_game_realm_valid((string) ($row['game_realm'] ?? ''))
            ? (string) $row['game_realm']
            : BRACKET_GAME_REALM_DEFAULT;
        $nickState = user_game_nicknames_state($profile);
        $nick = trim((string) ($nickState[$realm]['value'] ?? ''));
        if ($nick !== '' && !preg_match('/^#\d+$/', $nick)) {
            return $nick;
        }
    }

    $username = trim((string) ($profile['username'] ?? ''));

    return $username !== '' ? $username : null;
}

function bracket_is_guest_owned(array $row): bool {
    return bracket_row_owner_id($row) === null;
}

function bracket_edit_token_valid(array $row, ?string $editToken): bool {
    if ($editToken === null || $editToken === '') {
        return false;
    }

    $storedHash = (string) ($row['edit_token'] ?? '');

    return $storedHash !== '' && password_verify($editToken, $storedHash);
}

function bracket_assert_owner($db, array $row, ?int $userId, ?string $editToken): array {
    $ownerId = bracket_row_owner_id($row);

    if ($ownerId !== null) {
        if ($userId !== null && $userId === $ownerId) {
            return ['ok' => true];
        }

        return ['ok' => false, 'error' => 'Нет прав на редактирование'];
    }

    if (!bracket_edit_token_valid($row, $editToken)) {
        return ['ok' => false, 'error' => 'Неверный или отсутствующий токен редактирования'];
    }

    return ['ok' => true];
}

function bracket_claim_guest_bracket($db, string $publicId, int $userId, string $editToken): array {
    if (!bracket_public_id_valid($publicId) || $userId <= 0) {
        return ['ok' => false, 'error' => 'Некорректные данные'];
    }

    $row = $db->fetchOne(
        'SELECT id, public_id, user_id, edit_token FROM tournament_brackets WHERE public_id = ?',
        [$publicId]
    );
    if (!$row) {
        return ['ok' => false, 'error' => 'Сетка не найдена'];
    }

    if (!bracket_is_guest_owned($row)) {
        $ownerId = bracket_row_owner_id($row);
        if ($ownerId === $userId) {
            return ['ok' => true, 'public_id' => $publicId, 'already_owned' => true];
        }

        return ['ok' => false, 'error' => 'Сетка уже привязана к другому аккаунту'];
    }

    if (!bracket_edit_token_valid($row, $editToken)) {
        return ['ok' => false, 'error' => 'Неверный токен редактирования'];
    }

    $db->update(
        'UPDATE tournament_brackets SET user_id = ?, edit_token = NULL WHERE public_id = ? AND user_id IS NULL',
        [$userId, $publicId]
    );

    bracket_clear_guest_edit_cookie($publicId);

    return ['ok' => true, 'public_id' => $publicId];
}

function bracket_sql_select_columns(string $prefix = 'b'): string {
    $p = rtrim($prefix, '.') . '.';

    return $p . 'id, '
        . $p . 'public_id, '
        . $p . 'user_id, '
        . $p . 'title, '
        . $p . 'description, '
        . $p . 'format, '
        . $p . 'match_format, '
        . $p . 'game, '
        . $p . 'game_realm, '
        . $p . 'visibility, '
        . $p . 'status, '
        . $p . 'moderation_note, '
        . $p . 'moderated_at, '
        . $p . 'bracket_data, '
        . $p . 'starts_at, '
        . $p . 'completed_at, '
        . $p . 'prize_pool, '
        . $p . 'created_at, '
        . $p . 'updated_at';
}

function bracket_parse_bracket_data(array $row): array {
    $raw = $row['bracket_data'] ?? null;
    if (is_string($raw)) {
        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : [];
    }
    if (is_array($raw)) {
        return $raw;
    }

    return [];
}

function bracket_format_item(array $row, bool $includeModeration = false, bool $includeFullData = true): array {
    $bracketData = bracket_parse_bracket_data($row);
    $storedSize = (int) ($bracketData['settings']['bracketSize'] ?? 0);
    $participantCount = $storedSize >= 2
        ? $storedSize
        : count($bracketData['participants'] ?? []);
    $phase = bracket_tournament_phase($row);

    $item = [
        'public_id' => (string) ($row['public_id'] ?? ''),
        'title' => (string) ($row['title'] ?? ''),
        'description' => array_key_exists('description', $row) && $row['description'] !== null
            ? (string) $row['description']
            : null,
        'format' => (string) ($row['format'] ?? ''),
        'match_format' => bracket_match_format_valid((string) ($row['match_format'] ?? ''))
            ? (string) $row['match_format']
            : bracket_match_format_default(),
        'game' => bracket_game_valid((string) ($row['game'] ?? ''))
            ? (string) $row['game']
            : BRACKET_GAME_DEFAULT,
        'game_realm' => bracket_game_realm_valid((string) ($row['game_realm'] ?? ''))
            ? (string) $row['game_realm']
            : null,
        'game_icon' => bracket_game_icon_url(
            bracket_game_valid((string) ($row['game'] ?? '')) ? (string) $row['game'] : BRACKET_GAME_DEFAULT,
            bracket_game_realm_valid((string) ($row['game_realm'] ?? '')) ? (string) $row['game_realm'] : null
        ),
        'visibility' => (string) ($row['visibility'] ?? 'public'),
        'starts_at' => $row['starts_at'] ?? null,
        'completed_at' => $row['completed_at'] ?? null,
        'tournament_phase' => $phase,
        'prize_pool' => bracket_parse_prize_pool($row['prize_pool'] ?? null),
        'prize_tiers' => bracket_resolve_prize_tiers(
            (string) ($row['format'] ?? 'single'),
            $participantCount,
            $bracketData
        ),
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];

    if ($includeFullData) {
        $item['bracket_data'] = $bracketData;
    } else {
        $item['participant_count'] = count($bracketData['participants'] ?? []);
    }

    if ($includeModeration) {
        $item['status'] = (string) ($row['status'] ?? 'active');
        $item['moderation_note'] = $row['moderation_note'] !== null
            ? (string) $row['moderation_note']
            : null;
        $item['moderated_at'] = $row['moderated_at'] ?? null;
        $item['is_owner'] = true;
    }

    return $item;
}

function bracket_fetch_by_public_id($db, string $publicId, bool $activeOnly = true): ?array {
    if (!bracket_public_id_valid($publicId)) {
        return null;
    }

    $where = 'public_id = ?';
    $params = [$publicId];
    if ($activeOnly) {
        $where .= " AND status = 'active'";
    }

    $row = $db->fetchOne(
        'SELECT ' . bracket_sql_select_columns('b') . ' FROM tournament_brackets b WHERE ' . $where,
        $params
    );

    return is_array($row) ? $row : null;
}

function bracket_fetch_list($db, array $query): array {
    $page = max(1, (int) ($query['page'] ?? 1));
    $limit = max(1, min(50, (int) ($query['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;
    $search = trim((string) ($query['q'] ?? ''));

    $where = ["b.status = 'active'", "b.visibility = 'public'"];
    $params = [];

    if ($search !== '') {
        $where[] = 'b.title LIKE ?';
        $params[] = '%' . $search . '%';
    }

    $whereSql = implode(' AND ', $where);

    try {
        $listParams = array_merge($params, [$limit + 1, $offset]);
        $rows = $db->fetchAll(
            "SELECT " . bracket_sql_select_columns('b') . ",
                    u.username AS owner_username,
                    u.wg_account_id AS owner_wg_account_id,
                    u.wg_nickname AS owner_wg_nickname,
                    u.wg_realm AS owner_wg_realm,
                    u.game_nickname_ru AS owner_game_nickname_ru,
                    u.game_nickname_eu AS owner_game_nickname_eu,
                    u.game_nickname_na AS owner_game_nickname_na,
                    u.game_nickname_asia AS owner_game_nickname_asia
             FROM tournament_brackets b
             LEFT JOIN site_users u ON u.id = b.user_id
             WHERE {$whereSql}
             ORDER BY b.updated_at DESC, b.id DESC
             LIMIT ? OFFSET ?",
            $listParams
        );
        $hasMore = count($rows) > $limit;
        if ($hasMore) {
            array_pop($rows);
        }

        $lang = isset($query['lang']) && $query['lang'] === 'en' ? 'en' : 'ru';
        $items = array_map(static function (array $row) use ($lang): array {
            $item = bracket_format_item($row, false, false);
            $creator = bracket_creator_display_name(null, [
                'user_id' => $row['user_id'] ?? null,
                'game' => $row['game'] ?? BRACKET_GAME_DEFAULT,
                'game_realm' => $row['game_realm'] ?? BRACKET_GAME_REALM_DEFAULT,
                'username' => $row['owner_username'] ?? '',
                'wg_account_id' => $row['owner_wg_account_id'] ?? 0,
                'wg_nickname' => $row['owner_wg_nickname'] ?? '',
                'wg_realm' => $row['owner_wg_realm'] ?? '',
                'game_nickname_ru' => $row['owner_game_nickname_ru'] ?? '',
                'game_nickname_eu' => $row['owner_game_nickname_eu'] ?? '',
                'game_nickname_na' => $row['owner_game_nickname_na'] ?? '',
                'game_nickname_asia' => $row['owner_game_nickname_asia'] ?? '',
            ], $lang);
            if ($creator !== null && $creator !== '') {
                $item['creator_name'] = $creator;
            }

            return $item;
        }, $rows);

        $rowCount = count($items);
        $total = $offset + $rowCount + ($hasMore ? 1 : 0);
        $pages = $hasMore ? ($page + 1) : $page;

        return [
            'success' => true,
            'data' => $items,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => $pages,
            ],
        ];
    } catch (Throwable $e) {
        return ['success' => false, 'error' => 'Ошибка сервера'];
    }
}

function bracket_guest_create_rate_check(string $lang = 'ru'): ?string {
    if (!isset($_SESSION)) {
        return null;
    }

    $now = time();
    $times = $_SESSION['bracket_create_times'] ?? [];
    if (!is_array($times)) {
        $times = [];
    }

    $times = array_values(array_filter($times, static function ($t) use ($now) {
        return is_int($t) && ($now - $t) < BRACKET_GUEST_CREATE_WINDOW_SEC;
    }));

    if (count($times) >= BRACKET_GUEST_CREATE_MAX) {
        return $lang === 'en'
            ? 'Too many brackets created. Try again later.'
            : 'Слишком много сеток за короткое время. Попробуйте позже.';
    }

    return null;
}

function bracket_guest_create_rate_register(): void {
    if (!isset($_SESSION)) {
        return;
    }

    $times = $_SESSION['bracket_create_times'] ?? [];
    if (!is_array($times)) {
        $times = [];
    }
    $times[] = time();
    $_SESSION['bracket_create_times'] = $times;
}

function bracket_build_href(string $lang, string $publicId, bool $edit = false): string {
    $slug = 'services/bracket/' . $publicId . ($edit ? '/edit' : '');

    return abs_build_lang_href($lang, $slug);
}
