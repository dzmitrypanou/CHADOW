<?php
require_once __DIR__ . '/ensure_site_users.php';
require_once __DIR__ . '/runtime_flags.php';

function ensure_clan_reserves_tables($db): void {
    static $ensured = false;
    if ($ensured) {
        return;
    }
    $ensured = true;

    if (chadow_runtime_schema_checks_enabled()) {
        ensure_site_users_table($db);
    }

    $pdo = $db->getConnection();
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS site_user_game_tokens (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            provider ENUM(\'wg\', \'lesta\') NOT NULL,
            realm ENUM(\'eu\', \'na\', \'ru\', \'asia\') NOT NULL,
            account_id BIGINT UNSIGNED NOT NULL,
            nickname VARCHAR(128) NULL,
            access_token_enc TEXT NOT NULL,
            expires_at INT UNSIGNED NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_user_provider_realm_account (user_id, provider, realm, account_id),
            INDEX idx_user (user_id),
            INDEX idx_user_provider_realm (user_id, provider, realm),
            INDEX idx_expires (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    clan_reserve_migrate_schema($pdo);

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS clan_reserve_rules (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            link_id INT UNSIGNED NULL,
            provider ENUM(\'wg\', \'lesta\') NOT NULL,
            realm ENUM(\'eu\', \'na\', \'ru\', \'asia\') NOT NULL,
            reserve_type VARCHAR(64) NOT NULL,
            reserve_level TINYINT UNSIGNED NOT NULL,
            time_local TIME NOT NULL,
            days_mask TINYINT UNSIGNED NOT NULL DEFAULT 127,
            timezone VARCHAR(64) NOT NULL DEFAULT \'Europe/Moscow\',
            enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,
            paused_no_stock TINYINT UNSIGNED NOT NULL DEFAULT 0,
            last_run_at TIMESTAMP NULL,
            last_status VARCHAR(32) NULL,
            last_error VARCHAR(512) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user_enabled (user_id, enabled),
            INDEX idx_link (link_id),
            INDEX idx_enabled (enabled)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS clan_reserve_clan_cache (
            link_id INT UNSIGNED NOT NULL PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            nickname VARCHAR(128) NULL,
            clan_id BIGINT UNSIGNED NULL,
            tag VARCHAR(16) NULL,
            name VARCHAR(128) NULL,
            emblem_url VARCHAR(512) NULL,
            no_clan TINYINT UNSIGNED NOT NULL DEFAULT 0,
            fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user (user_id),
            INDEX idx_fetched (fetched_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS clan_reserve_activation_log (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            rule_id INT UNSIGNED NULL,
            provider ENUM(\'wg\', \'lesta\') NOT NULL,
            realm ENUM(\'eu\', \'na\', \'ru\', \'asia\') NOT NULL,
            reserve_type VARCHAR(64) NOT NULL,
            reserve_level TINYINT UNSIGNED NOT NULL,
            trigger_type ENUM(\'manual\', \'schedule\') NOT NULL DEFAULT \'manual\',
            status VARCHAR(32) NOT NULL,
            error_message VARCHAR(512) NULL,
            activated_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_created (user_id, created_at),
            INDEX idx_rule (rule_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function clan_reserve_migrate_schema(PDO $pdo): void {
    static $migrated = false;
    if ($migrated) {
        return;
    }
    $migrated = true;

    $columnExists = static function (string $table, string $column) use ($pdo): bool {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        );
        $stmt->execute([$table, $column]);

        return (int) $stmt->fetchColumn() > 0;
    };

    $indexExists = static function (string $table, string $indexName) use ($pdo): bool {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?'
        );
        $stmt->execute([$table, $indexName]);

        return (int) $stmt->fetchColumn() > 0;
    };

    if (!$columnExists('site_user_game_tokens', 'nickname')) {
        try {
            $pdo->exec('ALTER TABLE site_user_game_tokens ADD COLUMN nickname VARCHAR(128) NULL AFTER account_id');
        } catch (Throwable $e) {
            error_log('clan_reserve_migrate_schema nickname: ' . $e->getMessage());
        }
    }

    foreach (['site_user_game_tokens', 'clan_reserve_rules', 'clan_reserve_activation_log'] as $table) {
        try {
            $pdo->exec(
                "ALTER TABLE {$table} MODIFY COLUMN realm ENUM('eu', 'na', 'ru', 'asia') NOT NULL"
            );
        } catch (Throwable $e) {
            error_log('clan_reserve_migrate_schema realm enum ' . $table . ': ' . $e->getMessage());
        }
    }

    if (!$columnExists('clan_reserve_rules', 'link_id')) {
        try {
            $pdo->exec('ALTER TABLE clan_reserve_rules ADD COLUMN link_id INT UNSIGNED NULL AFTER user_id');
            $pdo->exec('ALTER TABLE clan_reserve_rules ADD INDEX idx_link (link_id)');
        } catch (Throwable $e) {
            error_log('clan_reserve_migrate_schema link_id: ' . $e->getMessage());
        }
    }

    if (!$columnExists('clan_reserve_rules', 'paused_no_stock')) {
        try {
            $pdo->exec(
                'ALTER TABLE clan_reserve_rules ADD COLUMN paused_no_stock TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER enabled'
            );
        } catch (Throwable $e) {
            error_log('clan_reserve_migrate_schema paused_no_stock: ' . $e->getMessage());
        }
    }

    if ($indexExists('site_user_game_tokens', 'uk_user_provider_realm')) {
        try {
            $pdo->exec('ALTER TABLE site_user_game_tokens DROP INDEX uk_user_provider_realm');
        } catch (Throwable $e) {
            error_log('clan_reserve_migrate_schema drop uk_user_provider_realm: ' . $e->getMessage());
        }
    }

    if (!$indexExists('site_user_game_tokens', 'uk_user_provider_realm_account')) {
        try {
            $pdo->exec(
                'ALTER TABLE site_user_game_tokens ADD UNIQUE KEY uk_user_provider_realm_account (user_id, provider, realm, account_id)'
            );
        } catch (Throwable $e) {
            error_log('clan_reserve_migrate_schema multi account unique: ' . $e->getMessage());
        }
    }
}
