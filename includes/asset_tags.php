<?php

if (!function_exists('chadow_emit_async_stylesheet')) {
    function chadow_emit_async_stylesheet(string $href): void
    {
        $hrefEsc = htmlspecialchars($href, ENT_QUOTES, 'UTF-8');
        echo '<link rel="stylesheet" href="' . $hrefEsc . '" media="print" onload="this.media=\'all\'">' . "\n";
        echo '<noscript><link rel="stylesheet" href="' . $hrefEsc . '"></noscript>' . "\n";
    }
}
