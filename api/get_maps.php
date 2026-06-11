<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/ensure_map_dictionary.php';
require_once __DIR__ . '/../includes/http_cache.php';
require_once __DIR__ . '/../includes/perf_metrics.php';
chadow_perf_start('api_get_maps');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $db = Database::getInstance();
    ensure_map_dictionary_table($db);
    $maps = $db->fetchAll(
        'SELECT map_code, display_name_ru, display_name_en, is_moderated, side_length
         FROM map_dictionary
         ORDER BY display_name_ru'
    );

    $response = [
        'success' => true,
        'timestamp' => time(),
        'count' => count($maps),
        'data' => $maps
    ];
    $payload = json_encode($response, JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
        throw new RuntimeException('JSON encode failed');
    }
    $etag = sha1($payload);
    chadow_http_json_cache_headers($etag, 300);
    if (chadow_http_if_none_match_matches($etag)) {
        chadow_emit_not_modified();
    }
    echo $payload;
    chadow_perf_finish('api_get_maps', ['rows' => count($maps)]);
} catch (Exception $e) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'timestamp' => time(),
        'count' => 0,
        'data' => [],
        'warning' => 'map_dictionary: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
