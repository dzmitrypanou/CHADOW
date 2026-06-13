<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../config/ensure_aim.php';
require_once __DIR__ . '/../../includes/aim_helpers.php';

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

ensure_aim_scores_table($db);

try {
    if (!aim_admin_delete_score($db, $id)) {
        echo json_encode(['success' => false, 'error' => 'Запись не найдена'], JSON_UNESCAPED_UNICODE);
        exit();
    }
    echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Ошибка сервера'], JSON_UNESCAPED_UNICODE);
}
