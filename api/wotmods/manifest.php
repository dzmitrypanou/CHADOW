<?php

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

require_once __DIR__ . '/../../includes/wotmods_helpers.php';

$modId = isset($_GET['mod']) ? trim((string) $_GET['mod']) : '';
$mods = wotmods_install_manifest_mods($modId !== '' ? $modId : null);

if ($mods === []) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'not_found'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode([
    'ok' => true,
    'mods' => $mods,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
