<?php
require_once __DIR__ . '/../includes/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Неверные параметры'], JSON_UNESCAPED_UNICODE);
    exit();
}

admin_require_csrf_ajax();

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$myId = (int) $_SESSION['admin_user_id'];

if ($id <= 0) {
    echo json_encode(['success' => false, 'error' => 'Некорректный id'], JSON_UNESCAPED_UNICODE);
    exit();
}

if ($id === $myId) {
    echo json_encode(['success' => false, 'error' => 'Нельзя удалить свою учётную запись'], JSON_UNESCAPED_UNICODE);
    exit();
}

function admin_count_admins($db): int {
    $row = $db->fetchOne('SELECT COUNT(*) AS c FROM admin_users WHERE role = ?', ['admin']);
    return (int) ($row['c'] ?? 0);
}

try {
    $u = $db->fetchOne('SELECT id, role FROM admin_users WHERE id = ?', [$id]);
    if (!$u) {
        echo json_encode(['success' => false, 'error' => 'Пользователь не найден'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($u['role'] === 'admin' && admin_count_admins($db) < 2) {
        echo json_encode(['success' => false, 'error' => 'Нельзя удалить последнего администратора'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $deleted = $db->delete('DELETE FROM admin_users WHERE id = ?', [$id]);
    if ($deleted < 1) {
        echo json_encode(['success' => false, 'error' => 'Пользователь не был удалён'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
