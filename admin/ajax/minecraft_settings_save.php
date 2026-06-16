<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../includes/minecraft_helpers.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Неверный метод запроса'], JSON_UNESCAPED_UNICODE);
    exit();
}

admin_require_csrf_ajax();

if (!admin_is_admin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Недостаточно прав'], JSON_UNESCAPED_UNICODE);
    exit();
}

$enabled = isset($_POST['mc_enabled']) && filter_var($_POST['mc_enabled'], FILTER_VALIDATE_BOOLEAN);
$landingActive = isset($_POST['mc_landing_active']) && filter_var($_POST['mc_landing_active'], FILTER_VALIDATE_BOOLEAN);
$landingDescRu = isset($_POST['mc_landing_desc_ru']) ? trim((string) $_POST['mc_landing_desc_ru']) : '';
$landingDescEn = isset($_POST['mc_landing_desc_en']) ? trim((string) $_POST['mc_landing_desc_en']) : '';
$landingTileSpan = isset($_POST['mc_landing_tile_span']) ? trim((string) $_POST['mc_landing_tile_span']) : '2';
$landingBadgesRaw = $_POST['mc_landing_badges_json'] ?? '[]';
$serversRaw = $_POST['mc_servers_json'] ?? '[]';
$minecraftVersion = isset($_POST['mc_minecraft_version']) ? trim((string) $_POST['mc_minecraft_version']) : '';
$javaMajor = isset($_POST['mc_java_major']) ? trim((string) $_POST['mc_java_major']) : '21';
$launcherVersion = isset($_POST['mc_launcher_version']) ? trim((string) $_POST['mc_launcher_version']) : '1';
$existingExarotonToken = minecraft_exaroton_api_token($db);
if (array_key_exists('mc_exaroton_api_token', $_POST)) {
    $submittedExarotonToken = trim((string) $_POST['mc_exaroton_api_token']);
    $exarotonApiToken = $submittedExarotonToken !== '' ? $submittedExarotonToken : $existingExarotonToken;
} else {
    $exarotonApiToken = $existingExarotonToken;
}

$parsedServers = minecraft_parse_servers_input($serversRaw);
if (!$parsedServers['ok']) {
    echo json_encode(['success' => false, 'error' => $parsedServers['error'] ?? 'Некорректный список серверов'], JSON_UNESCAPED_UNICODE);
    exit();
}

$parsedBadges = minecraft_parse_landing_badges_input($landingBadgesRaw);
if (!$parsedBadges['ok']) {
    echo json_encode(['success' => false, 'error' => $parsedBadges['error'] ?? 'Некорректный список бейджей'], JSON_UNESCAPED_UNICODE);
    exit();
}

$servers = $parsedServers['servers'] ?? [];
$landingBadges = $parsedBadges['badges'] ?? [];

if ($enabled && $servers === []) {
    echo json_encode(['success' => false, 'error' => 'Добавьте хотя бы один сервер'], JSON_UNESCAPED_UNICODE);
    exit();
}

if (!minecraft_is_valid_version($minecraftVersion)) {
    echo json_encode(['success' => false, 'error' => 'Версия Minecraft: формат X.Y или X.Y.Z (например 1.20.4 или 26.1.2)'], JSON_UNESCAPED_UNICODE);
    exit();
}

$javaMajor = minecraft_normalize_java_major($javaMajor);
$launcherVersion = max(1, (int) $launcherVersion);
$landingTileSpan = minecraft_normalize_landing_tile_span($landingTileSpan);
$landingDefaults = minecraft_landing_defaults();

if ($landingDescRu === '') {
    $landingDescRu = $landingDefaults['desc_ru'];
}
if ($landingDescEn === '') {
    $landingDescEn = $landingDefaults['desc_en'];
}

try {
    set_site_setting($db, 'mc_enabled', $enabled ? '1' : '0');
    minecraft_save_servers($db, $servers);
    set_site_setting($db, 'mc_minecraft_version', $minecraftVersion);
    set_site_setting($db, 'mc_java_major', (string) $javaMajor);
    set_site_setting($db, 'mc_launcher_version', (string) $launcherVersion);
    set_site_setting($db, MINECRAFT_EXAROTON_TOKEN_SETTING_KEY, $exarotonApiToken);
    set_site_setting($db, 'mc_landing_active', $landingActive ? '1' : '0');
    set_site_setting($db, 'mc_landing_desc_ru', $landingDescRu);
    set_site_setting($db, 'mc_landing_desc_en', $landingDescEn);
    set_site_setting($db, 'mc_landing_tile_span', (string) $landingTileSpan);
    minecraft_save_landing_badges($db, $landingBadges);

    echo json_encode([
        'success' => true,
        'settings' => minecraft_get_settings($db),
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
