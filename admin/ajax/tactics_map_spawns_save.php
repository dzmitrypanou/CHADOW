<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../config/tactics_map_catalog.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit();
}

$mapCode = trim((string) ($_POST['map_code'] ?? ''));
$battleMode = trim((string) ($_POST['battle_mode'] ?? 'random'));
$pointsRaw = $_POST['points'] ?? '[]';
$boundsRaw = $_POST['bounds'] ?? '';

if ($mapCode === '') {
    echo json_encode(['success' => false, 'error' => 'Укажите код карты'], JSON_UNESCAPED_UNICODE);
    exit();
}

$points = json_decode(is_string($pointsRaw) ? $pointsRaw : '[]', true);
if (!is_array($points)) {
    echo json_encode(['success' => false, 'error' => 'Некорректные точки'], JSON_UNESCAPED_UNICODE);
    exit();
}

$bounds = null;
if (is_string($boundsRaw) && trim($boundsRaw) !== '') {
    $decodedBounds = json_decode($boundsRaw, true);
    if (is_array($decodedBounds)) {
        $bounds = $decodedBounds;
    }
}

$result = tactics_admin_save_map_spawns($mapCode, $battleMode, $points, $bounds);
if (empty($result['ok'])) {
    $messages = [
        'invalid_map' => 'Некорректная карта',
        'invalid_mode' => 'Некорректный режим',
        'mkdir_failed' => 'Нет прав на запись в config/',
        'write_failed' => 'Не удалось сохранить файл',
    ];
    $error = $messages[$result['error'] ?? ''] ?? 'Ошибка сохранения';
    echo json_encode(['success' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode([
    'success' => true,
    'data' => $result['data'],
], JSON_UNESCAPED_UNICODE);
