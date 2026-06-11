<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    tactics_json_error('Метод не поддерживается', 405);
}

$lang = abs_detect_lang();
$publicId = trim((string) ($_GET['public_id'] ?? ''));
$sinceRevision = max(0, (int) ($_GET['since_revision'] ?? 0));

if (!tactics_public_id_valid($publicId)) {
    tactics_json_error($lang === 'en' ? 'Invalid room code' : 'Некорректный код комнаты');
}

try {
    $row = tactics_fetch_row($userDb, $publicId, true);
    if (!$row) {
        tactics_json_error($lang === 'en' ? 'Room not found' : 'Комната не найдена', 404);
    }

    $currentRevision = (int) ($row['revision'] ?? 1);
    $changed = $sinceRevision <= 0 || $currentRevision > $sinceRevision;

    $realtime = null;
    $clientId = trim((string) ($_GET['client_id'] ?? ''));
    $sinceEventId = max(0, (int) ($_GET['since_event_id'] ?? 0));
    $wsToken = trim((string) ($_GET['ws_token'] ?? ''));
    $nickname = tactics_sanitize_nickname((string) ($_GET['nickname'] ?? 'Guest'));

    if ($wsToken !== '') {
        $tokenPayload = tactics_verify_room_token($userDb, $wsToken, $row);
        if ($tokenPayload !== null) {
            $clientId = trim((string) ($tokenPayload['cid'] ?? $clientId));
            $nickname = tactics_sanitize_nickname((string) ($tokenPayload['nick'] ?? $nickname));
        }
    }

    if ($clientId !== '') {
        tactics_upsert_presence($userDb, $publicId, $clientId, $nickname);
        $participants = tactics_fetch_ws_presence($userDb, $wsToken);
        if ($participants === null) {
            $participants = tactics_fetch_presence_participants($userDb, $publicId);
        }
        $realtime = [
            'participants' => $participants,
            'events' => tactics_fetch_room_events($userDb, $publicId, $sinceEventId),
        ];
        tactics_purge_room_realtime($userDb);
    }

    header('Cache-Control: private, no-cache');
    $response = [
        'success' => true,
        'changed' => $changed,
        'data' => $changed ? tactics_format_item($row, true, true) : [
            'public_id' => $publicId,
            'revision' => $currentRevision,
        ],
    ];
    if ($realtime !== null) {
        $response['realtime'] = $realtime;
    }
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    tactics_json_error('Ошибка сервера', 500);
}
