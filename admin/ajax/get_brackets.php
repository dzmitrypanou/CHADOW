<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../config/ensure_brackets.php';
require_once __DIR__ . '/../../includes/bracket_helpers.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit();
}

ensure_brackets_table($db);

$status = isset($_GET['status']) ? trim((string) $_GET['status']) : '';
$visibility = isset($_GET['visibility']) ? trim((string) $_GET['visibility']) : '';
$search = isset($_GET['q']) ? trim((string) $_GET['q']) : '';

if ($status !== '' && !bracket_status_valid($status)) {
    echo json_encode(['success' => false, 'error' => 'Недопустимый статус'], JSON_UNESCAPED_UNICODE);
    exit();
}

if ($visibility !== '' && !bracket_visibility_valid($visibility)) {
    echo json_encode(['success' => false, 'error' => 'Недопустимая видимость'], JSON_UNESCAPED_UNICODE);
    exit();
}

$where = ['1=1'];
$params = [];

if ($status !== '') {
    $where[] = 'b.status = ?';
    $params[] = $status;
}

if ($visibility !== '') {
    $where[] = 'b.visibility = ?';
    $params[] = $visibility;
}

if ($search !== '') {
    $where[] = 'b.title LIKE ?';
    $params[] = '%' . $search . '%';
}

$whereSql = implode(' AND ', $where);

try {
    $stats = $db->fetchOne(
        "SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status = 'hidden' THEN 1 ELSE 0 END) AS hidden
         FROM tournament_brackets"
    );

    $rows = $db->fetchAll(
        "SELECT
            b.id,
            b.public_id,
            b.user_id,
            b.title,
            b.format,
            b.visibility,
            b.status,
            b.moderation_note,
            b.moderated_at,
            b.created_at,
            b.updated_at,
            u.username,
            u.email
         FROM tournament_brackets b
         LEFT JOIN site_users u ON u.id = b.user_id
         WHERE {$whereSql}
         ORDER BY b.updated_at DESC, b.id DESC",
        $params
    );

    $items = array_map(static function (array $row): array {
        $bracketData = bracket_parse_bracket_data($row);

        return [
            'id' => (int) $row['id'],
            'public_id' => (string) $row['public_id'],
            'user_id' => isset($row['user_id']) ? (int) $row['user_id'] : null,
            'title' => (string) $row['title'],
            'format' => (string) $row['format'],
            'format_label' => bracket_format_label((string) $row['format']),
            'visibility' => (string) $row['visibility'],
            'visibility_label' => bracket_visibility_label((string) $row['visibility']),
            'status' => (string) $row['status'],
            'status_label' => bracket_status_label((string) $row['status']),
            'moderation_note' => $row['moderation_note'] !== null ? (string) $row['moderation_note'] : null,
            'moderated_at' => $row['moderated_at'] ?? null,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
            'username' => (string) ($row['username'] ?? ''),
            'email' => (string) ($row['email'] ?? ''),
            'participant_count' => count($bracketData['participants'] ?? []),
            'view_url' => '/services/bracket/' . (string) $row['public_id'],
        ];
    }, $rows);

    echo json_encode([
        'success' => true,
        'data' => $items,
        'stats' => [
            'total' => (int) ($stats['total'] ?? 0),
            'active' => (int) ($stats['active'] ?? 0),
            'hidden' => (int) ($stats['hidden'] ?? 0),
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Ошибка сервера'], JSON_UNESCAPED_UNICODE);
}
