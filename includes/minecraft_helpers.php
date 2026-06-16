<?php

require_once __DIR__ . '/../config/ensure_site_settings.php';
require_once __DIR__ . '/user_auth.php';
require_once __DIR__ . '/game_api.php';

const MINECRAFT_PACKS_DIR = 'uploads/minecraft/packs';
const MINECRAFT_LAUNCHER_DIR = 'uploads/minecraft/launcher';
const MINECRAFT_PACK_MAX_BYTES = 2147483648;
const MINECRAFT_LAUNCHER_MAX_BYTES = 536870912;
const MINECRAFT_PACKS_SETTING_KEY = 'mc_client_packs';
const MINECRAFT_LAUNCHER_FILE_SETTING_KEY = 'mc_launcher_file';
const MINECRAFT_SERVERS_SETTING_KEY = 'mc_servers';
const MINECRAFT_EXAROTON_TOKEN_SETTING_KEY = 'mc_exaroton_api_token';
const MINECRAFT_SERVERS_MAX = 20;
const MINECRAFT_LANDING_BADGES_MAX = 8;

function minecraft_pack_php_upload_limit_bytes(): int
{
    $limits = [];
    foreach (['upload_max_filesize', 'post_max_size'] as $iniKey) {
        $raw = ini_get($iniKey);
        if (!is_string($raw) || $raw === '') {
            continue;
        }
        $limits[] = minecraft_parse_ini_size($raw);
    }

    if ($limits === []) {
        return MINECRAFT_PACK_MAX_BYTES;
    }

    return min(MINECRAFT_PACK_MAX_BYTES, min($limits));
}

function minecraft_pack_php_upload_limit_mb(): int
{
    return max(1, (int) floor(minecraft_pack_php_upload_limit_bytes() / (1024 * 1024)));
}

function minecraft_parse_ini_size(string $value): int
{
    $value = trim($value);
    if ($value === '') {
        return 0;
    }

    $unit = strtolower(substr($value, -1));
    $number = (float) $value;
    if ($unit === 'g') {
        return (int) round($number * 1024 * 1024 * 1024);
    }
    if ($unit === 'm') {
        return (int) round($number * 1024 * 1024);
    }
    if ($unit === 'k') {
        return (int) round($number * 1024);
    }

    return (int) round((float) $value);
}

function minecraft_pack_upload_body_rejected_error(): string
{
    $limitMb = minecraft_pack_php_upload_limit_mb();

    return 'Сервер не принял архив. Скорее всего, он больше лимита PHP (сейчас ~'
        . $limitMb
        . ' МБ). На сервере увеличьте upload_max_filesize и post_max_size до 2048M '
        . '(см. deploy/php/99-minecraft-upload.ini) и перезапустите php-fpm.';
}

function chadow_app_version(): string
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }

    $raw = @file_get_contents(dirname(__DIR__) . '/config/version.json');
    $data = $raw ? json_decode($raw, true) : null;
    $cached = (is_array($data) && !empty($data['version']))
        ? trim((string) $data['version'])
        : '3.2.2 daedalus';

    return $cached;
}

function minecraft_is_valid_server_id(string $id): bool
{
    return (bool) preg_match('/^[a-z0-9][a-z0-9_-]{0,31}$/i', $id);
}

function minecraft_get_servers($db): array
{
    $raw = get_site_setting($db, MINECRAFT_SERVERS_SETTING_KEY, '');
    $decoded = $raw !== '' ? json_decode((string) $raw, true) : null;
    if (is_array($decoded) && $decoded !== []) {
        $servers = [];
        foreach ($decoded as $entry) {
            $normalized = minecraft_normalize_server_entry(is_array($entry) ? $entry : []);
            if ($normalized !== null) {
                $servers[] = $normalized;
            }
        }
        if ($servers !== []) {
            return $servers;
        }
    }

    $settings = [
        'server_host' => trim((string) get_site_setting($db, 'mc_server_host', '')),
        'server_port' => minecraft_normalize_port(get_site_setting($db, 'mc_server_port', '25565')),
        'server_name' => trim((string) get_site_setting($db, 'mc_server_name', 'Chadow SMP')),
    ];

    if ($settings['server_host'] === '' || !minecraft_is_valid_host($settings['server_host'])) {
        return [];
    }

    return [[
        'id' => 'main',
        'name' => $settings['server_name'] !== '' ? $settings['server_name'] : 'Chadow SMP',
        'host' => $settings['server_host'],
        'port' => $settings['server_port'],
    ]];
}

