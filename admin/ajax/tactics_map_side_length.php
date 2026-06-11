<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../config/ensure_map_dictionary.php';
require_once __DIR__ . '/../../includes/tactics_helpers.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit();
}

admin_require_csrf_ajax();

$mapCode = trim((string) ($_POST['map_code'] ?? ''));
$sideLength = $_POST['side_length'] ?? null;

if ($mapCode === '' || !preg_match('/^[a-z0-9_\-]{1,64}$/', strtolower($mapCode))) {
    echo json_encode(['success' => false, 'error' => 'Некорректный код карты'], JSON_UNESCAPED_UNICODE);
    exit();
}

$result = tactics_admin_set_map_side_length($db, $mapCode, $sideLength);
if (!$result['ok']) {
    $errors = [
        'invalid_side_length' => 'Размер поля: от 100 до 20000 м',
        'not_found' => 'Карта не найдена в словаре',
    ];
    $key = (string) ($result['error'] ?? 'invalid_side_length');
    echo json_encode(['success' => false, 'error' => $errors[$key] ?? 'Ошибка сохранения'], JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode([
    'success' => true,
    'side_length' => $result['side_length'],
], JSON_UNESCAPED_UNICODE);
