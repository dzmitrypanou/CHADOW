#!/usr/bin/env php
<?php
/**
 * Удаление гостевых тактических комнат без активности N дней.
 * Cron (ежедневно): php /path/to/scripts/tactics_purge_guest_rooms.php
 */

require_once __DIR__ . '/../includes/user_bootstrap.php';
require_once __DIR__ . '/../config/ensure_tactics.php';
require_once __DIR__ . '/../includes/tactics_helpers.php';

ensure_tactics_table($userDb);

$days = TACTICS_GUEST_ROOM_INACTIVE_DAYS;
if (isset($argv[1]) && is_numeric($argv[1])) {
    $days = max(1, (int) $argv[1]);
}

$deleted = tactics_purge_stale_guest_rooms($userDb, $days, false);
fwrite(STDOUT, "Deleted {$deleted} stale guest tactics room(s).\n");
