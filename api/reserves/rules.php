<?php
require_once __DIR__ . '/bootstrap.php';

$profile = reserves_require_user();
$userId = (int) ($profile['id'] ?? 0);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $filterLinkId = (int) ($_GET['link_id'] ?? 0);
    $filterProvider = trim((string) ($_GET['provider'] ?? ''));
    $filterRealm = trim((string) ($_GET['realm'] ?? ''));

    $rulesParams = [$userId];
    $rulesWhere = 'user_id = ?';

    if ($filterLinkId > 0) {
        $link = clan_reserve_fetch_token_by_id($userDb, $userId, $filterLinkId);
        if (is_array($link)) {
            $provider = clan_reserve_normalize_provider((string) ($link['provider'] ?? 'wg'));
            $realm = clan_reserve_realm_for_provider($provider, (string) ($link['realm'] ?? 'eu'));
            $rulesWhere .= ' AND (link_id = ? OR (link_id IS NULL AND provider = ? AND realm = ?))';
            $rulesParams[] = $filterLinkId;
            $rulesParams[] = $provider;
            $rulesParams[] = $realm;

        } else {
            $rulesWhere .= ' AND link_id = ?';
            $rulesParams[] = $filterLinkId;
        }
    } elseif ($filterProvider !== '' && $filterRealm !== '') {
        $provider = clan_reserve_normalize_provider($filterProvider);
        $realm = clan_reserve_realm_for_provider($provider, $filterRealm);
        $rulesWhere .= ' AND provider = ? AND realm = ?';
        $rulesParams[] = $provider;
        $rulesParams[] = $realm;
    }

    $logFilter = clan_reserve_build_log_filter(
        $userDb,
        $userId,
        $filterLinkId,
        $filterProvider,
        $filterRealm
    );

    clan_reserve_heal_enabled_rules_links($userDb, $userId);

    $rows = $userDb->fetchAll(
        'SELECT * FROM clan_reserve_rules WHERE ' . $rulesWhere . ' ORDER BY id ASC',
        $rulesParams
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
         WHERE ' . $logFilter['where'] . '
         ORDER BY id DESC
         LIMIT 20',
        $logFilter['params']
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
    $reserveType = clan_reserve_normalize_reserve_type(trim((string) ($input['reserve_type'] ?? '')));
    $reserveLevel = (int) ($input['reserve_level'] ?? 0);
    $timeLocal = trim((string) ($input['time_local'] ?? ''));
    $days = is_array($input['days'] ?? null) ? $input['days'] : [];
    $enabled = !array_key_exists('enabled', $input) || !empty($input['enabled']);

    if ($reserveType === '' || $reserveLevel <= 0) {
        reserves_json_error($isEn ? 'Select reserve type and level.' : 'Выберите тип и уровень резерва.');
    }
    if (!preg_match('/^\d{1,2}:\d{2}(:\d{2})?$/', $timeLocal)) {
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

    if ($linkId > 0) {
        $service = new ClanReserveService($userDb);
        $token = clan_reserve_get_valid_token($userDb, $userId, $linkId);
        if ($token['ok']) {
            $catalog = $service->fetchClanReserves(
                (string) ($token['access_token'] ?? ''),
                $realm,
                $lang,
                trim((string) ($token['application_id'] ?? '')) ?: null
            );
            if (!empty($catalog['ok'])) {
                $service->syncRulesStockState(
                    $userId,
                    $linkId,
                    $provider,
                    $realm,
                    is_array($catalog['items'] ?? null) ? $catalog['items'] : []
                );
                $row = $userDb->fetchOne('SELECT * FROM clan_reserve_rules WHERE id = ? AND user_id = ? LIMIT 1', [$savedId, $userId]);
            }
        }
    }

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
