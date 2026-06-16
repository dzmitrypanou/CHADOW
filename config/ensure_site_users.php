<?php
require_once __DIR__ . '/runtime_flags.php';

function ensure_site_users_table($db) {
    static $ensured = false;
    if ($ensured) {
        return;
    }
    $ensured = true;
    if (!chadow_runtime_schema_checks_enabled()) {
        return;
    }

    $pdo = $db->getConnection();
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS site_users (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(64) NOT NULL,
            email VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255) NULL,
            auth_provider ENUM(\'local\', \'wg\') NOT NULL DEFAULT \'local\',
            wg_account_id BIGINT UNSIGNED NULL,
            wg_nickname VARCHAR(64) NULL,
            wg_realm ENUM(\'ru\', \'eu\', \'na\') NULL,
            game_nickname_ru VARCHAR(64) NULL,
            game_nickname_eu VARCHAR(64) NULL,
            game_nickname_na VARCHAR(64) NULL,
            game_nickname_asia VARCHAR(64) NULL,
            email_verified TINYINT UNSIGNED NOT NULL DEFAULT 0,
            is_active TINYINT UNSIGNED NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY username_unique (username),
            UNIQUE KEY email_unique (email),
            UNIQUE KEY wg_account_realm_unique (wg_account_id, wg_realm),
            INDEX idx_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    ensure_site_users_columns($pdo);
}

function site_users_existing_columns($pdo): array {
    $columns = [];
    try {
        $stmt = $pdo->query('SHOW COLUMNS FROM site_users');
        if ($stmt) {
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $field = (string) ($row['Field'] ?? '');
                if ($field !== '') {
                    $columns[$field] = true;
                }
            }
        }
    } catch (Throwable $e) {
        return [];
    }
    return $columns;
}

function site_users_required_columns(): array {
    return ['username', 'email', 'password_hash', 'auth_provider', 'is_active'];
}

function site_users_schema_ready($pdo): bool {
    $columns = site_users_existing_columns($pdo);
    foreach (site_users_required_columns() as $column) {
        if (!isset($columns[$column])) {
            return false;
        }
    }
    return true;
}

function ensure_site_users_columns($pdo): void {
    $columns = site_users_existing_columns($pdo);

    $addColumn = static function (string $column, string $definition) use ($pdo, &$columns): void {
        if (isset($columns[$column])) {
            return;
        }
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $column)) {
            return;
        }
        try {
            $pdo->exec('ALTER TABLE site_users ADD COLUMN ' . $column . ' ' . $definition);
            $columns[$column] = true;
        } catch (Throwable $e) {

        }
    };

    $addColumn('username', 'VARCHAR(64) NOT NULL DEFAULT \'\'');
    $addColumn('email', 'VARCHAR(255) NOT NULL DEFAULT \'\'');
    $addColumn('password_hash', 'VARCHAR(255) NULL');
    $addColumn('auth_provider', "ENUM('local', 'wg') NOT NULL DEFAULT 'local'");
    $addColumn('wg_account_id', 'BIGINT UNSIGNED NULL');
    $addColumn('wg_nickname', 'VARCHAR(64) NULL');
    $addColumn('wg_realm', "ENUM('ru', 'eu', 'na') NULL");
    $addColumn('game_nickname_ru', 'VARCHAR(64) NULL');
    $addColumn('game_nickname_eu', 'VARCHAR(64) NULL');
    $addColumn('game_nickname_na', 'VARCHAR(64) NULL');
    $addColumn('game_nickname_asia', 'VARCHAR(64) NULL');
    $addColumn('lesta_account_id', 'BIGINT UNSIGNED NULL');
    $addColumn('lesta_nickname', 'VARCHAR(64) NULL');
    $addColumn('email_verified', 'TINYINT UNSIGNED NOT NULL DEFAULT 0');
    $addColumn('is_active', 'TINYINT UNSIGNED NOT NULL DEFAULT 1');
    $addColumn('created_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
    $addColumn('updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    $addColumn('recruiting_contact', 'VARCHAR(255) NULL');
    $addColumn('recruiting_clan_tag', 'VARCHAR(16) NULL');
    $addColumn('recruiting_team_name', 'VARCHAR(64) NULL');
    $addColumn('recruiting_clan_tag_type', "ENUM('clan_tag', 'team_name') NULL");
    $addColumn('recruiting_post_type', 'VARCHAR(32) NULL');
    $addColumn('recruiting_realm', "ENUM('ru', 'eu', 'na') NULL");

    try {
        $pdo->exec('ALTER TABLE site_users MODIFY COLUMN recruiting_contact TEXT NULL');
    } catch (Throwable $e) {

    }

    try {
        $pdo->exec('ALTER TABLE site_users MODIFY COLUMN recruiting_clan_tag VARCHAR(64) NULL');
    } catch (Throwable $e) {

    }

    try {
        $pdo->exec(
            "UPDATE site_users
             SET recruiting_team_name = recruiting_clan_tag
             WHERE recruiting_clan_tag_type = 'team_name'
               AND recruiting_clan_tag IS NOT NULL
               AND recruiting_clan_tag != ''
               AND (recruiting_team_name IS NULL OR recruiting_team_name = '')"
        );
        $pdo->exec(
            "UPDATE site_users
             SET recruiting_clan_tag = NULL
             WHERE recruiting_clan_tag_type = 'team_name'
               AND recruiting_team_name IS NOT NULL
               AND recruiting_team_name != ''"
        );
    } catch (Throwable $e) {

    }

    try {
        $pdo->exec("ALTER TABLE site_users MODIFY COLUMN wg_realm ENUM('ru', 'eu', 'na', 'asia') NULL");
    } catch (Throwable $e) {

    }

    try {
        $pdo->exec("ALTER TABLE site_users MODIFY COLUMN recruiting_realm ENUM('ru', 'eu', 'na', 'asia') NULL");
    } catch (Throwable $e) {

    }

    try {
        $pdo->exec('ALTER TABLE site_users ADD UNIQUE KEY username_unique (username)');
    } catch (Throwable $e) {

    }

    try {
        $pdo->exec('ALTER TABLE site_users ADD UNIQUE KEY email_unique (email)');
    } catch (Throwable $e) {

    }

    try {
        $pdo->exec('ALTER TABLE site_users ADD UNIQUE KEY wg_account_realm_unique (wg_account_id, wg_realm)');
    } catch (Throwable $e) {

    }

    try {
        $pdo->exec('ALTER TABLE site_users ADD UNIQUE KEY lesta_account_unique (lesta_account_id)');
    } catch (Throwable $e) {

    }

    try {
        $pdo->exec(
            'UPDATE site_users
             SET lesta_account_id = wg_account_id,
                 lesta_nickname = wg_nickname
             WHERE auth_provider = \'local\'
               AND wg_realm = \'ru\'
               AND wg_account_id IS NOT NULL
               AND (lesta_account_id IS NULL OR lesta_account_id = 0)'
        );
        $pdo->exec(
            'UPDATE site_users
             SET wg_account_id = NULL,
                 wg_nickname = NULL,
                 wg_realm = NULL
             WHERE auth_provider = \'local\'
               AND wg_realm = \'ru\'
               AND lesta_account_id IS NOT NULL'
        );
    } catch (Throwable $e) {

    }

    try {
        $pdo->exec('ALTER TABLE site_users ADD INDEX idx_active (is_active)');
    } catch (Throwable $e) {

    }
}