function minecraft_normalize_server_entry(array $entry): ?array
{
    $id = trim((string) ($entry['id'] ?? ''));
    $name = trim((string) ($entry['name'] ?? ''));
    $host = trim((string) ($entry['host'] ?? ''));
    $port = minecraft_normalize_port($entry['port'] ?? 25565);
    $connectHost = trim((string) ($entry['connectHost'] ?? ''));
    $connectPortRaw = $entry['connectPort'] ?? null;
    $connectPort = $connectPortRaw === null || $connectPortRaw === ''
        ? null
        : minecraft_normalize_port($connectPortRaw);
    $icon = trim((string) ($entry['icon'] ?? ''));
    $exarotonId = trim((string) ($entry['exarotonId'] ?? ''));

    if ($id === '') {
        $idSeed = ($connectHost !== '' ? $connectHost : $host) . ':' . ($connectPort ?? $port);
        $id = 'server-' . substr(hash('crc32b', strtolower($idSeed)), 0, 8);
    }
    if (!minecraft_is_valid_server_id($id)) {
        return null;
    }
    if ($name === '' || mb_strlen($name, 'UTF-8') > 80) {
        return null;
    }
    if (!minecraft_is_valid_host($host)) {
        return null;
    }
    if ($connectHost !== '' && !minecraft_is_valid_host($connectHost)) {
        return null;
    }
    if ($exarotonId !== '' && !minecraft_is_valid_exaroton_id($exarotonId)) {
        return null;
    }
    if ($icon !== '' && mb_strlen($icon, 'UTF-8') > 120) {
        return null;
    }
    if ($icon !== '' && !minecraft_is_valid_server_icon($icon)) {
        return null;
    }

    $description = minecraft_normalize_server_description($entry['description'] ?? '');

    $normalized = [
        'id' => $id,
        'name' => $name,
        'host' => $host,
        'port' => $port,
    ];
    if ($icon !== '') {
        $normalized['icon'] = $icon;
    }
    if ($description !== []) {
        $normalized['description'] = $description;
    }
    if ($connectHost !== '') {
        $normalized['connectHost'] = $connectHost;
        if ($connectPort !== null) {
            $normalized['connectPort'] = $connectPort;
        }
    }
    if ($exarotonId !== '') {
        $normalized['exarotonId'] = $exarotonId;
    }

    return $normalized;
}

function minecraft_is_valid_exaroton_id(string $id): bool
{

    return preg_match('/^[A-Za-z0-9]{10,24}$/', $id) === 1;
}

function minecraft_exaroton_api_token($db): string
{
    return trim((string) get_site_setting($db, MINECRAFT_EXAROTON_TOKEN_SETTING_KEY, ''));
}

function minecraft_exaroton_wake_cooldown_path(string $exarotonId): string
{
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR
        . 'mc_exo_wake_'
        . hash('sha256', $exarotonId)
        . '.time';
}

function minecraft_exaroton_can_wake(string $exarotonId, int $cooldownSec = 45): bool
{
    $path = minecraft_exaroton_wake_cooldown_path($exarotonId);
    if (!is_file($path)) {
        return true;
    }

    return (time() - (int) @filemtime($path)) >= $cooldownSec;
}

function minecraft_exaroton_mark_wake(string $exarotonId): void
{
    @file_put_contents(minecraft_exaroton_wake_cooldown_path($exarotonId), (string) time());
}

function minecraft_exaroton_api_request($db, string $method, string $path): array
{
    $token = minecraft_exaroton_api_token($db);
    if ($token === '') {
        return ['ok' => false, 'error' => 'no_token'];
    }
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'error' => 'curl_missing'];
    }

    $url = 'https://api.exaroton.com/v1' . $path;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
        ],
        CURLOPT_TIMEOUT => 12,
        CURLOPT_CONNECTTIMEOUT => 8,
    ]);
    $raw = curl_exec($ch);
    $errno = curl_errno($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($errno !== 0 || $raw === false) {
        return ['ok' => false, 'error' => 'network'];
    }

    $json = json_decode((string) $raw, true);
    if (!is_array($json)) {
        return ['ok' => false, 'error' => 'invalid_json', 'status' => $httpCode];
    }
    if ($httpCode < 200 || $httpCode >= 300) {
        $message = trim((string) ($json['message'] ?? $json['error'] ?? 'http_error'));

        return ['ok' => false, 'error' => $message !== '' ? $message : 'http_error', 'status' => $httpCode];
    }

    return ['ok' => true, 'status' => $httpCode, 'data' => $json];
}

