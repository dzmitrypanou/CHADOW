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

$version = isset($_POST['mc_pack_version']) ? trim((string) $_POST['mc_pack_version']) : '';

if (!isset($_FILES['mc_pack_archive'])) {
    echo json_encode(['success' => false, 'error' => 'Файл не передан'], JSON_UNESCAPED_UNICODE);
    exit();
}

try {
    ensure_site_settings_table($db);
    $result = minecraft_admin_upload_client_pack($db, $version, $_FILES['mc_pack_archive']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Ошибка сервера: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

if (!$result['ok']) {
    $errors = [
        'invalid_version' => 'Версия: формат X.Y или X.Y.Z (например 1.21.11 или 26.1.2)',
        'no_file' => 'Выберите ZIP-архив',
        'upload_failed' => 'Ошибка загрузки файла',
        'file_too_large' => 'Файл слишком большой (макс. 2 ГБ; проверьте upload_max_filesize и post_max_size в PHP)',
        'invalid_type' => 'Допустим только формат .zip',
        'invalid_zip' => 'Некорректный ZIP-архив',
        'missing_version_json' => 'В архиве должен быть файл versions/{версия}/{версия}.json в корне',
        'mkdir_failed' => 'Нет прав на запись в uploads/minecraft/packs',
        'save_failed' => 'Не удалось сохранить архив',
    ];
    $key = (string) ($result['error'] ?? 'save_failed');
    echo json_encode([
        'success' => false,
        'error' => $errors[$key] ?? 'Ошибка сохранения',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

$pack = $result['pack'] ?? [];
echo json_encode([
    'success' => true,
    'pack' => [
        'version' => $pack['version'] ?? $version,
        'size' => (int) ($pack['size'] ?? 0),
        'sha256' => $pack['sha256'] ?? '',
        'uploaded_at' => $pack['uploaded_at'] ?? '',
        'url' => user_absolute_url(minecraft_pack_public_path($pack['version'] ?? $version)),
    ],
    'packs' => minecraft_get_client_packs($db),
], JSON_UNESCAPED_UNICODE);
