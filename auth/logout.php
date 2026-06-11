<?php
require_once __DIR__ . '/../includes/user_bootstrap.php';
require_once __DIR__ . '/../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ' . user_auth_path('/auth/login'));
    exit();
}

if (!user_csrf_verify()) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Доступ запрещён';
    exit();
}

user_logout();
header('Location: ' . user_auth_path('/auth/login'));
exit();
