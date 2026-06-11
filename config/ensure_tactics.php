<?php
require_once __DIR__ . '/ensure_site_users.php';
require_once __DIR__ . '/runtime_flags.php';

/**
 * Тактический планшет — комнаты для совместного рисования.
 *
 * @param Database $db
 */
function ensure_tactics_table($db) {
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
        'CREATE TABLE IF NOT EXISTS tactics_rooms (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            public_id VARCHAR(8) NOT NULL,
            user_id INT UNSIGNED NULL,
            title VARCHAR(120) NOT NULL,
            visibility ENUM(\'open\', \'closed\') NOT NULL DEFAULT \'open\',
            password_hash VARCHAR(255) NULL,
            room_data JSON NOT NULL,
            revision INT UNSIGNED NOT NULL DEFAULT 1,
            last_active_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_public_id (public_id),
            INDEX idx_user (user_id),
            INDEX idx_visibility_active (visibility, last_active_at),
            INDEX idx_updated (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

/**
 * Привязка карт тактики к игре и режиму боя (админка).
 *
 * @param Database $db
 */
function ensure_tactics_map_assignments_table($db) {
    static $ensured = false;
    if ($ensured) {
        return;
    }
    $ensured = true;

    $pdo = $db->getConnection();
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS tactics_map_assignments (
            map_code VARCHAR(128) NOT NULL,
            game VARCHAR(16) NOT NULL,
            battle_mode VARCHAR(32) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (map_code, game, battle_mode),
            INDEX idx_tactics_map_assign_game_mode (game, battle_mode)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

/**
 * Realtime tables for tactics presence/events (always safe to run).
 *
 * @param Database $db
 */
function ensure_tactics_realtime_tables($db) {
    static $ensured = false;
    if ($ensured) {
        return;
    }
    $ensured = true;

    $pdo = $db->getConnection();
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS tactics_room_presence (
            public_id VARCHAR(8) NOT NULL,
            client_id VARCHAR(64) NOT NULL,
            nickname VARCHAR(32) NOT NULL DEFAULT \'Guest\',
            cursor_slide_id VARCHAR(48) NULL,
            cursor_payload JSON NULL,
            cursor_updated_at TIMESTAMP(3) NULL,
            last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (public_id, client_id),
            INDEX idx_room_seen (public_id, last_seen_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS tactics_room_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            public_id VARCHAR(8) NOT NULL,
            client_id VARCHAR(64) NOT NULL,
            event_type VARCHAR(16) NOT NULL,
            slide_id VARCHAR(48) NOT NULL DEFAULT \'\',
            payload JSON NOT NULL,
            created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            INDEX idx_room_events (public_id, id),
            INDEX idx_room_created (public_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS tactics_room_chat (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            public_id VARCHAR(8) NOT NULL,
            client_id VARCHAR(64) NOT NULL,
            nickname VARCHAR(32) NOT NULL DEFAULT \'Guest\',
            message VARCHAR(500) NOT NULL,
            created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            INDEX idx_room_chat (public_id, id),
            INDEX idx_room_chat_created (public_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}
