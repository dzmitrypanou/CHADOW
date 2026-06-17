<?php

require_once __DIR__ . '/../../includes/wotmods_helpers.php';

$modId = isset($_GET['mod']) ? trim((string) $_GET['mod']) : '';
$path = isset($_GET['path']) ? trim((string) $_GET['path']) : '';

$resolved = wotmods_resolve_install_file($modId, $path);
if (empty($resolved['ok']) || empty($resolved['path'])) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => $resolved['error'] ?? 'not_found'], JSON_UNESCAPED_UNICODE);
    exit;
}

$definition = wotmods_install_mod_definition($modId);
$modVersion = is_array($definition) ? (string) ($definition['version'] ?? '1.0.0') : '1.0.0';
$contents = file_get_contents($resolved['path']);
if ($contents === false) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'read_failed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$contents = wotmods_prepare_install_file_contents($contents, $modVersion);
$basename = basename($resolved['path']);

header('Content-Type: text/plain; charset=utf-8');
header('Content-Disposition: inline; filename="' . $basename . '"');
header('Cache-Control: public, max-age=3600');
header('X-Content-Type-Options: nosniff');
echo $contents;
