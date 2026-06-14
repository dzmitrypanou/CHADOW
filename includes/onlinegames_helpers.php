<?php

function onlinegames_build_href(string $lang): string {
    if (!function_exists('abs_build_lang_href')) {
        require_once __DIR__ . '/lang.php';
    }

    return abs_build_lang_href($lang, 'services/onlinegames');
}

function onlinegames_build_home_href(string $lang): string {
    if (!function_exists('abs_build_lang_href')) {
        require_once __DIR__ . '/lang.php';
    }

    $base = abs_build_lang_href($lang, '');
    if ($base === '/' || $base === '/en' || $base === '/en/') {
        return rtrim($base, '/') . '#online-games';
    }

    return $base . '#online-games';
}

function onlinegames_meta(string $lang = 'ru'): array {
    if ($lang === 'en') {
        return [
            'title' => 'Online Games',
            'desc' => 'Play with friends in real time — board games and more.',
        ];
    }

    return [
        'title' => 'Онлайн игры',
        'desc' => 'Играйте с друзьями в реальном времени — настольные игры и не только.',
    ];
}
