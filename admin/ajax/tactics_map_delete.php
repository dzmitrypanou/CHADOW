<?php
require_once __DIR__ . '/../includes/bootstrap.php';
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
$mapCode = trim((string) ($_POST['map_code'] ?? ''));

if ($mapCode === '') {
    echo json_encode(['success' => false, 'error' => 'Некорректные параметры'], JSON_UNESCAPED_UNICODE);
    exit();
}

$result = tactics_admin_delete_map_asset($db, $game, $battleMode, $mapCode);
if (!$result['ok']) {
    echo json_encode(['success' => false, 'error' => 'Файл не найден'], JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
