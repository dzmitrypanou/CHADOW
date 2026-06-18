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
        'desc' => 'Пошаговая установка модов для World of Tanks или Мира танков.',
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

function wotmods_battle_limit_version(): string
{
    return '1.0.20';
}

function wotmods_normalize_game_client(string $client): string
{
    $client = strtolower(trim($client));
    if (in_array($client, ['wg', 'wargaming', 'worldoftanks', 'wot'], true)) {
        return 'wot';
    }

    return 'lesta';
}

function wotmods_package_extension(string $client): string
{
    return wotmods_normalize_game_client($client) === 'wot' ? 'wotmod' : 'mtmod';
}

/**
 * @param array<string, mixed> $mod
 * @return list<string>
 */
function wotmods_mod_clients(array $mod): array
{
    $raw = $mod['clients'] ?? ['lesta', 'wot'];
    if (!is_array($raw)) {
        return ['lesta', 'wot'];
    }

    $clients = [];
    foreach ($raw as $client) {
        $normalized = wotmods_normalize_game_client((string) $client);
        if ($normalized === 'wot' || $normalized === 'lesta') {
            $clients[] = $normalized;
        }
    }

    return $clients !== [] ? array_values(array_unique($clients)) : ['lesta', 'wot'];
}

function wotmods_mod_supports_client(array $mod, string $client): bool
{
    return in_array(wotmods_normalize_game_client($client), wotmods_mod_clients($mod), true);
}

function wotmods_install_package_file(string $modId, string $client): ?string
{
    $definition = wotmods_install_mod_definition($modId);
    if ($definition === null) {
        return null;
    }

    $version = (string) ($definition['version'] ?? '');
    if ($version === '') {
        return null;
    }

    $ext = wotmods_package_extension($client);

    return 'chadow.battle-limit_' . $version . '.' . $ext;
}

/**
 * @param list<string> $clients
 */
function wotmods_mod_clients_ordered(array $clients): array
{
    $clients = array_values(array_unique(array_map('wotmods_normalize_game_client', $clients)));
    $order = ['lesta', 'wot'];
    $result = [];
    foreach ($order as $client) {
        if (in_array($client, $clients, true)) {
            $result[] = $client;
        }
    }
    foreach ($clients as $client) {
        if (!in_array($client, $result, true)) {
            $result[] = $client;
        }
    }

    return $result;
}

function wotmods_mod_version_label(string $lang = 'ru'): string
{
    return $lang === 'en' ? 'Mod version' : 'Версия мода';
}

function wotmods_mod_client_rows_html(array $clients, string $version, string $lang = 'ru'): string
{
    $clients = wotmods_mod_clients_ordered($clients);
    if ($clients === []) {
        return '';
    }

    $versionEsc = htmlspecialchars($version, ENT_QUOTES, 'UTF-8');
    $versionLabel = htmlspecialchars(wotmods_mod_version_label($lang), ENT_QUOTES, 'UTF-8');
    $rows = [];
    $labels = [];
    foreach ($clients as $client) {
        $label = wotmods_game_client_label($client, $lang);
        $labels[] = $label;
        $labelEsc = htmlspecialchars($label, ENT_QUOTES, 'UTF-8');
        $icon = htmlspecialchars(wotmods_game_client_icon($client), ENT_QUOTES, 'UTF-8');
        $clientEsc = htmlspecialchars($client, ENT_QUOTES, 'UTF-8');
        $rows[] = '<span class="wotmods-mod-item__client-row" data-wotmods-client="' . $clientEsc . '" title="' . $labelEsc . '">'
            . '<span class="wotmods-mod-item__game">'
            . '<img src="' . $icon . '" width="18" height="18" alt="' . $labelEsc . '" loading="lazy" decoding="async">'
            . '</span>'
            . '<span class="wotmods-mod-item__version">'
            . '<span class="wotmods-mod-item__version-label" data-wotmods-version-label>' . $versionLabel . '</span> '
            . '<span class="wotmods-mod-item__version-value">v' . $versionEsc . '</span>'
            . '</span>'
            . '</span>';
    }

    $aria = htmlspecialchars(implode(', ', $labels), ENT_QUOTES, 'UTF-8');

    return '<span class="wotmods-mod-item__clients" aria-label="' . $aria . '">' . implode('', $rows) . '</span>';
}

/**
 * @param array<string, mixed> $mod
 */
