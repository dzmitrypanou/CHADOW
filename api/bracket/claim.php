<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bracket_json_error('Метод не поддерживается', 405);
}

user_require_ajax();
user_require_active($userDb);
user_require_csrf_ajax();

$lang = abs_detect_lang();
$userId = user_current_id();
$input = bracket_read_json_input();
$items = $input['items'] ?? null;

if ($items !== null && !is_array($items)) {
    bracket_json_error($lang === 'en' ? 'Invalid request' : 'Некорректный запрос');
}

$items = is_array($items) ? $items : [];

$claimed = [];
$failed = [];

try {
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        $publicId = trim((string) ($item['public_id'] ?? ''));
        $editToken = trim((string) ($item['edit_token'] ?? ''));
        if (!bracket_public_id_valid($publicId) || $editToken === '') {
            if ($publicId !== '') {
                $failed[] = $publicId;
            }
            continue;
        }

        $result = bracket_claim_guest_bracket($userDb, $publicId, (int) $userId, $editToken);
        if ($result['ok']) {
            $claimed[] = $publicId;
        } else {
            $failed[] = $publicId;
        }
    }

    $fromCookies = bracket_claim_all_guest_brackets_from_cookies($userDb, (int) $userId);
    if ($fromCookies !== []) {
        $claimed = array_values(array_unique(array_merge($claimed, $fromCookies)));
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'claimed' => $claimed,
            'failed' => $failed,
            'count' => count($claimed),
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    bracket_json_error('Ошибка сервера', 500);
}