function minecraft_exaroton_wake_server($db, string $exarotonId): array
{
    if (!minecraft_exaroton_can_wake($exarotonId)) {
        return ['ok' => true, 'skipped' => true];
    }

    $result = minecraft_exaroton_api_request(
        $db,
        'GET',
        '/servers/' . rawurlencode($exarotonId) . '/start/'
    );
    if (!$result['ok']) {
        return ['ok' => false, 'error' => $result['error'] ?? 'wake_failed'];
    }

    minecraft_exaroton_mark_wake($exarotonId);

    return ['ok' => true];
}

function minecraft_wake_launcher_servers($db, ?string $serverId = null): array
{
    if (minecraft_exaroton_api_token($db) === '') {
        return [
            'reason' => 'no_token',
            'woken' => [],
        ];
    }

    $results = [];
    foreach (minecraft_get_servers($db) as $server) {
        $id = (string) ($server['id'] ?? '');
        if ($serverId !== null && $serverId !== '' && $id !== $serverId) {
            continue;
        }

        $exarotonId = trim((string) ($server['exarotonId'] ?? ''));
        if ($exarotonId === '') {
            continue;
        }

        $wake = minecraft_exaroton_wake_server($db, $exarotonId);
        $results[] = [
            'id' => $id,
            'ok' => $wake['ok'],
            'skipped' => $wake['skipped'] ?? false,
            'error' => $wake['error'] ?? null,
        ];
    }

    if ($results === []) {
        return [
            'reason' => $serverId !== null && $serverId !== '' ? 'server_not_configured' : 'no_exaroton_servers',
            'woken' => [],
        ];
    }

    return [
        'reason' => null,
        'woken' => $results,
    ];
}

function minecraft_public_server_entry(array $server): array
{
    $public = $server;
    unset($public['exarotonId']);

    return $public;
}

function minecraft_server_connect_host(array $server): string
{
    $connectHost = trim((string) ($server['connectHost'] ?? ''));
    if ($connectHost !== '') {
        return $connectHost;
    }

    return trim((string) ($server['host'] ?? ''));
}

function minecraft_server_connect_port(array $server): int
{
    if (array_key_exists('connectPort', $server) && $server['connectPort'] !== null && $server['connectPort'] !== '') {
        return minecraft_normalize_port($server['connectPort']);
    }

    return minecraft_normalize_port($server['port'] ?? 25565);
}

function minecraft_normalize_server_description($raw): array
{
    if (is_array($raw)) {
        $lines = $raw;
    } else {
        $lines = preg_split('/\R/u', (string) $raw) ?: [];
    }

    $result = [];
    foreach ($lines as $line) {
        $line = trim((string) $line);
        if ($line === '') {
            continue;
        }
        $result[] = mb_substr($line, 0, 48, 'UTF-8');
        if (count($result) >= 3) {
            break;
        }
    }

    return $result;
}

function minecraft_is_valid_server_icon(string $icon): bool
{
    if (array_key_exists($icon, minecraft_server_icon_options())) {
        return true;
    }
    if (preg_match('/^https?:\/\//i', $icon) === 1) {
        return true;
    }
    if (str_starts_with($icon, '/uploads/')) {
        return true;
    }

    return mb_strlen($icon, 'UTF-8') <= 8;
}

function minecraft_save_servers($db, array $servers): void
{
    set_site_setting(
        $db,
        MINECRAFT_SERVERS_SETTING_KEY,
        json_encode(array_values($servers), JSON_UNESCAPED_UNICODE)
    );

    $first = $servers[0] ?? null;
    if ($first !== null) {
        set_site_setting($db, 'mc_server_host', minecraft_server_connect_host($first));
        set_site_setting($db, 'mc_server_port', (string) minecraft_server_connect_port($first));
        set_site_setting($db, 'mc_server_name', $first['name']);
    } else {
        set_site_setting($db, 'mc_server_host', '');
        set_site_setting($db, 'mc_server_port', '25565');
        set_site_setting($db, 'mc_server_name', '');
    }
}