function wotmods_mod_usage_html(array $mod, string $lang = 'ru'): string
{
    $lines = $mod['usage'] ?? [];
    if (!is_array($lines) || $lines === []) {
        return '';
    }

    $title = (string) ($mod['usageTitle'] ?? ($lang === 'en' ? 'How to use' : 'Как пользоваться'));
    $titleEsc = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $items = [];
    foreach ($lines as $line) {
        $text = trim((string) $line);
        if ($text === '') {
            continue;
        }
        $items[] = '<li>' . htmlspecialchars($text, ENT_QUOTES, 'UTF-8') . '</li>';
    }
    if ($items === []) {
        return '';
    }

    return '<div class="wotmods-mod-usage">'
        . '<p class="wotmods-mod-usage__title">' . $titleEsc . '</p>'
        . '<ul class="wotmods-mod-usage__list">' . implode('', $items) . '</ul>'
        . '</div>';
}

/**
 * @return array<string, mixed>|null
 */
function wotmods_get_mod_by_id(string $id, string $lang = 'ru'): ?array
{
    foreach (wotmods_catalog($lang) as $mod) {
        if ((string) ($mod['id'] ?? '') === $id) {
            return $mod;
        }
    }

    return null;
}

/**
 * @return list<array<string, mixed>>
 */
