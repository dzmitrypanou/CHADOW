<?php

function user_request_raw_body(): string {
    static $raw = null;
    if ($raw === null) {
        $read = file_get_contents('php://input');
        $raw = $read === false ? '' : $read;
    }
    return $raw;
}

function user_csrf_ensure(): void {
    if (empty($_SESSION['site_csrf'])) {
        $_SESSION['site_csrf'] = bin2hex(random_bytes(32));
    }
}

function user_csrf_token(): string {
    user_csrf_ensure();
    return (string) $_SESSION['site_csrf'];
}

function user_csrf_verify(): bool {
    $token = '';
    if (!empty($_SERVER['HTTP_X_CSRF_TOKEN'])) {
        $token = trim((string) $_SERVER['HTTP_X_CSRF_TOKEN']);
    } elseif (isset($_POST['csrf_token'])) {
        $token = (string) $_POST['csrf_token'];
    } else {
        $input = json_decode(user_request_raw_body(), true);
        if (is_array($input) && isset($input['csrf_token'])) {
            $token = (string) $input['csrf_token'];
        }
    }
    if ($token === '' || empty($_SESSION['site_csrf'])) {
        return false;
    }
    return hash_equals((string) $_SESSION['site_csrf'], $token);
}

function user_require_csrf_ajax(): void {
    if (!user_csrf_verify()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Недействительный токен безопасности'], JSON_UNESCAPED_UNICODE);
        exit();
    }
}
