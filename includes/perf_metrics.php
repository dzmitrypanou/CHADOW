<?php

require_once __DIR__ . '/../config/runtime_flags.php';

if (!function_exists('chadow_perf_start')) {
    function chadow_perf_start(string $scope): void
    {
        if (!chadow_perf_logging_enabled()) {
            return;
        }

        $GLOBALS['__chadow_perf'][$scope] = [
            'start' => microtime(true),
            'sql' => 0,
            'sql_time_ms' => 0.0,
        ];
    }
}

if (!function_exists('chadow_perf_track_sql')) {
    function chadow_perf_track_sql(float $elapsedMs): void
    {
        if (!chadow_perf_logging_enabled()) {
            return;
        }

        if (empty($GLOBALS['__chadow_perf']) || !is_array($GLOBALS['__chadow_perf'])) {
            return;
        }

        foreach ($GLOBALS['__chadow_perf'] as $scope => $data) {
            if (!is_array($data)) {
                continue;
            }
            $GLOBALS['__chadow_perf'][$scope]['sql'] = (int) ($data['sql'] ?? 0) + 1;
            $GLOBALS['__chadow_perf'][$scope]['sql_time_ms'] = (float) ($data['sql_time_ms'] ?? 0) + $elapsedMs;
        }
    }
}

if (!function_exists('chadow_perf_finish')) {
    function chadow_perf_finish(string $scope, array $extra = []): void
    {
        if (!chadow_perf_logging_enabled()) {
            return;
        }

        $perf = $GLOBALS['__chadow_perf'][$scope] ?? null;
        if (!is_array($perf) || !isset($perf['start'])) {
            return;
        }

        $durationMs = (microtime(true) - (float) $perf['start']) * 1000;
        $payload = array_merge([
            'scope' => $scope,
            'duration_ms' => round($durationMs, 2),
            'sql_count' => (int) ($perf['sql'] ?? 0),
            'sql_time_ms' => round((float) ($perf['sql_time_ms'] ?? 0), 2),
            'uri' => $_SERVER['REQUEST_URI'] ?? '',
            'method' => $_SERVER['REQUEST_METHOD'] ?? '',
        ], $extra);

        error_log('[chadow_perf] ' . json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        unset($GLOBALS['__chadow_perf'][$scope]);
    }
}
