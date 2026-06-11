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
require_once __DIR__ . '/../config/ensure_dictionary_labels.php';
require_once __DIR__ . '/../config/dictionary_helpers.php';
require_once __DIR__ . '/../config/vehicle_code.php';
require_once __DIR__ . '/../config/runtime_flags.php';
require_once __DIR__ . '/../includes/http_cache.php';
require_once __DIR__ . '/../includes/perf_metrics.php';
chadow_perf_start('api_get_tanks');

try {
    $db = Database::getInstance();
    ensure_dictionary_labels_tables($db);
    if (chadow_allow_runtime_dictionary_merge()) {
        merge_duplicate_vehicle_codes($db);
    }
    $nationLabelsRu = nation_label_map($db);
    $nationLabelsEn = nation_label_map_en($db);
    $tankTypeLabelsRu = tank_type_label_map($db);
    $tankTypeLabelsEn = tank_type_label_map_en($db);

    $tanks = $db->fetchAll("
        SELECT 
            vehicle_code,
            display_name_ru,
            display_name_en,
            nation,
            tank_type,
            tier,
            is_premium,
            is_collectible,
            is_moderated
        FROM tank_dictionary 
        ORDER BY display_name_ru
    ");

    $response = [
        'success' => true,
        'timestamp' => time(),
        'count' => count($tanks),
        'data' => $tanks,
        // Старые клиенты/рендер: RU-колонка.
        'nation_labels' => $nationLabelsRu,
        'tank_type_labels' => $tankTypeLabelsRu,
        // Новые клиенты: оба языка.
        'nation_labels_ru' => $nationLabelsRu,
        'nation_labels_en' => $nationLabelsEn,
        'tank_type_labels_ru' => $tankTypeLabelsRu,
        'tank_type_labels_en' => $tankTypeLabelsEn
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
    chadow_perf_finish('api_get_tanks', ['rows' => count($tanks)]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}