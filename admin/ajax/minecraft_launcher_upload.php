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

$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if (!isset($_FILES['mc_launcher_file'])) {
    if ($contentLength > 0) {
        echo json_encode(['success' => false, 'error' => minecraft_pack_upload_body_rejected_error()], JSON_UNESCAPED_UNICODE);
        exit();
    }

    echo json_encode(['success' => false, 'error' => 'Файл не передан'], JSON_UNESCAPED_UNICODE);
    exit();
}

try {
    ensure_site_settings_table($db);
    $result = minecraft_admin_upload_launcher_file($db, $_FILES['mc_launcher_file']);
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
        'no_file' => 'Выберите файл установщика',
        'upload_failed' => 'Ошибка загрузки файла',
        'file_too_large' => 'Файл слишком большой (макс. 512 МБ)',
        'invalid_type' => 'Допустимы только .exe и .msi',
        'mkdir_failed' => 'Нет прав на запись в uploads/minecraft/launcher',
        'save_failed' => 'Не удалось сохранить файл',
    ];
    $key = (string) ($result['error'] ?? 'save_failed');
    echo json_encode([
        'success' => false,
        'error' => $errors[$key] ?? 'Ошибка сохранения',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

$file = $result['file'] ?? [];
echo json_encode([
    'success' => true,
    'file' => [
        'filename' => $file['filename'] ?? '',
        'original_name' => $file['original_name'] ?? '',
        'size' => (int) ($file['size'] ?? 0),
        'sha256' => $file['sha256'] ?? '',
        'uploaded_at' => $file['uploaded_at'] ?? '',
        'url' => user_absolute_url(minecraft_launcher_public_path((string) ($file['filename'] ?? ''))),
    ],
    'landing' => minecraft_get_landing_settings($db),
], JSON_UNESCAPED_UNICODE);
