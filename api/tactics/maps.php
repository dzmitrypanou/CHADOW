<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/ensure_map_dictionary.php';
require_once __DIR__ . '/../../config/ensure_tactics.php';
require_once __DIR__ . '/../../config/tactics_map_catalog.php';
require_once __DIR__ . '/../../includes/lang.php';
require_once __DIR__ . '/../../includes/http_cache.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$lang = abs_resolve_lang($_GET);

try {
    $db = Database::getInstance();
    ensure_map_dictionary_table($db);
    ensure_tactics_map_assignments_table($db);
    $rows = $db->fetchAll(
        'SELECT map_code, display_name_ru, display_name_en, side_length
         FROM map_dictionary
         ORDER BY display_name_ru'
    );

    $catalog = tactics_build_map_catalog($rows, $lang, $db);
    $response = [
        'success' => true,
        'timestamp' => time(),
        'data' => $catalog,
    ];
    $payload = json_encode($response, JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
        throw new RuntimeException('JSON encode failed');
    }
    $etag = sha1($payload);
    chadow_http_json_revalidate_headers($etag);
    if (chadow_http_if_none_match_matches($etag)) {
        chadow_emit_not_modified();
    }
    echo $payload;
} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'error' => 'catalog_error',
        'data' => null,
    ], JSON_UNESCAPED_UNICODE);
}
