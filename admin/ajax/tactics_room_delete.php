<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../config/ensure_tactics.php';
require_once __DIR__ . '/../../includes/tactics_helpers.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['id'])) {
    echo json_encode(['success' => false, 'error' => 'Неверные параметры'], JSON_UNESCAPED_UNICODE);
    exit();
}

admin_require_csrf_ajax();

$id = (int) $_POST['id'];
if ($id <= 0) {
    echo json_encode(['success' => false, 'error' => 'Некорректный идентификатор'], JSON_UNESCAPED_UNICODE);
    exit();
}

ensure_tactics_table($db);

try {
    if (!tactics_admin_delete_room($db, $id)) {
        echo json_encode(['success' => false, 'error' => 'Комната не найдена'], JSON_UNESCAPED_UNICODE);
        exit();
    }
    echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Ошибка сервера'], JSON_UNESCAPED_UNICODE);
}
