<?php

function chadow_env_flag(string $name, bool $default = false): bool
{
    $raw = getenv($name);
    if (!is_string($raw)) {
        return $default;
    }

    $value = strtolower(trim($raw));
    if ($value === '') {
        return $default;
    }

    return in_array($value, ['1', 'true', 'yes', 'on'], true);
}

function chadow_runtime_schema_checks_enabled(): bool
{
    static $enabled = null;
    if ($enabled !== null) {
        return $enabled;
    }

    if (PHP_SAPI === 'cli') {
        $enabled = true;
        return $enabled;
    }

    $enabled = chadow_env_flag('CHADOW_RUNTIME_SCHEMA_CHECKS', false);
    return $enabled;
}

function chadow_allow_runtime_dictionary_merge(): bool
{
    return chadow_runtime_schema_checks_enabled() && chadow_env_flag('CHADOW_RUNTIME_MERGE_DICTIONARY', false);
}

function chadow_perf_logging_enabled(): bool
{
    static $enabled = null;
    if ($enabled !== null) {
        return $enabled;
    }

    $enabled = chadow_env_flag('CHADOW_PERF_LOG', false);
    return $enabled;
}
