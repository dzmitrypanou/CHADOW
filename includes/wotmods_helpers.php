<?php

const WOTMODS_DOWNLOAD_DIR = 'downloads/wotmods';
const WOTMODS_SOURCE_DIR = 'wotmods';

function wotmods_build_href(string $lang, string $suffix = ''): string
{
    if (!function_exists('abs_build_lang_href')) {
        require_once __DIR__ . '/lang.php';
    }

    $path = 'services/mods';
    if ($suffix !== '') {
        $path .= '/' . ltrim($suffix, '/');
    }

    return abs_build_lang_href($lang, $path);
}

function wotmods_build_home_href(string $lang): string
{
    if (!function_exists('abs_build_lang_href')) {
        require_once __DIR__ . '/lang.php';
    }

    $base = abs_build_lang_href($lang, '');
    if ($base === '/' || $base === '/en' || $base === '/en/') {
        return rtrim($base, '/') . '#mod-install';
    }

    return $base . '#mod-install';
}

function wotmods_hub_meta(string $lang = 'ru'): array
{
    if ($lang === 'en') {
        return [
            'title' => 'Mod Installation',
            'desc' => 'Step-by-step installation and setup of Chadow mods for World of Tanks and Mir Tankov.',
        ];
    }

    return [
        'title' => 'Установка модов',
        'desc' => 'Пошаговая установка и настройка модов Chadow для World of Tanks и Мира танков.',
    ];
}

function wotmods_app_version(): string
{
    if (function_exists('chadow_app_version')) {
        return chadow_app_version();
    }

    $raw = @file_get_contents(dirname(__DIR__) . '/config/version.json');
    $data = $raw ? json_decode($raw, true) : null;

    return is_array($data) && !empty($data['version']) ? (string) $data['version'] : '0.0.0';
}

function wotmods_download_root(): string
{
    return dirname(__DIR__) . '/' . WOTMODS_DOWNLOAD_DIR;
}

function wotmods_download_public_path(string $filename): string
{
    return '/' . WOTMODS_DOWNLOAD_DIR . '/' . rawurlencode($filename);
}

function wotmods_download_exists(string $filename): bool
{
    $filename = basename($filename);
    if ($filename === '' || preg_match('/[\/\\\\]/', $filename)) {
        return false;
    }

    return is_file(wotmods_download_root() . '/' . $filename);
}

/**
 * @return list<array<string, mixed>>
 */
function wotmods_catalog(string $lang = 'ru'): array
{
    $isEn = $lang === 'en';
    $version = '1.0.1';

    return [
        [
            'id' => 'battle-limit',
            'slug' => 'battle-limit',
            'icon' => 'fa-hand-paper',
            'version' => $version,
            'clients' => ['lesta', 'wg'],
            'title' => $isEn ? 'Battle button limiter' : 'Блокировка кнопки «В бой»',
            'short' => $isEn
                ? 'Blocks the fight button after the selected number of battles per session.'
                : 'Блокирует кнопку «В бой» после выбранного числа боёв за сессию.',
            'configMarker' => 'mods/configs/chadow.battle_limit.json',
        ],
    ];
}

/**
 * @return array<string, mixed>|null
 */
function wotmods_get_mod(string $slug, string $lang = 'ru'): ?array
{
    foreach (wotmods_catalog($lang) as $mod) {
        if (($mod['slug'] ?? '') === $slug) {
            return $mod;
        }
    }

    return null;
}

/**
 * @return array<string, mixed>
 */
