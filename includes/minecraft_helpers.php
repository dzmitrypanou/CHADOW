<?php

require_once __DIR__ . '/../config/ensure_site_settings.php';
require_once __DIR__ . '/user_auth.php';
require_once __DIR__ . '/game_api.php';

const MINECRAFT_PACKS_DIR = 'uploads/minecraft/packs';
const MINECRAFT_PACK_MAX_BYTES = 2147483648; // 2 GiB
const MINECRAFT_PACKS_SETTING_KEY = 'mc_client_packs';

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

/**
 * @param mixed $db
 * @return array{
 *   enabled:bool,
 *   server_host:string,
 *   server_port:int,
 *   server_name:string,
 *   minecraft_version:string,
 *   java_major:int,
 *   wg_application_id:string,
 *   lesta_application_id:string,
 *   launcher_version:int
 * }
 */
function minecraft_get_settings($db): array
{
    return [
        'enabled' => get_site_setting($db, 'mc_enabled', '0') === '1',
        'server_host' => trim((string) get_site_setting($db, 'mc_server_host', '')),
        'server_port' => minecraft_normalize_port(get_site_setting($db, 'mc_server_port', '25565')),
        'server_name' => trim((string) get_site_setting($db, 'mc_server_name', 'Chadow SMP')),
        'minecraft_version' => trim((string) get_site_setting($db, 'mc_minecraft_version', '1.20.4')),
        'java_major' => minecraft_normalize_java_major(get_site_setting($db, 'mc_java_major', '21')),
        'wg_application_id' => game_api_wg_application_id($db),
        'lesta_application_id' => game_api_lesta_application_id($db),
        'launcher_version' => max(1, (int) get_site_setting($db, 'mc_launcher_version', '17')),
    ];
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
    // Классический формат (1.20.4) и новая схема Mojang (26.1.2 и т.д.)
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

/**
 * @return list<array{
 *   version:string,
 *   filename:string,
 *   sha256:string,
 *   size:int,
 *   uploaded_at:string
 * }>
 */
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

/**
 * @param list<array{
 *   version:string,
 *   filename:string,
 *   sha256:string,
 *   size:int,
 *   uploaded_at:string
 * }> $packs
 */
function minecraft_save_client_packs($db, array $packs): void
{
    set_site_setting($db, MINECRAFT_PACKS_SETTING_KEY, json_encode(array_values($packs), JSON_UNESCAPED_UNICODE));
}

/**
 * @return array{
 *   version:string,
 *   filename:string,
 *   sha256:string,
 *   size:int,
 *   uploaded_at:string
 * }|null
 */
function minecraft_find_client_pack($db, string $version): ?array
{
    foreach (minecraft_get_client_packs($db) as $pack) {
        if ($pack['version'] === $version) {
            return $pack;
        }
    }

    return null;
}

/**
 * @return array{ok:bool,error?:string,pack?:array<string,mixed>}
 */
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

/**
 * @return array{ok:bool,error?:string}
 */
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

/**
 * @return array<string, mixed>|null
 */
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

/**
 * @param mixed $db
 * @return array<string, mixed>
 */
function minecraft_bootstrap_payload($db): array
{
    $settings = minecraft_get_settings($db);
    $servers = [];

    if ($settings['server_host'] !== '') {
        $servers[] = [
            'id' => 'main',
            'name' => $settings['server_name'] !== '' ? $settings['server_name'] : 'Chadow SMP',
            'host' => $settings['server_host'],
            'port' => $settings['server_port'],
        ];
    }

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

    return $payload;
}
