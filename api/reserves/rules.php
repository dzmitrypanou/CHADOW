<?php
require_once __DIR__ . '/bootstrap.php';

$profile = reserves_require_user();
$userId = (int) ($profile['id'] ?? 0);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $filterLinkId = (int) ($_GET['link_id'] ?? 0);
    $filterProvider = trim((string) ($_GET['provider'] ?? ''));
    $filterRealm = trim((string) ($_GET['realm'] ?? ''));
    $params = [$userId];
    $where = 'user_id = ?';
    if ($filterLinkId > 0) {
        $where .= ' AND link_id = ?';
        $params[] = $filterLinkId;
    } elseif ($filterProvider !== '' && $filterRealm !== '') {
        $where .= ' AND provider = ? AND realm = ?';
        $params[] = clan_reserve_normalize_provider($filterProvider);
        $params[] = clan_reserve_realm_for_provider($filterProvider, $filterRealm);
    }

    $rows = $userDb->fetchAll(
        'SELECT * FROM clan_reserve_rules WHERE ' . $where . ' ORDER BY id ASC',
        $params
    );
    $rules = [];
    foreach ($rows as $row) {
        if (is_array($row)) {
            $rules[] = clan_reserve_format_rule_row($row);
        }
    }

    $logRows = $userDb->fetchAll(
        'SELECT reserve_type, reserve_level, trigger_type, status, error_message, activated_at, created_at, provider, realm
         FROM clan_reserve_activation_log
         WHERE ' . $where . '
         ORDER BY id DESC
         LIMIT 20',
        $params
    );

    echo json_encode([
        'success' => true,
        'data' => [
            'rules' => $rules,
            'log' => is_array($logRows) ? $logRows : [],
        ],
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

if ($method === 'POST') {
    if (!user_csrf_verify()) {
        reserves_json_error($isEn
            ? 'Session expired. Refresh the page and try again.'
            : 'Сессия устарела. Обновите страницу и попробуйте снова.', 403);
    }

    $ctx = reserves_user_context($profile);
    $input = reserves_read_json_input();
    $activeLink = reserves_parse_active_link($profile, $input);

    $ruleId = (int) ($input['id'] ?? 0);
    $reserveType = trim((string) ($input['reserve_type'] ?? ''));
    $reserveLevel = (int) ($input['reserve_level'] ?? 0);
    $timeLocal = trim((string) ($input['time_local'] ?? ''));
    $days = is_array($input['days'] ?? null) ? $input['days'] : [];
    $enabled = !array_key_exists('enabled', $input) || !empty($input['enabled']);

    if ($reserveType === '' || $reserveLevel <= 0) {
        reserves_json_error($isEn ? 'Select reserve type and level.' : 'Выберите тип и уровень резерва.');
    }
    if (!preg_match('/^\d{1,2}:\d{2}$/', $timeLocal)) {
        reserves_json_error($isEn ? 'Invalid time format.' : 'Некорректный формат времени.');
    }

    $parts = explode(':', $timeLocal);
    $hour = (int) ($parts[0] ?? 0);
    $minute = (int) ($parts[1] ?? 0);
    if ($hour > 23 || $minute > 59) {
        reserves_json_error($isEn ? 'Invalid time.' : 'Некорректное время.');
    }
    $timeSql = sprintf('%02d:%02d:00', $hour, $minute);
    $daysMask = clan_reserve_mask_from_days($days);
    $linkId = (int) ($activeLink['link_id'] ?? 0);
    $provider = (string) $activeLink['provider'];
    $realm = (string) $activeLink['realm'];

    if ($ruleId > 0) {
        $existing = $userDb->fetchOne(
            'SELECT id FROM clan_reserve_rules WHERE id = ? AND user_id = ? LIMIT 1',
            [$ruleId, $userId]
        );
        if (!is_array($existing)) {
            reserves_json_error($isEn ? 'Rule not found.' : 'Правило не найдено.', 404);
        }
        $userDb->update(
            'UPDATE clan_reserve_rules
             SET link_id = ?, provider = ?, realm = ?, reserve_type = ?, reserve_level = ?, time_local = ?, days_mask = ?, enabled = ?
             WHERE id = ? AND user_id = ?',
            [
                $linkId > 0 ? $linkId : null,
                $provider,
                $realm,
                $reserveType,
                max(1, min(10, $reserveLevel)),
                $timeSql,
                $daysMask,
                $enabled ? 1 : 0,
                $ruleId,
                $userId,
            ]
        );
        $savedId = $ruleId;
    } else {
        $savedId = (int) $userDb->insert(
            'INSERT INTO clan_reserve_rules
             (user_id, link_id, provider, realm, reserve_type, reserve_level, time_local, days_mask, enabled)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $userId,
                $linkId > 0 ? $linkId : null,
                $provider,
                $realm,
                $reserveType,
                max(1, min(10, $reserveLevel)),
                $timeSql,
                $daysMask,
                $enabled ? 1 : 0,
            ]
        );
    }

    $row = $userDb->fetchOne('SELECT * FROM clan_reserve_rules WHERE id = ? AND user_id = ? LIMIT 1', [$savedId, $userId]);

    echo json_encode([
        'success' => true,
        'data' => is_array($row) ? clan_reserve_format_rule_row($row) : null,
        'message' => $isEn ? 'Schedule saved.' : 'Расписание сохранено.',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

if ($method === 'DELETE') {
    if (!user_csrf_verify()) {
        reserves_json_error($isEn
            ? 'Session expired. Refresh the page and try again.'
            : 'Сессия устарела. Обновите страницу и попробуйте снова.', 403);
    }

    $input = reserves_read_json_input();
    $ruleId = (int) ($input['id'] ?? ($_GET['id'] ?? 0));
    if ($ruleId <= 0) {
        reserves_json_error($isEn ? 'Rule id required.' : 'Укажите id правила.');
    }

    $userDb->update(
        'DELETE FROM clan_reserve_rules WHERE id = ? AND user_id = ?',
        [$ruleId, $userId]
    );

    echo json_encode([
        'success' => true,
        'message' => $isEn ? 'Schedule deleted.' : 'Расписание удалено.',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

reserves_json_error($isEn ? 'Method not allowed' : 'Метод не поддерживается', 405);
