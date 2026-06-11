<?php
require_once __DIR__ . '/runtime_flags.php';

function ensure_wot_online_cache_table($db): void
{
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
        'CREATE TABLE IF NOT EXISTS wot_online_cache (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            data_json LONGTEXT NULL,
            charts_json LONGTEXT NULL,
            fetched_at DATETIME NULL,
            fetch_status VARCHAR(16) NOT NULL DEFAULT \'pending\',
            fetch_error TEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $hasFetchLog = $db->fetchOne(
        "SHOW COLUMNS FROM wot_online_cache LIKE 'fetch_log_json'"
    );
    if (!$hasFetchLog) {
        $pdo->exec('ALTER TABLE wot_online_cache ADD COLUMN fetch_log_json LONGTEXT NULL');
    }

    $hasUptime = $db->fetchOne(
        "SHOW COLUMNS FROM wot_online_cache LIKE 'uptime_json'"
    );
    if (!$hasUptime) {
        $pdo->exec('ALTER TABLE wot_online_cache ADD COLUMN uptime_json LONGTEXT NULL');
    }
}
