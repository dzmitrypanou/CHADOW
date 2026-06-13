<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../config/ensure_aim.php';
require_once __DIR__ . '/../../includes/aim_helpers.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit();
}

ensure_aim_scores_table($db);

$trainer = isset($_GET['trainer']) ? trim((string) $_GET['trainer']) : '';
$device = isset($_GET['device']) ? trim((string) $_GET['device']) : '';
$search = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
$view = isset($_GET['view']) ? trim((string) $_GET['view']) : 'all';
$page = isset($_GET['page']) ? (int) $_GET['page'] : 1;

$result = aim_admin_fetch_scores($db, [
    'trainer' => $trainer,
    'device' => $device,
    'q' => $search,
    'view' => $view,
    'page' => $page,
    'per_page' => 50,
]);

if (empty($result['success'])) {
    $error = ($result['error'] ?? '') === 'invalid_trainer'
        ? 'Недопустимый тренажёр'
        : (($result['error'] ?? '') === 'invalid_device'
            ? 'Недопустимое устройство'
            : 'Ошибка сервера');
    echo json_encode(['success' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit();
}

$trainersMeta = [];
foreach (AIM_TRAINERS as $trainerId) {
    $trainersMeta[] = [
        'id' => $trainerId,
        'title' => aim_admin_trainer_label($trainerId, 'ru'),
    ];
}

echo json_encode([
    'success' => true,
    'data' => $result['data'] ?? [],
    'stats' => $result['stats'] ?? aim_admin_fetch_stats($db),
    'pagination' => $result['pagination'] ?? null,
    'view' => $result['view'] ?? $view,
    'trainer' => $result['trainer'] ?? ($trainer !== '' ? $trainer : null),
    'device' => $result['device'] ?? ($device !== '' ? $device : null),
    'trainers' => $trainersMeta,
], JSON_UNESCAPED_UNICODE);
