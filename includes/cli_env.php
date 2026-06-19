<?php

function chadow_load_cli_env(): void {
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;

    $paths = [
        dirname(__DIR__) . '/config/cli_env.php',
        '/etc/chadow/env',
    ];

    foreach ($paths as $path) {
        if (!is_string($path) || $path === '' || !is_file($path)) {
            continue;
        }

        if (str_ends_with(strtolower($path), '.php')) {
            require $path;
            continue;
        }

        $lines = @file($path, FILE_IGNORE_NEW_LINES);
        if (!is_array($lines)) {
            continue;
        }

        foreach ($lines as $line) {
            $line = trim((string) $line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            if (!str_contains($line, '=')) {
                continue;
            }
            [$name, $value] = explode('=', $line, 2);
            $name = trim($name);
            if ($name === '' || getenv($name) !== false) {
                continue;
            }
            putenv($name . '=' . trim($value, " \t\"'"));
        }
    }
}

function chadow_putenv_if_unset(string $name, string $value): void {
    if ($name === '' || $value === '' || getenv($name) !== false) {
        return;
    }

    putenv($name . '=' . $value);
    $_ENV[$name] = $value;
}
