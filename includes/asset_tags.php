<?php

if (!function_exists('chadow_emit_async_stylesheet')) {
    function chadow_emit_async_stylesheet(string $href): void
    {
        $hrefEsc = htmlspecialchars($href, ENT_QUOTES, 'UTF-8');
        echo '<link rel="stylesheet" href="' . $hrefEsc . '" media="print" onload="this.media=\'all\'">' . "\n";
        echo '<noscript><link rel="stylesheet" href="' . $hrefEsc . '"></noscript>' . "\n";
    }
}

if (!function_exists('chadow_emit_preload')) {
    function chadow_emit_preload(string $href, string $as, string $type = ''): void
    {
        $hrefEsc = htmlspecialchars($href, ENT_QUOTES, 'UTF-8');
        $asEsc = htmlspecialchars($as, ENT_QUOTES, 'UTF-8');
        echo '<link rel="preload" href="' . $hrefEsc . '" as="' . $asEsc . '"';
        if ($type !== '') {
            echo ' type="' . htmlspecialchars($type, ENT_QUOTES, 'UTF-8') . '"';
        }
        echo '>' . "\n";
    }
}

if (!function_exists('chadow_emit_inline_landing_critical_css')) {
    function chadow_emit_inline_landing_critical_css(): void
    {
        static $css = null;
        if ($css === null) {
            $path = __DIR__ . '/../css/landing-critical.min.css';
            $raw = is_readable($path) ? file_get_contents($path) : false;
            $css = is_string($raw) ? trim($raw) : '';
        }
        if ($css === '') {
            return;
        }
        echo '<style id="landing-critical">' . $css . '</style>' . "\n";
    }
}
