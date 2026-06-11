<?php

const RECRUITING_POST_TYPES = [
    'clan_seeks_players',
    'team_seeks_players',
    'player_seeks_clan',
    'player_seeks_team',
];

const RECRUITING_REALMS = ['ru', 'eu', 'na', 'asia'];

const RECRUITING_STATUSES = ['pending', 'approved', 'rejected', 'hidden'];

const RECRUITING_CONTACT_TYPES = ['vk', 'max', 'telegram', 'viber', 'discord'];

const RECRUITING_CONTACTS_MAX = 10;

const RECRUITING_CONTACT_VALUE_MAX = 128;

const RECRUITING_CLAN_TAG_TYPES = ['clan_tag', 'team_name'];

function recruiting_clan_tag_type_valid(string $value): bool {
    return in_array($value, RECRUITING_CLAN_TAG_TYPES, true);
}

function recruiting_clan_tag_type_normalize(string $value): string {
    $value = strtolower(trim($value));
    return recruiting_clan_tag_type_valid($value) ? $value : 'clan_tag';
}

function recruiting_clan_tag_max_length(string $type): int {
    return recruiting_clan_tag_type_normalize($type) === 'team_name' ? 64 : 16;
}

function recruiting_clan_tag_type_label(string $type, string $lang = 'ru'): string {
    $type = recruiting_clan_tag_type_normalize($type);
    $labels = [
        'ru' => [
            'clan_tag' => 'Тег клана',
            'team_name' => 'Название команды',
        ],
        'en' => [
            'clan_tag' => 'Clan tag',
            'team_name' => 'Team name',
        ],
    ];
    $dict = $labels[$lang] ?? $labels['ru'];
    return $dict[$type] ?? $type;
}

function recruiting_clan_tag_no_clan_label(string $lang = 'ru'): string {
    return $lang === 'en' ? 'Without clan' : 'Без клана';
}

function recruiting_clan_tag_no_team_label(string $lang = 'ru'): string {
    return $lang === 'en' ? 'Without team' : 'Без команды';
}

function recruiting_clan_tag_is_no_clan(string $tag): bool {
    $tag = trim($tag);
    return $tag === recruiting_clan_tag_no_clan_label('ru')
        || $tag === recruiting_clan_tag_no_clan_label('en');
}

function recruiting_clan_tag_is_no_team(string $tag): bool {
    $tag = trim($tag);
    return $tag === recruiting_clan_tag_no_team_label('ru')
        || $tag === recruiting_clan_tag_no_team_label('en');
}

function recruiting_clan_tag_is_placeholder(string $tag): bool {
    return recruiting_clan_tag_is_no_clan($tag) || recruiting_clan_tag_is_no_team($tag);
}

function recruiting_normalize_clan_tag_value(string $tag, string $type): string {
    $tag = trim($tag);
    if ($tag === '' || recruiting_clan_tag_is_placeholder($tag)) {
        return $tag;
    }
    if (recruiting_clan_tag_type_normalize($type) === 'clan_tag') {
        return mb_strtoupper($tag, 'UTF-8');
    }
    return $tag;
}

function recruiting_clan_tag_board_display(string $tag, string $type, string $lang = 'ru'): string {
    $tag = trim($tag);
    if ($tag === '') {
        return '';
    }
    if (recruiting_clan_tag_is_placeholder($tag)) {
        return $tag;
    }
    $type = recruiting_clan_tag_type_normalize($type);
    $label = recruiting_clan_tag_type_label($type, $lang);
    return $label . ': ' . $tag;
}

function recruiting_clan_tag_portal_href(string $realm, string $tag, ?string $type = 'clan_tag'): ?string {
    $tag = trim($tag);
    if ($tag === '' || recruiting_clan_tag_is_placeholder($tag)) {
        return null;
    }
    if (recruiting_clan_tag_type_normalize($type ?? 'clan_tag') !== 'clan_tag') {
        return null;
    }
    if (!recruiting_realm_valid($realm)) {
        return null;
    }

    require_once __DIR__ . '/tanki_client.php';
    require_once __DIR__ . '/game_api.php';

    return TankiClient::forRealm($realm)->buildClanTagPortalUrl($tag, game_api_application_id_for_realm($realm));
}

function recruiting_render_clan_tag_meta(array $post, string $lang = 'ru'): string {
    $tag = trim((string) ($post['clan_tag'] ?? ''));
    if ($tag === '') {
        return '';
    }

    $type = recruiting_clan_tag_type_normalize((string) ($post['clan_tag_type'] ?? 'clan_tag'));
    $href = recruiting_clan_tag_portal_href((string) ($post['realm'] ?? ''), $tag, $type);
    if ($href === null) {
        $clanDisplay = recruiting_clan_tag_board_display($tag, $type, $lang);
        if ($clanDisplay === '') {
            return '';
        }

        return '<span class="recruiting-post-meta-item recruiting-post-meta-item--clan">'
            . '<i class="fas fa-shield-alt" aria-hidden="true"></i> '
            . htmlspecialchars($clanDisplay, ENT_QUOTES, 'UTF-8')
            . '</span>';
    }

    $label = recruiting_clan_tag_type_label($type, $lang);

    return '<span class="recruiting-post-meta-item recruiting-post-meta-item--clan">'
        . '<i class="fas fa-shield-alt" aria-hidden="true"></i> '
        . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . ': '
        . '<a class="recruiting-clan-tag-link" href="' . htmlspecialchars($href, ENT_QUOTES, 'UTF-8') . '" target="_blank" rel="noopener noreferrer">'
        . htmlspecialchars($tag, ENT_QUOTES, 'UTF-8')
        . '</a></span>';
}

/**
 * @return array{ok: bool, error?: string, data: array<string, mixed>}
 */
function recruiting_apply_clan_tag_post_type_rules(array $data, string $lang = 'ru'): array {
    $isEn = $lang === 'en';
    $postType = (string) ($data['post_type'] ?? '');

    if ($postType === 'player_seeks_clan') {
        $data['clan_tag'] = recruiting_clan_tag_no_clan_label($lang);
        $data['clan_tag_type'] = 'clan_tag';
        return ['ok' => true, 'data' => $data];
    }

    if ($postType === 'player_seeks_team') {
        $data['clan_tag'] = recruiting_clan_tag_no_team_label($lang);
        $data['clan_tag_type'] = 'team_name';
        return ['ok' => true, 'data' => $data];
    }

    if ($postType === 'clan_seeks_players') {
        $tag = trim((string) ($data['clan_tag'] ?? ''));
        if ($tag === '' || recruiting_clan_tag_is_no_clan($tag)) {
            return [
                'ok' => false,
                'error' => $isEn ? 'Enter clan tag.' : 'Укажите тег клана.',
            ];
        }
        $data['clan_tag'] = $tag;
        $data['clan_tag_type'] = 'clan_tag';
        return ['ok' => true, 'data' => $data];
    }

    if ($postType === 'team_seeks_players') {
        $tag = trim((string) ($data['clan_tag'] ?? ''));
        if ($tag === '' || recruiting_clan_tag_is_no_team($tag)) {
            return [
                'ok' => false,
                'error' => $isEn ? 'Enter team name.' : 'Укажите название команды.',
            ];
        }
        $data['clan_tag'] = $tag;
        $data['clan_tag_type'] = 'team_name';
        return ['ok' => true, 'data' => $data];
    }

    return ['ok' => true, 'data' => $data];
}