function minecraft_parse_servers_input($raw): array
{
    if (is_string($raw)) {
        $decoded = json_decode($raw, true);
    } elseif (is_array($raw)) {
        $decoded = $raw;
    } else {
        return ['ok' => false, 'error' => 'Некорректный список серверов'];
    }

    if (!is_array($decoded)) {
        return ['ok' => false, 'error' => 'Некорректный список серверов'];
    }

    if (count($decoded) > MINECRAFT_SERVERS_MAX) {
        return ['ok' => false, 'error' => 'Слишком много серверов (макс. ' . MINECRAFT_SERVERS_MAX . ')'];
    }

    $servers = [];
    $ids = [];
    foreach ($decoded as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $exarotonId = trim((string) ($entry['exarotonId'] ?? ''));
        if ($exarotonId !== '' && !minecraft_is_valid_exaroton_id($exarotonId)) {
            return [
                'ok' => false,
                'error' => 'Неверный Exaroton ID: укажите короткий ID сервера из панели exaroton, а не API-токен',
            ];
        }
        $normalized = minecraft_normalize_server_entry($entry);
        if ($normalized === null) {
            return ['ok' => false, 'error' => 'Проверьте название, адреса и порты каждого сервера'];
        }
        if (isset($ids[$normalized['id']])) {
            return ['ok' => false, 'error' => 'ID серверов должны быть уникальными'];
        }
        $ids[$normalized['id']] = true;
        $servers[] = $normalized;
    }

    return ['ok' => true, 'servers' => $servers];
}

function minecraft_get_settings($db): array
{
    $servers = minecraft_get_servers($db);
    $primary = $servers[0] ?? null;

    return [
        'enabled' => get_site_setting($db, 'mc_enabled', '0') === '1',
        'server_host' => $primary['host'] ?? '',
        'server_port' => $primary['port'] ?? 25565,
        'server_name' => $primary['name'] ?? 'Chadow SMP',
        'servers' => $servers,
        'minecraft_version' => trim((string) get_site_setting($db, 'mc_minecraft_version', '1.20.4')),
        'java_major' => minecraft_normalize_java_major(get_site_setting($db, 'mc_java_major', '21')),
        'wg_application_id' => game_api_wg_application_id($db),
        'lesta_application_id' => game_api_lesta_application_id($db),
        'launcher_version' => max(1, (int) get_site_setting($db, 'mc_launcher_version', '17')),
        'exaroton_api_token' => minecraft_exaroton_api_token($db),
        'landing' => minecraft_get_landing_settings($db),
    ];
}

function minecraft_landing_defaults(): array
{
    return [
        'desc_ru' => 'С помощью лаунчера можно играть на сервере «Chadow Land» Minecraft.',
        'desc_en' => 'With the launcher you can play on the “Chadow Land” Minecraft server.',
        'tile_span' => 2,
        'badges' => [],
    ];
}

function minecraft_landing_badge_styles(): array
{
    return [
        'default',
        'test',
        'minecraft',
        'wg',
        'lesta',
        'cs2',
        'dota2',
        'survival',
        'pvp',
        'vip',
        'classic',
        'beta',
        'new',
    ];
}

function minecraft_server_icon_options(): array
{
    return [
        '' => 'Без иконки',
        'pickaxe' => '⛏ Кирка',
        'sword' => '⚔ Меч',
        'castle' => '🏰 Замок',
        'globe' => '🌐 Мир',
        'fire' => '🔥 Огонь',
        'star' => '⭐ Звезда',
        'diamond' => '💎 Алмаз',
        'tree' => '🌲 Лес',
        'ship' => '⛵ Порт',
        'pick' => '🪓 Топор',
    ];
}

function minecraft_normalize_landing_tile_span($span): int
{
    $span = (int) $span;
    if (!in_array($span, [1, 2, 4], true)) {
        return 2;
    }

    return $span;
}

function minecraft_landing_tile_class(int $span): string
{
    if ($span === 4) {
        return 'project-card--span-4';
    }
    if ($span === 2) {
        return 'project-card--span-2';
    }

    return '';
}

function minecraft_get_landing_settings($db): array
{
    $defaults = minecraft_landing_defaults();
    $badges = minecraft_parse_landing_badges_stored(
        get_site_setting($db, 'mc_landing_badges', '')
    );

    return [
        'active' => get_site_setting($db, 'mc_landing_active', '0') === '1',
        'desc_ru' => trim((string) get_site_setting($db, 'mc_landing_desc_ru', $defaults['desc_ru'])),
        'desc_en' => trim((string) get_site_setting($db, 'mc_landing_desc_en', $defaults['desc_en'])),
        'tile_span' => minecraft_normalize_landing_tile_span(
            get_site_setting($db, 'mc_landing_tile_span', (string) $defaults['tile_span'])
        ),
        'badges' => $badges,
        'launcher_file' => minecraft_get_launcher_file_meta($db),
    ];
}

