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

$profile = user_login_row($userDb, (int) $userId);
$isLocal = is_array($profile) && ($profile['auth_provider'] ?? '') === 'local';
$messages = [];
$latestProfile = $profile;

try {
    if ($isLocal && (array_key_exists('username', $input) || array_key_exists('email', $input))) {
        $username = trim((string) ($input['username'] ?? ''));
        $email = trim((string) ($input['email'] ?? ''));
        $result = user_update_local_profile($userDb, (int) $userId, $username, $email, $lang);
        if (!$result['ok']) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $result['error'] ?? 'Ошибка'], JSON_UNESCAPED_UNICODE);
            exit();
        }
        if (!empty($result['message'])) {
            $messages[] = (string) $result['message'];
        }
        if (!empty($result['profile']) && is_array($result['profile'])) {
            $latestProfile = $result['profile'];
        }
    }

    $hasNicknameInput = false;
    foreach (user_game_nickname_realms() as $realm) {
        if (array_key_exists('game_nickname_' . $realm, $input)) {
            $hasNicknameInput = true;
            break;
        }
    }

    if ($hasNicknameInput) {
        $nickResult = user_update_game_nicknames($userDb, (int) $userId, $input, $lang);
        if (!$nickResult['ok']) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $nickResult['error'] ?? 'Ошибка'], JSON_UNESCAPED_UNICODE);
            exit();
        }
        if (!empty($nickResult['message'])) {
            $messages[] = (string) $nickResult['message'];
        }
        if (!empty($nickResult['profile']) && is_array($nickResult['profile'])) {
            $latestProfile = $nickResult['profile'];
        }
    }

    $nickState = is_array($latestProfile) ? user_game_nicknames_state($latestProfile) : [];

    echo json_encode([
        'success' => true,
        'message' => $messages !== []
            ? $messages[0]
            : ($lang === 'en' ? 'Settings saved.' : 'Настройки сохранены.'),
        'profile' => is_array($latestProfile) ? [
            'username' => (string) ($latestProfile['username'] ?? ''),
            'email' => (string) ($latestProfile['email'] ?? ''),
            'game_nicknames' => [
                'ru' => $nickState['ru']['value'] ?? '',
                'eu' => $nickState['eu']['value'] ?? '',
                'na' => $nickState['na']['value'] ?? '',
            ],
        ] : null,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $lang === 'en' ? 'Server error' : 'Ошибка сервера',
    ], JSON_UNESCAPED_UNICODE);
}