function wotmods_battle_limit_page(string $lang = 'ru'): array
{
    $isEn = $lang === 'en';
    $version = '1.0.1';
    $configFile = 'chadow.battle_limit.json';
    $resArchive = 'chadow.battle-limit-res.zip';

    $downloads = [
        [
            'id' => 'config',
            'label' => $isEn ? 'Config file' : 'Файл настроек',
            'filename' => $configFile,
            'hint' => $isEn
                ? 'Copy to <code>mods/configs/</code> in the game folder.'
                : 'Скопируйте в <code>mods/configs/</code> в папке игры.',
            'available' => wotmods_download_exists($configFile),
            'url' => wotmods_download_public_path($configFile),
        ],
        [
            'id' => 'res',
            'label' => $isEn ? 'Mod scripts (res_mods)' : 'Скрипты мода (res_mods)',
            'filename' => $resArchive,
            'hint' => $isEn
                ? 'Unpack into <code>res_mods/&lt;version&gt;/</code>, then compile with Python 2.7.'
                : 'Распакуйте в <code>res_mods/&lt;версия&gt;/</code>, затем скомпилируйте Python 2.7.',
            'available' => wotmods_download_exists($resArchive),
            'url' => wotmods_download_public_path($resArchive),
        ],
    ];

    $installSteps = $isEn
        ? [
            'Open <code>version.xml</code> in the game root and note the client version (for example <code>1.43.0.0</code>).',
            'Create <code>mods/configs/</code> if it does not exist and place <code>chadow.battle_limit.json</code> there.',
            'Unpack the archive into <code>res_mods/&lt;version&gt;/</code> so scripts land in <code>res/scripts/client/gui/mods/</code>.',
            'Compile Python 2.7: <code>python -m compileall res\\scripts\\client\\gui\\mods</code> inside the version folder.',
            'Launch the client and check <code>python.log</code> for <code>[chadow.battle_limit] loaded</code>.',
        ]
        : [
            'Откройте <code>version.xml</code> в корне игры и запомните версию клиента (например <code>1.43.0.0</code>).',
            'Создайте папку <code>mods/configs/</code>, если её нет, и положите туда <code>chadow.battle_limit.json</code>.',
            'Распакуйте архив в <code>res_mods/&lt;версия&gt;/</code>, чтобы скрипты оказались в <code>res/scripts/client/gui/mods/</code>.',
            'Скомпилируйте Python 2.7: <code>python -m compileall res\\scripts\\client\\gui\\mods</code> внутри папки версии.',
            'Запустите клиент и проверьте <code>python.log</code> — должна быть строка <code>[chadow.battle_limit] loaded</code>.',
        ];

    $hotkeys = $isEn
        ? [
            ['keys' => 'Alt+Shift+1 … 9', 'action' => 'Set limit to 1–9 battles'],
            ['keys' => 'Alt+Shift+0', 'action' => 'Disable the limit'],
            ['keys' => 'Alt+Shift+B', 'action' => 'Cycle presets: 1 → 3 → 5 → 10 → 15 → 20 → 30 → 50 → off'],
            ['keys' => 'Alt+Shift+R', 'action' => 'Reset battles played counter'],
        ]
        : [
            ['keys' => 'Alt+Shift+1 … 9', 'action' => 'Лимит 1–9 боёв'],
            ['keys' => 'Alt+Shift+0', 'action' => 'Отключить лимит'],
            ['keys' => 'Alt+Shift+B', 'action' => 'Пресеты: 1 → 3 → 5 → 10 → 15 → 20 → 30 → 50 → выкл'],
            ['keys' => 'Alt+Shift+R', 'action' => 'Сбросить счётчик сыгранных боёв'],
        ];

    $configFields = $isEn
        ? [
            ['name' => 'enabled', 'desc' => 'Enable limiting (requires maxBattles > 0)'],
            ['name' => 'maxBattles', 'desc' => 'Battle limit per session (0 = unlimited)'],
            ['name' => 'battlesPlayed', 'desc' => 'Battles already played this session'],
            ['name' => 'showNotifications', 'desc' => 'Hangar notifications when the limit changes'],
        ]
        : [
            ['name' => 'enabled', 'desc' => 'Включить ограничение (нужен maxBattles > 0)'],
            ['name' => 'maxBattles', 'desc' => 'Лимит боёв за сессию (0 = без ограничения)'],
            ['name' => 'battlesPlayed', 'desc' => 'Сколько боёв уже сыграно'],
            ['name' => 'showNotifications', 'desc' => 'Уведомления в ангаре при смене лимита'],
        ];

    return [
        'id' => 'battle-limit',
        'slug' => 'battle-limit',
        'version' => $version,
        'icon' => 'fa-hand-paper',
        'title' => $isEn ? 'Battle button limiter' : 'Блокировка кнопки «В бой»',
        'metaTitle' => $isEn ? 'Battle button limiter mod' : 'Мод: блокировка кнопки «В бой»',
        'desc' => $isEn
            ? 'Limits how many battles you can queue per session. When the limit is reached, the fight button is disabled until you reset the counter or raise the limit.'
            : 'Ограничивает число боёв за сессию. Когда лимит достигнут, кнопка «В бой» блокируется, пока не сбросите счётчик или не увеличите лимит.',
        'features' => $isEn
            ? [
                'Configurable battle limit via config file or hotkeys in the hangar.',
                'Persists counter and limit between game restarts.',
                'Does not automate aiming or shooting — only blocks queueing.',
            ]
            : [
                'Настраиваемый лимит через файл конфигурации или горячие клавиши в ангаре.',
                'Счётчик и лимит сохраняются между перезапусками клиента.',
                'Не автоматизирует стрельбу — только блокирует постановку в очередь.',
            ],
        'compatNote' => $isEn
            ? 'Tested against the AO IT Technologies RU client layout. WG clients use the same hook points but may need verification after major patches.'
            : 'Разработано под клиент АО «Айти Технологии» (Мир танков RU). На WG-клиенте используются те же точки подключения, но после крупных патчей может потребоваться проверка.',
        'installSteps' => $installSteps,
        'examplePaths' => $isEn
            ? [
                'Config' => 'Tanki/mods/configs/chadow.battle_limit.json',
                'Scripts' => 'Tanki/res_mods/1.43.0.0/res/scripts/client/gui/mods/',
            ]
            : [
                'Конфиг' => 'Tanki/mods/configs/chadow.battle_limit.json',
                'Скрипты' => 'Tanki/res_mods/1.43.0.0/res/scripts/client/gui/mods/',
            ],
        'downloads' => $downloads,
        'hotkeys' => $hotkeys,
        'configFields' => $configFields,
        'configSample' => "{\n  \"enabled\": true,\n  \"maxBattles\": 5,\n  \"battlesPlayed\": 0,\n  \"showNotifications\": true\n}",
    ];
}

