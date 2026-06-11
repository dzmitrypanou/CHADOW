<?php
require_once __DIR__ . '/runtime_flags.php';

function ensure_site_settings_table($db): void
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
        'CREATE TABLE IF NOT EXISTS site_settings (
            setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
            setting_value TEXT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $stmt = $pdo->prepare('INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES (?, ?)');
    $stmt->execute(['replay_storage_enabled', '1']);
    $stmt->execute(['site_name_ru', 'Chadow']);
    $stmt->execute(['site_name_en', 'Chadow']);
    $stmt->execute(['wg_application_id', '']);
    $stmt->execute(['lesta_application_id', '']);
}

function get_site_setting($db, string $key, $default = null)
{
    if (!isset($GLOBALS['__chadow_site_setting_cache']) || !is_array($GLOBALS['__chadow_site_setting_cache'])) {
        $GLOBALS['__chadow_site_setting_cache'] = [];
    }
    $cache = &$GLOBALS['__chadow_site_setting_cache'];
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    ensure_site_settings_table($db);
    $row = $db->fetchOne('SELECT setting_value FROM site_settings WHERE setting_key = ?', [$key]);
    if (!$row || !array_key_exists('setting_value', $row)) {
        $cache[$key] = $default;
        return $default;
    }

    $cache[$key] = $row['setting_value'];
    return $cache[$key];
}

function set_site_setting($db, string $key, $value): void
{
    ensure_site_settings_table($db);
    $db->query(
        'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [$key, (string) $value]
    );
    if (!isset($GLOBALS['__chadow_site_setting_cache']) || !is_array($GLOBALS['__chadow_site_setting_cache'])) {
        $GLOBALS['__chadow_site_setting_cache'] = [];
    }
    $GLOBALS['__chadow_site_setting_cache'][$key] = (string) $value;
}

function is_replay_storage_enabled($db): bool
{
    return get_site_setting($db, 'replay_storage_enabled', '1') === '1';
}

function get_site_name($db, string $lang = 'ru'): string
{
    $lang = $lang === 'en' ? 'en' : 'ru';
    $key = $lang === 'en' ? 'site_name_en' : 'site_name_ru';
    $default = 'Chadow';
    $value = get_site_setting($db, $key, $default);
    $value = is_string($value) ? trim($value) : '';

    return $value !== '' ? $value : $default;
}

