<?php
require_once __DIR__ . '/../includes/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Неверный метод запроса'], JSON_UNESCAPED_UNICODE);
    exit();
}

admin_require_csrf_ajax();

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
if ($id <= 0) {
    echo json_encode(['success' => false, 'error' => 'Некорректный идентификатор пользователя'], JSON_UNESCAPED_UNICODE);
    exit();
}

function admin_generate_temporary_password(int $length = 12): string {
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    $alphabetLength = strlen($alphabet);
    if ($alphabetLength < 2) {
        return bin2hex(random_bytes(8));
    }
    $result = '';
    for ($i = 0; $i < $length; $i++) {
        $idx = random_int(0, $alphabetLength - 1);
        $result .= $alphabet[$idx];
    }
    return $result;
}

try {
    $user = $db->fetchOne('SELECT id, username FROM admin_users WHERE id = ?', [$id]);
    if (!$user) {
        echo json_encode(['success' => false, 'error' => 'Пользователь не найден'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $temporaryPassword = admin_generate_temporary_password(12);
    $hash = password_hash($temporaryPassword, PASSWORD_DEFAULT);
    $db->query('UPDATE admin_users SET password_hash = ? WHERE id = ?', [$hash, $id]);

    echo json_encode([
        'success' => true,
        'username' => (string) $user['username'],
        'temporary_password' => $temporaryPassword,
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
