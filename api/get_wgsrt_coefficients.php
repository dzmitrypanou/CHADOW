<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/http_cache.php';
require_once __DIR__ . '/../includes/perf_metrics.php';
chadow_perf_start('api_get_wgsrt_coefficients');
try {
    $db = Database::getInstance();
    $coefficients = $db->fetchAll("
        SELECT 
            parameter_name,
            coefficient_value,
            min_value,
            max_value,
            normalization_factor,
            version
        FROM wgsrt_coefficients 
        WHERE is_active = 1
        ORDER BY parameter_name
    ");
    $response = [
        'success' => true,
        'timestamp' => time(),
        'version' => !empty($coefficients) ? $coefficients[0]['version'] : '2.6.0',
        'coefficients' => $coefficients
    ];
    $payload = json_encode($response, JSON_NUMERIC_CHECK | JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
        throw new RuntimeException('JSON encode failed');
    }
    $etag = sha1($payload);
    chadow_http_json_cache_headers($etag, 300);
    if (chadow_http_if_none_match_matches($etag)) {
        chadow_emit_not_modified();
    }
    echo $payload;
    chadow_perf_finish('api_get_wgsrt_coefficients', ['rows' => count($coefficients)]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}