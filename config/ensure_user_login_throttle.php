<?php
require_once __DIR__ . '/runtime_flags.php';
/**
 * Ограничение частоты попыток входа/регистрации публичных пользователей по IP.
 *
 * @param Database $db
 */
function ensure_site_login_throttle_table($db) {
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
        'CREATE TABLE IF NOT EXISTS site_login_throttle (
            ip_key CHAR(64) NOT NULL PRIMARY KEY,
            fail_count INT UNSIGNED NOT NULL DEFAULT 0,
            window_start INT UNSIGNED NOT NULL,
            locked_until INT UNSIGNED NOT NULL DEFAULT 0,
            INDEX idx_locked (locked_until)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}