/**
 * @return array{ok:bool, error?:string, clan_tag:?string, clan_tag_type:?string}
 */
function recruiting_parse_clan_tag_fields(array $input, string $lang = 'ru'): array {
    $isEn = $lang === 'en';
    $clanTag = trim((string) ($input['clan_tag'] ?? $input['recruiting_clan_tag'] ?? ''));
    $clanTagType = recruiting_clan_tag_type_normalize(
        (string) ($input['clan_tag_type'] ?? $input['recruiting_clan_tag_type'] ?? 'clan_tag')
    );

    if ($clanTag === '') {
        return ['ok' => true, 'clan_tag' => null, 'clan_tag_type' => null];
    }

    $maxLen = recruiting_clan_tag_max_length($clanTagType);
    if (mb_strlen($clanTag, 'UTF-8') > $maxLen) {
        if ($clanTagType === 'team_name') {
            return [
                'ok' => false,
                'error' => $isEn
                    ? 'Team name must be ' . $maxLen . ' characters or less.'
                    : 'Название команды — не длиннее ' . $maxLen . ' символов.',
            ];
        }
        return [
            'ok' => false,
            'error' => $isEn
                ? 'Clan tag must be ' . $maxLen . ' characters or less.'
                : 'Тег клана — не длиннее ' . $maxLen . ' символов.',
        ];
    }

    $clanTag = recruiting_normalize_clan_tag_value($clanTag, $clanTagType);

    return ['ok' => true, 'clan_tag' => $clanTag, 'clan_tag_type' => $clanTagType];
}

function recruiting_contact_type_valid(string $type): bool {
    return in_array($type, RECRUITING_CONTACT_TYPES, true);
}

function recruiting_contact_type_label(string $type, string $lang = 'ru'): string {
    $labels = [
        'ru' => [
            'vk' => 'ВКонтакте',
            'max' => 'MAX',
            'telegram' => 'Telegram',
            'viber' => 'Viber',
            'discord' => 'Discord',
        ],
        'en' => [
            'vk' => 'VK',
            'max' => 'MAX',
            'telegram' => 'Telegram',
            'viber' => 'Viber',
            'discord' => 'Discord',
        ],
    ];
    $dict = $labels[$lang] ?? $labels['ru'];
    return $dict[$type] ?? $type;
}

function recruiting_contact_type_icon(string $type): string {
    $icons = [
        'vk' => 'fab fa-vk',
        'telegram' => 'fab fa-telegram',
        'viber' => 'fab fa-viber',
        'discord' => 'fab fa-discord',
        'max' => 'recruiting-contact-icon-max',
    ];
    return $icons[$type] ?? 'fas fa-link';
}

/**
 * @return list<array{id:string, label:string, icon:string, placeholderRu:string, placeholderEn:string}>
 */
function recruiting_contact_types_meta(string $lang = 'ru'): array {
    $isEn = $lang === 'en';
    $items = [];
    foreach (RECRUITING_CONTACT_TYPES as $type) {
        $placeholders = [
            'vk' => ['https://vk.com/username', 'https://vk.com/username'],
            'max' => ['https://max.ru/join/XXXXXX', 'https://max.ru/join/XXXXXX'],
            'telegram' => ['@username', '@username'],
            'viber' => ['+79001234567', '+79001234567'],
            'discord' => ['username', 'username'],
        ];
        $ph = $placeholders[$type] ?? ['', ''];
        $items[] = [
            'id' => $type,
            'label' => recruiting_contact_type_label($type, $lang),
            'icon' => recruiting_contact_type_icon($type),
            'placeholder' => $isEn ? $ph[1] : $ph[0],
        ];
    }
    return $items;
}

/**
 * @param mixed $raw
 * @return list<array{type:string, value:string}>
 */
function recruiting_contacts_sanitize($raw): array {
    if (!is_array($raw)) {
        return [];
    }
    $out = [];
    foreach ($raw as $item) {
        if (!is_array($item)) {
            continue;
        }
        $type = strtolower(trim((string) ($item['type'] ?? '')));
        $value = trim((string) ($item['value'] ?? ''));
        if ($value === '') {
            continue;
        }
        if (!recruiting_contact_type_valid($type)) {
            $type = 'telegram';
        }
        if (mb_strlen($value, 'UTF-8') > RECRUITING_CONTACT_VALUE_MAX) {
            $value = mb_substr($value, 0, RECRUITING_CONTACT_VALUE_MAX, 'UTF-8');
        }
        $out[] = ['type' => $type, 'value' => $value];
        if (count($out) >= RECRUITING_CONTACTS_MAX) {
            break;
        }
    }
    return $out;
}

/**
 * @return list<array{type:string, value:string}>
 */
function recruiting_contacts_parse(?string $raw): array {
    if ($raw === null) {
        return [];
    }
    $raw = trim($raw);
    if ($raw === '') {
        return [];
    }
    if ($raw[0] === '[') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return recruiting_contacts_sanitize($decoded);
        }
    }
    return [['type' => 'telegram', 'value' => mb_substr($raw, 0, RECRUITING_CONTACT_VALUE_MAX, 'UTF-8')]];
}

/**
 * @param list<array{type:string, value:string}> $contacts
 */
function recruiting_contacts_encode(array $contacts): ?string {
    $contacts = recruiting_contacts_sanitize($contacts);
    if ($contacts === []) {
        return null;
    }
    return json_encode($contacts, JSON_UNESCAPED_UNICODE);
}

/**
 * @return list<array{type:string, value:string}>
 */
function recruiting_contacts_from_input(array $input): array {
    if (isset($input['contacts']) && is_array($input['contacts'])) {
        return recruiting_contacts_sanitize($input['contacts']);
    }
    if (isset($input['contacts_json']) && is_string($input['contacts_json'])) {
        $decoded = json_decode($input['contacts_json'], true);
        if (is_array($decoded)) {
            return recruiting_contacts_sanitize($decoded);
        }
    }
    if (isset($input['recruiting_contacts_json']) && is_string($input['recruiting_contacts_json'])) {
        $decoded = json_decode($input['recruiting_contacts_json'], true);
        if (is_array($decoded)) {
            return recruiting_contacts_sanitize($decoded);
        }
    }
    if (array_key_exists('contact', $input)) {
        if (is_array($input['contact'])) {
            return recruiting_contacts_sanitize($input['contact']);
        }
        if (is_string($input['contact'])) {
            return recruiting_contacts_parse($input['contact']);
        }
    }
    return [];
}

function recruiting_post_type_valid(string $value): bool {
    return in_array($value, RECRUITING_POST_TYPES, true);
}

function recruiting_realm_valid(string $value): bool {
    return in_array($value, RECRUITING_REALMS, true);
}

function recruiting_normalize_form_game_nickname(?string $nickname): string {
    if (!is_string($nickname)) {
        return '';
    }
    return trim($nickname);
}

/**
 * @return array{id:int,username:string}|null
 */
