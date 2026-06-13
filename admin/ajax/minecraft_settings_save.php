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
$serverHost = isset($_POST['mc_server_host']) ? trim((string) $_POST['mc_server_host']) : '';
$serverPort = isset($_POST['mc_server_port']) ? trim((string) $_POST['mc_server_port']) : '25565';
$serverName = isset($_POST['mc_server_name']) ? trim((string) $_POST['mc_server_name']) : '';
$minecraftVersion = isset($_POST['mc_minecraft_version']) ? trim((string) $_POST['mc_minecraft_version']) : '';
$javaMajor = isset($_POST['mc_java_major']) ? trim((string) $_POST['mc_java_major']) : '21';
$launcherVersion = isset($_POST['mc_launcher_version']) ? trim((string) $_POST['mc_launcher_version']) : '1';

if ($enabled && !minecraft_is_valid_host($serverHost)) {
    echo json_encode(['success' => false, 'error' => 'Укажите корректный IP или домен сервера'], JSON_UNESCAPED_UNICODE);
    exit();
}

if ($serverName === '') {
    echo json_encode(['success' => false, 'error' => 'Укажите название сервера'], JSON_UNESCAPED_UNICODE);
    exit();
}

if (!minecraft_is_valid_version($minecraftVersion)) {
    echo json_encode(['success' => false, 'error' => 'Версия Minecraft: формат X.Y или X.Y.Z (например 1.20.4 или 26.1.2)'], JSON_UNESCAPED_UNICODE);
    exit();
}

$serverPort = minecraft_normalize_port($serverPort);
$javaMajor = minecraft_normalize_java_major($javaMajor);
$launcherVersion = max(1, (int) $launcherVersion);

if (mb_strlen($serverName, 'UTF-8') > 80) {
    echo json_encode(['success' => false, 'error' => 'Название сервера не должно превышать 80 символов'], JSON_UNESCAPED_UNICODE);
    exit();
}

try {
    set_site_setting($db, 'mc_enabled', $enabled ? '1' : '0');
    set_site_setting($db, 'mc_server_host', $serverHost);
    set_site_setting($db, 'mc_server_port', (string) $serverPort);
    set_site_setting($db, 'mc_server_name', $serverName);
    set_site_setting($db, 'mc_minecraft_version', $minecraftVersion);
    set_site_setting($db, 'mc_java_major', (string) $javaMajor);
    set_site_setting($db, 'mc_launcher_version', (string) $launcherVersion);

    echo json_encode([
        'success' => true,
        'settings' => minecraft_get_settings($db),
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
