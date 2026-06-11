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
require_once __DIR__ . '/../../config/ensure_brackets.php';
require_once __DIR__ . '/../../includes/user_auth.php';
require_once __DIR__ . '/../../includes/user_csrf.php';
require_once __DIR__ . '/../../includes/bracket_helpers.php';

if (!isset($userDb)) {
    $userDb = Database::getInstance();
}

ensure_brackets_table($userDb);
user_csrf_ensure();

function bracket_read_json_input(): array {
    $raw = user_request_raw_body();
    if (trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);

    return is_array($data) ? $data : [];
}

function bracket_json_error(string $message, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit();
}
