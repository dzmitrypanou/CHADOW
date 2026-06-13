<?php
require_once __DIR__ . '/../../../includes/minecraft_oauth_helpers.php';

$sessionId = isset($_GET['session']) ? trim((string) $_GET['session']) : '';
if (!minecraft_oauth_is_valid_session_id($sessionId)) {
    http_response_code(400);
    header('Location: /auth/wg.php');
    exit();
}

header('Location: ' . minecraft_oauth_launcher_start_url($sessionId));
exit();
