<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../config/ensure_aim.php';
require_once __DIR__ . '/../../includes/aim_helpers.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Неверные параметры'], JSON_UNESCAPED_UNICODE);
    exit();
}

admin_require_csrf_ajax();

$trainer = isset($_POST['trainer']) ? trim((string) $_POST['trainer']) : '';
$device = isset($_POST['device']) ? trim((string) $_POST['device']) : 'desktop';
$playerName = isset($_POST['player_name']) ? trim((string) $_POST['player_name']) : '';

if ($trainer === '' || $playerName === '') {
    echo json_encode(['success' => false, 'error' => 'Укажите тренажёр и ник'], JSON_UNESCAPED_UNICODE);
    exit();
}

ensure_aim_scores_table($db);

try {
    $deleted = aim_admin_delete_player_scores($db, $trainer, $device, $playerName);
    if ($deleted <= 0) {
        echo json_encode(['success' => false, 'error' => 'Записи не найдены'], JSON_UNESCAPED_UNICODE);
        exit();
    }
    echo json_encode([
        'success' => true,
        'deleted' => $deleted,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Ошибка сервера'], JSON_UNESCAPED_UNICODE);
}
