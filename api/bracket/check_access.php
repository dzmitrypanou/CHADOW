<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../../includes/lang.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bracket_json_error('Метод не поддерживается', 405);
}

user_require_csrf_ajax();

$lang = abs_detect_lang();
$input = bracket_read_json_input();
$publicId = trim((string) ($input['public_id'] ?? ''));
$editToken = bracket_resolve_edit_token(
    $publicId,
    isset($input['edit_token']) ? trim((string) $input['edit_token']) : null
);

if (!bracket_public_id_valid($publicId)) {
    bracket_json_error($lang === 'en' ? 'Invalid bracket ID' : 'Некорректный идентификатор');
}

$userId = user_current_id();

try {
    $row = $userDb->fetchOne(
        'SELECT id, public_id, user_id, edit_token, status FROM tournament_brackets WHERE public_id = ?',
        [$publicId]
    );
    if (!$row) {
        bracket_json_error($lang === 'en' ? 'Bracket not found' : 'Сетка не найдена', 404);
    }

    $ownerId = bracket_row_owner_id($row);
    $isLoggedOwner = $userId !== null && $ownerId !== null && $ownerId === $userId;
    $claimed = false;

    if ($isLoggedOwner) {
        echo json_encode([
            'success' => true,
            'data' => [
                'can_edit' => true,
                'is_logged_owner' => true,
                'is_guest_owned' => false,
                'claimed' => false,
            ],
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if (bracket_is_guest_owned($row) && $userId !== null && bracket_edit_token_valid($row, $editToken)) {
        $claim = bracket_claim_guest_bracket($userDb, $publicId, $userId, (string) $editToken);
        if ($claim['ok']) {
            $isLoggedOwner = true;
            $claimed = empty($claim['already_owned']);
        }
    }

    if ($isLoggedOwner) {
        echo json_encode([
            'success' => true,
            'data' => [
                'can_edit' => true,
                'is_logged_owner' => true,
                'is_guest_owned' => false,
                'claimed' => $claimed,
            ],
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $ownerCheck = bracket_assert_owner($userDb, $row, $userId, $editToken);

    echo json_encode([
        'success' => true,
        'data' => [
            'can_edit' => $ownerCheck['ok'],
            'is_logged_owner' => false,
            'is_guest_owned' => bracket_is_guest_owned($row),
            'claimed' => false,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    bracket_json_error('Ошибка сервера', 500);
}
