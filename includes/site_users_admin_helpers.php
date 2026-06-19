<?php

if (!function_exists('ensure_site_users_table')) {
    require_once __DIR__ . '/../config/ensure_site_users.php';
}

function site_users_admin_auth_label(string $provider): string
{
    return $provider === 'wg' ? 'Wargaming' : 'Сайт (email)';
}

function site_users_admin_linked_accounts(array $row): string
{
    $parts = [];

    $lestaId = (int) ($row['lesta_account_id'] ?? 0);
    $lestaNick = trim((string) ($row['lesta_nickname'] ?? ''));
    if ($lestaId > 0 || $lestaNick !== '') {
        $parts[] = 'LESTA: ' . ($lestaNick !== '' ? $lestaNick : '#' . $lestaId);
    }

    $wgId = (int) ($row['wg_account_id'] ?? 0);
    $wgNick = trim((string) ($row['wg_nickname'] ?? ''));
    $wgRealm = trim((string) ($row['wg_realm'] ?? ''));
    if ($wgId > 0 || $wgNick !== '') {
        $realm = $wgRealm !== '' ? strtoupper($wgRealm) . ' ' : '';
        $parts[] = 'WG ' . $realm . ($wgNick !== '' ? $wgNick : '#' . $wgId);
    }

    foreach (['ru' => 'game_nickname_ru', 'eu' => 'game_nickname_eu', 'na' => 'game_nickname_na', 'asia' => 'game_nickname_asia'] as $realm => $column) {
        $nick = trim((string) ($row[$column] ?? ''));
        if ($nick !== '') {
            $parts[] = strtoupper($realm) . ' nick: ' . $nick;
        }
    }

    return $parts !== [] ? implode(' · ', $parts) : '—';
}

function site_users_admin_fetch_stats($db): array
{
    ensure_site_users_table($db);

    try {
        $row = $db->fetchOne(
            'SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS blocked,
                SUM(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) AS last24h
             FROM site_users'
        );
        return [
            'total' => (int) ($row['total'] ?? 0),
            'active' => (int) ($row['active'] ?? 0),
            'blocked' => (int) ($row['blocked'] ?? 0),
            'last24h' => (int) ($row['last24h'] ?? 0),
        ];
    } catch (Throwable $e) {
        return ['total' => 0, 'active' => 0, 'blocked' => 0, 'last24h' => 0];
    }
}

function site_users_admin_fetch_users($db, array $filters = []): array
{
    ensure_site_users_table($db);

    $search = isset($filters['q']) ? trim((string) $filters['q']) : '';
    $provider = isset($filters['provider']) ? trim((string) $filters['provider']) : '';
    $active = isset($filters['active']) ? trim((string) $filters['active']) : '';
    $page = max(1, (int) ($filters['page'] ?? 1));
    $perPage = max(10, min(100, (int) ($filters['per_page'] ?? 50)));
    $offset = ($page - 1) * $perPage;

    if ($provider !== '' && !in_array($provider, ['local', 'wg'], true)) {
        return ['success' => false, 'error' => 'invalid_provider'];
    }
    if ($active !== '' && !in_array($active, ['1', '0'], true)) {
        return ['success' => false, 'error' => 'invalid_active'];
    }

    $where = ['1=1'];
    $params = [];

    if ($provider !== '') {
        $where[] = 'auth_provider = ?';
        $params[] = $provider;
    }
    if ($active === '1') {
        $where[] = 'is_active = 1';
    } elseif ($active === '0') {
        $where[] = 'is_active = 0';
    }
    if ($search !== '') {
        $like = '%' . $search . '%';
        $where[] = '(username LIKE ? OR email LIKE ? OR wg_nickname LIKE ? OR lesta_nickname LIKE ?
            OR game_nickname_ru LIKE ? OR game_nickname_eu LIKE ? OR game_nickname_na LIKE ? OR game_nickname_asia LIKE ?)';
        array_push($params, $like, $like, $like, $like, $like, $like, $like, $like);
    }

    $whereSql = implode(' AND ', $where);

    try {
        $countRow = $db->fetchOne('SELECT COUNT(*) AS c FROM site_users WHERE ' . $whereSql, $params);
        $total = (int) ($countRow['c'] ?? 0);
        $pages = max(1, (int) ceil($total / $perPage));
        if ($page > $pages) {
            $page = $pages;
            $offset = ($page - 1) * $perPage;
        }

        $sql = 'SELECT id, username, email, auth_provider, is_active, email_verified,
                       wg_account_id, wg_nickname, wg_realm,
                       lesta_account_id, lesta_nickname,
                       game_nickname_ru, game_nickname_eu, game_nickname_na, game_nickname_asia,
                       created_at, updated_at
                FROM site_users
                WHERE ' . $whereSql . '
                ORDER BY id DESC
                LIMIT ' . (int) $perPage . ' OFFSET ' . (int) $offset;

        $rows = $db->fetchAll($sql, $params);
        $data = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $providerValue = (string) ($row['auth_provider'] ?? 'local');
            $data[] = [
                'id' => (int) ($row['id'] ?? 0),
                'username' => (string) ($row['username'] ?? ''),
                'email' => (string) ($row['email'] ?? ''),
                'auth_provider' => $providerValue,
                'auth_label' => site_users_admin_auth_label($providerValue),
                'is_active' => (int) ($row['is_active'] ?? 0) === 1,
                'email_verified' => (int) ($row['email_verified'] ?? 0) === 1,
                'linked_label' => site_users_admin_linked_accounts($row),
                'created_at' => (string) ($row['created_at'] ?? ''),
                'updated_at' => (string) ($row['updated_at'] ?? ''),
            ];
        }

        return [
            'success' => true,
            'data' => $data,
            'stats' => site_users_admin_fetch_stats($db),
            'pagination' => [
                'page' => $page,
                'pages' => $pages,
                'per_page' => $perPage,
                'total' => $total,
            ],
        ];
    } catch (Throwable $e) {
        return ['success' => false, 'error' => 'db_error'];
    }
}

function site_users_admin_set_active($db, int $userId, bool $active): array
{
    ensure_site_users_table($db);

    if ($userId <= 0) {
        return ['success' => false, 'error' => 'invalid_id'];
    }

    $row = $db->fetchOne('SELECT id, username, is_active FROM site_users WHERE id = ?', [$userId]);
    if (!$row) {
        return ['success' => false, 'error' => 'not_found'];
    }

    $db->query('UPDATE site_users SET is_active = ? WHERE id = ?', [$active ? 1 : 0, $userId]);

    return [
        'success' => true,
        'id' => $userId,
        'username' => (string) ($row['username'] ?? ''),
        'is_active' => $active,
    ];
}
