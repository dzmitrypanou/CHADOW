<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Tactics-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit();
}

require_once __DIR__ . '/../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../config/ensure_tactics.php';
require_once __DIR__ . '/../../includes/tactics_helpers.php';

if (!isset($userDb)) {
    $userDb = Database::getInstance();
}

ensure_tactics_table($userDb);

$token = trim((string) ($_GET['token'] ?? $_SERVER['HTTP_X_TACTICS_TOKEN'] ?? ''));
if ($token === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Token required'], JSON_UNESCAPED_UNICODE);
    exit();
}

$payload = tactics_verify_signed_token($userDb, $token);
if ($payload === null) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized'], JSON_UNESCAPED_UNICODE);
    exit();
}

$publicId = trim((string) ($payload['pid'] ?? ''));
$clientId = trim((string) ($payload['cid'] ?? ''));
$nickname = tactics_sanitize_nickname((string) ($payload['nick'] ?? 'Guest'));
if ($clientId !== '') {
    tactics_upsert_presence($userDb, $publicId, $clientId, $nickname);
}

$participants = tactics_fetch_ws_presence($userDb, $token);
$source = 'ws';
if ($participants === null) {
    $participants = tactics_fetch_presence_participants($userDb, $publicId);
    $source = 'db';
}

tactics_purge_room_realtime($userDb);

echo json_encode([
    'success' => true,
    'public_id' => $publicId,
    'source' => $source,
    'participants' => $participants,
], JSON_UNESCAPED_UNICODE);
