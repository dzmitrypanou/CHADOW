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
require_once __DIR__ . '/../config/ensure_wgsrt.php';
require_once __DIR__ . '/../includes/lang.php';
require_once __DIR__ . '/../includes/http_cache.php';
require_once __DIR__ . '/../includes/perf_metrics.php';
chadow_perf_start('api_get_wgsrt_grades');
try {
    $db = Database::getInstance();
    ensure_wgsrt_grades_lang_columns($db);
    $lang = abs_detect_lang();
    $grades = $db->fetchAll("
        SELECT
            grade_name,
            grade_name_en,
            grade_code,
            min_value,
            max_value,
            color,
            description,
            description_en,
            sort_order
        FROM wgsrt_grades
        ORDER BY sort_order
    ");
    foreach ($grades as &$grade) {
        $nameRu = (string) ($grade['grade_name'] ?? '');
        $nameEn = trim((string) ($grade['grade_name_en'] ?? ''));
        $descRu = (string) ($grade['description'] ?? '');
        $descEn = trim((string) ($grade['description_en'] ?? ''));

        $grade['grade_name'] = ($lang === 'en' && $nameEn !== '') ? $nameEn : $nameRu;
        $grade['description'] = ($lang === 'en' && $descEn !== '') ? $descEn : $descRu;
    }
    unset($grade);
    $response = [
        'success' => true,
        'timestamp' => time(),
        'grades' => $grades
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
    chadow_perf_finish('api_get_wgsrt_grades', ['rows' => count($grades)]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}