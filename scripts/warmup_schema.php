<?php
if (php_sapi_name() !== 'cli') {
    fwrite(STDERR, "CLI only\n");
    exit(1);
}

putenv('CHADOW_RUNTIME_SCHEMA_CHECKS=1');
putenv('CHADOW_RUNTIME_MERGE_DICTIONARY=1');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/ensure_admin_users.php';
require_once __DIR__ . '/../config/ensure_dictionary_labels.php';
require_once __DIR__ . '/../config/ensure_tank_dictionary.php';
require_once __DIR__ . '/../config/ensure_cms_pages.php';
require_once __DIR__ . '/../config/ensure_site_menu.php';
require_once __DIR__ . '/../config/ensure_wgsrt.php';
require_once __DIR__ . '/../config/ensure_site_settings.php';
require_once __DIR__ . '/../config/ensure_login_throttle.php';
require_once __DIR__ . '/../config/ensure_user_login_throttle.php';
require_once __DIR__ . '/../config/ensure_site_users.php';
require_once __DIR__ . '/../config/ensure_online_cache.php';
require_once __DIR__ . '/../config/ensure_map_dictionary.php';
require_once __DIR__ . '/../config/ensure_recruiting.php';
require_once __DIR__ . '/../config/ensure_brackets.php';
require_once __DIR__ . '/../config/ensure_tactics.php';
require_once __DIR__ . '/../config/ensure_aim.php';
require_once __DIR__ . '/../config/vehicle_code.php';

$db = Database::getInstance();
ensure_admin_users_table($db);
ensure_dictionary_labels_tables($db);
ensure_tank_dictionary_table($db);
merge_duplicate_vehicle_codes($db);
ensure_cms_pages_table($db);
ensure_site_menu_table($db);
ensure_wgsrt_grades_lang_columns($db);
ensure_site_settings_table($db);
ensure_admin_login_throttle_table($db);
ensure_site_login_throttle_table($db);
ensure_site_users_table($db);
ensure_wot_online_cache_table($db);
ensure_map_dictionary_table($db);
ensure_recruiting_posts_table($db);
ensure_brackets_table($db);
ensure_tactics_table($db);
ensure_tactics_map_assignments_table($db);
ensure_aim_scores_table($db);

fwrite(STDOUT, "Schema warmup completed\n");
