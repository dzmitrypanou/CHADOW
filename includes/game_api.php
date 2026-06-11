<?php

require_once __DIR__ . '/../config/ensure_site_settings.php';

/**
 * @param mixed $db
 */
function game_api_db($db = null) {
    if ($db !== null) {
        return $db;
    }

    require_once __DIR__ . '/../config/database.php';

    return Database::getInstance();
}

/**
 * @param mixed $db
 */
function game_api_wg_application_id($db = null): string {
    $fromEnv = getenv('WG_APPLICATION_ID');
    if (is_string($fromEnv) && trim($fromEnv) !== '') {
        return trim($fromEnv);
    }

    $fromDb = get_site_setting(game_api_db($db), 'wg_application_id', '');

    return is_string($fromDb) ? trim($fromDb) : '';
}

/**
 * @param mixed $db
 */
function game_api_lesta_application_id($db = null): string {
    $fromEnv = getenv('LESTA_APPLICATION_ID');
    if (is_string($fromEnv) && trim($fromEnv) !== '') {
        return trim($fromEnv);
    }

    $fromDb = get_site_setting(game_api_db($db), 'lesta_application_id', '');

    return is_string($fromDb) ? trim($fromDb) : '';
}

/**
 * @param mixed $db
 */
function game_api_application_id_for_realm(string $realm, $db = null): string {
    require_once __DIR__ . '/tanki_client.php';
    $realm = TankiClient::normalizeRealm($realm);

    if ($realm === TankiClient::REALM_RU) {
        return game_api_lesta_application_id($db);
    }

    return game_api_wg_application_id($db);
}

/**
 * @param mixed $db
 */
function game_api_is_configured_for_realm(string $realm, $db = null): bool {
    return game_api_application_id_for_realm($realm, $db) !== '';
}
