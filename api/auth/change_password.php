<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit();
}

require_once __DIR__ . '/../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';
require_once __DIR__ . '/../../config/ensure_site_users.php';

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
ensure_site_users_table($userDb);

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

$raw = user_request_raw_body();
$input = [];
if (trim($raw) !== '') {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $input = $decoded;
    }
}
if ($input === [] && !empty($_POST)) {
    $input = $_POST;
}

$currentPassword = (string) ($input['current_password'] ?? '');
$newPassword = (string) ($input['new_password'] ?? '');
$newPasswordConfirm = (string) ($input['new_password_confirm'] ?? '');

if ($newPassword !== $newPasswordConfirm) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $lang === 'en'
            ? 'New password and confirmation do not match.'
            : 'Новый пароль и подтверждение не совпадают.',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

$result = user_change_local_password($userDb, (int) $userId, $currentPassword, $newPassword, $lang);
if (!$result['ok']) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $result['error'] ?? 'Ошибка'], JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode([
    'success' => true,
    'message' => $result['message'] ?? ($lang === 'en' ? 'Password changed.' : 'Пароль изменён.'),
], JSON_UNESCAPED_UNICODE);