function wotmods_client_badges_html(string $lang = 'ru'): string
{
    if (!function_exists('game_api_ru_publisher_badge_span')) {
        require_once __DIR__ . '/game_api.php';
    }

    return '<div class="project-card-badge-row">'
        . '<span class="project-card-badge project-card-badge--wg">WG</span>'
        . game_api_ru_publisher_badge_span($lang)
        . '</div>';
}

function wotmods_game_client_icon(string $client): string
{
    return $client === 'wot'
        ? '/assets/icons/games/wot-white.png'
        : '/assets/icons/games/mir-tankov.png';
}

function wotmods_game_client_label(string $client, string $lang = 'ru'): string
{
    if ($client === 'wot') {
        return 'World of Tanks';
    }

    return $lang === 'en' ? 'Mir Tankov' : 'Мир танков';
}

/**
 * @return array{files: list<string>, dirs: list<string>, packageMarkers: list<string>, configMarkers: list<string>}
 */
function wotmods_uninstall_spec_for_mod(string $modId): array
{
    $definition = wotmods_install_mod_definition($modId);
    if ($definition === null) {
        return ['files' => [], 'dirs' => [], 'packageMarkers' => [], 'configMarkers' => []];
    }

    $files = [];
    $configPath = (string) ($definition['configGamePath'] ?? '');
    if ($configPath !== '') {
        $files[] = $configPath;
    }

    $packageFile = (string) ($definition['packageFile'] ?? '');
    if ($packageFile !== '') {
        $files[] = 'mods/{clientVersion}/' . $packageFile;
    }

    $dirs = [];
    foreach (wotmods_list_res_files() as $relativePath) {
        $files[] = 'res_mods/{clientVersion}/res/' . $relativePath;
        if (preg_match('/\.py$/i', $relativePath)) {
            $files[] = 'res_mods/{clientVersion}/res/' . preg_replace('/\.py$/i', '.pyc', $relativePath);
        }
        $parent = dirname(str_replace('\\', '/', $relativePath));
        if ($parent !== '.' && str_contains($parent, 'chadow')) {
            $dirs[] = 'res_mods/{clientVersion}/res/' . $parent;
        }
    }

    $dirs = array_values(array_unique($dirs));
    rsort($dirs);

    return [
        'files' => array_values(array_unique($files)),
        'dirs' => $dirs,
        'packageMarkers' => ['chadow.battle-limit', 'chadow.battle_limit', 'mod_chadow', 'chadow_'],
        'configMarkers' => ['chadow.'],
    ];
}

function wotmods_res_root(): string
{
    return dirname(__DIR__) . '/' . WOTMODS_SOURCE_DIR . '/res';
}

/**
 * @return list<string>
 */
