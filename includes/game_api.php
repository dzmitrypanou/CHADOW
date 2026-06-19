<?php

require_once __DIR__ . '/../config/ensure_site_settings.php';

function game_api_db($db = null) {
    if ($db !== null) {
        return $db;
    }

    require_once __DIR__ . '/../config/database.php';

    return Database::getInstance();
}

function game_api_wg_application_id($db = null): string {
    $fromEnv = getenv('WG_APPLICATION_ID');
    if (is_string($fromEnv) && trim($fromEnv) !== '') {
        return trim($fromEnv);
    }

    $fromDb = get_site_setting(game_api_db($db), 'wg_application_id', '');

    return is_string($fromDb) ? trim($fromDb) : '';
}

function game_api_lesta_application_id($db = null): string {
    $fromEnv = getenv('LESTA_APPLICATION_ID');
    if (is_string($fromEnv) && trim($fromEnv) !== '') {
        return trim($fromEnv);
    }

    $fromDb = get_site_setting(game_api_db($db), 'lesta_application_id', '');

    return is_string($fromDb) ? trim($fromDb) : '';
}

function game_api_wg_application_id_from_db($db = null): string {
    $fromDb = get_site_setting(game_api_db($db), 'wg_application_id', '');

    return is_string($fromDb) ? trim($fromDb) : '';
}

function game_api_lesta_application_id_from_db($db = null): string {
    $fromDb = get_site_setting(game_api_db($db), 'lesta_application_id', '');

    return is_string($fromDb) ? trim($fromDb) : '';
}

function game_api_wg_application_id_resolved($db = null): string {
    $fromDb = game_api_wg_application_id_from_db($db);
    if ($fromDb !== '') {
        return $fromDb;
    }

    return game_api_wg_application_id($db);
}

function game_api_lesta_application_id_resolved($db = null): string {
    $fromDb = game_api_lesta_application_id_from_db($db);
    if ($fromDb !== '') {
        return $fromDb;
    }

    return game_api_lesta_application_id($db);
}

function game_api_application_id_for_realm(string $realm, $db = null): string {
    require_once __DIR__ . '/tanki_client.php';
    $realm = TankiClient::normalizeRealm($realm);

    if ($realm === TankiClient::REALM_RU) {
        return game_api_lesta_application_id($db);
    }

    return game_api_wg_application_id($db);
}

function game_api_application_id_for_realm_resolved(string $realm, $db = null): string {
    require_once __DIR__ . '/tanki_client.php';
    $realm = TankiClient::normalizeRealm($realm);

    if ($realm === TankiClient::REALM_RU) {
        return game_api_lesta_application_id_resolved($db);
    }

    return game_api_wg_application_id_resolved($db);
}

function game_api_is_configured_for_realm(string $realm, $db = null): bool {
    return game_api_application_id_for_realm($realm, $db) !== '';
}

function game_api_ru_publisher_name(string $lang = 'ru'): string {
    return 'LESTA';
}

function game_api_ru_api_label(string $lang = 'ru'): string {
    return 'LESTA API';
}

function game_api_ru_publisher_badge_span(string $lang = 'ru'): string {
    $ru = game_api_ru_publisher_name('ru');
    $en = game_api_ru_publisher_name('en');
    $label = $lang === 'en' ? $en : $ru;

    return '<span class="project-card-badge project-card-badge--lesta" data-badge-custom="1"'
        . ' data-label-ru="' . htmlspecialchars($ru, ENT_QUOTES, 'UTF-8') . '"'
        . ' data-label-en="' . htmlspecialchars($en, ENT_QUOTES, 'UTF-8') . '">'
        . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</span>';
}
