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

$playerName = isset($_POST['player_name']) ? trim((string) $_POST['player_name']) : '';
if ($playerName === '') {
    echo json_encode(['success' => false, 'error' => 'Укажите ник игрока'], JSON_UNESCAPED_UNICODE);
    exit();
}

ensure_aim_scores_table($db);

$result = aim_admin_rename_player($db, $playerName);
if (empty($result['success'])) {
    $errors = [
        'invalid_player_name' => 'Некорректный ник',
        'already_renamed' => 'Игрок уже переименован',
        'not_found' => 'Записи не найдены',
        'invalid_new_name' => 'Не удалось сгенерировать новый ник',
        'server_error' => 'Ошибка сервера',
    ];
    $code = (string) ($result['error'] ?? '');
    echo json_encode([
        'success' => false,
        'error' => $errors[$code] ?? 'Ошибка сервера',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode([
    'success' => true,
    'old_name' => $result['old_name'] ?? $playerName,
    'new_name' => $result['new_name'] ?? '',
    'updated' => (int) ($result['updated'] ?? 0),
], JSON_UNESCAPED_UNICODE);
