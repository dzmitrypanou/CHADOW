<?php

require_once __DIR__ . '/../config/ensure_site_settings.php';

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
        'wg_application_id' => trim((string) get_site_setting($db, 'mc_wg_application_id', '')),
        'lesta_application_id' => trim((string) get_site_setting($db, 'mc_lesta_application_id', '')),
        'launcher_version' => max(1, (int) get_site_setting($db, 'mc_launcher_version', '1')),
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
    if ($major < 8 || $major > 25) {
        return 21;
    }

    return $major;
}

function minecraft_is_valid_version(string $version): bool
{
    return (bool) preg_match('/^1\.\d+(\.\d+)?$/', $version);
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

    return [
        'success' => true,
        'enabled' => $settings['enabled'],
        'minecraftVersion' => $settings['minecraft_version'],
        'javaMajor' => $settings['java_major'],
        'launcherVersion' => $settings['launcher_version'],
        'servers' => $servers,
        'oauth' => [
            'wg' => [
                'enabled' => $settings['wg_application_id'] !== '',
                'applicationId' => $settings['wg_application_id'],
            ],
            'lesta' => [
                'enabled' => $settings['lesta_application_id'] !== '',
                'applicationId' => $settings['lesta_application_id'],
            ],
        ],
        'assets' => [],
    ];
}