function minecraft_parse_landing_badges_stored($raw): array
{
    if (is_string($raw)) {
        $decoded = json_decode($raw, true);
    } elseif (is_array($raw)) {
        $decoded = $raw;
    } else {
        return [];
    }

    if (!is_array($decoded)) {
        return [];
    }

    $badges = [];
    foreach ($decoded as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $normalized = minecraft_normalize_landing_badge_entry($entry);
        if ($normalized !== null) {
            $badges[] = $normalized;
        }
    }

    return $badges;
}

function minecraft_normalize_landing_badge_entry(array $entry): ?array
{
    $labelRu = trim((string) ($entry['label_ru'] ?? ''));
    $labelEn = trim((string) ($entry['label_en'] ?? ''));
    if ($labelRu === '' && $labelEn === '') {
        return null;
    }

    $style = trim((string) ($entry['style'] ?? 'default'));
    if (!in_array($style, minecraft_landing_badge_styles(), true)) {
        $style = 'default';
    }

    return [
        'label_ru' => mb_substr($labelRu, 0, 40, 'UTF-8'),
        'label_en' => mb_substr($labelEn, 0, 40, 'UTF-8'),
        'style' => $style,
    ];
}

function minecraft_parse_landing_badges_input($raw): array
{
    if (is_string($raw)) {
        $decoded = json_decode($raw, true);
    } elseif (is_array($raw)) {
        $decoded = $raw;
    } else {
        return ['ok' => false, 'error' => 'Некорректный список бейджей'];
    }

    if (!is_array($decoded)) {
        return ['ok' => false, 'error' => 'Некорректный список бейджей'];
    }

    if (count($decoded) > MINECRAFT_LANDING_BADGES_MAX) {
        return ['ok' => false, 'error' => 'Слишком много бейджей (макс. ' . MINECRAFT_LANDING_BADGES_MAX . ')'];
    }

    $badges = [];
    foreach ($decoded as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $normalized = minecraft_normalize_landing_badge_entry($entry);
        if ($normalized === null) {
            continue;
        }
        $badges[] = $normalized;
    }

    return ['ok' => true, 'badges' => $badges];
}

function minecraft_save_landing_badges($db, array $badges): void
{
    set_site_setting(
        $db,
        'mc_landing_badges',
        json_encode(array_values($badges), JSON_UNESCAPED_UNICODE)
    );
}

function minecraft_landing_badges_html(array $badges, string $lang): string
{
    if ($badges === []) {
        return '';
    }

    $html = '<div class="project-card-badge-row">';
    foreach ($badges as $badge) {
        $labelRu = $badge['label_ru'];
        $labelEn = $badge['label_en'];
        $label = $lang === 'en'
            ? ($labelEn !== '' ? $labelEn : $labelRu)
            : ($labelRu !== '' ? $labelRu : $labelEn);
        if ($label === '') {
            continue;
        }

        $class = 'project-card-badge';
        $style = $badge['style'] ?? 'default';
        if ($style !== '' && $style !== 'default') {
            $class .= ' project-card-badge--' . preg_replace('/[^a-z0-9_-]/', '', $style);
        }

        $html .= '<span class="' . htmlspecialchars($class, ENT_QUOTES, 'UTF-8') . '"'
            . ' data-badge-custom="1"'
            . ' data-label-ru="' . htmlspecialchars($labelRu, ENT_QUOTES, 'UTF-8') . '"'
            . ' data-label-en="' . htmlspecialchars($labelEn, ENT_QUOTES, 'UTF-8') . '">'
            . htmlspecialchars($label, ENT_QUOTES, 'UTF-8')
            . '</span>';
    }
    $html .= '</div>';

    return $html;
}

function minecraft_landing_card_badges_html(array $landing, string $lang, bool $active): string
{
    $badges = is_array($landing['badges'] ?? null) ? $landing['badges'] : [];
    $html = minecraft_landing_badges_html($badges, $lang);
    if ($html !== '' || $active) {
        return $html;
    }

    $label = $lang === 'en' ? 'IN DEVELOPMENT' : 'В РАЗРАБОТКЕ';

    return '<div class="project-card-badge-row">'
        . '<span class="project-card-badge" data-badge-custom="1"'
        . ' data-label-ru="В РАЗРАБОТКЕ" data-label-en="IN DEVELOPMENT">'
        . htmlspecialchars($label, ENT_QUOTES, 'UTF-8')
        . '</span></div>';
}

function minecraft_launcher_root(): string
{
    return dirname(__DIR__) . '/' . MINECRAFT_LAUNCHER_DIR;
}

