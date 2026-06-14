<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../config/ensure_map_dictionary.php';
require_once __DIR__ . '/../../config/ensure_tactics.php';
require_once __DIR__ . '/../../includes/tactics_helpers.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit();
}

admin_require_csrf_ajax();

$game = trim((string) ($_POST['game'] ?? ''));
$battleMode = trim((string) ($_POST['battle_mode'] ?? ''));
$displayNameRu = trim((string) ($_POST['display_name_ru'] ?? ''));
$displayNameEn = trim((string) ($_POST['display_name_en'] ?? ''));
$mapCode = trim((string) ($_POST['map_code'] ?? ''));

if ($displayNameRu === '' && $displayNameEn !== '') {
    $displayNameRu = $displayNameEn;
}

if ($displayNameRu === '') {
    echo json_encode([
        'success' => false,
        'error' => 'Укажите название в поле «Название карты» (или «Название (EN)»)',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

if (!isset($_FILES['image'])) {
    echo json_encode(['success' => false, 'error' => 'Файл не передан'], JSON_UNESCAPED_UNICODE);
    exit();
}

try {
    ensure_map_dictionary_table($db);
    ensure_map_dictionary_admin_columns($db);
    ensure_tactics_map_assignments_table($db);

    $result = tactics_admin_create_tactics_map(
        $db,
        $game,
        $battleMode,
        $displayNameRu,
        $displayNameEn,
        $mapCode !== '' ? $mapCode : null,
        $_POST['side_length'] ?? null,
        $_FILES['image']
    );
} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Ошибка сервера: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

if (!$result['ok']) {
    $errors = [
        'upload_failed' => 'Ошибка загрузки файла',
        'file_too_large' => 'Файл слишком большой (макс. 8 МБ)',
        'invalid_image' => 'Некорректное изображение',
        'invalid_type' => 'Допустимы WebP, PNG, JPEG',
        'mkdir_failed' => 'Нет прав на запись в assets/tactics/maps (chown -R www-data:www-data assets/tactics/maps)',
        'save_failed' => 'Не удалось сохранить файл (проверьте права на каталог и место на диске)',
        'empty_name' => 'Укажите название в поле «Название карты» (или «Название (EN)»)',
        'invalid_side_length' => 'Размер поля: от 100 до 20000 (м или units)',
        'invalid_map_code' => 'Некорректный код карты (латиница, цифры, _)',
        'db_error' => 'Ошибка базы данных (проверьте миграции map_dictionary / tactics_map_assignments)',
    ];
    $key = (string) ($result['error'] ?? 'save_failed');
    echo json_encode([
        'success' => false,
        'error' => $errors[$key] ?? 'Ошибка сохранения',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode([
    'success' => true,
    'data' => $result['data'] ?? [],
], JSON_UNESCAPED_UNICODE);
