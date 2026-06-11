<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../config/ensure_recruiting.php';
require_once __DIR__ . '/../../includes/user_auth.php';
require_once __DIR__ . '/../../includes/recruiting_helpers.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit();
}

ensure_recruiting_posts_table($db);

$status = isset($_GET['status']) ? trim((string) $_GET['status']) : '';
$postType = isset($_GET['post_type']) ? trim((string) $_GET['post_type']) : '';
$realm = isset($_GET['realm']) ? strtolower(trim((string) $_GET['realm'])) : '';
$search = isset($_GET['q']) ? trim((string) $_GET['q']) : '';

if ($status !== '' && !in_array($status, RECRUITING_STATUSES, true)) {
    echo json_encode(['success' => false, 'error' => 'Недопустимый статус'], JSON_UNESCAPED_UNICODE);
    exit();
}

if ($postType !== '' && !recruiting_post_type_valid($postType)) {
    echo json_encode(['success' => false, 'error' => 'Недопустимый тип объявления'], JSON_UNESCAPED_UNICODE);
    exit();
}

if ($realm !== '' && !recruiting_realm_valid($realm)) {
    echo json_encode(['success' => false, 'error' => 'Недопустимый регион'], JSON_UNESCAPED_UNICODE);
    exit();
}

$where = ['1=1'];
$params = [];

if ($status !== '') {
    $where[] = 'p.status = ?';
    $params[] = $status;
}

if ($postType !== '') {
    $where[] = 'p.post_type = ?';
    $params[] = $postType;
}

if ($realm !== '') {
    $where[] = 'p.realm = ?';
    $params[] = $realm;
}

if ($search !== '') {
    $where[] = '(p.title LIKE ? OR p.body LIKE ? OR p.clan_tag LIKE ? OR u.username LIKE ? OR u.wg_nickname LIKE ?)';
    $like = '%' . $search . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

$whereSql = implode(' AND ', $where);

try {
    $stats = $db->fetchOne(
        "SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
            SUM(CASE WHEN status = 'hidden' THEN 1 ELSE 0 END) AS hidden
         FROM recruiting_posts"
    );

    $rows = $db->fetchAll(
        "SELECT
            p.id,
            p.user_id,
            p.post_type,
            p.realm,
            p.title,
            p.body,
            p.contact,
            p.clan_tag,
            p.clan_tag_type,
            p.game_nickname,
            p.status,
            p.moderation_note,
            p.moderated_by,
            p.moderated_at,
            p.published_at,
            p.created_at,
            p.updated_at,
            " . recruiting_sql_user_author_columns('u') . ",
            u.email
         FROM recruiting_posts p
         LEFT JOIN site_users u ON u.id = p.user_id
         WHERE {$whereSql}
         ORDER BY
            CASE p.status WHEN 'pending' THEN 0 ELSE 1 END,
            p.updated_at DESC,
            p.id DESC",
        $params
    );

    $items = array_map(static function (array $row): array {
        $item = recruiting_format_post($row, true);
        $item['user_id'] = isset($row['user_id']) ? (int) $row['user_id'] : null;
        $item['username'] = (string) ($row['username'] ?? '');
        $item['email'] = (string) ($row['email'] ?? '');
        $item['post_type_label'] = recruiting_post_type_label((string) $row['post_type']);
        $item['realm_label'] = recruiting_realm_label((string) $row['realm']);
        $item['status_label'] = recruiting_status_label((string) $row['status']);
        return $item;
    }, $rows);

    echo json_encode([
        'success' => true,
        'data' => $items,
        'stats' => [
            'total' => (int) ($stats['total'] ?? 0),
            'pending' => (int) ($stats['pending'] ?? 0),
            'approved' => (int) ($stats['approved'] ?? 0),
            'rejected' => (int) ($stats['rejected'] ?? 0),
            'hidden' => (int) ($stats['hidden'] ?? 0),
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Ошибка сервера'], JSON_UNESCAPED_UNICODE);
}
