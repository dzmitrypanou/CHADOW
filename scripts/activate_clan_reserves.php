<?php

if (php_sapi_name() !== 'cli') {
    fwrite(STDERR, "CLI only\n");
    exit(1);
}

require_once __DIR__ . '/../includes/cli_env.php';
chadow_load_cli_env();

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/ensure_clan_reserves.php';
require_once __DIR__ . '/../includes/clan_reserve_helpers.php';
require_once __DIR__ . '/../includes/clan_reserve_service.php';

$argv = $argv ?? [];
$loop = in_array('--loop', $argv, true);
$interval = 60;

$db = Database::getInstance();
ensure_clan_reserves_tables($db);
chadow_sync_reserves_cli_env($db);
$service = new ClanReserveService($db);

do {
    try {
        $summary = $service->runDueRules(new DateTimeImmutable('now', new DateTimeZone('UTC')));
        $triggered = (int) ($summary['triggered'] ?? 0);
        if ($triggered > 0 || !empty($summary['errors'])) {
            fwrite(
                STDERR,
                gmdate('c')
                . ' clan_reserves checked=' . (int) ($summary['checked'] ?? 0)
                . ' triggered=' . $triggered
                . ' success=' . (int) ($summary['success'] ?? 0)
                . ' errors=' . count($summary['errors'] ?? [])
                . "\n"
            );
        }
    } catch (Throwable $e) {
        fwrite(STDERR, gmdate('c') . ' clan_reserves error=' . $e->getMessage() . "\n");
        if (!$loop) {
            exit(1);
        }
    }

    if (!$loop) {
        exit(0);
    }

    sleep($interval);
} while (true);
