<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../config/tactics_map_catalog.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit();
}

$mapCode = trim((string) ($_GET['map_code'] ?? ''));
$battleMode = trim((string) ($_GET['battle_mode'] ?? 'random'));

if ($mapCode === '') {
    echo json_encode(['success' => false, 'error' => 'Укажите код карты'], JSON_UNESCAPED_UNICODE);
    exit();
}

$data = tactics_admin_get_map_spawns($mapCode, $battleMode);

echo json_encode([
    'success' => true,
    'data' => $data,
], JSON_UNESCAPED_UNICODE);
