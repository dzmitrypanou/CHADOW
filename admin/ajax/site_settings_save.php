<?php
require_once __DIR__ . '/../includes/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Неверный метод запроса'], JSON_UNESCAPED_UNICODE);
    exit();
}

admin_require_csrf_ajax();

if (!admin_is_admin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Недостаточно прав'], JSON_UNESCAPED_UNICODE);
    exit();
}

$replayStorageEnabled = isset($_POST['replay_storage_enabled'])
    && filter_var($_POST['replay_storage_enabled'], FILTER_VALIDATE_BOOLEAN);

$siteNameRu = isset($_POST['site_name_ru']) ? trim((string) $_POST['site_name_ru']) : '';
$siteNameEn = isset($_POST['site_name_en']) ? trim((string) $_POST['site_name_en']) : '';
$wgApplicationId = isset($_POST['wg_application_id']) ? trim((string) $_POST['wg_application_id']) : '';
$lestaApplicationId = isset($_POST['lesta_application_id']) ? trim((string) $_POST['lesta_application_id']) : '';

if ($siteNameRu === '' || $siteNameEn === '') {
    echo json_encode(['success' => false, 'error' => 'Укажите название сайта на обоих языках'], JSON_UNESCAPED_UNICODE);
    exit();
}

if (mb_strlen($siteNameRu, 'UTF-8') > 120 || mb_strlen($siteNameEn, 'UTF-8') > 120) {
    echo json_encode(['success' => false, 'error' => 'Название сайта не должно превышать 120 символов'], JSON_UNESCAPED_UNICODE);
    exit();
}

try {
    set_site_setting($db, 'site_name_ru', $siteNameRu);
    set_site_setting($db, 'site_name_en', $siteNameEn);
    set_site_setting($db, 'replay_storage_enabled', $replayStorageEnabled ? '1' : '0');
    set_site_setting($db, 'wg_application_id', $wgApplicationId);
    set_site_setting($db, 'lesta_application_id', $lestaApplicationId);
    echo json_encode([
        'success' => true,
        'replay_storage_enabled' => $replayStorageEnabled,
        'site_name_ru' => $siteNameRu,
        'site_name_en' => $siteNameEn,
        'wg_application_id' => $wgApplicationId,
        'lesta_application_id' => $lestaApplicationId,
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