function minecraft_launcher_public_path(string $filename): string
{
    return '/' . MINECRAFT_LAUNCHER_DIR . '/' . rawurlencode($filename);
}

function minecraft_get_launcher_file_meta($db): ?array
{
    $raw = get_site_setting($db, MINECRAFT_LAUNCHER_FILE_SETTING_KEY, '');
    if ($raw === '') {
        return null;
    }

    $decoded = json_decode((string) $raw, true);
    if (!is_array($decoded)) {
        return null;
    }

    $filename = trim((string) ($decoded['filename'] ?? ''));
    if ($filename === '' || preg_match('/[\/\\\\]/', $filename)) {
        return null;
    }

    $path = minecraft_launcher_root() . '/' . $filename;
    if (!is_file($path)) {
        return null;
    }

    $sha256 = strtolower(trim((string) ($decoded['sha256'] ?? '')));
    if ($sha256 === '') {
        $sha256 = hash_file('sha256', $path) ?: '';
    }

    $size = max(0, (int) ($decoded['size'] ?? 0));
    if ($size <= 0) {
        $size = (int) filesize($path);
    }

    $uploadedAt = trim((string) ($decoded['uploaded_at'] ?? ''));
    if ($uploadedAt === '') {
        $uploadedAt = date('c', (int) filemtime($path));
    }

    return [
        'filename' => $filename,
        'original_name' => trim((string) ($decoded['original_name'] ?? $filename)),
        'sha256' => $sha256,
        'size' => $size,
        'uploaded_at' => $uploadedAt,
    ];
}

function minecraft_sanitize_launcher_filename(string $name): string
{
    $name = basename(str_replace('\\', '/', $name));
    $name = preg_replace('/[^\w.\- ()]+/u', '_', $name) ?? 'launcher-setup.exe';
    $name = trim($name, '._- ');
    if ($name === '') {
        return 'launcher-setup.exe';
    }

    return mb_substr($name, 0, 120, 'UTF-8');
}

function minecraft_admin_upload_launcher_file($db, array $file): array
{
    if (!isset($file['error']) || (int) $file['error'] !== UPLOAD_ERR_OK) {
        $code = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE) {
            return ['ok' => false, 'error' => 'file_too_large'];
        }
        if ($code === UPLOAD_ERR_NO_FILE) {
            return ['ok' => false, 'error' => 'no_file'];
        }

        return ['ok' => false, 'error' => 'upload_failed'];
    }

    $tmpPath = (string) ($file['tmp_name'] ?? '');
    if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
        return ['ok' => false, 'error' => 'upload_failed'];
    }

    $size = (int) ($file['size'] ?? 0);
    if ($size <= 0 || $size > MINECRAFT_LAUNCHER_MAX_BYTES) {
        return ['ok' => false, 'error' => 'file_too_large'];
    }

    $originalName = (string) ($file['name'] ?? 'launcher-setup.exe');
    $lowerName = strtolower($originalName);
    if (!str_ends_with($lowerName, '.exe') && !str_ends_with($lowerName, '.msi')) {
        return ['ok' => false, 'error' => 'invalid_type'];
    }

    $root = minecraft_launcher_root();
    if (!is_dir($root) && !mkdir($root, 0755, true) && !is_dir($root)) {
        return ['ok' => false, 'error' => 'mkdir_failed'];
    }

    $previous = minecraft_get_launcher_file_meta($db);
    if ($previous !== null) {
        $oldPath = $root . '/' . $previous['filename'];
        if (is_file($oldPath)) {
            @unlink($oldPath);
        }
    }

    $filename = minecraft_sanitize_launcher_filename($originalName);
    $destPath = $root . '/' . $filename;
    if (!move_uploaded_file($tmpPath, $destPath)) {
        return ['ok' => false, 'error' => 'save_failed'];
    }

    $meta = [
        'filename' => $filename,
        'original_name' => $originalName,
        'sha256' => hash_file('sha256', $destPath) ?: '',
        'size' => (int) filesize($destPath),
        'uploaded_at' => gmdate('c'),
    ];
    set_site_setting($db, MINECRAFT_LAUNCHER_FILE_SETTING_KEY, json_encode($meta, JSON_UNESCAPED_UNICODE));

    return [
        'ok' => true,
        'file' => $meta,
    ];
}

function minecraft_admin_delete_launcher_file($db): array
{
    $meta = minecraft_get_launcher_file_meta($db);
    if ($meta === null) {
        return ['ok' => false, 'error' => 'not_found'];
    }

    $path = minecraft_launcher_root() . '/' . $meta['filename'];
    if (is_file($path)) {
        @unlink($path);
    }

    set_site_setting($db, MINECRAFT_LAUNCHER_FILE_SETTING_KEY, '');

    return ['ok' => true];
}

