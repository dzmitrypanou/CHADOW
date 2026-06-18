<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    reserves_json_error($isEn ? 'Method not allowed' : 'Метод не поддерживается', 405);
}

$profile = reserves_require_user();
$ctx = reserves_user_context($profile);

echo json_encode([
    'success' => true,
    'data' => [
        'links' => $ctx['links'],
        'enabled_realms' => $ctx['enabled_realms'],
    ],
], JSON_UNESCAPED_UNICODE);
