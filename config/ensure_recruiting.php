<?php
require_once __DIR__ . '/ensure_site_users.php';
require_once __DIR__ . '/runtime_flags.php';

function ensure_recruiting_posts_table($db) {
    static $ensured = false;
    if ($ensured) {
        return;
    }
    $ensured = true;
    if (!chadow_runtime_schema_checks_enabled()) {
        return;
    }

    ensure_site_users_table($db);

    $pdo = $db->getConnection();
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS recruiting_posts (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NULL,
            post_type ENUM(
                \'clan_seeks_players\',
                \'team_seeks_players\',
                \'player_seeks_clan\',
                \'player_seeks_team\'
            ) NOT NULL,
            realm ENUM(\'ru\', \'eu\', \'na\', \'asia\') NOT NULL,
            title VARCHAR(120) NOT NULL,
            body TEXT NOT NULL,
            contact VARCHAR(255) NULL,
            clan_tag VARCHAR(64) NULL,
            clan_tag_type ENUM(\'clan_tag\', \'team_name\') NULL,
            game_nickname VARCHAR(64) NULL,
            status ENUM(\'pending\', \'approved\', \'rejected\', \'hidden\') NOT NULL DEFAULT \'pending\',
            moderation_note VARCHAR(500) NULL,
            moderated_by INT UNSIGNED NULL,
            moderated_at TIMESTAMP NULL,
            published_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_status_created (status, created_at),
            INDEX idx_status_published (status, published_at),
            INDEX idx_user (user_id),
            INDEX idx_realm_type (realm, post_type),
            INDEX idx_published (published_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    ensure_recruiting_posts_columns($pdo);
}

function recruiting_posts_existing_columns($pdo): array {
    $columns = [];
    try {
        $stmt = $pdo->query('SHOW COLUMNS FROM recruiting_posts');
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

function recruiting_posts_existing_indexes($pdo): array {
    $indexes = [];
    try {
        $stmt = $pdo->query('SHOW INDEX FROM recruiting_posts');
        if ($stmt) {
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $name = (string) ($row['Key_name'] ?? '');
                if ($name !== '') {
                    $indexes[$name] = true;
                }
            }
        }
    } catch (Throwable $e) {
        return [];
    }

    return $indexes;
}

function ensure_recruiting_posts_columns($pdo): void {
    $columns = recruiting_posts_existing_columns($pdo);
    if ($columns === []) {
        return;
    }

    $addColumn = static function (string $column, string $definition) use ($pdo, &$columns): void {
        if (isset($columns[$column])) {
            return;
        }
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $column)) {
            return;
        }
        try {
            $pdo->exec('ALTER TABLE recruiting_posts ADD COLUMN ' . $column . ' ' . $definition);
            $columns[$column] = true;
        } catch (Throwable $e) {

        }
    };

    $addColumn('user_id', 'INT UNSIGNED NOT NULL AFTER id');
    $addColumn('post_type', "ENUM(
        'clan_seeks_players',
        'team_seeks_players',
        'player_seeks_clan',
        'player_seeks_team'
    ) NOT NULL AFTER user_id");
    $addColumn('realm', "ENUM('ru', 'eu', 'na') NOT NULL AFTER post_type");
    $addColumn('title', 'VARCHAR(120) NOT NULL AFTER realm');
    $addColumn('body', 'TEXT NOT NULL AFTER title');
    $addColumn('contact', 'VARCHAR(255) NULL AFTER body');
    $addColumn('clan_tag', 'VARCHAR(16) NULL AFTER contact');
    $addColumn('clan_tag_type', "ENUM('clan_tag', 'team_name') NULL AFTER clan_tag");
    $addColumn('game_nickname', 'VARCHAR(64) NULL AFTER clan_tag_type');
    $addColumn('status', "ENUM('pending', 'approved', 'rejected', 'hidden') NOT NULL DEFAULT 'pending' AFTER game_nickname");
    $addColumn('moderation_note', 'VARCHAR(500) NULL AFTER status');
    $addColumn('moderated_by', 'INT UNSIGNED NULL AFTER moderation_note');
    $addColumn('moderated_at', 'TIMESTAMP NULL AFTER moderated_by');
    $addColumn('published_at', 'TIMESTAMP NULL AFTER moderated_at');
    $addColumn('created_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
    $addColumn('updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

    $indexes = recruiting_posts_existing_indexes($pdo);
    $addIndex = static function (string $name, string $definition) use ($pdo, &$indexes): void {
        if (isset($indexes[$name])) {
            return;
        }
        try {
            $pdo->exec('ALTER TABLE recruiting_posts ADD INDEX ' . $name . ' ' . $definition);
            $indexes[$name] = true;
        } catch (Throwable $e) {

        }
    };

    $addIndex('idx_status_created', '(status, created_at)');
    $addIndex('idx_status_published', '(status, published_at)');
    $addIndex('idx_user', '(user_id)');
    $addIndex('idx_realm_type', '(realm, post_type)');
    $addIndex('idx_published', '(published_at)');

    try {
        $pdo->exec("ALTER TABLE recruiting_posts MODIFY COLUMN realm ENUM('ru', 'eu', 'na', 'asia') NOT NULL");
    } catch (Throwable $e) {

    }

    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM recruiting_posts LIKE 'contact'");
        $contactCol = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : false;
        $contactType = strtolower((string) ($contactCol['Type'] ?? ''));
        if ($contactType !== '' && $contactType !== 'text') {
            $pdo->exec('ALTER TABLE recruiting_posts MODIFY COLUMN contact TEXT NULL');
        }
    } catch (Throwable $e) {

    }

    try {
        $pdo->exec('ALTER TABLE recruiting_posts MODIFY COLUMN user_id INT UNSIGNED NULL');
    } catch (Throwable $e) {

    }

    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM recruiting_posts LIKE 'clan_tag'");
        $clanTagCol = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : false;
        $clanTagType = (string) ($clanTagCol['Type'] ?? '');
        if ($clanTagType !== '' && stripos($clanTagType, 'varchar(64)') === false) {
            $pdo->exec('ALTER TABLE recruiting_posts MODIFY COLUMN clan_tag VARCHAR(64) NULL');
        }
    } catch (Throwable $e) {

    }
}
