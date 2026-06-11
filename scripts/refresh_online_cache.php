<?php
/**
 * Фоновое обновление кэша онлайна и графиков.
 *
 * Рекомендуется: systemd-сервис chadow-online-cache (--loop, каждые 15 с).
 *   sudo deploy/systemd/install-online-cache-service.sh
 *
 * Разовый запуск:  php scripts/refresh_online_cache.php
 * Принудительно:   php scripts/refresh_online_cache.php --force
 * Постоянный цикл: php scripts/refresh_online_cache.php --loop
 *
 * Запасной вариант — cron каждые 15 с или URL-cron /api/cron_refresh_online.php?token=...
 */

if (php_sapi_name() !== 'cli') {
    fwrite(STDERR, "CLI only\n");
    exit(1);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/online_service.php';

$argv = $argv ?? [];
$loop = in_array('--loop', $argv, true);
$force = in_array('--force', $argv, true);
$interval = OnlineService::BACKGROUND_REFRESH_INTERVAL_SECONDS;
$service = new OnlineService(Database::getInstance());

do {
    $result = $service->runScheduledRefresh($force);
    $force = false;

    if (!empty($result['skipped'])) {
        fwrite(STDERR, gmdate('c') . " online_cache skipped fetched_at=" . ($result['fetched_at'] ?? '-') . "\n");
    } else {
        $status = !empty($result['success']) ? 'ok' : (string) ($result['error'] ?? 'error');
        $fetchedAt = (string) ($result['fetched_at'] ?? '-');
        $rateLimited = !empty($result['rate_limited']) ? ' rate_limited' : '';
        fwrite(STDERR, gmdate('c') . " online_cache refresh={$status} fetched_at={$fetchedAt}{$rateLimited}\n");
    }

    if (!$loop) {
        exit(!empty($result['success']) ? 0 : 1);
    }

    sleep($interval);
} while (true);
