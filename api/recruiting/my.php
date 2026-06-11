<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    recruiting_json_error('Метод не поддерживается', 405);
}

user_require_ajax();
user_require_active($userDb);

$userId = user_current_id();
$status = isset($_GET['status']) ? trim((string) $_GET['status']) : '';

if ($status !== '' && !in_array($status, RECRUITING_STATUSES, true)) {
    recruiting_json_error('Недопустимый статус');
}

$where = ['p.user_id = ?'];
$params = [$userId];

if ($status !== '') {
    $where[] = 'p.status = ?';
    $params[] = $status;
}

$whereSql = implode(' AND ', $where);

try {
    $rows = $userDb->fetchAll(
        "SELECT
            p.id,
            p.post_type,
            p.realm,
            p.title,
            p.body,
            p.contact,
            p.clan_tag,
            p.clan_tag_type,
            p.status,
            p.moderation_note,
            p.moderated_at,
            p.published_at,
            p.created_at,
            p.updated_at,
            " . recruiting_sql_user_author_columns('u') . "
         FROM recruiting_posts p
         INNER JOIN site_users u ON u.id = p.user_id
         WHERE {$whereSql}
         ORDER BY p.updated_at DESC, p.id DESC",
        $params
    );

    $items = array_map(static function (array $row): array {
        return recruiting_format_post($row, true);
    }, $rows);

    echo json_encode([
        'success' => true,
        'data' => $items,
        'count' => count($items),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    recruiting_json_error('Ошибка сервера', 500);
}
