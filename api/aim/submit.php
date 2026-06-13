<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/user_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    aim_json_error(aim_error_message('method_not_allowed', aim_detect_lang()), 405);
}

$lang = aim_detect_lang();
$payload = aim_read_json_input();

$userId = null;
if (user_is_logged_in()) {
    $userId = user_current_id();
}

try {
    $result = aim_save_score($userDb, $payload, $userId);
    if (!$result['success']) {
        $code = (string) ($result['error'] ?? 'server_error');
        $httpCode = $code === 'rate_limited' ? 429 : 400;
        aim_json_error(aim_error_message($code, $lang), $httpCode);
    }

    echo json_encode([
        'success' => true,
        'entry' => $result['entry'],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    aim_json_error(aim_error_message('server_error', $lang), 500);
}
