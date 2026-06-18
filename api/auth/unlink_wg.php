<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit();
}

require_once __DIR__ . '/../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';
require_once __DIR__ . '/../../includes/clan_reserve_helpers.php';

$lang = abs_detect_lang();

if (!user_is_logged_in()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => $lang === 'en' ? 'Not authorized' : 'Не авторизован'], JSON_UNESCAPED_UNICODE);
    exit();
}

$userId = user_current_id();
if ($userId === null) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => $lang === 'en' ? 'Not authorized' : 'Не авторизован'], JSON_UNESCAPED_UNICODE);
    exit();
}

user_require_active($userDb);

if (!user_csrf_verify()) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => $lang === 'en'
            ? 'Session expired. Refresh the page and try again.'
            : 'Сессия устарела. Обновите страницу и попробуйте снова.',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

try {
    $input = json_decode(file_get_contents('php://input') ?: '{}', true);
    $provider = is_array($input) ? strtolower(trim((string) ($input['provider'] ?? 'wg'))) : 'wg';
    if ($provider !== 'wg' && $provider !== 'lesta') {
        $provider = 'wg';
    }

    $result = user_unlink_game_api_account($userDb, (int) $userId, $provider, $lang);
    if (!$result['ok']) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $result['error'] ?? 'Ошибка'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    echo json_encode([
        'success' => true,
        'message' => $result['message'] ?? ($lang === 'en' ? 'Game account unlinked.' : 'Игровой аккаунт отвязан.'),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $lang === 'en' ? 'Server error' : 'Ошибка сервера',
    ], JSON_UNESCAPED_UNICODE);
}
