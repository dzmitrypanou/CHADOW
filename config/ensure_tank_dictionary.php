<?php
require_once __DIR__ . '/runtime_flags.php';

function ensure_tank_dictionary_table($db) {
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
        'CREATE TABLE IF NOT EXISTS tank_dictionary (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            vehicle_code VARCHAR(128) NOT NULL,
            display_name_ru VARCHAR(255) NOT NULL,
            display_name_en VARCHAR(255) NOT NULL DEFAULT \'\',
            nation VARCHAR(40) NOT NULL DEFAULT \'unknown\',
            tank_type VARCHAR(40) NOT NULL DEFAULT \'medium\',
            tier TINYINT UNSIGNED NOT NULL DEFAULT 8,
            is_premium TINYINT(1) NOT NULL DEFAULT 0,
            is_collectible TINYINT(1) NOT NULL DEFAULT 0,
            is_moderated TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY vehicle_code_unique (vehicle_code),
            KEY nation_idx (nation),
            KEY moderated_idx (is_moderated)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}
