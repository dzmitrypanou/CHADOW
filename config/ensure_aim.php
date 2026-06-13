<?php
require_once __DIR__ . '/ensure_site_users.php';
require_once __DIR__ . '/runtime_flags.php';

/**
 * Таблица результатов аим-тренажёров.
 *
 * @param Database $db
 */
function ensure_aim_scores_table($db) {
    static $ensured = false;
    if ($ensured) {
        return;
    }
    $ensured = true;

    if (chadow_runtime_schema_checks_enabled()) {
        ensure_site_users_table($db);
    }

    $pdo = $db->getConnection();
    try {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS aim_scores (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                trainer ENUM(\'flick\', \'tracking\', \'reaction\', \'lead\', \'gridshot\') NOT NULL,
                player_name VARCHAR(32) NOT NULL,
                user_id INT UNSIGNED NULL,
                score INT NOT NULL,
                grade VARCHAR(4) NOT NULL,
                metrics JSON NULL,
                ip_hash CHAR(64) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_trainer_score (trainer, score DESC),
                INDEX idx_trainer_player (trainer, player_name),
                INDEX idx_ip_created (ip_hash, created_at),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    } catch (Throwable $e) {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS aim_scores (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                trainer ENUM(\'flick\', \'tracking\', \'reaction\', \'lead\', \'gridshot\') NOT NULL,
                player_name VARCHAR(32) NOT NULL,
                user_id INT UNSIGNED NULL,
                score INT NOT NULL,
                grade VARCHAR(4) NOT NULL,
                metrics TEXT NULL,
                ip_hash CHAR(64) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_trainer_score (trainer, score DESC),
                INDEX idx_trainer_player (trainer, player_name),
                INDEX idx_ip_created (ip_hash, created_at),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    aim_ensure_scores_foreign_key($pdo);
    aim_ensure_scores_grade_column($pdo);
}

function aim_ensure_scores_grade_column($pdo): void {
    try {
        $pdo->exec('ALTER TABLE aim_scores MODIFY COLUMN grade VARCHAR(4) NOT NULL');
    } catch (Throwable $e) {
        // Column may already be the right type.
    }
}

function aim_ensure_scores_foreign_key($pdo): void {
    try {
        $stmt = $pdo->query(
            "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'aim_scores'
               AND CONSTRAINT_NAME = 'fk_aim_scores_user'"
        );
        if ($stmt && (int) $stmt->fetchColumn() > 0) {
            return;
        }
        $usersStmt = $pdo->query("SHOW TABLES LIKE 'site_users'");
        if (!$usersStmt || !$usersStmt->fetchColumn()) {
            return;
        }
        $pdo->exec(
            'ALTER TABLE aim_scores
             ADD CONSTRAINT fk_aim_scores_user
             FOREIGN KEY (user_id) REFERENCES site_users(id) ON DELETE SET NULL'
        );
    } catch (Throwable $e) {
        // FK is optional; table works without it for guest scores.
    }
}
