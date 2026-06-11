<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../config/ensure_tactics.php';
require_once __DIR__ . '/../../includes/tactics_helpers.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit();
}

ensure_tactics_table($db);

$search = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
$visibility = isset($_GET['visibility']) ? trim((string) $_GET['visibility']) : '';

if ($visibility !== '' && !tactics_visibility_valid($visibility)) {
    echo json_encode(['success' => false, 'error' => 'Недопустимая видимость'], JSON_UNESCAPED_UNICODE);
    exit();
}

$result = tactics_admin_fetch_rooms($db, [
    'q' => $search,
    'visibility' => $visibility,
]);

if (!$result['success']) {
    echo json_encode(['success' => false, 'error' => 'Ошибка сервера'], JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode([
    'success' => true,
    'data' => $result['data'] ?? [],
    'stats' => $result['stats'] ?? ['total' => 0, 'open' => 0, 'closed' => 0],
], JSON_UNESCAPED_UNICODE);
