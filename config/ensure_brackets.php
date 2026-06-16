<?php
require_once __DIR__ . '/ensure_site_users.php';
require_once __DIR__ . '/runtime_flags.php';

function ensure_brackets_table($db) {
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
        'CREATE TABLE IF NOT EXISTS tournament_brackets (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            public_id VARCHAR(16) NOT NULL,
            user_id INT UNSIGNED NULL,
            edit_token VARCHAR(255) NULL,
            title VARCHAR(120) NOT NULL,
            format ENUM(\'single\', \'double\', \'group\', \'group_se\', \'group_de\') NOT NULL,
            visibility ENUM(\'public\', \'hidden\') NOT NULL DEFAULT \'public\',
            status ENUM(\'active\', \'hidden\') NOT NULL DEFAULT \'active\',
            moderation_note VARCHAR(500) NULL,
            moderated_by INT UNSIGNED NULL,
            moderated_at TIMESTAMP NULL,
            bracket_data JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_public_id (public_id),
            INDEX idx_user (user_id),
            INDEX idx_status_visibility_updated (status, visibility, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    ensure_brackets_columns($pdo);
}

function brackets_existing_columns($pdo): array {
    $columns = [];
    try {
        $stmt = $pdo->query('SHOW COLUMNS FROM tournament_brackets');
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

function ensure_brackets_columns($pdo): void {
    $existing = brackets_existing_columns($pdo);

    $addColumn = static function (string $sql) use ($pdo): void {
        try {
            $pdo->exec($sql);
        } catch (Throwable $e) {

        }
    };

    if (!isset($existing['public_id'])) {
        $addColumn('ALTER TABLE tournament_brackets ADD COLUMN public_id VARCHAR(16) NOT NULL AFTER id');
    }
    if (!isset($existing['edit_token'])) {
        $addColumn('ALTER TABLE tournament_brackets ADD COLUMN edit_token VARCHAR(255) NULL AFTER user_id');
    }
    if (!isset($existing['moderation_note'])) {
        $addColumn('ALTER TABLE tournament_brackets ADD COLUMN moderation_note VARCHAR(500) NULL AFTER status');
    }
    if (!isset($existing['moderated_by'])) {
        $addColumn('ALTER TABLE tournament_brackets ADD COLUMN moderated_by INT UNSIGNED NULL AFTER moderation_note');
    }
    if (!isset($existing['moderated_at'])) {
        $addColumn('ALTER TABLE tournament_brackets ADD COLUMN moderated_at TIMESTAMP NULL AFTER moderated_by');
    }
    if (!isset($existing['description'])) {
        $addColumn('ALTER TABLE tournament_brackets ADD COLUMN description TEXT NULL AFTER title');
    }
    if (!isset($existing['starts_at'])) {
        $addColumn('ALTER TABLE tournament_brackets ADD COLUMN starts_at DATETIME NULL AFTER bracket_data');
    }
    if (!isset($existing['completed_at'])) {
        $addColumn('ALTER TABLE tournament_brackets ADD COLUMN completed_at DATETIME NULL AFTER starts_at');
    }
    if (!isset($existing['prize_pool'])) {
        $addColumn('ALTER TABLE tournament_brackets ADD COLUMN prize_pool JSON NULL AFTER completed_at');
    }
    if (!isset($existing['match_format'])) {
        $addColumn("ALTER TABLE tournament_brackets ADD COLUMN match_format ENUM('bo1', 'bo3', 'bo7', 'bo9') NOT NULL DEFAULT 'bo1' AFTER format");
    }
    if (!isset($existing['game'])) {
        $addColumn("ALTER TABLE tournament_brackets ADD COLUMN game ENUM('wot', 'csgo', 'dota2') NOT NULL DEFAULT 'wot' AFTER match_format");
    }
    if (!isset($existing['game_realm'])) {
        $addColumn("ALTER TABLE tournament_brackets ADD COLUMN game_realm ENUM('ru', 'eu', 'na', 'asia') NULL AFTER game");
    }

    ensure_brackets_format_enum($pdo);
}

function ensure_brackets_format_enum($pdo): void {
    try {
        $pdo->exec(
            "ALTER TABLE tournament_brackets MODIFY COLUMN format "
            . "ENUM('single', 'double', 'group', 'group_se', 'group_de') NOT NULL"
        );
    } catch (Throwable $e) {

    }

    try {
        $stmt = $pdo->query(
            "SELECT id, bracket_data FROM tournament_brackets WHERE format = 'group'"
        );
        if (!$stmt) {
            return;
        }

        $update = $pdo->prepare(
            "UPDATE tournament_brackets SET format = 'group_se' WHERE id = ?"
        );

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $raw = $row['bracket_data'] ?? null;
            if (!is_string($raw) || $raw === '') {
                continue;
            }
            $data = json_decode($raw, true);
            if (!is_array($data)) {
                continue;
            }
            if (!empty($data['settings']['playoffGenerated'])) {
                $update->execute([(int) ($row['id'] ?? 0)]);
            }
        }
    } catch (Throwable $e) {

    }
}
