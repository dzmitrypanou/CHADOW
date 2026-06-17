<?php

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

require_once __DIR__ . '/../../includes/wotmods_helpers.php';

$modId = isset($_GET['mod']) ? trim((string) $_GET['mod']) : '';
$client = isset($_GET['client']) ? trim((string) $_GET['client']) : '';

if ($client === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'missing_client'], JSON_UNESCAPED_UNICODE);
    exit;
}

$mods = wotmods_install_manifest_mods($modId !== '' ? $modId : null, $client);

if ($mods === []) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'not_found'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode([
    'ok' => true,
    'client' => wotmods_normalize_game_client($client),
    'mods' => $mods,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
