<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../config/ensure_recruiting.php';
require_once __DIR__ . '/../../includes/recruiting_helpers.php';

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

$allowedStatuses = ['approved', 'rejected', 'hidden'];
if ($id <= 0 || !in_array($status, $allowedStatuses, true)) {
    echo json_encode(['success' => false, 'error' => 'Некорректные данные'], JSON_UNESCAPED_UNICODE);
    exit();
}

if ($status === 'rejected' && $note === '') {
    echo json_encode(['success' => false, 'error' => 'Укажите причину отклонения'], JSON_UNESCAPED_UNICODE);
    exit();
}

if (mb_strlen($note, 'UTF-8') > 500) {
    echo json_encode(['success' => false, 'error' => 'Причина не длиннее 500 символов'], JSON_UNESCAPED_UNICODE);
    exit();
}

ensure_recruiting_posts_table($db);

$adminUser = admin_user();
$adminId = $adminUser ? (int) $adminUser['id'] : null;

try {
    $existing = $db->fetchOne('SELECT id, status FROM recruiting_posts WHERE id = ?', [$id]);
    if (!$existing) {
        echo json_encode(['success' => false, 'error' => 'Объявление не найдено'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($status === 'approved') {
        $db->update(
            'UPDATE recruiting_posts
             SET status = ?, published_at = NOW(), moderated_by = ?, moderated_at = NOW(),
                 moderation_note = NULL
             WHERE id = ?',
            [$status, $adminId, $id]
        );
    } elseif ($status === 'rejected') {
        $db->update(
            'UPDATE recruiting_posts
             SET status = ?, moderation_note = ?, moderated_by = ?, moderated_at = NOW(),
                 published_at = NULL
             WHERE id = ?',
            [$status, $note, $adminId, $id]
        );
    } else {
        $db->update(
            'UPDATE recruiting_posts
             SET status = ?, moderated_by = ?, moderated_at = NOW()
             WHERE id = ?',
            [$status, $adminId, $id]
        );
    }

    echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Ошибка сервера'], JSON_UNESCAPED_UNICODE);
}