function wotmods_catalog(string $lang = 'ru'): array
{
    $isEn = $lang === 'en';
    $version = wotmods_battle_limit_version();

    return [
        [
            'id' => 'battle-limit',
            'slug' => 'battle-limit',
            'icon' => 'fa-hand-paper',
            'version' => $version,
            'clients' => ['lesta', 'wot'],
            'title' => $isEn ? 'Battle button limiter (session)' : 'Блокировка кнопки «В бой» (сессионная)',
            'author' => 'Immortal_Emperor',
            'authorLabel' => $isEn ? 'Author:' : 'Автор:',
            'authorUrl' => 'https://tanki.su/ru/community/accounts/282194247',
            'short' => $isEn
                ? 'Blocks the fight button after the selected number of battles per session. Set 0 to block completely.'
                : 'Блокирует кнопку «В бой» после выбранного числа боёв за сессию. Выставьте 0, чтобы заблокировать полностью',
            'usageTitle' => $isEn ? 'How to use' : 'Как пользоваться',
            'usage' => $isEn
                ? [
                    'Restart the client after installation.',
                    'Settings: Alt+Shift+M.',
                    'Type the battle limit, then click Accept. 0 = block all random battles.',
                    'Only random battles count. When the limit is reached, Fight is disabled for random.',
                    'Reset clears the session battle counter.',
                ]
                : [
                    'После установки перезапустите клиент.',
                    'Настройки: Alt+Shift+M.',
                    'Введите лимит боёв и нажмите «Принять». 0 — полная блокировка случайных боёв.',
                    'Считаются только случайные бои. После лимита «В бой» для random недоступна.',
                    'Кнопка «Сбросить» — обнулить счётчик сыгранных боёв.',
                ],
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
    $version = wotmods_battle_limit_version();
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
            ['keys' => 'Hangar counter', 'action' => 'Open settings (bottom-right, near chat)'],
            ['keys' => 'Alt+Shift+1 … 9', 'action' => 'Set limit to 1–9 battles (optional)'],
            ['keys' => 'Alt+Shift+0', 'action' => 'Disable the limit (optional)'],
            ['keys' => 'Alt+Shift+B', 'action' => 'Cycle presets (optional)'],
            ['keys' => 'Alt+Shift+R', 'action' => 'Reset battles played counter (optional)'],
        ]
        : [
            ['keys' => 'Счётчик в ангаре', 'action' => 'Открыть настройки (внизу справа, у чата)'],
            ['keys' => 'Alt+Shift+1 … 9', 'action' => 'Лимит 1–9 боёв (опционально)'],
            ['keys' => 'Alt+Shift+0', 'action' => 'Отключить лимит (опционально)'],
            ['keys' => 'Alt+Shift+B', 'action' => 'Пресеты (опционально)'],
            ['keys' => 'Alt+Shift+R', 'action' => 'Сбросить счётчик (опционально)'],
        ];

    $configFields = $isEn
        ? [
            ['name' => 'enabled', 'desc' => 'Enable limiting (requires maxBattles > 0)'],
            ['name' => 'maxBattles', 'desc' => 'Battle limit per session (0 = unlimited)'],
            ['name' => 'battlesPlayed', 'desc' => 'Battles already played this session'],
            ['name' => 'showNotifications', 'desc' => 'Hangar notifications when the limit changes'],
            ['name' => 'randomOnly', 'desc' => 'Apply limit only to random battles'],
            ['name' => 'hardBlockRandom', 'desc' => 'Always block random battles (other modes stay available)'],
        ]
        : [
            ['name' => 'enabled', 'desc' => 'Включить ограничение (нужен maxBattles > 0)'],
            ['name' => 'maxBattles', 'desc' => 'Лимит случайных боёв за сессию (0 = без ограничения)'],
            ['name' => 'battlesPlayed', 'desc' => 'Сколько случайных боёв уже сыграно'],
            ['name' => 'showNotifications', 'desc' => 'Уведомления в ангаре при смене лимита'],
            ['name' => 'randomOnly', 'desc' => 'Ограничение только для случайного боя'],
            ['name' => 'hardBlockRandom', 'desc' => 'Полный запрет случайного боя (другие режимы доступны)'],
        ];

    return [
        'id' => 'battle-limit',
        'slug' => 'battle-limit',
        'version' => $version,
        'icon' => 'fa-hand-paper',
        'title' => $isEn ? 'Battle button limiter (session)' : 'Блокировка кнопки «В бой» (сессионная)',
        'metaTitle' => $isEn ? 'Battle button limiter mod (session)' : 'Мод: блокировка кнопки «В бой» (сессионная)',
        'desc' => $isEn
            ? 'Limits how many battles you can queue per session. When the limit is reached, the fight button is disabled until you reset the counter or raise the limit.'
            : 'Ограничивает число боёв за сессию. Когда лимит достигнут, кнопка «В бой» блокируется, пока не сбросите счётчик или не увеличите лимит.',
        'features' => $isEn
            ? [
                'Hangar counter button (bottom-right) opens a settings window.',
                'Configurable battle limit via config file or optional hotkeys.',
                'Persists counter and limit between game restarts.',
                'Does not automate aiming or shooting — only blocks queueing.',
            ]
            : [
                'Счётчик внизу справа в ангаре — нажмите, чтобы открыть настройки.',
                'Лимит можно задать через окно настроек, файл конфигурации или горячие клавиши.',
                'Счётчик и лимит сохраняются между перезапусками клиента.',
                'Не автоматизирует стрельбу — только блокирует постановку в очередь.',
            ],
        'compatNote' => $isEn
            ? 'Tested against the LESTA RU client layout. WG clients use the same hook points but may need verification after major patches.'
            : 'Разработано под клиент LESTA (Мир танков RU). На WG-клиенте используются те же точки подключения, но после крупных патчей может потребоваться проверка.',
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
        'configSample' => "{\n  \"enabled\": true,\n  \"maxBattles\": 0,\n  \"battlesPlayed\": 0,\n  \"showNotifications\": true,\n  \"randomOnly\": true,\n  \"hardBlockRandom\": false\n}",
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

    $packageFile = wotmods_install_package_file($modId, 'lesta');
    if ($packageFile !== null) {
        $files[] = 'mods/{clientVersion}/' . $packageFile;
    }
    $packageFileWot = wotmods_install_package_file($modId, 'wot');
    if ($packageFileWot !== null && $packageFileWot !== $packageFile) {
        $files[] = 'mods/{clientVersion}/' . $packageFileWot;
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
            'version' => wotmods_battle_limit_version(),
            'configGamePath' => 'mods/configs/chadow.battle_limit.json',
            'configFile' => 'chadow.battle_limit.json',
        ],
    ];

    return $definitions[$modId] ?? null;
}

/**
 * @return list<array<string, mixed>>
 */
function wotmods_install_manifest_mods(?string $modId = null, ?string $client = null): array
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

    $targetClient = $client !== null && $client !== ''
        ? wotmods_normalize_game_client($client)
        : 'lesta';
    $mods = [];

    foreach ($ids as $id) {
        $definition = wotmods_install_mod_definition($id);
        if ($definition === null) {
            continue;
        }

        $catalogMod = wotmods_get_mod_by_id($id);
        $supportedClients = $catalogMod !== null ? wotmods_mod_clients($catalogMod) : ['lesta', 'wot'];
        $supported = in_array($targetClient, $supportedClients, true);

        $configFile = (string) ($definition['configFile'] ?? '');
        $packageFile = $supported ? wotmods_install_package_file($id, $targetClient) : null;
        $mods[] = [
            'id' => $definition['id'],
            'version' => $definition['version'],
            'client' => $targetClient,
            'supportedClients' => $supportedClients,
            'supported' => $supported,
            'packageExtension' => wotmods_package_extension($targetClient),
            'configGamePath' => $definition['configGamePath'],
            'configUrl' => wotmods_download_exists($configFile)
                ? wotmods_download_public_path($configFile)
                : null,
            'packageGamePath' => $packageFile !== null
                ? 'mods/{clientVersion}/' . $packageFile
                : null,
            'packageUrl' => ($packageFile !== null && wotmods_download_exists($packageFile))
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
