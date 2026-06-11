<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../config/ensure_brackets.php';
require_once __DIR__ . '/../../includes/bracket_helpers.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['id']) || !isset($_POST['status'])) {
    echo json_encode(['success' => false, 'error' => 'Неверные параметры'], JSON_UNESCAPED_UNICODE);
    exit();
}

admin_require_csrf_ajax();

$id = (int) $_POST['id'];
$status = trim((string) $_POST['status']);
$note = isset($_POST['note']) ? trim((string) $_POST['note']) : '';

$allowedStatuses = ['active', 'hidden'];
if ($id <= 0 || !in_array($status, $allowedStatuses, true)) {
    echo json_encode(['success' => false, 'error' => 'Некорректные данные'], JSON_UNESCAPED_UNICODE);
    exit();
}

if (mb_strlen($note, 'UTF-8') > 500) {
    echo json_encode(['success' => false, 'error' => 'Примечание не длиннее 500 символов'], JSON_UNESCAPED_UNICODE);
    exit();
}

ensure_brackets_table($db);

$adminUser = admin_user();
$adminId = $adminUser ? (int) $adminUser['id'] : null;

try {
    $existing = $db->fetchOne('SELECT id FROM tournament_brackets WHERE id = ?', [$id]);
    if (!$existing) {
        echo json_encode(['success' => false, 'error' => 'Сетка не найдена'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($status === 'active') {
        $db->update(
            'UPDATE tournament_brackets
             SET status = ?, moderation_note = NULL, moderated_by = ?, moderated_at = NOW()
             WHERE id = ?',
            [$status, $adminId, $id]
        );
    } else {
        $db->update(
            'UPDATE tournament_brackets
             SET status = ?, moderation_note = ?, moderated_by = ?, moderated_at = NOW()
             WHERE id = ?',
            [$status, $note !== '' ? $note : null, $adminId, $id]
        );
    }

    echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Ошибка сервера'], JSON_UNESCAPED_UNICODE);
}