function minecraft_normalize_port($port): int
{
    $port = (int) $port;
    if ($port < 1 || $port > 65535) {
        return 25565;
    }

    return $port;
}

function minecraft_normalize_java_major($major): int
{
    $major = (int) $major;
    if ($major < 8 || $major > 30) {
        return 21;
    }

    return $major;
}

function minecraft_is_valid_version(string $version): bool
{

    return (bool) preg_match('/^\d+\.\d+(\.\d+)?$/', $version);
}

function minecraft_packs_root(): string
{
    return dirname(__DIR__) . '/' . MINECRAFT_PACKS_DIR;
}

function minecraft_pack_filename(string $version): string
{
    return preg_replace('/[^0-9.]/', '_', $version) . '.zip';
}

function minecraft_pack_public_path(string $version): string
{
    return '/' . MINECRAFT_PACKS_DIR . '/' . minecraft_pack_filename($version);
}

function minecraft_get_client_packs($db): array
{
    $raw = get_site_setting($db, MINECRAFT_PACKS_SETTING_KEY, '[]');
    $decoded = json_decode((string) $raw, true);
    if (!is_array($decoded)) {
        return [];
    }

    $packs = [];
    foreach ($decoded as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $version = trim((string) ($entry['version'] ?? ''));
        if ($version === '' || !minecraft_is_valid_version($version)) {
            continue;
        }
        $filename = trim((string) ($entry['filename'] ?? minecraft_pack_filename($version)));
        $sha256 = strtolower(trim((string) ($entry['sha256'] ?? '')));
        $size = max(0, (int) ($entry['size'] ?? 0));
        $uploadedAt = trim((string) ($entry['uploaded_at'] ?? ''));
        $path = minecraft_packs_root() . '/' . $filename;
        if (!is_file($path)) {
            continue;
        }
        if ($sha256 === '') {
            $sha256 = hash_file('sha256', $path) ?: '';
        }
        if ($size <= 0) {
            $size = (int) filesize($path);
        }
        $packs[] = [
            'version' => $version,
            'filename' => $filename,
            'sha256' => $sha256,
            'size' => $size,
            'uploaded_at' => $uploadedAt !== '' ? $uploadedAt : date('c', (int) filemtime($path)),
        ];
    }

    usort($packs, static function (array $a, array $b): int {
        return strcmp($b['uploaded_at'], $a['uploaded_at']);
    });

    return $packs;
}

function minecraft_save_client_packs($db, array $packs): void
{
    set_site_setting($db, MINECRAFT_PACKS_SETTING_KEY, json_encode(array_values($packs), JSON_UNESCAPED_UNICODE));
}

function minecraft_find_client_pack($db, string $version): ?array
{
    foreach (minecraft_get_client_packs($db) as $pack) {
        if ($pack['version'] === $version) {
            return $pack;
        }
    }

    return null;
}

function minecraft_admin_upload_client_pack($db, string $version, array $file): array
{
    if (!minecraft_is_valid_version($version)) {
        return ['ok' => false, 'error' => 'invalid_version'];
    }

    if (!isset($file['error']) || (int) $file['error'] !== UPLOAD_ERR_OK) {
        $code = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE) {
            return ['ok' => false, 'error' => 'file_too_large'];
        }
        if ($code === UPLOAD_ERR_NO_FILE) {
            return ['ok' => false, 'error' => 'no_file'];
        }

        return ['ok' => false, 'error' => 'upload_failed'];
    }

    $tmpPath = (string) ($file['tmp_name'] ?? '');
    if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
        return ['ok' => false, 'error' => 'upload_failed'];
    }

    $size = (int) ($file['size'] ?? 0);
    if ($size <= 0 || $size > MINECRAFT_PACK_MAX_BYTES) {
        return ['ok' => false, 'error' => 'file_too_large'];
    }

    $originalName = strtolower((string) ($file['name'] ?? ''));
    if (!str_ends_with($originalName, '.zip')) {
        return ['ok' => false, 'error' => 'invalid_type'];
    }

    $zipError = minecraft_validate_pack_zip($tmpPath, $version);
    if ($zipError !== null) {
        return ['ok' => false, 'error' => $zipError];
    }

    $root = minecraft_packs_root();
    if (!is_dir($root) && !mkdir($root, 0755, true) && !is_dir($root)) {
        return ['ok' => false, 'error' => 'mkdir_failed'];
    }

    $filename = minecraft_pack_filename($version);
    $destPath = $root . '/' . $filename;
    if (!move_uploaded_file($tmpPath, $destPath)) {
        return ['ok' => false, 'error' => 'save_failed'];
    }

    $sha256 = hash_file('sha256', $destPath) ?: '';
    $pack = [
        'version' => $version,
        'filename' => $filename,
        'sha256' => $sha256,
        'size' => (int) filesize($destPath),
        'uploaded_at' => gmdate('c'),
    ];

    $packs = array_values(array_filter(
        minecraft_get_client_packs($db),
        static fn (array $entry): bool => $entry['version'] !== $version
    ));
    $packs[] = $pack;
    minecraft_save_client_packs($db, $packs);

    return [
        'ok' => true,
        'pack' => $pack,
    ];
}

