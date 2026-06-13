<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    aim_json_error(aim_error_message('method_not_allowed', aim_detect_lang()), 405);
}

$trainer = isset($_GET['trainer']) ? trim((string) $_GET['trainer']) : '';
$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
$device = isset($_GET['device']) ? aim_normalize_device((string) $_GET['device']) : 'desktop';

try {
    $result = aim_fetch_leaderboard($userDb, $trainer, $limit, $device);
    if (!$result['success']) {
        aim_json_error(aim_error_message((string) ($result['error'] ?? 'server_error'), aim_detect_lang()));
    }

    header('Cache-Control: public, max-age=15, stale-while-revalidate=30');
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    aim_json_error(aim_error_message('server_error', aim_detect_lang()), 500);
}