function wotmods_list_res_files(): array
{
    $root = wotmods_res_root();
    if (!is_dir($root)) {
        return [];
    }

    $files = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $fileInfo) {
        if (!$fileInfo->isFile()) {
            continue;
        }
        $name = $fileInfo->getFilename();
        if (!preg_match('/\.py$/i', $name)) {
            continue;
        }
        $relative = str_replace('\\', '/', substr($fileInfo->getPathname(), strlen($root) + 1));
        $files[] = $relative;
    }
    sort($files);

    return $files;
}

/**
 * @return array<string, mixed>|null
 */
function wotmods_normalize_client_version(string $version, array $folderVersions = []): string
{
    $version = trim($version);
    if ($version === '') {
        return '';
    }

    if ($folderVersions !== [] && in_array($version, $folderVersions, true)) {
        return $version;
    }

    if ($folderVersions !== []) {
        $matches = array_values(array_filter($folderVersions, static function (string $folderVersion) use ($version): bool {
            return $folderVersion === $version
                || str_starts_with($folderVersion, $version . '.')
                || str_starts_with($version, $folderVersion . '.');
        }));
        if ($matches !== []) {
            usort($matches, static function (string $a, string $b): int {
                return version_compare($b, $a);
            });

            return $matches[0];
        }
    }

    if (preg_match('/^[0-9]+\.[0-9]+\.[0-9]+$/', $version)) {
        return $version . '.0';
    }

    return $version;
}

function wotmods_install_paths_for_version(string $version): array
{
    $version = wotmods_normalize_client_version($version);

    return [
        'config' => 'mods/configs/',
        'scripts' => 'res_mods/' . $version . '/res/',
        'modsVersion' => 'mods/' . $version . '/',
    ];
}

function wotmods_install_mod_definition(string $modId): ?array
{
    $definitions = [
        'battle-limit' => [
            'id' => 'battle-limit',
            'version' => '1.0.1',
            'configGamePath' => 'mods/configs/chadow.battle_limit.json',
            'configFile' => 'chadow.battle_limit.json',
            'packageFile' => 'chadow.battle-limit_1.0.1.mtmod',
        ],
    ];

    return $definitions[$modId] ?? null;
}

/**
 * @return list<array<string, mixed>>
 */
function wotmods_install_manifest_mods(?string $modId = null): array
{
    if ($modId !== null && $modId !== '') {
        $ids = [$modId];
    } else {
        $ids = [];
        foreach (wotmods_catalog('ru') as $entry) {
            $id = (string) ($entry['id'] ?? '');
            if ($id !== '') {
                $ids[] = $id;
            }
        }
    }
    $mods = [];

    foreach ($ids as $id) {
        $definition = wotmods_install_mod_definition($id);
        if ($definition === null) {
            continue;
        }

        $configFile = (string) ($definition['configFile'] ?? '');
        $packageFile = (string) ($definition['packageFile'] ?? '');
        $mods[] = [
            'id' => $definition['id'],
            'version' => $definition['version'],
            'configGamePath' => $definition['configGamePath'],
            'configUrl' => wotmods_download_exists($configFile)
                ? wotmods_download_public_path($configFile)
                : null,
            'packageGamePath' => $packageFile !== ''
                ? 'mods/{clientVersion}/' . $packageFile
                : null,
            'packageUrl' => ($packageFile !== '' && wotmods_download_exists($packageFile))
                ? wotmods_download_public_path($packageFile)
                : null,
            'uninstall' => wotmods_uninstall_spec_for_mod($id),
        ];
    }

    return $mods;
}

/**
 * @return array{ok: bool, path?: string, error?: string}
 */
function wotmods_resolve_install_file(string $modId, string $path): array
{
    $definition = wotmods_install_mod_definition($modId);
    if ($definition === null) {
        return ['ok' => false, 'error' => 'unknown_mod'];
    }

    $path = str_replace('\\', '/', $path);
    $path = ltrim($path, '/');
    if ($path === '' || strpos($path, '..') !== false) {
        return ['ok' => false, 'error' => 'invalid_path'];
    }

    $root = realpath(wotmods_res_root());
    if ($root === false) {
        return ['ok' => false, 'error' => 'missing_source'];
    }

    $full = realpath($root . '/' . $path);
    if ($full === false || strpos($full, $root) !== 0 || !is_file($full)) {
        return ['ok' => false, 'error' => 'not_found'];
    }

    return ['ok' => true, 'path' => $full];
}

function wotmods_prepare_install_file_contents(string $contents, string $modVersion): string
{
    return str_replace('{{VERSION}}', $modVersion, $contents);
}