function minecraft_admin_delete_client_pack($db, string $version): array
{
    if (!minecraft_is_valid_version($version)) {
        return ['ok' => false, 'error' => 'invalid_version'];
    }

    $pack = minecraft_find_client_pack($db, $version);
    if ($pack === null) {
        return ['ok' => false, 'error' => 'not_found'];
    }

    $path = minecraft_packs_root() . '/' . $pack['filename'];
    if (is_file($path)) {
        @unlink($path);
    }

    $packs = array_values(array_filter(
        minecraft_get_client_packs($db),
        static fn (array $entry): bool => $entry['version'] !== $version
    ));
    minecraft_save_client_packs($db, $packs);

    return ['ok' => true];
}

function minecraft_validate_pack_zip(string $path, string $version): ?string
{
    if (!class_exists('ZipArchive')) {
        return null;
    }

    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        return 'invalid_zip';
    }

    $required = "versions/{$version}/{$version}.json";
    $found = false;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = str_replace('\\', '/', (string) $zip->getNameIndex($i));
        if ($name === $required) {
            $found = true;
            break;
        }
    }
    $zip->close();

    if (!$found) {
        return 'missing_version_json';
    }

    return null;
}

function minecraft_client_pack_payload($db, string $version): ?array
{
    $pack = minecraft_find_client_pack($db, $version);
    if ($pack === null) {
        return null;
    }

    return [
        'version' => $pack['version'],
        'url' => user_absolute_url(minecraft_pack_public_path($pack['version'])),
        'sha256' => $pack['sha256'],
        'size' => $pack['size'],
    ];
}

function minecraft_is_valid_host(string $host): bool
{
    if ($host === '') {
        return false;
    }
    if (strlen($host) > 253) {
        return false;
    }

    return (bool) preg_match('/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/', $host)
        || filter_var($host, FILTER_VALIDATE_IP) !== false;
}

function minecraft_bootstrap_payload($db): array
{
    $settings = minecraft_get_settings($db);
    $servers = array_map('minecraft_public_server_entry', $settings['servers']);

    $games = [[
        'id' => 'minecraft',
        'name' => 'Minecraft',
        'minecraftVersion' => $settings['minecraft_version'],
        'javaMajor' => $settings['java_major'],
        'servers' => $servers,
    ]];

    $oauthBase = user_absolute_url('/api/minecraft/oauth');

    $payload = [
        'success' => true,
        'enabled' => $settings['enabled'],
        'appVersion' => chadow_app_version(),
        'minecraftVersion' => $settings['minecraft_version'],
        'javaMajor' => $settings['java_major'],
        'launcherVersion' => $settings['launcher_version'],
        'games' => $games,
        'servers' => $servers,
        'oauth' => [
            'wg' => [
                'enabled' => $settings['wg_application_id'] !== '',
                'startUrl' => $oauthBase . '/start?provider=wg',
            ],
            'lesta' => [
                'enabled' => $settings['lesta_application_id'] !== '',
                'startUrl' => $oauthBase . '/start?provider=lesta',
            ],
        ],
        'assets' => [],
    ];

    $clientPack = minecraft_client_pack_payload($db, $settings['minecraft_version']);
    if ($clientPack !== null) {
        $payload['clientPack'] = $clientPack;
    }

    $launcherFile = minecraft_get_launcher_file_meta($db);
    if ($launcherFile !== null) {
        $payload['launcherDownload'] = [
            'url' => user_absolute_url(minecraft_launcher_public_path($launcherFile['filename'])),
            'sha256' => $launcherFile['sha256'],
            'size' => $launcherFile['size'],
            'filename' => $launcherFile['original_name'],
        ];
    }

    return $payload;
}
