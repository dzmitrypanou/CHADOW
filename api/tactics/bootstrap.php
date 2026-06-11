<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, X-Tactics-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../config/ensure_tactics.php';
require_once __DIR__ . '/../../includes/user_auth.php';
require_once __DIR__ . '/../../includes/user_csrf.php';
require_once __DIR__ . '/../../includes/tactics_helpers.php';

if (!isset($userDb)) {
    $userDb = Database::getInstance();
}

ensure_tactics_table($userDb);
ensure_tactics_realtime_tables($userDb);
user_csrf_ensure();

function tactics_read_json_input(): array {
    $raw = user_request_raw_body();
    if (trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);

    return is_array($data) ? $data : [];
}

function tactics_json_error(string $message, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit();
}

function tactics_resolve_access_token(array $input): ?string {
    $header = $_SERVER['HTTP_X_TACTICS_TOKEN'] ?? '';
    if (is_string($header) && trim($header) !== '') {
        return trim($header);
    }

    $token = isset($input['access_token']) ? trim((string) $input['access_token']) : '';

    return $token !== '' ? $token : null;
}

function tactics_format_response(array $row, $db, string $clientId, string $nickname, bool $isOwner): array {
    $publicId = (string) ($row['public_id'] ?? '');
    $accessToken = tactics_issue_access_token($db, $publicId, $clientId, $nickname, $isOwner, $row);
    $wsToken = tactics_issue_ws_token($db, $publicId, $clientId, $nickname, $isOwner ? 'owner' : 'guest', $row);
    $roomItem = tactics_format_item($row, true, true);
    $roomData = is_array($roomItem['room_data'] ?? null) ? $roomItem['room_data'] : [];
    $roomItem['map_urls'] = tactics_build_slide_map_urls($roomData, $publicId);
    $canDraw = tactics_user_can_draw($roomData, $clientId, $isOwner);

    tactics_upsert_presence($db, $publicId, $clientId, $nickname);

    return [
        'room' => $roomItem,
        'access_token' => $accessToken,
        'ws_token' => $wsToken,
        'ws_url' => tactics_ws_public_url(),
        'room_href' => tactics_build_href(abs_detect_lang(), $publicId),
        'nickname' => $nickname,
        'can_manage' => $isOwner,
        'can_draw' => $canDraw,
    ];
}