function recruiting_find_user_by_game_nickname($db, string $nickname, string $realm): ?array {
    $nickname = recruiting_normalize_form_game_nickname($nickname);
    $realm = user_normalize_wg_realm($realm);
    if ($nickname === '' || preg_match('/^#\d+$/', $nickname)) {
        return null;
    }

    $column = user_game_nickname_column($realm);
    if ($column === null) {
        return null;
    }

    try {
        $row = $db->fetchOne(
            'SELECT id, username
             FROM site_users
             WHERE is_active = 1
               AND (
                    (wg_nickname = ? AND wg_realm = ?)
                    OR (lesta_nickname = ? AND ? = \'ru\')
                    OR ' . $column . ' = ?
               )
             LIMIT 1',
            [$nickname, $realm, $nickname, $realm, $nickname]
        );
    } catch (Throwable $e) {
        return null;
    }

    return is_array($row) ? $row : null;
}

/**
 * @return array{ok:bool, error?:string}
 */
function recruiting_assert_game_nickname_allowed(
    $db,
    string $nickname,
    string $realm,
    ?int $currentUserId,
    string $lang = 'ru'
): array {
    $isEn = $lang === 'en';
    $nickname = recruiting_normalize_form_game_nickname($nickname);
    $realm = user_normalize_wg_realm($realm);

    if ($nickname === '') {
        return [
            'ok' => false,
            'error' => $isEn ? 'Enter your game nickname.' : 'Укажите игровой ник.',
        ];
    }
    if (!user_validate_game_nickname($nickname)) {
        return [
            'ok' => false,
            'error' => $isEn
                ? 'Game nickname: up to 24 characters, Latin letters, digits, _ -'
                : 'Игровой ник: до 24 символов, латиница, цифры, _ -',
        ];
    }
    if (!recruiting_realm_valid($realm)) {
        return [
            'ok' => false,
            'error' => $isEn ? 'Invalid region.' : 'Недопустимый регион.',
        ];
    }

    $owner = recruiting_find_user_by_game_nickname($db, $nickname, $realm);
    if ($owner === null) {
        return ['ok' => true];
    }

    $ownerId = (int) ($owner['id'] ?? 0);
    if ($currentUserId === null || $currentUserId !== $ownerId) {
        return [
            'ok' => false,
            'error' => $isEn
                ? 'This nickname is already linked to a site account. Choose another one.'
                : 'Этот ник уже привязан к аккаунту на сайте. Укажите другой ник.',
        ];
    }

    return ['ok' => true];
}

/**
 * @return array{ok: bool, error?: string, data?: array<string, mixed>}
 */
function recruiting_validate_post_input(array $input, bool $requireAll = true, string $lang = 'ru'): array {
    $fields = ['post_type', 'realm', 'title', 'body', 'contact', 'clan_tag'];
    $data = [];

    foreach ($fields as $field) {
        if (!array_key_exists($field, $input)) {
            if ($requireAll && in_array($field, ['post_type', 'realm', 'body'], true)) {
                return ['ok' => false, 'error' => 'Отсутствуют обязательные поля'];
            }
            continue;
        }
        $data[$field] = is_string($input[$field]) ? trim($input[$field]) : $input[$field];
    }

    if ($requireAll || isset($data['post_type'])) {
        $postType = (string) ($data['post_type'] ?? '');
        if (!recruiting_post_type_valid($postType)) {
            return ['ok' => false, 'error' => 'Недопустимый тип объявления'];
        }
        $data['post_type'] = $postType;
    }

    if ($requireAll || isset($data['realm'])) {
        $realm = strtolower((string) ($data['realm'] ?? ''));
        if (!recruiting_realm_valid($realm)) {
            return ['ok' => false, 'error' => 'Недопустимый регион'];
        }
        $data['realm'] = $realm;
    }

    if ($requireAll || array_key_exists('game_nickname', $input)) {
        $gameNickname = recruiting_normalize_form_game_nickname(
            isset($input['game_nickname']) ? (string) $input['game_nickname'] : ''
        );
        if ($requireAll && $gameNickname === '') {
            return ['ok' => false, 'error' => 'Укажите игровой ник'];
        }
        if ($gameNickname !== '' && !user_validate_game_nickname($gameNickname)) {
            return ['ok' => false, 'error' => 'Игровой ник: до 24 символов, латиница, цифры, _ -'];
        }
        $data['game_nickname'] = $gameNickname;
    }

    if (isset($data['title'])) {
        $title = (string) $data['title'];
        if ($title !== '') {
            $titleLen = mb_strlen($title, 'UTF-8');
            if ($titleLen < 3 || $titleLen > 120) {
                return ['ok' => false, 'error' => 'Заголовок должен быть от 3 до 120 символов'];
            }
            $data['title'] = $title;
        } else {
            unset($data['title']);
        }
    }

    if ($requireAll || isset($data['body'])) {
        $body = (string) ($data['body'] ?? '');
        $bodyLen = mb_strlen($body, 'UTF-8');
        if ($bodyLen < 10 || $bodyLen > 5000) {
            return ['ok' => false, 'error' => 'Текст объявления должен быть от 10 до 5000 символов'];
        }
        $data['body'] = $body;
    }

    if (isset($input['contacts']) || isset($input['contacts_json']) || array_key_exists('contact', $input)) {
        $contacts = recruiting_contacts_from_input($input);
        $encoded = recruiting_contacts_encode($contacts);
        if ($encoded !== null && mb_strlen($encoded, 'UTF-8') > 4000) {
            return ['ok' => false, 'error' => 'Слишком много контактов'];
        }
        $data['contact'] = $encoded;
    }

    if (array_key_exists('clan_tag', $input) || array_key_exists('clan_tag_type', $input)
        || array_key_exists('recruiting_clan_tag', $input) || array_key_exists('recruiting_clan_tag_type', $input)) {
        $parsed = recruiting_parse_clan_tag_fields($input);
        if (!$parsed['ok']) {
            return ['ok' => false, 'error' => $parsed['error'] ?? 'Некорректный тег клана или название команды'];
        }
        $data['clan_tag'] = $parsed['clan_tag'];
        $data['clan_tag_type'] = $parsed['clan_tag_type'];
    } elseif (array_key_exists('clan_tag', $data)) {
        $parsed = recruiting_parse_clan_tag_fields(['clan_tag' => $data['clan_tag']]);
        if (!$parsed['ok']) {
            return ['ok' => false, 'error' => $parsed['error'] ?? 'Некорректный тег клана или название команды'];
        }
        $data['clan_tag'] = $parsed['clan_tag'];
        $data['clan_tag_type'] = $parsed['clan_tag_type'];
    }

    if (!empty($data['post_type'])) {
        $clanRules = recruiting_apply_clan_tag_post_type_rules($data, $lang);
        if (!$clanRules['ok']) {
            return ['ok' => false, 'error' => $clanRules['error'] ?? 'Некорректный тег клана или название команды'];
        }
        $data = $clanRules['data'];
    }

    return ['ok' => true, 'data' => $data];
}

function recruiting_auto_title(array $data, string $lang = 'ru'): string {
    $parts = [
        recruiting_post_type_label((string) ($data['post_type'] ?? ''), $lang),
        recruiting_realm_label((string) ($data['realm'] ?? ''), $lang),
    ];
    if (!empty($data['clan_tag'])) {
        $parts[] = (string) $data['clan_tag'];
    }
    $title = implode(' · ', array_filter($parts, static fn($p) => $p !== ''));
    if (mb_strlen($title, 'UTF-8') < 3) {
        $body = preg_replace('/\s+/u', ' ', trim((string) ($data['body'] ?? ''))) ?? '';
        $title = $body !== '' ? $body : 'Recruiting';
    }
    if (mb_strlen($title, 'UTF-8') > 120) {
        return mb_substr($title, 0, 120, 'UTF-8');
    }
    return $title;
}

/**
 * @param array{post_type?:string, clan_tag?:string, team_name?:string, clan_tag_type?:string} $prefs
 * @return array{clan_tag:string, clan_tag_type:string}
 */
function user_recruiting_post_form_clan(array $prefs): array {
    $postType = (string) ($prefs['post_type'] ?? '');
    if ($postType === 'team_seeks_players') {
        return [
            'clan_tag' => (string) ($prefs['team_name'] ?? ''),
            'clan_tag_type' => 'team_name',
        ];
    }

    return [
        'clan_tag' => (string) ($prefs['clan_tag'] ?? ''),
        'clan_tag_type' => 'clan_tag',
    ];
}

/**
 * @return array{ok:bool, error?:string, clan_tag:string, team_name:string}
 */
function user_recruiting_parse_profile_clan_team(array $input, string $lang = 'ru'): array {
    $isEn = $lang === 'en';
    $clanTag = trim((string) ($input['recruiting_clan_tag'] ?? ''));
    $teamName = trim((string) ($input['recruiting_team_name'] ?? ''));

    if ($clanTag !== '') {
        $clanTag = recruiting_normalize_clan_tag_value($clanTag, 'clan_tag');
        if (mb_strlen($clanTag, 'UTF-8') > recruiting_clan_tag_max_length('clan_tag')) {
            return [
                'ok' => false,
                'error' => $isEn
                    ? 'Clan tag must be ' . recruiting_clan_tag_max_length('clan_tag') . ' characters or less.'
                    : 'Тег клана — не длиннее ' . recruiting_clan_tag_max_length('clan_tag') . ' символов.',
            ];
        }
    }

    if ($teamName !== '') {
        if (mb_strlen($teamName, 'UTF-8') > recruiting_clan_tag_max_length('team_name')) {
            return [
                'ok' => false,
                'error' => $isEn
                    ? 'Team name must be ' . recruiting_clan_tag_max_length('team_name') . ' characters or less.'
                    : 'Название команды — не длиннее ' . recruiting_clan_tag_max_length('team_name') . ' символов.',
            ];
        }
    }

    return ['ok' => true, 'clan_tag' => $clanTag, 'team_name' => $teamName];
}

/**
 * @return array{contacts:list<array{type:string,value:string}>, clan_tag:string, team_name:string, clan_tag_type:string, post_type:string, realm:string, contact:?string}
 */
function user_recruiting_prefs($db, int $userId): array {
    if (!function_exists('ensure_site_users_table')) {
        require_once __DIR__ . '/../config/ensure_site_users.php';
    }
    ensure_site_users_table($db);

    $contactRaw = null;
    $clanTag = '';
    $teamName = '';
    $clanTagType = 'clan_tag';
    $postType = '';
    $realm = '';
    $useFallbackContact = true;
    $useFallbackClan = true;
    $useFallbackTeam = true;
    $useFallbackClanType = true;
    $useFallbackPostType = true;
    $useFallbackRealm = true;

    try {
        $row = $db->fetchOne(
            'SELECT recruiting_contact, recruiting_clan_tag, recruiting_team_name, recruiting_clan_tag_type, recruiting_post_type, recruiting_realm
             FROM site_users WHERE id = ?',
            [$userId]
        );
        if (is_array($row)) {
            if (array_key_exists('recruiting_contact', $row) && $row['recruiting_contact'] !== null) {
                $contactRaw = (string) $row['recruiting_contact'];
                $useFallbackContact = false;
            }
            if (array_key_exists('recruiting_clan_tag', $row) && $row['recruiting_clan_tag'] !== null) {
                $clanTag = trim((string) $row['recruiting_clan_tag']);
                $useFallbackClan = false;
            }
            if (array_key_exists('recruiting_team_name', $row) && $row['recruiting_team_name'] !== null) {
                $teamName = trim((string) $row['recruiting_team_name']);
                $useFallbackTeam = false;
            }
            if (array_key_exists('recruiting_clan_tag_type', $row) && $row['recruiting_clan_tag_type'] !== null) {
                $clanTagType = recruiting_clan_tag_type_normalize((string) $row['recruiting_clan_tag_type']);
                $useFallbackClanType = false;
            }
            if (array_key_exists('recruiting_post_type', $row) && $row['recruiting_post_type'] !== null) {
                $postType = trim((string) $row['recruiting_post_type']);
                $useFallbackPostType = false;
            }
            if (array_key_exists('recruiting_realm', $row) && $row['recruiting_realm'] !== null) {
                $realm = trim((string) $row['recruiting_realm']);
                $useFallbackRealm = false;
            }
        }
    } catch (Throwable $e) {
        // колонки ещё не добавлены
    }

    if ($useFallbackContact || $useFallbackClan || $useFallbackTeam || $useFallbackClanType || $useFallbackPostType || $useFallbackRealm) {
        try {
            $last = $db->fetchOne(
                'SELECT post_type, realm, contact, clan_tag, clan_tag_type FROM recruiting_posts
                 WHERE user_id = ?
                 ORDER BY updated_at DESC, id DESC
                 LIMIT 1',
                [$userId]
            );
            if (is_array($last)) {
                if ($useFallbackContact) {
                    $contactRaw = isset($last['contact']) ? (string) $last['contact'] : null;
                }
                $lastTag = trim((string) ($last['clan_tag'] ?? ''));
                $lastType = recruiting_clan_tag_type_normalize((string) ($last['clan_tag_type'] ?? 'clan_tag'));
                if ($useFallbackClan && $lastTag !== '' && $lastType !== 'team_name') {
                    $clanTag = $lastTag;
                }
                if ($useFallbackTeam && $lastTag !== '' && $lastType === 'team_name') {
                    $teamName = $lastTag;
                }
                if ($useFallbackClanType && $lastTag !== '') {
                    $clanTagType = $lastType;
                }
                if ($useFallbackPostType) {
                    $postType = trim((string) ($last['post_type'] ?? ''));
                }
                if ($useFallbackRealm) {
                    $realm = trim((string) ($last['realm'] ?? ''));
                }
            }
        } catch (Throwable $e) {
            // таблица объявлений недоступна
        }
    }

    if ($postType !== '' && !recruiting_post_type_valid($postType)) {
        $postType = '';
    }
    if ($realm !== '' && !recruiting_realm_valid($realm)) {
        $realm = '';
    }

    $contacts = recruiting_contacts_parse($contactRaw);

    if ($clanTag !== '' && recruiting_clan_tag_type_normalize($clanTagType) === 'team_name' && $teamName === '') {
        $teamName = $clanTag;
        $clanTag = '';
        $clanTagType = 'team_name';
    }

    return [
        'contacts' => $contacts,
        'contact' => recruiting_contacts_encode($contacts),
        'clan_tag' => $clanTag,
        'team_name' => $teamName,
        'clan_tag_type' => $clanTagType,
        'post_type' => $postType,
        'realm' => $realm,
    ];
}

/**
 * @param array{contact?:array|string|null, clan_tag?:?string, team_name?:?string, clan_tag_type?:?string, post_type?:?string, realm?:?string} $prefs
 */
function user_recruiting_save_prefs($db, int $userId, array $prefs): bool {
    if (!function_exists('ensure_site_users_table')) {
        require_once __DIR__ . '/../config/ensure_site_users.php';
    }
    ensure_site_users_table($db);

    if (isset($prefs['contacts']) && is_array($prefs['contacts'])) {
        $contactStored = recruiting_contacts_encode($prefs['contacts']);
    } else {
        $contactStored = recruiting_contacts_encode(recruiting_contacts_parse(
            isset($prefs['contact']) ? (is_string($prefs['contact']) ? $prefs['contact'] : null) : null
        ));
    }
    $clanTag = trim((string) ($prefs['clan_tag'] ?? ''));
    $teamName = trim((string) ($prefs['team_name'] ?? ''));
    $postType = trim((string) ($prefs['post_type'] ?? ''));
    $realm = strtolower(trim((string) ($prefs['realm'] ?? '')));

    if ($clanTag !== '') {
        $clanTag = recruiting_normalize_clan_tag_value($clanTag, 'clan_tag');
        if (mb_strlen($clanTag, 'UTF-8') > recruiting_clan_tag_max_length('clan_tag')) {
            return false;
        }
    }
    if ($teamName !== '') {
        if (mb_strlen($teamName, 'UTF-8') > recruiting_clan_tag_max_length('team_name')) {
            return false;
        }
    }

    $clanTagType = null;
    if ($clanTag !== '' && $teamName === '') {
        $clanTagType = 'clan_tag';
    } elseif ($teamName !== '' && $clanTag === '') {
        $clanTagType = 'team_name';
    } elseif ($clanTag !== '') {
        $clanTagType = 'clan_tag';
    }
    if ($postType !== '' && !recruiting_post_type_valid($postType)) {
        return false;
    }
    if ($realm !== '' && !recruiting_realm_valid($realm)) {
        return false;
    }
    if ($contactStored !== null && mb_strlen($contactStored, 'UTF-8') > 4000) {
        return false;
    }

    try {
        $db->update(
            'UPDATE site_users
             SET recruiting_contact = ?, recruiting_clan_tag = ?, recruiting_team_name = ?, recruiting_clan_tag_type = ?,
                 recruiting_post_type = ?, recruiting_realm = ?
             WHERE id = ?',
            [
                $contactStored,
                $clanTag !== '' ? $clanTag : null,
                $teamName !== '' ? $teamName : null,
                $clanTagType,
                $postType !== '' ? $postType : '',
                $realm !== '' ? $realm : null,
                $userId,
            ]
        );
        return true;
    } catch (Throwable $e) {
        return false;
    }
}

/**
 * @param array{contact?:?string, clan_tag?:?string, clan_tag_type?:?string, post_type?:string, realm?:string} $data
 */
function user_recruiting_sync_prefs_from_post($db, int $userId, array $data): void {
    $existing = user_recruiting_prefs($db, $userId);
    $prefs = [
        'contacts' => recruiting_contacts_from_input($data),
        'clan_tag' => (string) ($existing['clan_tag'] ?? ''),
        'team_name' => (string) ($existing['team_name'] ?? ''),
        'post_type' => (string) ($data['post_type'] ?? ''),
        'realm' => (string) ($data['realm'] ?? ''),
    ];

    $tag = trim((string) ($data['clan_tag'] ?? ''));
    $type = recruiting_clan_tag_type_normalize((string) ($data['clan_tag_type'] ?? 'clan_tag'));
    if ($tag !== '' && !recruiting_clan_tag_is_placeholder($tag)) {
        if ($type === 'team_name') {
            $prefs['team_name'] = $tag;
        } else {
            $prefs['clan_tag'] = $tag;
        }
    }

    user_recruiting_save_prefs($db, $userId, $prefs);
}

/**
 * @return array{ok:bool, error?:string, prefs?:array{contacts:list,contact:?string,clan_tag:string,clan_tag_type:string,post_type:string,realm:string}}
 */
function user_recruiting_save_from_request($db, int $userId, array $input, string $lang = 'ru'): array {
    $isEn = $lang === 'en';
    $contacts = recruiting_contacts_from_input($input);
    $postType = trim((string) ($input['recruiting_post_type'] ?? $input['post_type'] ?? ''));
    $realm = strtolower(trim((string) ($input['recruiting_realm'] ?? $input['realm'] ?? '')));

    $existing = user_recruiting_prefs($db, $userId);
    $hasClanKey = array_key_exists('recruiting_clan_tag', $input) || array_key_exists('clan_tag', $input);
    $hasTeamKey = array_key_exists('recruiting_team_name', $input) || array_key_exists('team_name', $input);

    $parsed = user_recruiting_parse_profile_clan_team($input, $lang);
    if (!$parsed['ok']) {
        return ['ok' => false, 'error' => $parsed['error'] ?? ($isEn ? 'Invalid clan tag or team name.' : 'Некорректный тег клана или название команды.')];
    }
    $clanTag = $hasClanKey ? (string) ($parsed['clan_tag'] ?? '') : (string) ($existing['clan_tag'] ?? '');
    $teamName = $hasTeamKey ? (string) ($parsed['team_name'] ?? '') : (string) ($existing['team_name'] ?? '');

    if ($postType !== '' && !recruiting_post_type_valid($postType)) {
        return ['ok' => false, 'error' => $isEn ? 'Invalid ad type.' : 'Недопустимый тип объявления.'];
    }
    if ($realm !== '' && !recruiting_realm_valid($realm)) {
        return ['ok' => false, 'error' => $isEn ? 'Invalid region.' : 'Недопустимый регион.'];
    }
    if (!user_recruiting_save_prefs($db, $userId, [
        'contacts' => $contacts,
        'clan_tag' => $clanTag,
        'team_name' => $teamName,
        'post_type' => $postType,
        'realm' => $realm,
    ])) {
        return ['ok' => false, 'error' => $isEn ? 'Could not save settings.' : 'Не удалось сохранить настройки.'];
    }

    return ['ok' => true, 'prefs' => user_recruiting_prefs($db, $userId)];
}

function recruiting_post_type_label(string $type, string $lang = 'ru'): string {
    $labels = [
        'ru' => [
            'clan_seeks_players' => 'Клан ищет игроков',
            'team_seeks_players' => 'Команда ищет игроков',
            'player_seeks_clan' => 'Игрок ищет клан',
            'player_seeks_team' => 'Игрок ищет команду',
        ],
        'en' => [
            'clan_seeks_players' => 'Clan seeks players',
            'team_seeks_players' => 'Team seeks players',
            'player_seeks_clan' => 'Player seeks clan',
            'player_seeks_team' => 'Player seeks team',
        ],
    ];
    $dict = $labels[$lang] ?? $labels['ru'];
    return $dict[$type] ?? $type;
}

function recruiting_realm_label(string $realm, string $lang = 'ru'): string {
    $labels = [
        'ru' => ['ru' => 'RU', 'eu' => 'EU', 'na' => 'NA', 'asia' => 'ASIA'],
        'en' => ['ru' => 'RU', 'eu' => 'EU', 'na' => 'NA', 'asia' => 'ASIA'],
    ];
    $dict = $labels[$lang] ?? $labels['ru'];
    return $dict[$realm] ?? strtoupper($realm);
}

function recruiting_status_label(string $status, string $lang = 'ru'): string {
    $labels = [
        'ru' => [
            'pending' => 'На модерации',
            'approved' => 'Опубликовано',
            'rejected' => 'Отклонено',
            'hidden' => 'Скрыто',
        ],
        'en' => [
            'pending' => 'Pending',
            'approved' => 'Published',
            'rejected' => 'Rejected',
            'hidden' => 'Hidden',
        ],
    ];
    $dict = $labels[$lang] ?? $labels['ru'];
    return $dict[$status] ?? $status;
}

function recruiting_author_display_name(array $row, ?string $realm = null): string {
    $postNick = trim((string) ($row['game_nickname'] ?? ''));
    if ($postNick !== '' && !preg_match('/^#\d+$/', $postNick)) {
        return $postNick;
    }

    $realm = $realm !== null && $realm !== ''
        ? user_normalize_wg_realm($realm)
        : user_normalize_wg_realm((string) ($row['realm'] ?? ''));

    $profileLike = [
        'wg_account_id' => $row['wg_account_id'] ?? 0,
        'wg_nickname' => $row['wg_nickname'] ?? '',
        'wg_realm' => $row['wg_realm'] ?? '',
        'game_nickname_ru' => $row['game_nickname_ru'] ?? '',
        'game_nickname_eu' => $row['game_nickname_eu'] ?? '',
        'game_nickname_na' => $row['game_nickname_na'] ?? '',
        'game_nickname_asia' => $row['game_nickname_asia'] ?? '',
    ];
    $state = user_game_nicknames_state($profileLike);
    $nick = trim((string) ($state[$realm]['value'] ?? ''));
    if ($nick !== '' && !preg_match('/^#\d+$/', $nick)) {
        return $nick;
    }

    return trim((string) ($row['username'] ?? ''));
}

function recruiting_sql_user_author_columns(string $alias = 'u'): string {
    $alias = preg_match('/^[a-z]+$/', $alias) ? $alias : 'u';

    return $alias . '.username, '
        . $alias . '.wg_account_id, '
        . $alias . '.wg_nickname, '
        . $alias . '.wg_realm, '
        . $alias . '.game_nickname_ru, '
        . $alias . '.game_nickname_eu, '
        . $alias . '.game_nickname_na, '
        . $alias . '.game_nickname_asia';
}

/**
 * @param array<string, mixed> $row
 * @return array<string, mixed>
 */
/**
 * @return array{id:int}|null
 */
function recruiting_find_recent_duplicate_post($db, array $data, ?int $userId, int $windowSeconds = 120): ?array {
    $body = (string) ($data['body'] ?? '');
    $postType = (string) ($data['post_type'] ?? '');
    $realm = (string) ($data['realm'] ?? '');
    $gameNickname = recruiting_normalize_form_game_nickname((string) ($data['game_nickname'] ?? ''));

    if ($body === '' || $postType === '' || $realm === '') {
        return null;
    }

    $windowSeconds = max(30, min(600, $windowSeconds));

    if ($userId !== null) {
        $row = $db->fetchOne(
            'SELECT id
             FROM recruiting_posts
             WHERE user_id = ?
               AND post_type = ?
               AND realm = ?
               AND body = ?
               AND COALESCE(game_nickname, \'\') = ?
               AND created_at >= (UTC_TIMESTAMP() - INTERVAL ' . (int) $windowSeconds . ' SECOND)
             ORDER BY id DESC
             LIMIT 1',
            [$userId, $postType, $realm, $body, $gameNickname]
        );
        return is_array($row) ? $row : null;
    }

    if ($gameNickname === '') {
        return null;
    }

    $row = $db->fetchOne(
        'SELECT id
         FROM recruiting_posts
         WHERE user_id IS NULL
           AND post_type = ?
           AND realm = ?
           AND body = ?
           AND game_nickname = ?
           AND created_at >= (UTC_TIMESTAMP() - INTERVAL ' . (int) $windowSeconds . ' SECOND)
         ORDER BY id DESC
         LIMIT 1',
        [$postType, $realm, $body, $gameNickname]
    );

    return is_array($row) ? $row : null;
}

function recruiting_format_post(array $row, bool $includeModeration = false): array {
    $contacts = recruiting_contacts_parse(
        array_key_exists('contact', $row) && $row['contact'] !== null ? (string) $row['contact'] : null
    );
    $item = [
        'id' => (int) $row['id'],
        'post_type' => (string) $row['post_type'],
        'realm' => (string) $row['realm'],
        'title' => (string) $row['title'],
        'body' => (string) $row['body'],
        'contacts' => $contacts,
        'contact' => recruiting_contacts_encode($contacts),
        'clan_tag' => array_key_exists('clan_tag', $row) && $row['clan_tag'] !== null ? (string) $row['clan_tag'] : null,
        'clan_tag_type' => !empty($row['clan_tag'])
            ? recruiting_clan_tag_type_normalize((string) ($row['clan_tag_type'] ?? 'clan_tag'))
            : null,
        'clan_tag_href' => !empty($row['clan_tag'])
            ? recruiting_clan_tag_portal_href(
                (string) ($row['realm'] ?? ''),
                (string) $row['clan_tag'],
                !empty($row['clan_tag_type']) ? (string) $row['clan_tag_type'] : 'clan_tag'
            )
            : null,
        'author' => recruiting_author_display_name($row),
        'published_at' => $row['published_at'] ?? null,
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];

    if ($includeModeration) {
        $item['status'] = (string) ($row['status'] ?? 'pending');
        $item['moderation_note'] = $row['moderation_note'] !== null
            ? (string) $row['moderation_note']
            : null;
        $item['moderated_at'] = $row['moderated_at'] ?? null;
    }

    return $item;
}

/**
 * Список опубликованных объявлений для доски и API.
 *
 * @param Database $db
 * @param array{post_type?:string,realm?:string,q?:string,page?:int,limit?:int} $query
 * @return array{success:bool,data?:list<array<string,mixed>>,pagination?:array<string,int>,error?:string}
 */
function recruiting_fetch_post_list($db, array $query): array {
    $postType = isset($query['post_type']) ? trim((string) $query['post_type']) : '';
    $realm = isset($query['realm']) ? strtolower(trim((string) $query['realm'])) : '';
    $search = isset($query['q']) ? trim((string) $query['q']) : '';
    $page = max(1, (int) ($query['page'] ?? 1));
    $limit = (int) ($query['limit'] ?? 20);
    $limit = max(1, min(50, $limit));
    $offset = ($page - 1) * $limit;

    if ($postType !== '' && !recruiting_post_type_valid($postType)) {
        return ['success' => false, 'error' => 'Недопустимый тип объявления'];
    }

    if ($realm !== '' && !recruiting_realm_valid($realm)) {
        return ['success' => false, 'error' => 'Недопустимый регион'];
    }

    $where = ["p.status = 'approved'"];
    $params = [];

    if ($postType !== '') {
        $where[] = 'p.post_type = ?';
        $params[] = $postType;
    }

    if ($realm !== '') {
        $where[] = 'p.realm = ?';
        $params[] = $realm;
    }

    if ($search !== '') {
        $where[] = '(p.title LIKE ? OR p.body LIKE ? OR p.clan_tag LIKE ?)';
        $like = '%' . $search . '%';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }

    $whereSql = implode(' AND ', $where);

    $rows = $db->fetchAll(
        "SELECT
            p.id,
            p.post_type,
            p.realm,
            p.title,
            p.body,
            p.contact,
            p.clan_tag,
            p.clan_tag_type,
            p.game_nickname,
            p.published_at,
            p.created_at,
            p.updated_at,
            " . recruiting_sql_user_author_columns('u') . "
         FROM recruiting_posts p
         LEFT JOIN site_users u ON u.id = p.user_id
         WHERE {$whereSql}
         ORDER BY p.published_at DESC, p.id DESC
         LIMIT " . ($limit + 1) . " OFFSET {$offset}",
        $params
    );

    $hasMore = count($rows) > $limit;
    if ($hasMore) {
        array_pop($rows);
    }

    $items = array_map(static function (array $row): array {
        return recruiting_format_post($row, false);
    }, $rows);

    $rowCount = count($rows);
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
}

function recruiting_board_labels(string $lang = 'ru'): array {
    $isEn = $lang === 'en';

    return [
        'empty' => $isEn ? 'No ads match your filters.' : 'Нет объявлений по выбранным фильтрам.',
        'author' => $isEn ? 'Author' : 'Автор',
        'clanTagLabel' => $isEn ? 'Clan tag' : 'Тег клана',
        'teamNameLabel' => $isEn ? 'Team name' : 'Название команды',
        'prev' => $isEn ? 'Previous' : 'Назад',
        'next' => $isEn ? 'Next' : 'Вперёд',
        'page' => $isEn ? 'Page' : 'Страница',
        'readMore' => $isEn ? 'Read more' : 'Читать полностью',
        'showLess' => $isEn ? 'Show less' : 'Свернуть',
        'discordCopyHint' => $isEn ? 'Click to copy Discord ID' : 'Нажмите, чтобы скопировать Discord ID',
        'discordCopied' => $isEn ? 'Discord ID copied' : 'Discord ID скопирован',
        'viberCopyHint' => $isEn ? 'Click to copy Viber number' : 'Нажмите, чтобы скопировать номер Viber',
        'viberCopied' => $isEn ? 'Viber number copied' : 'Номер Viber скопирован',
    ];
}

function recruiting_viber_copy_value(string $value): string {
    $digits = preg_replace('/\D+/', '', $value);
    return $digits !== '' ? '+' . $digits : '';
}

function recruiting_post_excerpt(string $text, int $maxLen = 220): string {
    $clean = trim((string) preg_replace('/\s+/u', ' ', $text));
    if (mb_strlen($clean, 'UTF-8') <= $maxLen) {
        return $clean;
    }

    return rtrim(mb_substr($clean, 0, $maxLen, 'UTF-8')) . '…';
}

function recruiting_post_type_css_class(string $type): string {
    $map = [
        'clan_seeks_players' => 'recruiting-type-badge--clan-seeks',
        'team_seeks_players' => 'recruiting-type-badge--team-seeks',
        'player_seeks_clan' => 'recruiting-type-badge--player-clan',
        'player_seeks_team' => 'recruiting-type-badge--player-team',
    ];

    return $map[$type] ?? '';
}

function recruiting_format_board_date(?string $iso): string {
    if (!function_exists('abs_format_utc_local')) {
        require_once __DIR__ . '/datetime.php';
    }

    $formatted = abs_format_utc_local($iso);
    return $formatted ?? '—';
}

function recruiting_contact_public_href(string $type, string $value): ?string {
    $raw = trim($value);
    if ($raw === '') {
        return null;
    }
    if (preg_match('/^https?:\/\//i', $raw)) {
        return $raw;
    }

    switch ($type) {
        case 'vk':
            $slug = preg_replace('/^(?:https?:\/\/)?(?:www\.)?vk\.com\//i', '', ltrim($raw, '@'));
            return $slug !== '' ? 'https://vk.com/' . rawurlencode($slug) : null;
        case 'telegram':
            $slug = preg_replace('/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\//i', '', ltrim($raw, '@'));
            return $slug !== '' ? 'https://t.me/' . rawurlencode($slug) : null;
        case 'viber':
            $digits = preg_replace('/\D+/', '', $raw);
            return $digits !== '' ? 'viber://chat?number=%2B' . $digits : null;
        case 'discord':
            if (preg_match('/discord(?:app)?\.com/i', $raw) || preg_match('/^discord\.gg\//i', $raw)) {
                return preg_match('/^https?:\/\//i', $raw) ? $raw : 'https://' . ltrim($raw, '/');
            }
            return null;
        case 'max':
            if (preg_match('/max\.ru\/join\//i', $raw)) {
                return preg_match('/^https?:\/\//i', $raw) ? $raw : 'https://' . ltrim($raw, '/');
            }
            $code = ltrim($raw, '@');
            return preg_match('/^[a-zA-Z0-9_-]+$/', $code) ? 'https://max.ru/join/' . rawurlencode($code) : null;
        default:
            return null;
    }
}

function recruiting_render_max_icon(string $className = 'recruiting-contact-icon-max'): string {
    return '<svg class="' . htmlspecialchars($className, ENT_QUOTES, 'UTF-8') . '" viewBox="0 0 42 42" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">'
        . '<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M21.47 41.88c-4.11 0-6.02-.6-9.34-3-2.1 2.7-8.75 4.81-9.04 1.2 0-2.71-.6-5-1.28-7.5C1 29.5.08 26.07.08 21.1.08 9.23 9.82.3 21.36.3c11.55 0 20.6 9.37 20.6 20.91a20.6 20.6 0 0 1-20.49 20.67m.17-31.32c-5.62-.29-10 3.6-10.97 9.7-.8 5.05.62 11.2 1.83 11.52.58.14 2.04-1.04 2.95-1.95a10.4 10.4 0 0 0 5.08 1.81 10.7 10.7 0 0 0 11.19-9.97 10.7 10.7 0 0 0-10.08-11.1Z"/></svg>';
}

function recruiting_render_contact_link(array $contact, string $lang = 'ru'): string {
    $type = (string) ($contact['type'] ?? 'telegram');
    $value = trim((string) ($contact['value'] ?? ''));
    if ($value === '') {
        return '';
    }

    $iconClass = recruiting_contact_type_icon($type);
    if ($iconClass === 'recruiting-contact-icon-max') {
        $iconHtml = recruiting_render_max_icon($iconClass);
    } else {
        $iconHtml = '<i class="' . htmlspecialchars($iconClass, ENT_QUOTES, 'UTF-8') . '" aria-hidden="true"></i>';
    }

    $label = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    $labels = recruiting_board_labels($lang);

    if ($type === 'viber') {
        $copyValue = recruiting_viber_copy_value($value);
        if ($copyValue !== '') {
            $hint = htmlspecialchars((string) ($labels['viberCopyHint'] ?? ''), ENT_QUOTES, 'UTF-8');
            $copied = htmlspecialchars((string) ($labels['viberCopied'] ?? ''), ENT_QUOTES, 'UTF-8');

            return '<button type="button" class="recruiting-post-contact-link recruiting-post-contact-link--copy" data-copy-value="'
                . htmlspecialchars($copyValue, ENT_QUOTES, 'UTF-8') . '" data-copy-done="' . $copied . '" title="' . $hint . '" aria-label="' . $hint . '">'
                . $iconHtml . '<span>' . $label . '</span></button>';
        }
    }

    $href = recruiting_contact_public_href($type, $value);

    if ($type === 'discord' && $href === null) {
        $copyValue = ltrim($value, '@');
        if ($copyValue !== '') {
            $hint = htmlspecialchars((string) ($labels['discordCopyHint'] ?? ''), ENT_QUOTES, 'UTF-8');
            $copied = htmlspecialchars((string) ($labels['discordCopied'] ?? ''), ENT_QUOTES, 'UTF-8');

            return '<button type="button" class="recruiting-post-contact-link recruiting-post-contact-link--copy" data-copy-value="'
                . htmlspecialchars($copyValue, ENT_QUOTES, 'UTF-8') . '" data-copy-done="' . $copied . '" title="' . $hint . '" aria-label="' . $hint . '">'
                . $iconHtml . '<span>' . $label . '</span></button>';
        }
    }
    if ($href !== null) {
        return '<a class="recruiting-post-contact-link" href="' . htmlspecialchars($href, ENT_QUOTES, 'UTF-8') . '" target="_blank" rel="noopener noreferrer">'
            . $iconHtml . '<span>' . $label . '</span></a>';
    }

    return '<span class="recruiting-post-contact-link recruiting-post-contact-link--plain">'
        . $iconHtml . '<span>' . $label . '</span></span>';
}

function recruiting_render_board_card(array $post, string $lang = 'ru'): string {
    $labels = recruiting_board_labels($lang);
    $typeLabel = recruiting_post_type_label((string) ($post['post_type'] ?? ''), $lang);
    $typeClass = recruiting_post_type_css_class((string) ($post['post_type'] ?? ''));
    $realm = recruiting_realm_label((string) ($post['realm'] ?? ''), $lang);
    $bodyFull = (string) ($post['body'] ?? '');
    $cleanBody = trim((string) preg_replace('/\s+/u', ' ', $bodyFull));
    $bodyShort = recruiting_post_excerpt($bodyFull, 220);
    $hasMore = mb_strlen($cleanBody, 'UTF-8') > 220;
    $dateRaw = (string) (($post['published_at'] ?? null) ?: ($post['created_at'] ?? ''));
    $dateLabel = recruiting_format_board_date($dateRaw);

    $metaParts = [];
    if (!empty($post['clan_tag'])) {
        $clanMeta = recruiting_render_clan_tag_meta($post, $lang);
        if ($clanMeta !== '') {
            $metaParts[] = $clanMeta;
        }
    }

    $contactLinks = [];
    foreach ((array) ($post['contacts'] ?? []) as $contact) {
        if (!is_array($contact)) {
            continue;
        }
        $link = recruiting_render_contact_link($contact, $lang);
        if ($link !== '') {
            $contactLinks[] = $link;
        }
    }

    $footRow = '';
    if ($metaParts !== [] || $contactLinks !== []) {
        $footRow = '<div class="recruiting-post-card-foot-row">'
            . implode('', $metaParts)
            . ($contactLinks !== [] ? '<div class="recruiting-post-contacts">' . implode('', $contactLinks) . '</div>' : '')
            . '</div>';
    }

    $toggleHtml = '';
    if ($hasMore) {
        $toggleHtml = '<div class="recruiting-post-body-full hidden">'
            . htmlspecialchars($bodyFull, ENT_QUOTES, 'UTF-8')
            . '</div><button type="button" class="recruiting-post-toggle" data-expanded="false">'
            . htmlspecialchars($labels['readMore'], ENT_QUOTES, 'UTF-8')
            . '</button>';
    }

    return '<article class="recruiting-post-card" data-post-id="' . (int) ($post['id'] ?? 0) . '">'
        . '<header class="recruiting-post-card-head">'
        . '<div class="recruiting-post-card-meta">'
        . '<span class="recruiting-post-author">' . htmlspecialchars($labels['author'], ENT_QUOTES, 'UTF-8') . ': '
        . htmlspecialchars((string) ($post['author'] ?? '—'), ENT_QUOTES, 'UTF-8') . '</span>'
        . '<time class="recruiting-post-date" datetime="' . htmlspecialchars($dateRaw, ENT_QUOTES, 'UTF-8') . '">'
        . htmlspecialchars($dateLabel, ENT_QUOTES, 'UTF-8') . '</time>'
        . '</div></header>'
        . '<div class="recruiting-post-excerpt">' . htmlspecialchars($bodyShort, ENT_QUOTES, 'UTF-8') . '</div>'
        . $toggleHtml
        . '<footer class="recruiting-post-card-foot">'
        . $footRow
        . '<div class="recruiting-post-badges recruiting-post-badges--bottom">'
        . '<span class="recruiting-type-badge ' . htmlspecialchars($typeClass, ENT_QUOTES, 'UTF-8') . '">'
        . htmlspecialchars($typeLabel, ENT_QUOTES, 'UTF-8') . '</span>'
        . '<span class="recruiting-realm-badge">' . htmlspecialchars($realm, ENT_QUOTES, 'UTF-8') . '</span>'
        . '</div></footer></article>';
}

function recruiting_render_board_pagination(?array $pagination, string $lang = 'ru'): string {
    if (!is_array($pagination)) {
        return '';
    }

    $labels = recruiting_board_labels($lang);
    $pages = (int) ($pagination['pages'] ?? 0);
    $page = (int) ($pagination['page'] ?? 1);
    if ($pages <= 1) {
        return '';
    }

    $prevDisabled = $page <= 1 ? ' disabled' : '';
    $nextDisabled = $page >= $pages ? ' disabled' : '';

    return '<button type="button" class="recruiting-page-btn" data-page="' . ($page - 1) . '"' . $prevDisabled . '>'
        . htmlspecialchars($labels['prev'], ENT_QUOTES, 'UTF-8') . '</button>'
        . '<span class="recruiting-page-info">' . htmlspecialchars($labels['page'], ENT_QUOTES, 'UTF-8')
        . ' ' . $page . ' / ' . $pages . '</span>'
        . '<button type="button" class="recruiting-page-btn" data-page="' . ($page + 1) . '"' . $nextDisabled . '>'
        . htmlspecialchars($labels['next'], ENT_QUOTES, 'UTF-8') . '</button>';
}

function recruiting_render_board_list(?array $result, string $lang = 'ru'): string {
    if (!is_array($result) || empty($result['success'])) {
        return '';
    }

    $items = is_array($result['data'] ?? null) ? $result['data'] : [];
    if ($items === []) {
        $labels = recruiting_board_labels($lang);

        return '<p class="recruiting-list-empty">' . htmlspecialchars($labels['empty'], ENT_QUOTES, 'UTF-8') . '</p>';
    }

    $html = '';
    foreach ($items as $post) {
        if (is_array($post)) {
            $html .= recruiting_render_board_card($post, $lang);
        }
    }

    return $html;
}
