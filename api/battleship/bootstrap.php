<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../includes/user_bootstrap.php';
require_once __DIR__ . '/../../includes/user_auth.php';
require_once __DIR__ . '/../../includes/user_csrf.php';
require_once __DIR__ . '/../../includes/battleship_helpers.php';
require_once __DIR__ . '/../../includes/lang.php';

if (!isset($userDb)) {
    $userDb = Database::getInstance();
}

user_csrf_ensure();

function battleship_read_json_input(): array {
    $raw = user_request_raw_body();
    if (trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);

    return is_array($data) ? $data : [];
}

function battleship_json_error(string $message, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit();
}

function battleship_resolve_lang(array $input): string {
    $lang = abs_resolve_lang($input);

    return $lang === 'en' ? 'en' : 'ru';
}

function battleship_default_nickname($db, string $lang): string {
    $uid = user_current_id();
    if ($uid !== null) {
        $profile = user_login_row($db, $uid);
        if (is_array($profile) && !empty($profile['username'])) {
            return battleship_normalize_player_name((string) $profile['username']);
        }
    }

    return $lang === 'en' ? 'Player' : 'Игрок';
}
