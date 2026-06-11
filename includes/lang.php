<?php
/**
 * Простая поддержка локали для публичной части.
 *
 * Логика:
 * - /en/... => lang = 'en'
 * - всё остальное => lang = 'ru'
 *
 * Для тестов можно также передавать query-параметр lang=en|ru.
 */
function abs_detect_lang(): string
{
    $path = parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
    $path = is_string($path) ? $path : '';
    $path = rtrim($path, '/');

    if ($path === '/en' || preg_match('#^/en(?:/|$)#', $path)) {
        return 'en';
    }

    // Query-параметр оставляем только как fallback для тестов.
    // Путь имеет приоритет, чтобы /en не переключался на ru из-за ?lang=ru.
    $q = $_GET['lang'] ?? '';
    $q = is_string($q) ? strtolower(trim($q)) : '';
    if ($q === 'en' || $q === 'ru') {
        return $q;
    }

    return 'ru';
}

/**
 * Язык для API-запросов: путь, query lang=, тело JSON (lang) или Referer с /en/.
 */
function abs_resolve_lang(?array $input = null): string
{
    if (is_array($input)) {
        $fromBody = strtolower(trim((string) ($input['lang'] ?? '')));
        if ($fromBody === 'en' || $fromBody === 'ru') {
            return $fromBody;
        }
    }

    $lang = abs_detect_lang();
    if ($lang === 'en') {
        return 'en';
    }

    $referer = (string) ($_SERVER['HTTP_REFERER'] ?? '');
    if ($referer !== '') {
        $refPath = parse_url($referer, PHP_URL_PATH);
        if (is_string($refPath) && ($refPath === '/en' || preg_match('#^/en(?:/|$)#', $refPath))) {
            return 'en';
        }
    }

    return $lang;
}

/**
 * Возвращает slug текущего публичного пути без языкового префикса.
 * Примеры:
 * - / => ''
 * - /about => 'about'
 * - /en/about => 'about'
 */
function abs_extract_slug_from_request(): string
{
    $path = parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
    if (!is_string($path) || $path === '') {
        return '';
    }
    $path = rtrim($path, '/');

    // Убираем /en префикс
    if ($path === '/en') {
        return '';
    }
    if (preg_match('#^/en/(.+)$#', $path, $m)) {
        return trim($m[1], '/');
    }

    $slug = trim($path, '/');
    if ($slug === '') {
        return '';
    }
    // CMS-страницы (один сегмент) и сервисы вроде services/abs
    if (!preg_match('/^[a-z0-9\-]+(?:\/[a-z0-9\-]+)*$/i', $slug)) {
        return '';
    }
    return $slug;
}

function abs_build_lang_href(string $lang, string $slug): string
{
    $lang = $lang === 'en' ? 'en' : 'ru';
    $slug = trim($slug, '/');
    if ($slug === '') {
        return $lang === 'en' ? '/en' : '/';
    }
    return $lang === 'en' ? ('/en/' . $slug) : ('/' . $slug);
}

/**
 * Заголовки вкладки для обеих локалей (до подключения site_header.php).
 */
function abs_set_page_titles(string $ru, string $en): void
{
    global $pageTitle, $pageTitleRu, $pageTitleEn;
    $pageTitleRu = $ru;
    $pageTitleEn = $en;
    $lang = abs_detect_lang();
    $pageTitle = $lang === 'en' ? $en : $ru;
}
