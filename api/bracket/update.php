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
if (!bracket_public_id_valid($publicId)) {
    bracket_json_error($lang === 'en' ? 'Invalid bracket ID' : 'Некорректный идентификатор');
}

$editToken = bracket_resolve_edit_token(
    $publicId,
    isset($input['edit_token']) ? trim((string) $input['edit_token']) : null
);
$userId = user_current_id();

try {
    $existing = $userDb->fetchOne(
        'SELECT ' . bracket_sql_select_columns('b') . ', b.edit_token FROM tournament_brackets b WHERE b.public_id = ?',
        [$publicId]
    );
    if (!$existing) {
        bracket_json_error($lang === 'en' ? 'Bracket not found' : 'Сетка не найдена', 404);
    }

    $ownerCheck = bracket_assert_owner($userDb, $existing, $userId, $editToken);
    if (!$ownerCheck['ok']) {
        bracket_json_error($ownerCheck['error'] ?? 'Нет прав', 403);
    }

    $existingData = bracket_parse_bracket_data($existing);
    $participantHint = count($existingData['participants'] ?? []);

    if (!empty($existing['completed_at']) && isset($input['bracket_data'])) {
        bracket_json_error($lang === 'en' ? 'Tournament completed — reopen to edit results' : 'Турнир завершён — откройте заново для правки результатов', 403);
    }

    $validation = bracket_validate_update_input(
        $input,
        $lang,
        $participantHint,
        (string) ($existing['format'] ?? 'single'),
        $existingData
    );
    if (!$validation['ok']) {
        bracket_json_error($validation['error'] ?? 'Некорректные данные');
    }

    $updates = $validation['data'];
    $sets = [];
    $params = [];

    foreach (['title', 'visibility', 'description', 'starts_at', 'match_format', 'game', 'game_realm'] as $field) {
        if (array_key_exists($field, $updates)) {
            $sets[] = $field . ' = ?';
            $params[] = $updates[$field];
        }
    }

    if (isset($updates['bracket_data'])) {
        $sets[] = 'bracket_data = ?';
        $params[] = json_encode($updates['bracket_data'], JSON_UNESCAPED_UNICODE);
    }

    if (array_key_exists('prize_pool', $updates)) {
        $sets[] = 'prize_pool = ?';
        $params[] = json_encode($updates['prize_pool'], JSON_UNESCAPED_UNICODE);
    }

    if (array_key_exists('completed_at', $updates)) {
        if ($updates['completed_at'] === 'NOW') {
            $sets[] = 'completed_at = NOW()';
        } else {
            $sets[] = 'completed_at = ?';
            $params[] = $updates['completed_at'];
        }
    }

    if ($sets === []) {
        bracket_json_error($lang === 'en' ? 'Nothing to update' : 'Нет данных для обновления');
    }

    $params[] = $publicId;
    $userDb->update(
        'UPDATE tournament_brackets SET ' . implode(', ', $sets) . ' WHERE public_id = ?',
        $params
    );

    $row = $userDb->fetchOne(
        'SELECT ' . bracket_sql_select_columns('b') . ' FROM tournament_brackets b WHERE b.public_id = ?',
        [$publicId]
    );

    echo json_encode([
        'success' => true,
        'data' => bracket_format_item($row, true, true),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    bracket_json_error('Ошибка сервера', 500);
}
